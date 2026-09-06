import axios, { AxiosError } from "axios";

import { AUTH_UNAUTHORIZED_EVENT } from "@/auth/tokenStorage";

export const apiBaseURL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8010/api/v1";

export const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

/** Shape of the backend's domain errors (see app/core/exceptions.py). */
interface ApiErrorBody {
  detail?: string | { msg?: string }[];
  type?: string;
}

/**
 * A single error type for the whole UI, so components never branch on axios
 * internals. FastAPI returns a string `detail` for domain errors and an array
 * of objects for 422 validation errors — both are flattened here.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: string | null;

  constructor(message: string, status: number | null, kind: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

function readDetail(body: ApiErrorBody | undefined): string | null {
  if (!body?.detail) return null;
  if (typeof body.detail === "string") return body.detail;
  const messages = body.detail.map((item) => item.msg).filter(Boolean);
  return messages.length > 0 ? messages.join("; ") : null;
}

function localizeDetail(detail: string | null, status: number): string {
  if (detail && /[\u0590-\u05ff]/.test(detail)) return detail;
  if (status === 401) return "החיבור פג או שאינו תקין. יש להתחבר מחדש.";
  if (status === 403) return "אין לך הרשאה לבצע את הפעולה.";
  if (status === 404) return "הפריט המבוקש לא נמצא.";
  if (status === 409) return "כבר קיים פריט עם אותם פרטים.";
  if (status === 422) return "חלק מהפרטים שהוזנו אינם תקינים.";
  return detail ?? `הבקשה נכשלה (שגיאה ${status}).`;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;

    if (!axiosError.response) {
      return new ApiError(
        "לא ניתן להתחבר לשרת. יש לוודא שהשרת פועל ושהגדרת כתובת ה-API תקינה.",
        null,
        "network",
      );
    }

    const { status, data } = axiosError.response;
    return new ApiError(
      localizeDetail(readDetail(data), status),
      status,
      data?.type ?? null,
    );
  }

  return new ApiError("אירעה שגיאה. נסו שוב.", null, null);
}

// Normalise every rejection at the boundary — nothing downstream sees an AxiosError.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(toApiError(error));
  },
);
