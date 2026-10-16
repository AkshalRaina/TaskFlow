const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  details: FieldError[];

  constructor(status: number, message: string, details: FieldError[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Called when the API says our session is no longer valid (set by AuthProvider).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

/**
 * Small wrapper around fetch for calling the TaskFlow API.
 * - sends the auth cookie (`credentials: 'include'`)
 * - turns error responses into an `ApiError` with the server's message
 */
export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API running?');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, data?.error?.message ?? 'Something went wrong', data?.error?.details);
  }

  return data as T;
}
