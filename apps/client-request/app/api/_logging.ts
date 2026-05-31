type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

function payload(event: string, fields: LogFields = {}) {
  return {
    event,
    at: new Date().toISOString(),
    ...fields
  };
}

export function logInfo(event: string, fields?: LogFields) {
  console.info(payload(event, fields));
}

export function logWarn(event: string, fields?: LogFields) {
  console.warn(payload(event, fields));
}

export function logError(event: string, error: unknown, fields?: LogFields) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(payload(event, { ...fields, error: message }));
}
