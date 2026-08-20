const TOKEN_KEY = 'sp_token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export const api = {
  get:    (path: string)                 => request('GET',    path),
  post:   (path: string, body?: unknown) => request('POST',   path, body),
  put:    (path: string, body?: unknown) => request('PUT',    path, body),
  delete: (path: string)                 => request('DELETE', path),
}
