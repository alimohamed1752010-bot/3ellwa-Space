export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
  get retryAfterSeconds(): number | undefined {
    return typeof this.extra.retryAfterSeconds === "number" ? this.extra.retryAfterSeconds : undefined;
  }
  get triesLeft(): number | undefined {
    return typeof this.extra.triesLeft === "number" ? this.extra.triesLeft : undefined;
  }
}

// The admin app registers one handler so an expired session (401 on any admin call) sends the user back to login.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined || isForm ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path.startsWith("/api/admin")) unauthorizedHandler?.();
    const e = (data as { error?: { code?: string; message?: string } & Record<string, unknown> } | null)?.error;
    const { code, message, ...extra } = e ?? {};
    throw new ApiError(res.status, code ?? "unknown", message ?? "Something went wrong.", extra);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};
