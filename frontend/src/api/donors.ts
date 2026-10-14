// Подсказки ников для поля «Ник» в форме карточки (backend/app/routes/donors.py).

// Ники с доски и из истории, в которых есть эти буквы. Свежие донатеры выше.
export async function getDonorSuggestions(query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query.trim() })
  const response = await fetch(`/api/donors?${params}`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ники: ${response.status}`)
  }
  return response.json()
}
