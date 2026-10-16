/**
 * An error we expect and want to show to the client with a specific status code.
 * Anything else that is thrown becomes a generic 500.
 */
export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFound = (resource: string) => new AppError(404, `${resource} not found`);
