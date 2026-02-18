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
 * Parse a "Viewed Xh ago" / "Viewed Xm ago" / "Viewed Xd ago" caption
 * into hours (number) and a relative text for date_scrapped.
 * Returns null if not parseable.
 */
export function parseViewedAgoText(
  caption: string
): { hours: number; relativeText: string } | null {
  if (!caption) return null;
  const match = caption.match(/Viewed\s+(\d+)([mhdw])\s+ago/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m":
      return { hours: value / 60, relativeText: `${value} minutes` };
    case "h":
      return { hours: value, relativeText: `${value} hours` };
    case "d":
      return { hours: value * 24, relativeText: `${value} days` };
    case "w":
      return { hours: value * 24 * 7, relativeText: `${value * 7} days` };
    default:
      return null;
  }
}

/**
 * Profile view normalized from the GraphQL profile viewers response.
 */
export interface ProfileView {
  ageInHours?: number;
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
 * Filter profile views: exclude those without profile/id and views older than 24h.
 */
export function filterProfileViews(views: ProfileView[]): ProfileView[] {
  return views.filter((view) => {
    if (!view.profile) return false;
    if (!view.profile.id) return false;
    if (view.ageInHours !== undefined && view.ageInHours > 24) return false;
    return true;
  });
}

// ============================================
// ERROR REPORTING TO SLACK #script-logs
// ============================================

export interface TaskError {
  type: string;
  code: string | number;
  message: string;
  profile?: string;
}

export interface TaskResultGroup {
  label: string;
  inserted: number;
  skipped: number;
  errors: TaskError[];
}

/**
 * Send a standardized error recap to the script_logs Slack webhook.
 * Only sends if there are errors. Silent no-op if no errors or webhook not configured.
 */
export async function sendErrorToScriptLogs(
  taskName: string,
  groups: TaskResultGroup[]
): Promise<void> {
  const totalErrors = groups.reduce((sum, g) => sum + g.errors.length, 0);
  if (totalErrors === 0) return;

  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) {
    console.warn("script_logs env var not set, skipping error alert");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toISOString().substring(11, 16);

  let message = `[${taskName} — Trigger.dev] ⚠️ Erreurs — ${dateStr} ${timeStr}\n`;

  // Results section
  message += `\n📊 Résultats\n`;
  for (const group of groups) {
    message += `• ${group.label}: ${group.inserted} insérés | ${group.skipped} ignorés\n`;
  }

  // Errors section — group by type (code) within each group
  message += `\n❌ Erreurs (${totalErrors})\n`;
  for (const group of groups) {
    if (group.errors.length === 0) continue;

    const grouped: Record<string, number> = {};
    for (const err of group.errors) {
      const key = `${err.type} (${err.code})`;
      grouped[key] = (grouped[key] ?? 0) + 1;
    }

    const parts = Object.entries(grouped)
      .map(([errType, count]) => `${count}x ${errType}`)
      .join(", ");
    message += `• ${group.label}: ${parts}\n`;
  }

  message += `\nTotal: ${totalErrors} erreurs`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    console.error(
      "Failed to send error alert to script_logs:",
      err instanceof Error ? err.message : String(err)
    );
  }
}
