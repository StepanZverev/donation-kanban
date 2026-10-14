import { useSoundSetting } from '../../hooks/useSoundSetting'
import { ToggleField } from '../ToggleField/ToggleField'

// Переключатель «Звук нового доната» в разделе «Приём донатов»
export function SoundSettings() {
  const { isEnabled, changeSound } = useSoundSetting()

  return (
    <ToggleField
      label="Звук нового доната"
      description="Короткий «дзынь», когда на доску приходит донат. Отсеянные донаты звука не дают. Настройка своя у каждого браузера: на телефоне модератора звук можно выключить."
      checked={isEnabled}
      onChange={changeSound}
    />
  )
}
