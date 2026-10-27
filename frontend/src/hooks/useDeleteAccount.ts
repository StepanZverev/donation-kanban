import { useState } from 'react'
import { deleteAccount } from '../api/me'

// «Удалить аккаунт и все данные». После удаления открываем главную заново:
// cookie уже нет, поэтому покажется лендинг, как новому посетителю.
export function useDeleteAccount() {
  const [error, setError] = useState<string | null>(null)

  async function removeAccount() {
    setError(null)
    try {
      await deleteAccount()
      window.location.assign('/')
    } catch {
      setError('Не получилось удалить аккаунт. Попробуй ещё раз.')
    }
  }

  return { removeAccount, error }
}
