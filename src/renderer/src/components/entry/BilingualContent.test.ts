import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { BilingualContent } from './BilingualContent'

describe('BilingualContent', () => {
  beforeEach(() => {
    const { document, window } = parseHTML('<html><body></body></html>')
    class TestDOMParser {
      parseFromString(html: string, type: string) {
        if (type === 'text/html') {
          return parseHTML(`<html><body>${html}</body></html>`).document
        }
        return parseHTML(html).document
      }
    }
    vi.stubGlobal('DOMParser', TestDOMParser)
    vi.stubGlobal('document', document)
    vi.stubGlobal('Node', window.Node)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sanitizes both source and translated HTML before rendering', () => {
    const html = renderToStaticMarkup(
      createElement(BilingualContent, {
        paragraphs: [
          '<p>Original <strong>safe</strong><img src="https://cdn.example.com/a.png" onerror="window.hacked=1"><script>alert(1)</script></p>',
        ],
        translations: [
          '<p>译文 <em>safe</em><img src="https://cdn.example.com/b.png" onload="window.hacked=2"><a href="javascript:alert(2)">bad</a></p>',
        ],
        isTranslating: false,
        errorMap: {},
        fontSize: 16,
        lineHeight: 1.6,
        fontFamily: 'sans-serif',
      }),
    )

    expect(html).toContain('<strong>safe</strong>')
    expect(html).toContain('<em>safe</em>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('javascript:')
  })
})
