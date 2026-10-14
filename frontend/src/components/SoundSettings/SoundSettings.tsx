import { useSoundSetting } from '../../hooks/useSoundSetting'
import { ToggleField } from '../ToggleField/ToggleField'

// Переключатель «Звук нового доната» в разделе «Приём донатов»
export function SoundSettings() {
  const { isEnabled, changeSound } = useSoundSetting()

  return (
    <ToggleField
      label="Звук нового доната"
      description="Тихий короткий сигнал, когда на доску приходит донат. Отсеянные донаты звука не дают."
      checked={isEnabled}
      onChange={changeSound}
    />
  )
}
