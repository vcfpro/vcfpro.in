// Reconstructed from public_html/assets/index-BxfIvHoc.js (the shared `ke`
// fetch helper and its token-resolution functions) rather than guessed, so
// that a token issued by this rebuild is handled identically to the live
// site's - see capture/api-usage.md and capture/interactions.md.
//
// Token storage: the live site actually uses TWO localStorage keys.
// "admin_token" is set on admin login and is the one that matters for the
// reachable admin panel. "vcf_user_token" belongs to a separate public
// "Member" self-registration flow that exists in the bundle's code but has
// no reachable UI on the live site (POST /api/auth/register is also
// disabled server-side - see the Fix 2 security session). getToken() below
// checks both, exactly like the original, purely for parity; nothing in
// this scaffold exercises the Member path.

let cachedToken: string | null = null;

function isUsableToken(value: string | null): value is string {
  return !!value && value !== "null" && value !== "undefined" && value.trim() !== "";
}

export function getToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    const adminToken = localStorage.getItem("admin_token");
    if (isUsableToken(adminToken)) return adminToken;
    const userToken = localStorage.getItem("vcf_user_token");
    if (isUsableToken(userToken)) return userToken;
  } catch {
    // localStorage unavailable (e.g. private browsing) - fall through to null
  }
  return null;
}

export function setToken(token: string): void {
  cachedToken = token;
  try {
    localStorage.setItem("admin_token", token);
  } catch {
    // ignore - matches original's silent catch
  }
}

export function clearAuth(): void {
  cachedToken = null;
  try {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("vcf_user_token");
  } catch {
    // ignore
  }
}

export class ApiError extends Error {}

/** Mirrors the original's `ke(path, opts)` exactly: same base URL prefix,
 * same cache mode, same Authorization/Content-Type headers, same
 * throw-on-!ok-with-server-message shape. */
export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    cache: "no-store",
    ...opts,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    throw new ApiError(body.error || "API Error");
  }

  return response.json() as Promise<T>;
}

/** Mirrors the original's separate `Ii(file)` upload helper - multipart, so
 * no Content-Type header (the browser sets the boundary itself). */
export async function uploadMedia<T>(file: File): Promise<T> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const headers: HeadersInit = {};
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError("Upload failed");
  }

  return response.json() as Promise<T>;
}
