import { Menu, Tray, nativeImage } from 'electron'
import { getTrayIconPath } from '../../app-icon'
import { logInfo, logWarn } from './logger'

function createTrayImage() {
  const iconPath = getTrayIconPath()
  logInfo('[tray] loading icon from', iconPath)
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    logWarn('[tray] image is empty, path may be wrong:', iconPath)
    return nativeImage.createEmpty()
  }
  return image.resize({ width: 32, height: 32 })
}

export class AppTray {
  private tray: Tray | null = null

  constructor(
    private readonly actions: {
      showWindow: () => void
      hideWindow: () => void
      refreshAll: () => void
      openSettings: () => void
      quit: () => void
      isWindowVisible: () => boolean
    },
  ) {}

  ensureCreated(): void {
    if (this.tray) return
    try {
      this.tray = new Tray(createTrayImage())
      this.tray.setToolTip('Livo Local')
      this.tray.on('click', () => {
        if (this.actions.isWindowVisible()) this.actions.hideWindow()
        else this.actions.showWindow()
      })
      this.refreshMenu()
    } catch (error) {
      logWarn('[tray] failed to create tray', error)
    }
  }

  refreshMenu(): void {
    if (!this.tray) return
    const visible = this.actions.isWindowVisible()
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? 'Hide Livo Local' : 'Show Livo Local',
          click: () => {
            if (this.actions.isWindowVisible()) this.actions.hideWindow()
            else this.actions.showWindow()
            this.refreshMenu()
          },
        },
        {
          label: 'Refresh subscriptions',
          click: () => this.actions.refreshAll(),
        },
        { label: 'Settings', click: () => this.actions.openSettings() },
        { type: 'separator' },
        { label: 'Quit', click: () => this.actions.quit() },
      ]),
    )
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
