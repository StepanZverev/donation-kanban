export type HealthResponse = {
  status: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')

  if (!response.ok) {
    throw new Error(`Бэкенд ответил с ошибкой: ${response.status}`)
  }

  return response.json()
}
