import { AutoMergeSettings } from '../AutoMergeSettings/AutoMergeSettings'
import { IntakeSettingsFields } from '../IntakeSettingsFields/IntakeSettingsFields'
import { ResetBoardSettings } from '../ResetBoardSettings/ResetBoardSettings'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import { SoundSettings } from '../SoundSettings/SoundSettings'

// Раздел «Приём донатов» на странице настроек: какие донаты становятся карточками
// что делать с повторными донатами, звук нового доната и сброс доски в конце стрима.
export function DonationsSettings() {
  return (
    <SettingsSection title="Приём донатов" hint="Что происходит с новым донатом, когда он приходит.">
      <IntakeSettingsFields />
      <AutoMergeSettings />
      <SoundSettings />
      <ResetBoardSettings />
    </SettingsSection>
  )
}
