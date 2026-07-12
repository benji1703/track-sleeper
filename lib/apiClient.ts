const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Browser fetch with a bounded wait. Safe reads get one retry for transient
 * network/server failures; mutations never retry because they may have landed.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const attempts = method === 'GET' ? 2 : 1

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(input, { ...init, signal: controller.signal })
      if (response.status < 500 || attempt === attempts - 1) return response
    } catch (error) {
      if (attempt === attempts - 1) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('The connection is taking too long. Try again.')
        }
        throw error
      }
    } finally {
      window.clearTimeout(timeout)
    }

    await new Promise((resolve) => window.setTimeout(resolve, 350))
  }

  throw new Error('Request failed.')
}
