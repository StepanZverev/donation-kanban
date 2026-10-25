// За чьими карточками следит зритель на странице /v/<токен>.
// Входа у зрителя нет, поэтому ник запоминаем в браузере (localStorage), отдельно для каждой доски.
// Следим за ником, а не за одной карточкой: новый донат этого зрителя подхватится сам.

import { useState } from 'react'
import { readSaved, save } from '../utils/storage'

function getStorageKey(token: string) {
  return `viewer-follow:${token}`
}

export function useFollowedDonor(token: string) {
  const [followedName, setFollowedName] = useState(() => readSaved(getStorageKey(token)))

  // Следить за другим ником — прежний забываем: следим только за одним
  function follow(name: string) {
    save(getStorageKey(token), name)
    setFollowedName(name)
  }

  function unfollow() {
    save(getStorageKey(token), null)
    setFollowedName(null)
  }

  return { followedName, follow, unfollow }
}
