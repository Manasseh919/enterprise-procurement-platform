import type { IntegrationErrorCode } from "./types.js";

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly httpStatus?: number;
  readonly responseBody?: string;

  constructor(
    code: IntegrationErrorCode,
    message: string,
    httpStatus?: number,
    responseBody?: string,
  ) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.responseBody = responseBody;
  }
}

function truncate(value: string, max = 1000): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function classifyFetchError(err: unknown): IntegrationError {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /timeout|aborted/i.test(message)
  ) {
    return new IntegrationError("TIMEOUT", `TIMEOUT: ${message}`);
  }

  return new IntegrationError("NETWORK", `NETWORK: ${message}`);
}

export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw classifyFetchError(err);
  }

  const text = await response.text();

  if (!response.ok) {
    const code: IntegrationErrorCode =
      response.status >= 500 ? "HTTP_5XX" : "HTTP_4XX";
    throw new IntegrationError(
      code,
      `${code}: HTTP ${response.status} from ${url}: ${truncate(text || response.statusText)}`,
      response.status,
      text,
    );
  }

  if (!text.trim()) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `INVALID_RESPONSE: empty body from ${url}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `INVALID_RESPONSE: non-JSON body from ${url}: ${truncate(text)}`,
      response.status,
      text,
    );
  }
}