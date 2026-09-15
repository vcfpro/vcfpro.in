// Shapes match public_html/api/index.php exactly - see capture/api-usage.md.
// The backend is untouched; these types describe its existing contract.

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image: string | null;
  status: "draft" | "published";
  category_id: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  url: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
  published_at: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  // The admin UI has a "Parent Category" picker and an edit flow for
  // categories, but the live backend's `categories` table has no
  // parent_id column and no PUT route at all (confirmed in
  // public_html/api/index.php) - a real, unfixed bug in the original
  // (see TODO-after-parity.md). parent_id is accepted client-side purely
  // to match the original's request body shape; the backend silently
  // ignores it on create and 404s on the edit PUT that never existed.
  parent_id?: number | null;
}

export interface Comment {
  id: number;
  post_id: number;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
  parent_id: number | null;
  author_key: string | null;
  post_title?: string; // present only on /comments/all
}

export interface MediaItem {
  id: number;
  filename: string;
  url: string;
  type: "image" | "video";
  created_at: string;
}

export interface ContactMessage {
  id: number;
  email: string;
  message: string;
  created_at: string;
}

export interface ThemeSettings {
  mode: "dark" | "light";
  accentColor: string;
  dayBg: string;
  dayInk: string;
  nightBg: string;
  nightInk: string;
  editorDayBg: string;
  editorDayInk: string;
  editorNightBg: string;
  editorNightInk: string;
}

export interface TimelineEntry {
  year: string;
  role: string;
  company: string;
}

export interface Accolade {
  title: string;
  subtitle: string;
  color: string;
  showDot: boolean;
}

export interface AboutEntry {
  title: string;
  detail: string;
  imageUrl?: string;
}

export interface AboutPageSettings {
  title: string;
  introduction: string;
  bio: string;
  accolades: AboutEntry[];
  certifications: AboutEntry[];
}

export interface PortfolioSettings {
  headerGreeting: string;
  headerDescription: string;
  buttonText?: string;
  timelineLabel: string;
  timeline: TimelineEntry[];
  clientVoiceLabel: string;
  clientQuote: string;
  clientName: string;
  clientRole: string;
  statsLabel: string;
  statsCaption: string;
  softwareLabel: string;
  contactLabel: string;
  email: string;
  phone?: string;
  aboutText?: string;
  linkedinUrl: string;
  heroImage: string;
  bgVideo1: string;
  bgVideo2: string;
  bgVideo3: string;
  accoladesLabel?: string;
  accoladeLeaderTitle?: string;
  accoladeLeaderSubtitle?: string;
  accolades: Accolade[];
}

export interface AdminProfileSettings {
  name: string;
  avatar: string;
  title?: string;
  bio?: string;
  linkedinUrl?: string;
}

export interface MusicSettings {
  url: string;
  enabled: boolean;
  uiSoundsEnabled: boolean;
}

export interface Settings {
  theme: ThemeSettings;
  portfolio: PortfolioSettings;
  adminProfile: AdminProfileSettings;
  musicSettings: MusicSettings;
  aboutPage?: AboutPageSettings;
}

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface LoginResponse {
  success: true;
  token: string;
  user: User;
}

export interface ApiErrorBody {
  error: string;
}
