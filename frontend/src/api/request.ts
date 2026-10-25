// Общая обёртка над fetch для всех файлов src/api/: отправляет запрос к бэкенду,
// разбирает ответ из JSON и бросает ошибку, если сервер ответил не 2xx.
//
//   const cards = await request<CardFromApi[]>('GET', `/api/boards/${boardId}/cards`)
//   await request('POST', `/api/boards/${boardId}/cards`, { text: 'Привет' })

// Ошибка запроса. Кроме обычного текста знает код ответа и объяснение бэкенда.
export class ApiError extends Error {
  // Код ответа: 404 — не найдено, 400 — бэкенд не согласен с данными и т. п.
  status: number
  // Объяснение бэкенда для человека (поле detail в ответе), например
  // «Нужна ссылка на DonationAlerts». null — бэкенд ничего не объяснил.
  detail: string | null

  constructor(status: number, detail: string | null, message: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

// body — что отправить на сервер, превратится в JSON. Без body запрос уходит пустым.
export async function request<T = void>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    // FastAPI кладёт объяснение в поле detail. Бывает, что там не текст, а список
    // ошибок проверки полей, — такое человеку не покажешь, считаем, что объяснения нет.
    const errorBody = await response.json().catch(() => null)
    const detail = typeof errorBody?.detail === 'string' ? errorBody.detail : null
    throw new ApiError(response.status, detail, `Запрос ${method} ${url} завершился ошибкой ${response.status}`)
  }

  // Некоторые запросы ничего не возвращают (например, удаление): тогда тело ответа пустое
  const text = await response.text()
  return text ? JSON.parse(text) : (undefined as T)
}

// Как request, только «не найдено» (ответ 404) — не ошибка, а null.
// Так спрашиваем то, чего может не быть: доску по ссылке, приглашение.
export async function requestOrNull<T>(method: string, url: string): Promise<T | null> {
  try {
    return await request<T>(method, url)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

// Объяснение бэкенда из ошибки запроса, чтобы показать его человеку. null — объяснения нет.
export function getErrorDetail(error: unknown): string | null {
  return error instanceof ApiError ? error.detail : null
}
