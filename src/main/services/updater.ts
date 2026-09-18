import { app, type BrowserWindow } from 'electron'
import type {
  AppUpdateInfo,
  AppUpdateInstallResult,
  AppUpdateState,
} from '../../shared/types'

function platformName(): AppUpdateInfo['platform'] {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return process.platform
  }
  return 'other'
}

/**
 * Livo Local intentionally has no bundled update channel. This service keeps
 * the existing application IPC contract stable while making every update
 * action a local no-op.
 */
export class UpdaterService {
  private window: BrowserWindow | null = null

  constructor(_isDev: boolean) {}

  private sendUpdateState(state: AppUpdateState): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('app:update-state', state)
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  async checkForAppUpdates(_force = false): Promise<AppUpdateInfo> {
    const info: AppUpdateInfo = {
      hasUpdate: false,
      canInstall: false,
      platform: platformName(),
      currentVersion: app.getVersion(),
    }
    this.sendUpdateState({ status: 'idle', info })
    return info
  }

  async installAppUpdate(): Promise<AppUpdateInstallResult> {
    return { success: false, error: 'Updates are disabled in the local build.' }
  }

  async checkForUpdates(): Promise<{ updateInfo?: unknown } | null> {
    return null
  }

  async downloadUpdate(): Promise<string[]> {
    return []
  }

  quitAndInstall(): void {}
}
