import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import {
  filterProfileViews,
  isACoUrl,
  sleep,
  timestampToISODate,
  timestampToRelativeTime,
  type ProfileView,
} from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const RATE_LIMIT = {
  PAUSE_BETWEEN_PROFILES: 3000,
  PAUSE_AFTER_ENRICHMENT: 1500,
  PAUSE_AFTER_429: 5000,
};

const MAX_RETRIES = 2;

const WVMP_URL =
  "https://www.linkedin.com/voyager/api/identity/wvmpCards";

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
        logger.error(`Échec profil ${profile.linkedin_url_owner_post}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Pause entre profils
      if (i < teamProfiles.length - 1) {
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_PROFILES);
      }
    }

    const summary = {
      success: successCount > 0,
      totalProfiles: teamProfiles.length,
      successCount,
      failureCount,
      totalInserted,
      totalEnriched,
    };

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

  // Trier par viewedAt (plus récent d'abord)
  allViews.sort((a, b) => (b.viewedAt ?? 0) - (a.viewedAt ?? 0));

  // Filtrer (exclure anonymes + > 24h)
  const filtered = filterProfileViews(allViews);
  logger.info(
    `${allViews.length} vues récupérées, ${filtered.length} après filtrage (< 24h, non anonymes)`
  );

  // Enrichir les URLs ACo si nécessaire
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
// RÉCUPÉRATION DES PROFILE VIEWS (UNIPILE)
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
 * Fetch profile views via Unipile raw route → LinkedIn Voyager wvmpCards.
 *
 * Pas de pagination : wvmpCards retourne un dashboard avec ~25 viewers max
 * répartis dans 7 insightCards (Summary, Notable, Company, JobTitle, Source).
 * On parse toutes les cards et on déduplique.
 *
 * TODO: Si Julien (CEO Unipile) ajoute un endpoint natif avec pagination,
 * remplacer cette fonction par un appel direct.
 */
async function fetchProfileViews(
  accountId: string
): Promise<ProfileView[]> {
  logger.info("Appel raw route wvmpCards...");

  const response = (await unipile.rawRoute(
    accountId,
    WVMP_URL
  )) as any;

  return parseWvmpResponse(response);
}

/**
 * Parse la réponse Voyager wvmpCards.
 * Itère sur toutes les insightCards, extrait les viewers, déduplique par publicIdentifier.
 */
function parseWvmpResponse(response: any): ProfileView[] {
  try {
    const elements = response?.data?.elements;
    if (!elements?.length) {
      logger.warn("Réponse wvmpCards vide (pas d'elements)");
      return [];
    }

    // Naviguer vers la WvmpViewersCard
    const firstElement = elements[0]?.value;
    if (!firstElement) return [];

    const viewersCardKey = Object.keys(firstElement).find((k) =>
      k.includes("WvmpViewersCard")
    );
    if (!viewersCardKey) {
      logger.warn("WvmpViewersCard non trouvée dans la réponse");
      return [];
    }

    const insightCards = firstElement[viewersCardKey]?.insightCards ?? [];
    logger.info(`${insightCards.length} insightCards trouvées`);

    // Collecter tous les viewers uniques
    const viewerMap = new Map<string, ProfileView>();

    for (const insightCard of insightCards) {
      const cardValue = insightCard?.value;
      if (!cardValue) continue;

      const cardTypeKey = Object.keys(cardValue)[0];
      const cardData = cardValue[cardTypeKey];
      const cards = cardData?.cards ?? [];

      for (const card of cards) {
        const profileCardValue = card?.value;
        if (!profileCardValue) continue;

        const profileCardKey = Object.keys(profileCardValue)[0];
        const profileCard = profileCardValue[profileCardKey];

        const viewedAt: number | undefined = profileCard?.viewedAt;
        const viewer = profileCard?.viewer;
        if (!viewer) continue;

        const viewerTypeKey = Object.keys(viewer)[0];

        // Skip anonymous/obfuscated viewers
        if (viewerTypeKey.includes("Obfuscated")) continue;

        const viewerData = viewer[viewerTypeKey];
        const miniProfile =
          viewerData?.profile?.miniProfile ?? viewerData?.miniProfile;
        if (!miniProfile) continue;

        const publicIdentifier: string | undefined =
          miniProfile.publicIdentifier;
        if (!publicIdentifier) continue;

        // Dédupliquer : garder le viewedAt le plus récent
        const existing = viewerMap.get(publicIdentifier);
        if (existing && existing.viewedAt && viewedAt && existing.viewedAt >= viewedAt) {
          continue;
        }

        const url = `https://www.linkedin.com/in/${publicIdentifier}`;
        const fullName = [miniProfile.firstName, miniProfile.lastName]
          .filter(Boolean)
          .join(" ");

        viewerMap.set(publicIdentifier, {
          viewedAt,
          last_viewed_time: viewedAt
            ? timestampToRelativeTime(viewedAt)
            : undefined,
          calculated_date: viewedAt
            ? timestampToISODate(viewedAt)
            : undefined,
          profile: {
            id: publicIdentifier,
            full_name: fullName,
            url,
            headline: miniProfile.occupation ?? "",
          },
        });
      }
    }

    const viewers = Array.from(viewerMap.values());
    logger.info(
      `${viewers.length} viewers uniques extraits de toutes les insightCards`
    );
    return viewers;
  } catch (err) {
    logger.error("Erreur parsing wvmpCards", {
      error: err instanceof Error ? err.message : String(err),
      response: JSON.stringify(response).substring(0, 500),
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
    logger.debug(`Enrichissement API: ${originalUrl}`);
    const userData = (await unipile.getUser(originalUrl, accountId)) as any;

    const enrichedUrl =
      userData?.public_profile_url ??
      (userData?.provider_id
        ? `https://www.linkedin.com/in/${userData.provider_id}`
        : null);

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
