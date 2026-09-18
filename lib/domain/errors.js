export const APPLICATION_ERROR_KINDS = Object.freeze([
  "unknown",
  "network",
  "authentication",
  "authorization",
  "validation",
  "not-found",
  "conflict",
  "timeout",
]);

export class ApplicationError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "ApplicationError";
    this.kind = APPLICATION_ERROR_KINDS.includes(options.kind)
      ? options.kind
      : "unknown";
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export function classifyApiError(error) {
  const statusCode = error?.statusCode;
  const kind = statusCode === 401
    ? "authentication"
    : statusCode === 403
      ? "authorization"
      : statusCode === 404
        ? "not-found"
        : statusCode === 409
          ? "conflict"
          : statusCode >= 500
            ? "network"
            : "unknown";

  return new ApplicationError(error?.detail || error?.message || String(error), {
    kind,
    statusCode,
    details: error,
    cause: error,
  });
}
