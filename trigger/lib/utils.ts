/**
 * Pause execution for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a relative time string ("10 hours", "3 minutes", "2 days") into hours.
 * Returns null if the format is not recognized.
 */
export function parseTimeToHours(timeText: string): number | null {
  if (!timeText) return null;

  const lower = timeText.toLowerCase();

  const minuteMatch = lower.match(/(\d+)\s*(minute|min|m)/);
  if (minuteMatch) return parseInt(minuteMatch[1], 10) / 60;

  const hourMatch = lower.match(/(\d+)\s*(hour|heure|h)/);
  if (hourMatch) return parseInt(hourMatch[1], 10);

  const dayMatch = lower.match(/(\d+)\s*(day|jour|d)/);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24;

  const weekMatch = lower.match(/(\d+)\s*(week|semaine|w)/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 24 * 7;

  const monthMatch = lower.match(/(\d+)\s*(month|mois)/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 24 * 30;

  return null;
}

/**
 * Calculate an ISO date (YYYY-MM-DD) by subtracting the relative time from now.
 */
export function calculateDateFromTime(timeText: string): string | null {
  const ageInHours = parseTimeToHours(timeText);
  if (ageInHours === null) return null;

  const pastDate = new Date(Date.now() - ageInHours * 60 * 60 * 1000);
  return pastDate.toISOString().substring(0, 10);
}

/**
 * Detect LinkedIn ACo-style URLs (e.g. /in/ACoAAA...).
 */
export function isACoUrl(url: string): boolean {
  return !!url && url.includes("/in/ACo");
}

/**
 * Convert a Unix timestamp (ms) to a relative time string ("2 hours", "30 minutes").
 */
export function timestampToRelativeTime(viewedAtMs: number): string {
  const diffMs = Date.now() - viewedAtMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (hours >= 1) return `${hours} hours`;
  return `${minutes} minutes`;
}

/**
 * Convert a Unix timestamp (ms) to an ISO date string "YYYY-MM-DD".
 */
export function timestampToISODate(viewedAtMs: number): string {
  return new Date(viewedAtMs).toISOString().substring(0, 10);
}

/**
 * Profile view as normalized from the Voyager wvmpCards response.
 */
export interface ProfileView {
  viewedAt?: number;
  last_viewed_time?: string;
  profile?: {
    id?: string;
    full_name?: string;
    url?: string;
    headline?: string;
  };
  calculated_date?: string;
}

/**
 * Filter profile views: exclude anonymous (no profile.id) and views older than 24h.
 */
export function filterProfileViews(views: ProfileView[]): ProfileView[] {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  return views.filter((view) => {
    if (!view.profile) return false;
    if (!view.profile.id) return false;
    if (view.viewedAt && view.viewedAt < twentyFourHoursAgo) return false;
    return true;
  });
}
