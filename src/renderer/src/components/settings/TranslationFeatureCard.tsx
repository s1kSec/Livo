import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import type { TranslationProviderId } from '../../../../shared/types'

import {
  FeatureCardShell,
  FeatureLanguageRow,
  FeatureSelectRow,
  FeatureToggleRow,
} from './feature-card-ui'

export interface TranslationFeatureCardProps {
  provider: TranslationProviderId
  enabled: boolean
  autoTranslate: boolean
  targetLanguage: string
  onProviderChange: (next: TranslationProviderId) => void
  onEnabledChange: (next: boolean) => void
  onAutoTranslateChange: (next: boolean) => void
  onLanguageChange: (next: string) => void
}

/**
 * AI translation feature card (Harmony `TranslationFeatureCard` parity):
 * target language, auto-translate on article open, and the master enable
 * toggle. Presentational — the host panel wires it to settings.
 */
export function TranslationFeatureCard({
  provider,
  enabled,
  autoTranslate,
  targetLanguage,
  onProviderChange,
  onEnabledChange,
  onAutoTranslateChange,
  onLanguageChange,
}: TranslationFeatureCardProps) {
  const { t } = useTranslation()
  const providerOptions = [
    { value: 'ai', label: t('settings.translationProviderAI') },
    {
      value: 'google',
      label: t('settings.translationProviderGoogle'),
    },
    {
      value: 'microsoft',
      label: t('settings.translationProviderMicrosoft'),
    },
  ]
  const availableProviderOptions =
    window.api.windowControls.platform === 'web'
      ? providerOptions.slice(0, 1)
      : providerOptions

  return (
    <FeatureCardShell
      title={t('settings.translationTitle')}
      icon={<Languages size={15} className="text-accent" aria-hidden="true" />}
    >
      <FeatureSelectRow
        label={t('settings.translationProvider')}
        description={
          window.api.windowControls.platform === 'web'
            ? undefined
            : t('settings.translationProviderDesc')
        }
        value={provider}
        options={availableProviderOptions}
        onChange={(next) => onProviderChange(next as TranslationProviderId)}
      />
      <FeatureLanguageRow
        label={t('settings.targetLanguage')}
        value={targetLanguage}
        onChange={onLanguageChange}
      />
      <FeatureToggleRow
        label={t('settings.autoTranslate')}
        description={t('settings.autoTranslateDesc')}
        checked={autoTranslate}
        onChange={onAutoTranslateChange}
      />
      <FeatureToggleRow
        label={t('settings.enableTranslation')}
        description={t('settings.enableTranslationDesc')}
        checked={enabled}
        onChange={onEnabledChange}
      />
    </FeatureCardShell>
  )
}
