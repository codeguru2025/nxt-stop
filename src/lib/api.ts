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

// Client-side API helper
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res.json()
}
