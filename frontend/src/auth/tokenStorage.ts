const ACCESS_TOKEN_KEY = "project-dashboard.access-token";

export const AUTH_UNAUTHORIZED_EVENT = "project-dashboard:unauthorized";

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}
