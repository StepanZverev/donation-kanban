// За чьими карточками следит зритель на странице /v/<токен>.
// Входа у зрителя нет, поэтому ник запоминаем в браузере (localStorage), отдельно для каждой доски.
// Следим за ником, а не за одной карточкой: новый донат этого зрителя подхватится сам.

import { useState } from 'react'

function getStorageKey(token: string) {
  return `viewer-follow:${token}`
}

function readFollowedName(token: string) {
  try {
    return localStorage.getItem(getStorageKey(token))
  } catch {
    return null
  }
}

function saveFollowedName(token: string, name: string | null) {
  try {
    if (name) {
      localStorage.setItem(getStorageKey(token), name)
    } else {
      localStorage.removeItem(getStorageKey(token))
    }
  } catch {
    // Браузер не даёт сохранить (например, приватное окно) — выбор проживёт до перезагрузки
  }
}

export function useFollowedDonor(token: string) {
  const [followedName, setFollowedName] = useState(() => readFollowedName(token))

  // Следить за другим ником — прежний забываем: следим только за одним
  function follow(name: string) {
    saveFollowedName(token, name)
    setFollowedName(name)
  }

  function unfollow() {
    saveFollowedName(token, null)
    setFollowedName(null)
  }

  return { followedName, follow, unfollow }
}
