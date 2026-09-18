import { join } from 'path'
import { LOCAL_APP_NAME } from '../shared/local-mode'

interface ApplicationIdentityApi {
  readonly isPackaged: boolean
  getPath(name: 'appData' | 'userData'): string
  setName(name: string): void
  setPath(name: 'userData', path: string): void
}

/** Keep this fork's name and user data separate from upstream Livo. */
export function configureAppIdentity(
  application: ApplicationIdentityApi,
  e2eUserDataPath?: string,
  platform: NodeJS.Platform = process.platform,
): { isDev: boolean } {
  const isDev = !application.isPackaged
  void platform
  application.setName(LOCAL_APP_NAME)
  application.setPath(
    'userData',
    e2eUserDataPath || join(application.getPath('appData'), LOCAL_APP_NAME),
  )

  return { isDev }
}
