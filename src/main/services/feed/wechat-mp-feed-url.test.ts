import { afterEach, describe, expect, it } from 'vitest'
import {
  isWechatMpBackendFeedUrl,
  rewriteWechatMpFeedUrlToBackendProxy,
  toWechatMpFreshBackendUrl,
} from './wechat-mp-feed-url'

const originalServerBaseUrl = process.env.LIVO_SERVER_BASE_URL

afterEach(() => {
  if (originalServerBaseUrl === undefined) {
    delete process.env.LIVO_SERVER_BASE_URL
  } else {
    process.env.LIVO_SERVER_BASE_URL = originalServerBaseUrl
  }
})

describe('rewriteWechatMpFeedUrlToBackendProxy', () => {
  it('keeps WeChat MP feed URLs local instead of using a backend proxy', () => {
    process.env.LIVO_SERVER_BASE_URL = 'https://api.example.com/'

    expect(
      rewriteWechatMpFeedUrlToBackendProxy(
        'https://wechat-rss.example/feed/MP_WXS_gh_12345.xml',
      ),
    ).toBe('https://wechat-rss.example/feed/MP_WXS_gh_12345.xml')
  })

  it('leaves non-WeChat feed URLs unchanged', () => {
    expect(
      rewriteWechatMpFeedUrlToBackendProxy('https://example.com/feed.xml'),
    ).toBe('https://example.com/feed.xml')
  })

  it('does not recognize or refresh backend WeChat feed URLs', () => {
    const url = 'https://api.example.com/api/wechat-rss/feed/MP_WXS_abc.xml'

    expect(isWechatMpBackendFeedUrl(url)).toBe(false)
    expect(toWechatMpFreshBackendUrl(url)).toBeNull()
    expect(isWechatMpBackendFeedUrl('https://example.com/feed.xml')).toBe(false)
  })
})
