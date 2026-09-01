/**
 * Client-side checks that mirror the backend's Pydantic rules, so obvious
 * mistakes get caught before a request goes out. The server still validates —
 * this is for speed of feedback, not security.
 */

export const PROJECT_NAME_MAX = 255;
export const PROJECT_ICON_MAX = 32;
export const PROJECT_ICON_FILE_MAX_BYTES = 512 * 1024;
export const PROJECT_DESCRIPTION_MAX = 5000;
export const LINK_TITLE_MAX = 255;
export const LINK_URL_MAX = 2048;

export function validateProjectName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "יש להזין שם לפרויקט.";
  if (name.length > PROJECT_NAME_MAX) return `יש להזין עד ${PROJECT_NAME_MAX} תווים.`;
  return undefined;
}

export function validateDescription(value: string): string | undefined {
  if (value.length > PROJECT_DESCRIPTION_MAX)
    return `יש להזין עד ${PROJECT_DESCRIPTION_MAX} תווים.`;
  return undefined;
}

export function validateProjectIcon(value: string): string | undefined {
  if (value.startsWith("data:image/")) return undefined;
  if (value.trim().length > PROJECT_ICON_MAX)
    return `יש להזין עד ${PROJECT_ICON_MAX} תווים.`;
  return undefined;
}

export function validateLinkTitle(value: string): string | undefined {
  const title = value.trim();
  if (!title) return "יש להזין כותרת לקישור.";
  if (title.length > LINK_TITLE_MAX) return `יש להזין עד ${LINK_TITLE_MAX} תווים.`;
  return undefined;
}

/**
 * The backend requires a scheme (`example.com` alone is rejected), so rather
 * than failing on a reasonable entry we add https:// and validate the result.
 */
export function normalizeUrl(value: string): string {
  const url = value.trim();
  if (!url) return url;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

export function validateUrl(value: string): string | undefined {
  const url = normalizeUrl(value);
  if (!url) return "יש להזין את כתובת הקישור.";
  if (url.length > LINK_URL_MAX) return `יש להזין עד ${LINK_URL_MAX} תווים.`;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return "הכתובת אינה נראית מלאה.";
    }
  } catch {
    return "כתובת הקישור אינה תקינה.";
  }

  return undefined;
}
