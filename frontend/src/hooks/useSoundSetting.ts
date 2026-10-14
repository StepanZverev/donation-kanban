// Галочка «Звук нового доната» на странице «Настройки».
// Сервер тут не участвует: настройка хранится в браузере (см. utils/sound.ts).

import { useState } from 'react'
import { isSoundEnabled, playDonationSound, saveSoundEnabled } from '../utils/sound'

export function useSoundSetting() {
  const [isEnabled, setIsEnabled] = useState(isSoundEnabled)

  function changeSound(enabled: boolean) {
    saveSoundEnabled(enabled)
    setIsEnabled(enabled)
    // Включили — сразу даём послушать, как он звучит
    if (enabled) {
      playDonationSound()
    }
  }

  return { isEnabled, changeSound }
}
