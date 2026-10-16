import { ApiError } from './api';

/** Turns an API validation error into `{ fieldName: message }` for showing under each input. */
export function toFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
