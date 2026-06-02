import type { TaskBoardSession } from "./taskBoardTypes";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || data.detail || "Request failed.", response.status);
  }
  return data;
}

export function isAuthError(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 429);
}

export function sessionReadHeaders(currentSession: TaskBoardSession) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (currentSession.passcode) {
    headers["X-Central-Vet-Passcode"] = currentSession.passcode;
  }
  return headers;
}
