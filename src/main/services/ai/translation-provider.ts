import { createHash } from 'node:crypto'
import { session } from 'electron'

import type { TranslationProviderId } from '../../../shared/types'
import { settingsProvider } from '../system/settings-provider'
import type { TaskRunContext } from '../system/task-runner'
import type { AiTranslateTaskPayload } from '../system/task-contracts'
import { sendToAllWindows } from '../system/event-bus'
import { runAITranslateTask, type AITranslateResult } from './ai-pipeline'
import { normalizeAIError } from './provider-protocol'

const GOOGLE_TRANSLATE_URL =
  'https://translate.googleapis.com/translate_a/t?anno=3&client=te&v=1.0&format=html'
const GOOGLE_TRANSLATE_TKK = '448487.932609646'
const MICROSOFT_TRANSLATE_URL =
  'https://edge.microsoft.com/translate/translatetext'
const TRANSLATION_REQUEST_TIMEOUT_MS = 20_000
const TRANSLATION_PROVIDER_IMPLEMENTATION_VERSION = 1

function getProvider(): TranslationProviderId {
  return settingsProvider.get().translation?.provider ?? 'ai'
}

export function getTranslationConfigFingerprint(): string {
  const settings = settingsProvider.get()
  const provider = settings.translation?.provider ?? 'ai'
  const config =
    provider === 'ai'
      ? {
          provider,
          implementationVersion: TRANSLATION_PROVIDER_IMPLEMENTATION_VERSION,
          ai: {
            provider: settings.ai.provider,
            apiKey:
              settings.ai.apiKeys?.[settings.ai.provider] ?? settings.ai.apiKey,
            baseUrl: settings.ai.baseUrl ?? '',
            model: settings.ai.model,
            enableSystemPrompt: settings.ai.enableSystemPrompt ?? false,
            systemPromptTemplate: settings.ai.systemPromptTemplate ?? '',
            translationPrompt: settings.ai.translationPrompt ?? '',
          },
        }
      : {
          provider,
          implementationVersion: TRANSLATION_PROVIDER_IMPLEMENTATION_VERSION,
        }

  return createHash('sha256').update(JSON.stringify(config)).digest('hex')
}

export function getTranslationProviderModel(): string | undefined {
  const settings = settingsProvider.get()
  const provider = settings.translation?.provider ?? 'ai'
  if (provider === 'ai') return settings.ai.model
  return provider === 'google'
    ? 'google-translate-free'
    : 'microsoft-translate-free'
}

function shiftLeftOrRightThenSumOrXor(
  value: number,
  operation: string,
): number {
  let result = value
  for (let index = 0; index < operation.length - 2; index += 3) {
    const operandCharacter = operation.charAt(index + 2)
    const operand =
      operandCharacter >= 'a'
        ? operandCharacter.charCodeAt(0) - 87
        : Number(operandCharacter)
    const shifted =
      operation.charAt(index + 1) === '+'
        ? result >>> operand
        : result << operand
    if (operation.charAt(index) === '+') {
      result += shifted & 0xffffffff
    } else {
      result ^= shifted
    }
  }
  return result
}

function calculateGoogleToken(query: string): string {
  const [indexText, keyText] = GOOGLE_TRANSLATE_TKK.split('.')
  const tokenIndex = Number(indexText) || 0
  const tokenKey = Number(keyText) || 0
  let round = tokenIndex

  for (const byte of new TextEncoder().encode(query)) {
    round += byte
    round = shiftLeftOrRightThenSumOrXor(round, '+-a^+6')
  }
  round = shiftLeftOrRightThenSumOrXor(round, '+-3^+b+-f')
  round ^= tokenKey
  if (round <= 0) {
    round = (round & 0x7fffffff) + 0x80000000
  }

  const normalized = round % 1_000_000
  return `${normalized}.${normalized ^ tokenIndex}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function unwrapPre(value: string): string {
  return value.replace(/^\s*<pre(?:\s[^>]*)?>/i, '').replace(/<\/pre>\s*$/i, '')
}

async function fetchTranslationJson(
  providerLabel: string,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    TRANSLATION_REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await session.defaultSession.fetch(url, {
      ...init,
      signal: controller.signal,
    })
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`${providerLabel}请求过于频繁，请稍后重试`)
      }
      if (response.status === 403) {
        throw new Error(`${providerLabel}拒绝了请求，免费接口可能已受限`)
      }
      throw new Error(`${providerLabel}请求失败（HTTP ${response.status}）`)
    }
    try {
      return await response.json()
    } catch {
      throw new Error(`${providerLabel}返回了无法解析的响应`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${providerLabel}请求超时，请检查网络或代理`)
    }
    if (error instanceof Error) throw error
    throw new Error(`${providerLabel}请求失败`)
  } finally {
    clearTimeout(timer)
  }
}

