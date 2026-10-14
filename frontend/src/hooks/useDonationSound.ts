// Играет звук, когда на доску пришёл новый донат (если звук включён в настройках).
// latestOnBoard — время самого свежего доната на доске (см. useNewDonations).

import { useEffect, useRef } from 'react'
import { isSoundEnabled, playDonationSound } from '../utils/sound'

export function useDonationSound(latestOnBoard: string | null | undefined) {
  // Время, которое видели в прошлый раз. undefined — ещё ничего не загрузили:
  // при первой загрузке звук не нужен, это старые донаты.
  const previous = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (latestOnBoard === undefined) {
      return
    }
    const isNewDonation =
      previous.current !== undefined && latestOnBoard !== null && latestOnBoard > (previous.current ?? '')
    previous.current = latestOnBoard
    if (isNewDonation && isSoundEnabled()) {
      playDonationSound()
    }
  }, [latestOnBoard])
}
