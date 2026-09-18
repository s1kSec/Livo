import { describe, expect, it, vi } from 'vitest'
import { join } from 'path'
import { configureAppIdentity } from './app-identity'

function createApp(isPackaged: boolean) {
  return {
    isPackaged,
    getPath: vi.fn(() => '/Users/test/Library/Application Support'),
    setName: vi.fn(),
    setPath: vi.fn(),
  }
}

describe('configureAppIdentity', () => {
  it('uses the local product name and a separate data directory', () => {
    const app = createApp(false)

    const result = configureAppIdentity(app, undefined, 'darwin')

    expect(result).toEqual({ isDev: true })
    expect(app.setName).toHaveBeenCalledWith('Livo Local')
    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      join('/Users/test/Library/Application Support', 'Livo Local'),
    )
  })

  it('keeps the isolated E2E user-data directory on macOS', () => {
    const app = createApp(false)

    configureAppIdentity(app, '/tmp/livo-e2e', 'darwin')

    expect(app.setName).toHaveBeenCalledWith('Livo Local')
    expect(app.setPath).toHaveBeenCalledWith('userData', '/tmp/livo-e2e')
    expect(app.getPath).not.toHaveBeenCalled()
  })

  it('uses the local name on other development platforms', () => {
    const app = createApp(false)

    configureAppIdentity(app, '/tmp/livo-e2e', 'win32')

    expect(app.setName).toHaveBeenCalledWith('Livo Local')
    expect(app.setPath).toHaveBeenCalledWith('userData', '/tmp/livo-e2e')
    expect(app.getPath).not.toHaveBeenCalled()
  })

  it('uses the local identity for packaged builds', () => {
    const app = createApp(true)

    const result = configureAppIdentity(app, undefined, 'darwin')

    expect(result).toEqual({ isDev: false })
    expect(app.setName).toHaveBeenCalledWith('Livo Local')
    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      join('/Users/test/Library/Application Support', 'Livo Local'),
    )
    expect(app.getPath).toHaveBeenCalledWith('appData')
  })
})
