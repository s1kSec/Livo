import { AppCommandProvider } from './AppCommandProvider'
import { GlobalShortcutsProvider } from './GlobalShortcutsProvider'
import { OverlayStackProvider } from './OverlayStackProvider'
import { QueryVisibilityRefreshProvider } from './QueryVisibilityRefreshProvider'
import { PerformanceMetricsProvider } from './PerformanceMetricsProvider'

export function DeferredAppProviders() {
  return (
    <OverlayStackProvider>
      <AppCommandProvider>
        <GlobalShortcutsProvider>
          <QueryVisibilityRefreshProvider>
            <PerformanceMetricsProvider />
          </QueryVisibilityRefreshProvider>
        </GlobalShortcutsProvider>
      </AppCommandProvider>
    </OverlayStackProvider>
  )
}
