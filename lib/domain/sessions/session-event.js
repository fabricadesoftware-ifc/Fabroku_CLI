export const SESSION_EVENT_TYPES = Object.freeze([
  "status",
  "output",
  "prompt",
  "complete",
  "error",
]);

export function normalizeSessionEvent(event) {
  const type = event.type || event.event;
  const data = event.data && typeof event.data === "object" ? event.data : event;
  const normalized = { type };
  if (event.id !== undefined && event.id !== null && !Number.isNaN(Number(event.id))) normalized.id = Number(event.id);
  for (const field of ["message", "prompt_id", "text", "label", "secret", "silent"]) {
    if (data[field] !== undefined) normalized[field] = data[field];
  }
  return normalized;
}
