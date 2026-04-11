// Typed API response helpers

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status })
}

export function error(message: string, status = 400): Response {
  return Response.json({ success: false, error: message }, { status })
}

export function unauthorized(): Response {
  return error('Unauthorized', 401)
}

export function forbidden(): Response {
  return error('Forbidden', 403)
}

export function notFound(entity = 'Resource'): Response {
  return error(`${entity} not found`, 404)
}

export function serverError(err?: unknown): Response {
  console.error(err)
  return error('Internal server error', 500)
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/)
  return match?.[1] ?? ''
}

// Client-side API helper — automatically includes CSRF token on mutations
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const method = options?.method?.toUpperCase() ?? 'GET'
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(isMutation ? { 'x-csrf-token': getCsrfToken() } : {}),
      ...options?.headers,
    },
  })
  return res.json()
}
