import { apiFetch, setToken, uploadMedia } from "./client";
import type {
  Category,
  Comment,
  ContactMessage,
  LoginResponse,
  MediaItem,
  Post,
  Settings,
  User,
} from "./types";

// --- auth ---

export async function login(username: string, password: string): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(result.token);
  return result;
}

export function getMe(): Promise<{ user: User }> {
  return apiFetch("/auth/me");
}

/** Kept for API-surface completeness only - disabled server-side (403,
 * "Registration is disabled") since the Fix 2 security session. The live
 * bundle has a corresponding "Register account" code path with no reachable
 * UI - see capture/interactions.md. Not wired to any page in this scaffold. */
export function register(username: string, password: string, role = "Member") {
  return apiFetch<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ success: boolean; message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function logout() {
  return apiFetch<{ success: boolean }>("/auth/logout", { method: "POST" });
}

// --- posts ---

export interface ListPostsParams {
  status?: string;
  limit?: number;
  offset?: number;
  category?: string;
}

export function listPosts(params: ListPostsParams = {}): Promise<Post[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.category) query.set("category", params.category);
  const qs = query.toString();
  return apiFetch(`/posts${qs ? `?${qs}` : ""}`);
}

export function getPostById(id: number): Promise<Post> {
  return apiFetch(`/posts/${id}`);
}

export function getPostBySlug(slug: string): Promise<Post> {
  return apiFetch(`/posts/slug/${slug}`);
}

export function createPost(post: Partial<Post>): Promise<{ id: number }> {
  return apiFetch("/posts", { method: "POST", body: JSON.stringify(post) });
}

export function updatePost(id: number, post: Partial<Post>) {
  return apiFetch<{ success: boolean }>(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(post),
  });
}

export function deletePost(id: number) {
  return apiFetch<{ success: boolean }>(`/posts/${id}`, { method: "DELETE" });
}

export function likePost(id: number) {
  return apiFetch<{ success: boolean; likes: number; dislikes: number }>(`/posts/${id}/like`, {
    method: "POST",
  });
}

export function dislikePost(id: number) {
  return apiFetch<{ success: boolean; likes: number; dislikes: number }>(`/posts/${id}/dislike`, {
    method: "POST",
  });
}

// --- comments ---

/** Matches the original exactly: a random id generated once per browser and
 * reused forever to "own" comments for edit/delete - see
 * capture/interactions.md. Not cryptographically strong; that's true of the
 * original too. */
export function getAuthorKey(): string {
  let key = localStorage.getItem("vcf_my_author_key");
  if (!key) {
    key = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("vcf_my_author_key", key);
  }
  return key;
}

export function getPostComments(postId: number): Promise<Comment[]> {
  return apiFetch(`/posts/${postId}/comments`);
}

export function postComment(
  postId: number,
  input: { author_name: string; author_role: string; content: string; parent_id?: number },
) {
  return apiFetch<{ success: boolean; comments: Comment[] }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ ...input, author_key: getAuthorKey() }),
  });
}

export function editComment(id: number, content: string) {
  return apiFetch<{ success: boolean }>(`/comments/${id}`, {
    method: "PUT",
    body: JSON.stringify({ content, author_key: getAuthorKey() }),
  });
}

export function deleteOwnComment(id: number) {
  return apiFetch<{ success: boolean }>(`/comments/${id}?author_key=${encodeURIComponent(getAuthorKey())}`, {
    method: "DELETE",
  });
}

/** Admin-only moderation view - Bearer token required, see index.php. */
export function listAllComments(): Promise<Comment[]> {
  return apiFetch("/comments/all");
}

export function deleteCommentAsAdmin(id: number) {
  return apiFetch<{ success: boolean }>(`/comments/${id}`, { method: "DELETE" });
}

// --- categories ---

export function listCategories(): Promise<Category[]> {
  return apiFetch("/categories");
}

export function createCategory(name: string, slug: string, parent_id: number | null = null): Promise<Category> {
  return apiFetch("/categories", { method: "POST", body: JSON.stringify({ name, slug, parent_id }) });
}

/** The admin UI has a real "Edit Category" flow that PUTs here - but
 * public_html/api/index.php has no PUT route for /categories/:id at all
 * (confirmed: only GET, POST, DELETE exist), so this always 404s against
 * the real backend. A genuine bug in the original, reproduced as-is per
 * "cloning, not improving" - see TODO-after-parity.md. Not fixed here. */
export function updateCategory(id: number, name: string, slug: string, parent_id: number | null = null): Promise<Category> {
  return apiFetch(`/categories/${id}`, { method: "PUT", body: JSON.stringify({ name, slug, parent_id }) });
}

export function deleteCategory(id: number) {
  return apiFetch<{ success: boolean }>(`/categories/${id}`, { method: "DELETE" });
}

// --- contact ---

export function submitContactMessage(email: string, message: string) {
  return apiFetch<{ success: boolean }>("/contact", {
    method: "POST",
    body: JSON.stringify({ email, message }),
  });
}

export function listContactMessages(): Promise<ContactMessage[]> {
  return apiFetch("/contact");
}

export function deleteContactMessage(id: number) {
  return apiFetch<{ success: boolean }>(`/contact/${id}`, { method: "DELETE" });
}

// --- media ---

export function listMedia(): Promise<MediaItem[]> {
  return apiFetch("/media");
}

export function uploadMediaFile(file: File): Promise<{ id: number; url: string; filename: string }> {
  return uploadMedia(file);
}

export function deleteMedia(id: number) {
  return apiFetch<{ success: boolean }>(`/media/${id}`, { method: "DELETE" });
}

// --- settings ---

export function getSettings(): Promise<Settings> {
  return apiFetch("/settings");
}

export function saveSettings(partial: Record<string, unknown>) {
  return apiFetch<{ success: boolean }>("/settings", {
    method: "POST",
    body: JSON.stringify(partial),
  });
}

// --- stats ---

/** Matches the original: a per-tab id in sessionStorage (NOT localStorage -
 * a fresh session gets a fresh visitor id), doubled-up Math.random string. */
export function getSessionClientId(): string {
  let id = sessionStorage.getItem("vcf_client_id_session");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("vcf_client_id_session", id);
  }
  return id;
}

export function pingStats() {
  return apiFetch<{ success: boolean; count: number }>("/stats/ping", {
    method: "POST",
    body: JSON.stringify({ clientId: getSessionClientId() }),
  }).catch(() => {
    // The original swallows ping failures silently too.
  });
}

export function getOnlineCount(): Promise<{ count: number }> {
  return apiFetch("/stats/online");
}
