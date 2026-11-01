export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'same-origin'
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'Нет соединения с сервером');
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    /* 401 от рабочих запросов не всегда значит «вы разлогинены»: инстанс мог пересоздать базу.
       Сначала перепроверяем сессию и один раз повторяем запрос — из кабинета не выкидываем зря. */
    if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/status')) {
      const alive = !retried && (await sessionAlive());
      if (alive) return request<T>(path, options, true);
      if (!alive) window.dispatchEvent(new CustomEvent('xenon:unauthorized'));
    }
    const code = (payload && (payload.error as string)) || 'request_failed';
    const message = (payload && (payload.message as string)) || 'Не удалось выполнить запрос';
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

/* Проверяем сессию отдельным запросом, чтобы отличить протухшую cookie от сбоя инстанса. */
async function sessionAlive(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/status', { credentials: 'same-origin' });
    if (!response.ok) return false;
    const payload = (await response.json()) as { authenticated?: boolean };
    return payload.authenticated === true;
  } catch {
    return true;
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
