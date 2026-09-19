import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSettings: vi.fn(),
  runAITranslateTask: vi.fn(),
  sendToAllWindows: vi.fn(),
}))

vi.mock('electron', () => ({
  session: { defaultSession: { fetch: mocks.fetch } },
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: { get: mocks.getSettings },
}))

vi.mock('../system/event-bus', () => ({
  sendToAllWindows: mocks.sendToAllWindows,
}))

vi.mock('./ai-pipeline', () => ({
  runAITranslateTask: mocks.runAITranslateTask,
}))

import {
  getTranslationConfigFingerprint,
  runConfiguredTranslationTask,
} from './translation-provider'

function mockSettings(provider: 'ai' | 'google' | 'microsoft') {
  mocks.getSettings.mockReturnValue({
    translation: { provider },
    ai: {
      provider: 'openai',
      apiKey: 'secret-key',
      apiKeys: { openai: 'secret-key' },
      baseUrl: '',
      model: 'test-model',
      translationPrompt: '',
    },
  })
}

describe('configured translation provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettings('ai')
  })

  it('delegates AI translation to the existing pipeline', async () => {
    mocks.runAITranslateTask.mockResolvedValue({
      success: true,
      translation: '你好',
    })
    const payload = { content: 'hello', targetLanguage: 'zh-CN' }

    await expect(runConfiguredTranslationTask(payload)).resolves.toEqual({
      success: true,
      translation: '你好',
    })
    expect(mocks.runAITranslateTask).toHaveBeenCalledWith(payload, undefined)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('uses the Immersive Translate compatible Google request', async () => {
    mockSettings('google')
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify([['<pre>你好世界</pre>', 'en']]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await runConfiguredTranslationTask({
      content: 'Hello world',
      targetLanguage: 'zh-CN',
    })

    expect(result.translation).toBe('你好世界')
    const [requestUrl, init] = mocks.fetch.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.origin + url.pathname).toBe(
      'https://translate.googleapis.com/translate_a/t',
    )
    expect(url.searchParams.get('sl')).toBe('auto')
    expect(url.searchParams.get('tl')).toBe('zh-CN')
    expect(url.searchParams.get('tk')).toMatch(/^\d+\.\d+$/)
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(new URLSearchParams(String(init.body)).get('q')).toBe(
      '<pre>Hello world</pre>',
    )
  })

  it('uses the current Microsoft Edge endpoint and maps Chinese scripts', async () => {
    mockSettings('microsoft')
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          { translations: [{ text: '你好世界', to: 'zh-Hans' }] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await runConfiguredTranslationTask({
      content: 'Hello world',
      targetLanguage: 'zh-CN',
    })

    expect(result.translation).toBe('你好世界')
    const [requestUrl, init] = mocks.fetch.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.origin + url.pathname).toBe(
      'https://edge.microsoft.com/translate/translatetext',
    )
    expect(url.searchParams.get('from')).toBe('')
    expect(url.searchParams.get('to')).toBe('zh-Hans')
    expect(url.searchParams.get('isEnterpriseClient')).toBe('false')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['Hello world']),
    })
  })

  it('returns a useful message for free-service rate limits', async () => {
    mockSettings('google')
    mocks.fetch.mockResolvedValue(new Response('', { status: 429 }))

    await expect(
      runConfiguredTranslationTask({
        content: 'Hello world',
        targetLanguage: 'zh-CN',
      }),
    ).rejects.toThrow('Google 翻译请求过于频繁，请稍后重试')
  })

  it('hashes configuration fingerprints instead of persisting API keys', () => {
    const aiFingerprint = getTranslationConfigFingerprint()
    expect(aiFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(aiFingerprint).not.toContain('secret-key')

    mockSettings('google')
    expect(getTranslationConfigFingerprint()).not.toBe(aiFingerprint)
  })
})
