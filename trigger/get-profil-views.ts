import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import {
  filterProfileViews,
  isACoUrl,
  parseViewedAgoText,
  sleep,
  sendErrorToScriptLogs,
  type ProfileView,
  type TaskError,
} from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const RATE_LIMIT = {
  PAUSE_BETWEEN_PROFILES: 3000,
  PAUSE_AFTER_ENRICHMENT: 1500,
  PAUSE_AFTER_429: 5000,
  PAUSE_BETWEEN_PAGES: 2000,
};

const MAX_RETRIES = 2;
const PAGE_SIZE = 10;

/**
 * GraphQL Voyager URL for paginated profile viewers.
 * Doc: https://developer.unipile.com/docs/get-raw-data-example#get-own-profile-viewers
 * Variables: start (offset), count (page size), surfaceType WVMP
 */
function buildGraphQLViewersUrl(start: number, count: number): string {
  return `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(start:${start},count:${count},query:(),analyticsEntityUrn:(activityUrn:urn%3Ali%3Adummy%3A-1),surfaceType:WVMP)&queryId=voyagerPremiumDashAnalyticsObject.c31102e906e7098910f44e0cecaa5b5c`;
}

// ============================================
// TYPES
// ============================================
interface TeamProfile {
  id: string;
  linkedin_url_owner_post: string;
  unipile_account_id: string;
}

