// Client HTTP unique. L'en-tête x-frq sert de protection CSRF côté serveur.
export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

async function request(method, url, body, { form } = {}) {
  const headers = { 'x-frq': '1' };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Pas de connexion. Réessaie quand le réseau revient.', 'offline');
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Erreur', data?.code);
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u, b) => request('DELETE', u, b),
  upload: (u, form) => request('POST', u, undefined, { form }),
};

export const view = (type, id) => api.post('/api/views', { type, id }).catch(() => {});
