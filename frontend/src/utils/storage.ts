// Небольшие настройки, которые браузер помнит сам (localStorage): тема, звук,
// свёрнутые правила у зрителя, за кем он следит.
//
// В некоторых браузерах (например, в приватном окне) localStorage может выдать ошибку.
// Тогда считаем, что ничего не сохранено, а новый выбор проживёт до перезагрузки страницы.

// Что сохранено под ключом. null — ничего.
export function readSaved(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Сохраняет значение под ключом. null — стереть запись.
export function save(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Браузер не даёт сохранить — выбор проживёт до перезагрузки
  }
}