// ============================================
// SCHEDULED TASK — 1x/jour à 7h00 UTC
// ============================================
export const getProfilViewsTask = schedules.task({
  id: "get-profil-views",
  // cron: "0 7 * * *",   ← à activer lors du déploiement via le dashboard
  maxDuration: 600, // 10 min max
  run: async () => {
    logger.info("=== DÉMARRAGE get-profil-views ===");

    // 1. Récupérer les profils d'équipe
    const teamProfiles = await getTeamProfiles();

    if (teamProfiles.length === 0) {
      logger.warn("Aucun profil d'équipe avec unipile_account_id trouvé");
      return { success: false, message: "Aucun profil d'équipe" };
    }

    logger.info(`${teamProfiles.length} profils d'équipe à traiter`);

    // 2. Traiter chaque profil
    let successCount = 0;
    let failureCount = 0;
    let totalInserted = 0;
    let totalEnriched = 0;
    const errors: TaskError[] = [];

    for (let i = 0; i < teamProfiles.length; i++) {
      const profile = teamProfiles[i];
      logger.info(
        `Profil ${i + 1}/${teamProfiles.length}: ${profile.linkedin_url_owner_post}`
      );

      try {
        const result = await processProfile(profile);
        successCount++;
        totalInserted += result.insertedCount;
        totalEnriched += result.enrichedCount;
        logger.info(
          `Profil traité: ${result.viewsCount} vues, ${result.enrichedCount} enrichies, ${result.insertedCount} insérées`
        );
      } catch (err) {
        failureCount++;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Échec profil ${profile.linkedin_url_owner_post}`, {
          error: msg,
        });
        errors.push({
          type: "Processing",
          code: "exception",
          message: msg,
          profile: profile.linkedin_url_owner_post,
        });
      }

      // Pause entre profils
      if (i < teamProfiles.length - 1) {
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_PROFILES);
      }
    }

    // Send error recap to #script-logs
    await sendErrorToScriptLogs("Profile Views", [{
      label: "Profils d'équipe",
      inserted: totalInserted,
      skipped: teamProfiles.length - successCount - failureCount,
      errors,
    }]);

    const summary = {
      success: successCount > 0,
      totalProfiles: teamProfiles.length,
      successCount,
      failureCount,
      totalInserted,
      totalEnriched,
    };

    // Send success recap webhook
    const successWebhook = process.env.webhook_succes_profil_view ?? "";
    if (successWebhook) {
      const now = new Date();
      const dateStr = now.toISOString().substring(0, 10);
      const timeStr = now.toISOString().substring(11, 16);
      const text = `[Profile Views — Trigger.dev] ✅ — ${dateStr} ${timeStr}\n• ${teamProfiles.length} profils traités, ${totalInserted} visites insérées, ${totalEnriched} enrichies`;
      try {
        await fetch(successWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch (err) {
        logger.warn("Failed to send success webhook", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("=== RÉSUMÉ ===", summary);
    return summary;
  },
});

// ============================================
// RÉCUPÉRATION DES PROFILS D'ÉQUIPE
// ============================================
async function getTeamProfiles(): Promise<TeamProfile[]> {
  const { data, error } = await supabase
    .from("workspace_team")
    .select("id, linkedin_url_owner_post, unipile_account_id")
    .not("unipile_account_id", "is", null);

  if (error) {
    throw new Error(`Erreur Supabase workspace_team: ${error.message}`);
  }

  return (data ?? []).filter(
    (p) =>
      p.linkedin_url_owner_post &&
      p.unipile_account_id &&
      p.linkedin_url_owner_post.includes("linkedin.com")
  ) as TeamProfile[];
}

// ============================================
// TRAITEMENT D'UN PROFIL
// ============================================
async function processProfile(profile: TeamProfile) {
  // Récupérer les profile views avec retry
  const allViews = await getProfileViewsWithRetry(
    profile.unipile_account_id,
    MAX_RETRIES
  );

  // Filtrer (exclure anonymes + > 24h)
  const filtered = filterProfileViews(allViews);
  logger.info(
    `${allViews.length} vues récupérées, ${filtered.length} après filtrage (< 24h, non anonymes)`
  );

  // Enrichir les URLs ACo → slug propre
  let enrichedCount = 0;
  for (const view of filtered) {
    if (view.profile?.url && isACoUrl(view.profile.url)) {
      const enriched = await enrichContactUrl(
        view.profile.url,
        profile.unipile_account_id
      );
      if (enriched && enriched !== view.profile.url) {
        view.profile.url = enriched;
        enrichedCount++;
      }
    }
  }

  // Upsert dans Supabase
  const insertedCount = await upsertVisits(
    filtered,
    profile.linkedin_url_owner_post
  );

  return {
    viewsCount: filtered.length,
    enrichedCount,
    insertedCount,
  };
}

// ============================================
// RÉCUPÉRATION DES PROFILE VIEWS (GRAPHQL PAGINÉ)
// ============================================
async function getProfileViewsWithRetry(
  accountId: string,
  maxRetries: number
): Promise<ProfileView[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      logger.warn(
        `Retry ${attempt}/${maxRetries} pour profile views...`
      );
      await sleep(RATE_LIMIT.PAUSE_AFTER_429);
    }

    try {
      return await fetchProfileViews(accountId);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!lastError.message.includes("429")) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Échec après retries");
}

/**
 * Fetch profile views via GraphQL endpoint with pagination.
 * Doc: https://developer.unipile.com/docs/get-raw-data-example#get-own-profile-viewers
 *
 * Pagine tant qu'il y a des viewers < 24h sur la page.
 * S'arrête quand tous les viewers d'une page sont > 24h ou quand la page est vide.
 */
async function fetchProfileViews(
  accountId: string
): Promise<ProfileView[]> {
  const allViews: ProfileView[] = [];
  let start = 0;
  let hasRecentViewers = true;

  while (hasRecentViewers) {
    const url = buildGraphQLViewersUrl(start, PAGE_SIZE);
    logger.info(`Fetch profile viewers page start=${start}...`);

    const response = (await unipile.rawRoute(accountId, url, false)) as any;
    const pageViews = parseGraphQLResponse(response);

    if (pageViews.length === 0) {
      logger.info(`Page vide à start=${start}, fin de pagination`);
      break;
    }

    allViews.push(...pageViews);

    // Vérifier si au moins un viewer est < 24h sur cette page
    const hasAnyRecent = pageViews.some(
      (v) => v.ageInHours !== undefined && v.ageInHours <= 24
    );

    if (!hasAnyRecent) {
      logger.info(
        `Plus aucun viewer < 24h à start=${start}, fin de pagination`
      );
      hasRecentViewers = false;
    } else {
      start += PAGE_SIZE;
      await sleep(RATE_LIMIT.PAUSE_BETWEEN_PAGES);
    }
  }

  logger.info(`Total: ${allViews.length} viewers récupérés`);
  return allViews;
}

/**
 * Parse la réponse GraphQL profile viewers.
 * Path: data.data.premiumDashAnalyticsObjectByAnalyticsEntity.elements[]
 */
function parseGraphQLResponse(response: any): ProfileView[] {
  try {
    const elements =
      response?.data?.data?.premiumDashAnalyticsObjectByAnalyticsEntity
        ?.elements;
    if (!elements?.length) {
      return [];
    }

    const views: ProfileView[] = [];

    for (const element of elements) {
      const lockup =
        element?.content?.analyticsEntityLockup?.entityLockup;
      if (!lockup) continue; // Skip promo/upsell slots

      const navigationUrl: string | undefined = lockup.navigationUrl;
      if (!navigationUrl) continue;

      // Skip semi-anonymous viewers ("Someone at Company" → URL vers /search/)
      if (navigationUrl.includes("/search/")) continue;

      // Skip si ce n'est pas un profil LinkedIn
      if (!navigationUrl.includes("/in/")) continue;

      const titleText: string = lockup.title?.text ?? "";
      const subtitleText: string = lockup.subtitle?.text ?? "";
      const captionText: string = lockup.caption?.text ?? "";

      // Parse "Viewed 5h ago" → { hours: 5, relativeText: "5 hours" }
      const parsed = parseViewedAgoText(captionText);

      // Extraire l'identifiant ACo depuis l'URL
      const acoMatch = navigationUrl.match(/\/in\/([^/?]+)/);
      const acoId = acoMatch?.[1];
      if (!acoId) continue;

      const profileUrl = `https://www.linkedin.com/in/${acoId}`;

      views.push({
        ageInHours: parsed?.hours,
        last_viewed_time: parsed?.relativeText,
        calculated_date: parsed
          ? new Date(Date.now() - parsed.hours * 3600000)
              .toISOString()
              .substring(0, 10)
          : undefined,
        profile: {
          id: acoId,
          full_name: titleText,
          url: profileUrl,
          headline: subtitleText,
        },
      });
    }

    return views;
  } catch (err) {
    logger.error("Erreur parsing GraphQL profile viewers", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ============================================
// ENRICHISSEMENT DES URLs (ACo → slug propre)
// ============================================
async function enrichContactUrl(
  originalUrl: string,
  accountId: string
): Promise<string | null> {
  // 1. Check cache Supabase
  const { data: cached } = await supabase
    .from("enriched_contacts")
    .select("enriched_url")
    .eq("original_url", originalUrl)
    .maybeSingle();

  if (cached?.enriched_url) {
    logger.debug(`Cache hit: ${originalUrl} → ${cached.enriched_url}`);
    return cached.enriched_url;
  }

  // 2. Appel API Unipile pour résoudre l'URL
  try {
    // Extraire l'identifiant ACo depuis l'URL
    const acoMatch = originalUrl.match(/\/in\/([^/?]+)/);
    const identifier = acoMatch?.[1] ?? originalUrl;

    logger.debug(`Enrichissement API: ${identifier}`);
    const userData = (await unipile.getUser(identifier, accountId)) as any;

    const slug = userData?.public_identifier;
    const enrichedUrl = slug
      ? `https://www.linkedin.com/in/${slug}`
      : null;

    if (enrichedUrl && enrichedUrl !== originalUrl) {
      await supabase.from("enriched_contacts").upsert(
        {
          original_url: originalUrl,
          enriched_url: enrichedUrl,
          profile_data: userData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "original_url" }
      );
    }

    await sleep(RATE_LIMIT.PAUSE_AFTER_ENRICHMENT);
    return enrichedUrl ?? originalUrl;
  } catch (err) {
    logger.warn(`Échec enrichissement ${originalUrl}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return originalUrl;
  }
}

// ============================================
// UPSERT DANS SUPABASE
// ============================================
async function upsertVisits(
  views: ProfileView[],
  profileVisited: string
): Promise<number> {
  if (views.length === 0) return 0;

  const batchData = views
    .filter((v) => v.profile && v.calculated_date)
    .map((view) => ({
      type_reaction: "visit_profil",
      profil_linkedin_url_reaction: view.profile!.url ?? "",
      profil_fullname: view.profile!.full_name ?? "",
      headline: view.profile!.headline ?? "",
      linkedin_url_profil_visited: profileVisited,
      date_scrapped: view.last_viewed_time ?? "",
      date_scrapped_calculated: view.calculated_date!,
    }));

  if (batchData.length === 0) return 0;

  logger.info(`Upsert de ${batchData.length} visites dans scrapped_visit...`);

  const { error } = await supabase.from("scrapped_visit").upsert(
    batchData,
    {
      onConflict:
        "profil_linkedin_url_reaction,linkedin_url_profil_visited,date_scrapped_calculated",
    }
  );

  if (error) {
    logger.error(`Erreur upsert Supabase: ${error.message}`);
    throw new Error(`Upsert failed: ${error.message}`);
  }

  logger.info(`Upsert terminé: ${batchData.length} enregistrements`);
  return batchData.length;
}
