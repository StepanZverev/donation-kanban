// Запросы для разработки.

// Просит бэкенд создать карточку из выдуманного доната.
export async function sendFakeDonation(): Promise<void> {
  const response = await fetch('/api/dev/fake-donation', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось создать тестовый донат: ${response.status}`)
  }
}