function parseGoogleTranslation(payload: unknown): string {
  let translated: unknown = payload
  if (Array.isArray(translated)) translated = translated[0]
  if (Array.isArray(translated)) translated = translated[0]
  if (typeof translated !== 'string' || !translated.trim()) {
    throw new Error('Google 翻译未返回有效内容')
  }
  return unescapeHtml(unwrapPre(translated))
}

async function translateWithGoogle(
  content: string,
  targetLanguage: string,
): Promise<string> {
  const query = `<pre>${escapeHtml(content)}</pre>`
  const url = new URL(GOOGLE_TRANSLATE_URL)
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', targetLanguage)
  url.searchParams.set('tk', calculateGoogleToken(query))

  const payload = await fetchTranslationJson('Google 翻译', url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ q: query }).toString(),
  })
  return parseGoogleTranslation(payload)
}

function toMicrosoftLanguage(targetLanguage: string): string {
  if (targetLanguage === 'zh-CN') return 'zh-Hans'
  if (targetLanguage === 'zh-TW') return 'zh-Hant'
  return targetLanguage
}

function parseMicrosoftTranslation(payload: unknown): string {
  if (!Array.isArray(payload)) {
    throw new Error('Microsoft 翻译返回了无效响应')
  }
  const first = payload[0] as
    | { translations?: Array<{ text?: unknown }> }
    | undefined
  const translated = first?.translations?.[0]?.text
  if (typeof translated !== 'string' || !translated.trim()) {
    throw new Error('Microsoft 翻译未返回有效内容')
  }
  return translated
}

async function translateWithMicrosoft(
  content: string,
  targetLanguage: string,
): Promise<string> {
  const url = new URL(MICROSOFT_TRANSLATE_URL)
  url.searchParams.set('from', '')
  url.searchParams.set('to', toMicrosoftLanguage(targetLanguage))
  url.searchParams.set('isEnterpriseClient', 'false')

  const payload = await fetchTranslationJson('Microsoft 翻译', url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([content]),
  })
  return parseMicrosoftTranslation(payload)
}

function reportExternalProgress(
  context: TaskRunContext | undefined,
  completed: number,
  message: string,
  payload: AiTranslateTaskPayload,
  provider: TranslationProviderId,
): void {
  context?.reportProgress({
    completed,
    total: 1,
    message,
    data: {
      streaming: false,
      provider,
      targetLanguage: payload.targetLanguage,
      contentLength: payload.content.length,
    },
  })
}

export async function runConfiguredTranslationTask(
  payload: AiTranslateTaskPayload,
  context?: TaskRunContext,
): Promise<AITranslateResult> {
  const provider = getProvider()
  if (provider === 'ai') return runAITranslateTask(payload, context)
  if (!payload.content.trim()) return { success: true, translation: '' }

  reportExternalProgress(context, 0, '正在翻译', payload, provider)
  try {
    const translation =
      provider === 'google'
        ? await translateWithGoogle(payload.content, payload.targetLanguage)
        : await translateWithMicrosoft(payload.content, payload.targetLanguage)

    if (payload.requestId) {
      sendToAllWindows('ai:translate-stream-chunk', {
        requestId: payload.requestId,
        content: translation,
      })
      sendToAllWindows('ai:translate-stream-done', {
        requestId: payload.requestId,
      })
    }
    reportExternalProgress(context, 1, '翻译已生成', payload, provider)
    return { success: true, translation }
  } catch (error) {
    if (payload.requestId) {
      sendToAllWindows('ai:translate-stream-error', {
        requestId: payload.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    throw error
  }
}

export function normalizeTranslationError(error: unknown): string {
  const settings = settingsProvider.get()
  if ((settings.translation?.provider ?? 'ai') === 'ai') {
    return normalizeAIError(error, settings.ai)
  }
  return error instanceof Error ? error.message : String(error)
}
