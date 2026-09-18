import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  autoUpdater: {
    updateConfigPath: undefined as string | null | undefined,
    forceDevUpdateConfig: false,
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
  getVersion: vi.fn(() => '1.0.0'),
  checkForAppUpdates: vi.fn(),
  installAppUpdate: vi.fn(),
  canInstallMacUpdateInPlace: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: mocks.getVersion },
}))
vi.mock('electron-updater', () => ({
  default: { autoUpdater: mocks.autoUpdater },
}))
vi.mock('./system/update-check', () => ({
  checkForAppUpdates: mocks.checkForAppUpdates,
}))
vi.mock('./system/update-install', () => ({
  installAppUpdate: mocks.installAppUpdate,
}))
vi.mock('./system/mac-update-capability', () => ({
  canInstallMacUpdateInPlace: mocks.canInstallMacUpdateInPlace,
}))

import { UpdaterService } from './updater'

describe('UpdaterService in the local build', () => {
  it('does not check, download, or install upstream updates', async () => {
    const service = new UpdaterService(false)

    await expect(service.checkForAppUpdates()).resolves.toMatchObject({
      hasUpdate: false,
      canInstall: false,
      currentVersion: '1.0.0',
    })
    await expect(service.installAppUpdate()).resolves.toMatchObject({
      success: false,
    })
    await expect(service.checkForUpdates()).resolves.toBeNull()
    await expect(service.downloadUpdate()).resolves.toEqual([])
    service.quitAndInstall()

    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(mocks.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(mocks.checkForAppUpdates).not.toHaveBeenCalled()
    expect(mocks.installAppUpdate).not.toHaveBeenCalled()
  })
})
