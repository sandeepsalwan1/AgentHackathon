type RequestField =
  | "requestType"
  | "clientName"
  | "clientPhone"
  | "clientDateOfBirth"
  | "petName"
  | "petWeight"
  | "request";

export type FieldErrors = Partial<Record<RequestField, string>>;

type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

export type RequestIntakeLogger = {
  info?: (event: string, fields?: LogFields) => void;
  warn?: (event: string, fields?: LogFields) => void;
  error?: (event: string, error: unknown, fields?: LogFields) => void;
};

export type ClientRequestIntakeResult = {
  body: { ok: true; id: string } | { error: string; fieldErrors?: FieldErrors };
  status: number;
};

export type ClientRequestIntakeOptions = {
  clinicId?: string | null;
  hospitalName?: string;
  logger?: RequestIntakeLogger;
  maxTrackedClients?: number;
};
