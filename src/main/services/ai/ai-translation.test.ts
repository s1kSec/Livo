import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntryAITranslationSession } from '../../../shared/types'
import { translateEntrySegments } from './ai-translation'

const getDbMock = vi.hoisted(() => vi.fn())
const getTranslationConfigFingerprintMock = vi.hoisted(() => vi.fn())
const getTranslationProviderModelMock = vi.hoisted(() => vi.fn())
const runConfiguredTranslationTaskMock = vi.hoisted(() => vi.fn())

vi.mock('../../database', () => ({
  getDb: getDbMock,
}))

vi.mock('./translation-provider', () => ({
  getTranslationConfigFingerprint: getTranslationConfigFingerprintMock,
  getTranslationProviderModel: getTranslationProviderModelMock,
  runConfiguredTranslationTask: runConfiguredTranslationTaskMock,
}))

function makeSession(
  overrides: Partial<EntryAITranslationSession> = {},
): EntryAITranslationSession {
  return {
    id: 'session-1',
    entryId: 'entry-1',
    targetLanguage: 'zh-CN',
    status: 'running',
    segments: [],
    configFingerprint: 'fingerprint-a',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function mockDb(initialSession: EntryAITranslationSession | null = null) {
  let session = initialSession
  const repo = {
    getLatestSessionByEntryId: vi.fn(() => session),
    createSession: vi.fn((input) => {
      session = makeSession({
        entryId: input.entryId,
        targetLanguage: input.targetLanguage,
        status: input.status,
        segments: input.segments,
        model: input.model,
        configFingerprint: input.configFingerprint,
      })
      return session
    }),
    updateSession: vi.fn((_id, updates) => {
      if (!session) return null
      session = { ...session, ...updates, updatedAt: Date.now() }
      return session
    }),
    getSessionById: vi.fn(() => session),
  }
  getDbMock.mockReturnValue({ aiTranslationSessions: repo })
  return repo
}

describe('translateEntrySegments', () => {
  beforeEach(() => {
    getDbMock.mockReset()
    getTranslationConfigFingerprintMock.mockReset()
    getTranslationProviderModelMock.mockReset()
    runConfiguredTranslationTaskMock.mockReset()
    getTranslationConfigFingerprintMock.mockReturnValue('fingerprint-a')
    getTranslationProviderModelMock.mockReturnValue('test-model')
  })

  it('translates runnable paragraphs and persists segment state', async () => {
    const repo = mockDb()
    runConfiguredTranslationTaskMock.mockResolvedValue({
      success: true,
      translation: '你好世界',
    })

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world', 'x'],
      targetLanguage: 'zh-CN',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.translatedParagraphs).toEqual(['你好世界', ''])
    expect(result.errorMap).toEqual({})
    expect(result.session.status).toBe('succeeded')
    expect(result.session.segments[0]).toMatchObject({
      index: 0,
      translatedText: '你好世界',
      status: 'succeeded',
    })
    expect(result.session.segments[1]).toMatchObject({
      index: 1,
      translatedText: '',
      status: 'skipped',
    })
    expect(runConfiguredTranslationTaskMock).toHaveBeenCalledTimes(1)
    expect(repo.createSession).toHaveBeenCalledTimes(1)
  })

  it('retries requested indexes while preserving existing translations', async () => {
    mockDb(
      makeSession({
        segments: [
          {
            index: 0,
            sourceText: 'hello world',
            translatedText: '旧翻译',
            status: 'succeeded',
          },
          {
            index: 1,
            sourceText: 'second paragraph',
            translatedText: '',
            status: 'failed',
            errorMessage: 'old error',
          },
        ],
      }),
    )
    runConfiguredTranslationTaskMock.mockResolvedValue({
      success: true,
      translation: '第二段',
    })

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world', 'second paragraph'],
      targetLanguage: 'zh-CN',
      indexes: [1],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.translatedParagraphs).toEqual(['旧翻译', '第二段'])
    expect(result.errorMap).toEqual({})
    expect(runConfiguredTranslationTaskMock).toHaveBeenCalledTimes(1)
    expect(runConfiguredTranslationTaskMock).toHaveBeenCalledWith({
      content: 'second paragraph',
      targetLanguage: 'zh-CN',
    })
  })

  it('marks the session config_changed when settings change during translation', async () => {
    mockDb()
    getTranslationConfigFingerprintMock
      .mockReturnValueOnce('fingerprint-a')
      .mockReturnValue('fingerprint-b')

    const result = await translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world'],
      targetLanguage: 'zh-CN',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.session).toMatchObject({
      status: 'config_changed',
      errorCode: 'config_changed',
      errorMessage: '翻译配置已变更，翻译已中止',
      configFingerprint: 'fingerprint-a',
      model: 'test-model',
    })
    expect(result.errorMap).toEqual({
      0: '翻译配置已变更，翻译已中止',
    })
    expect(result.session.segments[0]).toMatchObject({
      index: 0,
      status: 'failed',
      errorMessage: '翻译配置已变更，翻译已中止',
    })
    expect(runConfiguredTranslationTaskMock).not.toHaveBeenCalled()
  })

  it('discards a result when the provider changes during the request', async () => {
    mockDb()
    let fingerprint = 'fingerprint-a'
    getTranslationConfigFingerprintMock.mockImplementation(() => fingerprint)

    let resolveTranslation: (value: {
      success: true
      translation: string
    }) => void = () => undefined
    runConfiguredTranslationTaskMock.mockReturnValue(
      new Promise((resolve) => {
        resolveTranslation = resolve
      }),
    )

    const pending = translateEntrySegments({
      entryId: 'entry-1',
      paragraphs: ['hello world'],
      targetLanguage: 'zh-CN',
    })
    await vi.waitFor(() => {
      expect(runConfiguredTranslationTaskMock).toHaveBeenCalledTimes(1)
    })

    fingerprint = 'fingerprint-b'
    resolveTranslation({ success: true, translation: '不应缓存的翻译' })
    const result = await pending

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.translatedParagraphs).toEqual([''])
    expect(result.errorMap).toEqual({
      0: '翻译配置已变更，翻译已中止',
    })
    expect(result.session).toMatchObject({
      status: 'config_changed',
      configFingerprint: 'fingerprint-a',
      model: 'test-model',
    })
  })
})
