import { describe, expect, it } from 'vitest'
import { FeedViewType } from './types/feed'
import { parseDeepLink } from './deep-link'

describe('parseDeepLink', () => {
  it('parses supported local actions', () => {
    expect(
      parseDeepLink(
        'livo-local://add-feed?url=https%3A%2F%2Fexample.com%2Ffeed.xml',
      ),
    ).toEqual({
      type: 'add-feed',
      url: 'https://example.com/feed.xml',
    })
    expect(parseDeepLink('livo-local://entry/entry-1')).toEqual({
      type: 'open-entry',
      entryId: 'entry-1',
    })
    expect(parseDeepLink('livo-local://feed/feed-1')).toEqual({
      type: 'open-feed',
      feedId: 'feed-1',
    })
    expect(
      parseDeepLink('livo-local://discover?url=https%3A%2F%2Fexample.com'),
    ).toEqual({
      type: 'preview-feed',
      url: 'https://example.com/',
    })
    expect(parseDeepLink('livo-local://search?q=ai')).toEqual({
      type: 'open-search',
      query: 'ai',
    })
    expect(parseDeepLink('livo-local://starred')).toEqual({
      type: 'open-starred',
    })
    expect(parseDeepLink('livo-local://view/social')).toEqual({
      type: 'open-view',
      view: FeedViewType.SocialMedia,
    })
    expect(parseDeepLink('livo-local://settings?tab=data')).toEqual({
      type: 'open-settings',
      tab: 'data',
    })
    expect(parseDeepLink('livo-local://import-opml')).toEqual({
      type: 'import-opml',
    })
    expect(parseDeepLink('livo-local://refresh')).toEqual({
      type: 'refresh-all',
    })
    expect(parseDeepLink('livo-local://login/google')).toEqual({
      type: 'login',
      provider: 'google',
    })
  })

  it('rejects malformed or unsupported links', () => {
    expect(parseDeepLink('https://example.com')).toBeNull()
    expect(parseDeepLink('livo-local://entry')).toBeNull()
    expect(
      parseDeepLink('livo-local://add-feed?url=file:///tmp/feed.xml'),
    ).toBeNull()
    expect(parseDeepLink('livo-local://view/unknown')).toBeNull()
    expect(parseDeepLink('livo-local://unknown')).toBeNull()
    expect(parseDeepLink('livo://entry/entry-1')).toBeNull()
  })
})
