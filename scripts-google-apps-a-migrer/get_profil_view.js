// ============================================
// CONFIGURATION DES PAUSES (en millisecondes)
// ============================================
const RATE_LIMIT_CONFIG = {
  PAUSE_BETWEEN_PAGES: 2000,        // 2 secondes entre pages de pagination
  PAUSE_BETWEEN_PROFILES: 3000,     // 3 secondes entre profils
  PAUSE_AFTER_ENRICHMENT: 1500,     // 1.5 secondes après enrichissement API
  PAUSE_AFTER_429: 5000,            // 5 secondes après erreur 429
  PAUSE_EVERY_N_INSERTS: 10,        // Pause tous les X inserts
  PAUSE_INSERT_BATCH: 1000          // Pause pour les inserts batch
};



// ============================================
// FONCTION PRINCIPALE
// ============================================
function get_profil_view_allTeamProfiles() {
  console.log("=== DÉMARRAGE DU TRAITEMENT DE TOUS LES PROFILS D'ÉQUIPE ===");
  
  const teamProfilesResult = getTeamProfiles_visit_profil();
  
  if (!teamProfilesResult.success) {
    console.log(`ERREUR: Impossible de récupérer les profils d'équipe - ${teamProfilesResult.message}`);
    return {
      success: false,
      message: teamProfilesResult.message
    };
  }
  
  const teamProfiles = teamProfilesResult.profiles;
  
  if (teamProfiles.length === 0) {
    console.log("Aucun profil d'équipe valide trouvé dans la table workspace_team");
    return {
      success: false,
      message: "Aucun profil d'équipe valide trouvé"
    };
  }
  
  console.log(`${teamProfiles.length} profils d'équipe trouvés à traiter`);
  
  // Test de connectivité
  console.log("\n=== TEST: Connectivité API Ghost Genius ===");
  const apiConnected = testGhostGeniusAPI_visit_profil();
  
  if (!apiConnected) {
    console.log("ÉCHEC: Impossible de se connecter à l'API Ghost Genius");
    return {
      success: false,
      message: "Échec de connexion à l'API Ghost Genius"
    };
  }
  
  // Traiter chaque profil
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  let totalEnrichmentSuccessCount = 0;
  let totalEnrichmentFailureCount = 0;
  let totalInsertedCount = 0;
  let totalUpdatedCount = 0;
  let totalSkippedCount = 0;
  let total429Errors = 0;
  
  teamProfiles.forEach((profile, index) => {
    const profileId = profile.id;
    const linkedinUrl = profile.linkedin_url_owner_post;
    const ghostGeniusAccountId = profile.ghost_genius_account_id;
    
    console.log(`\n=== TRAITEMENT DU PROFIL #${index + 1}/${teamProfiles.length} ===`);
    console.log(`ID du profil: ${profileId}`);
    console.log(`URL LinkedIn: ${linkedinUrl}`);
    console.log(`ID de compte Ghost Genius: ${ghostGeniusAccountId}`);
    
    try {
      // Récupération avec retry en cas de 429
      const result = getLinkedInProfileViewsWithRetry_visit_profil(ghostGeniusAccountId, linkedinUrl);
      
      if (result.success) {
        successCount++;
        console.log(`✅ Profil traité avec succès: ${result.filtered_total} vues, ${result.enrichment_stats.success_count} URLs enrichies`);
        
        if (result.upsert_stats) {
          console.log(`📊 Upsert Supabase: ${result.upsert_stats.inserted_count} insérées, ${result.upsert_stats.updated_count} mises à jour, ${result.upsert_stats.skipped_count} ignorées`);
          totalInsertedCount += result.upsert_stats.inserted_count;
          totalUpdatedCount += result.upsert_stats.updated_count;
          totalSkippedCount += result.upsert_stats.skipped_count;
        }
        
        totalEnrichmentSuccessCount += result.enrichment_stats.success_count;
        totalEnrichmentFailureCount += result.enrichment_stats.failed_count;
        total429Errors += result.rate_limit_errors || 0;
      } else {
        failureCount++;
        console.log(`❌ Échec du traitement du profil: ${result.message}`);
      }
      
      result.profile_id = profileId;
      results.push(result);
      
      // Pause entre profils
      if (index < teamProfiles.length - 1) {
        console.log(`⏸️  Pause de ${RATE_LIMIT_CONFIG.PAUSE_BETWEEN_PROFILES/1000} secondes avant le prochain profil...`);
        Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_BETWEEN_PROFILES);
      }
    } catch (error) {
      failureCount++;
      console.log(`❌ Exception lors du traitement du profil: ${error.toString()}`);
      results.push({
        success: false,
        profile_id: profileId,
        message: `Exception: ${error.toString()}`,
        profil_visited: linkedinUrl,
        ghost_genius_account_id: ghostGeniusAccountId
      });
    }
  });
  
  // Résumé final
  console.log("\n=== RÉSUMÉ DU TRAITEMENT DES PROFILS ===");
  console.log(`Total des profils traités: ${teamProfiles.length}`);
  console.log(`Profils traités avec succès: ${successCount}`);
  console.log(`Profils en échec: ${failureCount}`);
  console.log(`Total des URLs enrichies: ${totalEnrichmentSuccessCount}`);
  console.log(`Total des échecs d'enrichissement: ${totalEnrichmentFailureCount}`);
  console.log(`Total des erreurs 429 (rate limit): ${total429Errors}`);
  console.log(`Total des vues insérées: ${totalInsertedCount}`);
  console.log(`Total des vues mises à jour: ${totalUpdatedCount}`);
  console.log(`Total des vues ignorées (déjà existantes): ${totalSkippedCount}`);
  
  return {
    success: successCount > 0,
    message: `${successCount}/${teamProfiles.length} profils traités avec succès`,
    results: results,
    summary: {
      total_profiles: teamProfiles.length,
      success_count: successCount,
      failure_count: failureCount,
      total_enrichment_success_count: totalEnrichmentSuccessCount,
      total_enrichment_failure_count: totalEnrichmentFailureCount,
      total_429_errors: total429Errors,
      total_inserted_count: totalInsertedCount,
      total_updated_count: totalUpdatedCount,
      total_skipped_count: totalSkippedCount
    }
  };
}

// ============================================
// FONCTION DE TEST API
// ============================================
function testGhostGeniusAPI_visit_profil() {
  try {
    if (!GHOST_GENIUS_API_KEY || GHOST_GENIUS_API_KEY === "YOUR_GHOST_GENIUS_API_KEY") {
      console.log("ERREUR: Clé API Ghost Genius non définie");
      return false;
    }
    
    const testEndpoint = `${GHOST_GENIUS_API_URL}/private/connections`;
    const options = {
      'method': 'GET',
      'headers': {
        'Authorization': `Bearer ${GHOST_GENIUS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      'muteHttpExceptions': true
    };
    
    console.log("Test de connectivité à l'API Ghost Genius...");
    
    const response = UrlFetchApp.fetch(testEndpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    console.log(`Code de réponse: ${responseCode}`);
    
    if (responseCode === 200) {
      console.log("✅ Connexion à l'API Ghost Genius réussie");
      return true;
    } else if (responseCode === 400 && responseText.includes('account_id')) {
      console.log("✅ Connexion à l'API Ghost Genius réussie (erreur account_id attendue)");
      return true;
    } else if (responseCode === 401) {
      console.log("❌ Erreur d'authentification - Vérifiez votre clé API");
      return false;
    } else if (responseCode === 403) {
      console.log("❌ Accès interdit - Vérifiez vos permissions");
      return false;
    } else if (responseCode >= 500) {
      console.log("❌ Erreur serveur Ghost Genius (Code: " + responseCode + ")");
      return false;
    } else {
      console.log("⚠️ Réponse inattendue de l'API (Code: " + responseCode + ")");
      return responseCode < 400;
    }
    
  } catch (error) {
    console.log("❌ Exception lors du test de connectivité: " + error.toString());
    return false;
  }
}

// ============================================
// FONCTION AVEC RETRY
// ============================================
function getLinkedInProfileViewsWithRetry_visit_profil(ghost_genius_account_id, linkedin_url_profil_visited, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;
  
  while (attempt <= maxRetries) {
    if (attempt > 0) {
      console.log(`🔄 Tentative ${attempt + 1}/${maxRetries + 1} après erreur de rate limiting...`);
      Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_AFTER_429);
    }
    
    const result = getLinkedInProfileViews_visit_profil(ghost_genius_account_id, linkedin_url_profil_visited);
    
    // Si succès ou erreur non-429, retourner le résultat
    if (result.success || !result.is_rate_limit_error) {
      return result;
    }
    
    lastError = result;
    attempt++;
  }
  
  // Si toutes les tentatives ont échoué
  console.log(`❌ Échec après ${maxRetries + 1} tentatives`);
  return lastError;
}

// ============================================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// ============================================
function getLinkedInProfileViews_visit_profil(ghost_genius_account_id, linkedin_url_profil_visited) {
  try {
    if (!GHOST_GENIUS_API_KEY || GHOST_GENIUS_API_KEY === "YOUR_GHOST_GENIUS_API_KEY") {
      console.log("ERREUR: Veuillez définir votre clé API Ghost Genius");
      return {
        success: false,
        message: "Clé API non définie"
      };
    }
    
    if (!ghost_genius_account_id) {
      console.log("ERREUR: ID de compte Ghost Genius non fourni");
      return {
        success: false,
        message: "ID de compte non fourni"
      };
    }
    
    const apiEndpoint = `${GHOST_GENIUS_API_URL}/private/profile-views`;
    const params = {
      "method": "GET",
      "headers": {
        "Authorization": "Bearer " + GHOST_GENIUS_API_KEY,
        "Content-Type": "application/json"
      },
      "muteHttpExceptions": true
    };
    
    let currentPage = 1;
    let hasMorePages = true;
    let allProfileViews = [];
    let totalViews = 0;
    let rateLimitErrors = 0;
    const MAX_PAGES = 3;
    
    console.log(`Début de la récupération des vues de profil pour ${linkedin_url_profil_visited} avec pagination...`);
    
    // Boucle de pagination
    while (hasMorePages && currentPage <= MAX_PAGES) {
      const url = `${apiEndpoint}?account_id=${ghost_genius_account_id}&page=${currentPage}`;
      
      console.log(`📄 Récupération de la page ${currentPage}/${MAX_PAGES}...`);
      
      const response = UrlFetchApp.fetch(url, params);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      // Gestion erreur 429
      if (responseCode === 429) {
        rateLimitErrors++;
        console.log(`⚠️ Rate limit atteint (429) à la page ${currentPage}`);
        return {
          success: false,
          message: `Rate limit error à la page ${currentPage}`,
          is_rate_limit_error: true,
          rate_limit_errors: rateLimitErrors
        };
      }
      
      // Gestion erreur 401
      if (responseCode === 401) {
        console.log(`❌ Erreur d'authentification (401) - Session LinkedIn expirée pour ce compte Ghost Genius`);
        return {
          success: false,
          message: "Session LinkedIn expirée - Reconnexion requise sur Ghost Genius",
          is_auth_error: true
        };
      }
      
      if (responseCode === 200) {
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.log("ERREUR: Impossible d'analyser la réponse JSON: " + parseError.toString());
          break;
        }
        
        if (!responseData || !responseData.data) {
          console.log("ERREUR: Format de réponse inattendu à la page " + currentPage);
          break;
        }
        
        if (currentPage === 1 && responseData.total) {
          totalViews = responseData.total;
          console.log(`📊 Total des vues de profil: ${totalViews}`);
        }
        
        allProfileViews = allProfileViews.concat(responseData.data);
        console.log(`✅ Page ${currentPage} récupérée: ${responseData.data.length} vues`);
        
        if (responseData.data.length < 10 || currentPage >= MAX_PAGES) {
          hasMorePages = false;
          if (currentPage >= MAX_PAGES) {
            console.log(`🛑 Limite de ${MAX_PAGES} pages atteinte.`);
          } else {
            console.log("✅ Toutes les pages ont été récupérées.");
          }
        } else {
          currentPage++;
          console.log(`⏸️  Pause de ${RATE_LIMIT_CONFIG.PAUSE_BETWEEN_PAGES/1000}s avant page suivante...`);
          Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_BETWEEN_PAGES);
        }
      } else {
        console.log(`ERREUR: Code ${responseCode} à la page ${currentPage}`);
        try {
          const errorData = JSON.parse(responseText);
          console.log("Message d'erreur: " + JSON.stringify(errorData));
        } catch (e) {
          console.log("Réponse brute: " + responseText);
        }
        hasMorePages = false;
      }
    }
    
    // Tri par date (plus récent d'abord)
    allProfileViews.sort((a, b) => {
      if (!a.last_viewed_time) return 1;
      if (!b.last_viewed_time) return -1;
      return a.last_viewed_time < b.last_viewed_time ? 1 : -1;
    });
    
    // Filtrage amélioré
    const filteredProfileViews = filterProfileViews_visit_profil(allProfileViews);
    
    console.log("=== RÉSUMÉ DE LA RÉCUPÉRATION ===");
    console.log(`Total des vues de profil: ${totalViews}`);
    console.log(`Nombre de vues récupérées: ${allProfileViews.length}`);
    console.log(`Nombre de vues après filtrage: ${filteredProfileViews.length}`);
    console.log(`Nombre de pages récupérées: ${currentPage}`);
    
    console.log("\n=== DÉTAIL DES VUES DE PROFIL (FILTRÉES) ===");
    console.log(`Profil visité: ${linkedin_url_profil_visited}`);
    
    let enrichedCount = 0;
    let enrichmentFailedCount = 0;
    
    // Enrichissement des URLs
    filteredProfileViews.forEach(function(view, index) {
      console.log(`------- Vue #${index + 1}/${filteredProfileViews.length} -------`);
      const lastViewedTime = view.last_viewed_time || "Inconnue";
      console.log(`date_scrapped: ${lastViewedTime}`);
      
      const calculatedDate = calculateDateFromTime_visit_profil(lastViewedTime);
      if (calculatedDate) {
        console.log(`date_scrapped_calculated: ${calculatedDate}`);
        view.calculated_date = calculatedDate;
      } else {
        console.log("date_scrapped_calculated: Non calculé (format de temps non compatible)");
      }
      
      const profile = view.profile;
      if (profile) {
        console.log(`profil_fullname: ${profile.full_name}`);
        console.log(`Type: ${profile.type}`);
        
        if (profile.id) {
          console.log(`ID du profil: ${profile.id}`);
        } else {
          console.log("ID du profil: Anonyme");
        }
        
        if (profile.url) {
          console.log(`profil_linkedin_url_original: ${profile.url}`);
          
          try {
            const enrichResult = enrichContact_visit_profil(profile.url);
            view.enrichedProfileInfo = enrichResult;
            
            if (enrichResult.success) {
              enrichedCount++;
              console.log(`profil_linkedin_url_enriched: ${enrichResult.enrichedUrl}`);
              console.log(`Source d'enrichissement: ${enrichResult.source}`);
              
              if (enrichResult.profileInfo) {
                view.extendedProfileInfo = enrichResult.profileInfo;
                console.log("Informations de profil enrichies: Disponibles");
              }
              
              // Pause après enrichissement réussi via API
              if (enrichResult.source === 'api') {
                console.log(`⏸️  Pause de ${RATE_LIMIT_CONFIG.PAUSE_AFTER_ENRICHMENT/1000}s après enrichissement API...`);
                Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_AFTER_ENRICHMENT);
              }
            } else {
              enrichmentFailedCount++;
              console.log(`profil_linkedin_url_enriched: Échec d'enrichissement - ${enrichResult.error || 'Erreur inconnue'}`);
            }
          } catch (enrichError) {
            enrichmentFailedCount++;
            console.log(`Erreur lors de l'enrichissement: ${enrichError.toString()}`);
            view.enrichedProfileInfo = {
              success: false,
              originalUrl: profile.url,
              enrichedUrl: profile.url,
              error: enrichError.toString()
            };
          }
        }
        
        if (profile.headline) {
          console.log(`headline: ${profile.headline}`);
        }
      }
    });
    
    console.log("\n=== STATISTIQUES D'ENRICHISSEMENT ===");
    console.log(`URLs enrichies avec succès: ${enrichedCount} / ${filteredProfileViews.length}`);
    console.log(`URLs avec échec d'enrichissement: ${enrichmentFailedCount}`);
    
    // UPSERT DANS SUPABASE
    console.log("\n=== UPSERT DES DONNÉES DANS SUPABASE ===");
    let upsertResult = { success: false, inserted_count: 0, updated_count: 0, skipped_count: 0 };
    
    if (filteredProfileViews.length > 0) {
      upsertResult = upsertVisitsToSupabase_visit_profil(filteredProfileViews, linkedin_url_profil_visited);
      console.log(`Résultat de l'upsert: ${upsertResult.message}`);
    } else {
      console.log("Aucune vue à insérer dans Supabase après filtrage.");
    }
    
    return {
      success: true,
      message: `Récupération réussie de ${filteredProfileViews.length} vues de profil après filtrage`,
      data: filteredProfileViews,
      total: totalViews,
      filtered_total: filteredProfileViews.length,
      profil_visited: linkedin_url_profil_visited,
      ghost_genius_account_id: ghost_genius_account_id,
      enrichment_stats: {
        success_count: enrichedCount,
        failed_count: enrichmentFailedCount
      },
      upsert_stats: upsertResult,
      rate_limit_errors: rateLimitErrors,
      is_rate_limit_error: false
    };
  } catch (error) {
    console.log("Exception: " + error.toString());
    console.log("Stack trace: " + error.stack);
    
    return {
      success: false,
      message: "Exception: " + error.toString()
    };
  }
}

// ============================================
// FONCTION DE FILTRAGE
// ============================================
function filterProfileViews_visit_profil(profileViews) {
  return profileViews.filter(view => {
    // Vérifier si le profil existe
    if (!view.profile) {
      return false;
    }
    
    // Exclure les profils anonymes
    if (!view.profile.id || view.profile.id === "Anonyme") {
      return false;
    }
    
    // Garder uniquement les vues en heures/minutes (pour avoir la date exacte)
    const lastViewedTime = view.last_viewed_time || "";
    const lowerCaseTime = lastViewedTime.toLowerCase();
    
    if (
      lowerCaseTime.includes("day") || 
      lowerCaseTime.includes("jour") || 
      lowerCaseTime.includes("week") || 
      lowerCaseTime.includes("semaine") || 
      lowerCaseTime.includes("month") || 
      lowerCaseTime.includes("mois")
    ) {
      return false;
    }
    
    return true;
  });
}

// ============================================
// FONCTION DE PARSING DU TEMPS EN HEURES
// ============================================
function parseTimeToHours_visit_profil(timeText) {
  if (!timeText) return null;
  
  const lowerCaseTime = timeText.toLowerCase();
  
  // Minutes
  const minuteMatch = lowerCaseTime.match(/(\d+)\s*(minute|min|m)/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10) / 60;
  }
  
  // Heures
  const hourMatch = lowerCaseTime.match(/(\d+)\s*(hour|heure|h)/);
  if (hourMatch) {
    return parseInt(hourMatch[1], 10);
  }
  
  // Jours
  const dayMatch = lowerCaseTime.match(/(\d+)\s*(day|jour|d)/);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10) * 24;
  }
  
  // Semaines
  const weekMatch = lowerCaseTime.match(/(\d+)\s*(week|semaine|w)/);
  if (weekMatch) {
    return parseInt(weekMatch[1], 10) * 24 * 7;
  }
  
  // Mois
  const monthMatch = lowerCaseTime.match(/(\d+)\s*(month|mois)/);
  if (monthMatch) {
    return parseInt(monthMatch[1], 10) * 24 * 30;
  }
  
  return null;
}

// ============================================
// FONCTION DE CALCUL DE DATE
// ============================================
function calculateDateFromTime_visit_profil(timeText) {
  if (!timeText) return null;
  
  const ageInHours = parseTimeToHours_visit_profil(timeText);
  
  if (ageInHours !== null) {
    const currentDate = new Date();
    const pastDate = new Date(currentDate.getTime() - (ageInHours * 60 * 60 * 1000));
    return pastDate.toISOString().substring(0, 10);
  }
  
  return null;
}

// ============================================
// FONCTION D'ENRICHISSEMENT DE CONTACT
// ============================================
function enrichContact_visit_profil(linkedinUrl) {
  try {
    // D'abord vérifier le cache dans Supabase
    const cachedResult = checkEnrichmentCache_visit_profil(linkedinUrl);
    if (cachedResult.found) {
      console.log(`🔄 URL enrichie trouvée dans la base de données: ${cachedResult.enrichedUrl}`);
      return {
        success: true,
        originalUrl: linkedinUrl,
        enrichedUrl: cachedResult.enrichedUrl,
        source: 'cache',
        profileInfo: cachedResult.profileInfo
      };
    }
    
    // Si pas en cache, appeler l'API Ghost Genius
    console.log(`🔍 Enrichissement via API pour: ${linkedinUrl}`);
    
    // URL CORRIGÉE : ajout du slash entre GHOST_GENIUS_API_URL et profile
    const apiUrl = `${GHOST_GENIUS_API_URL}/profile?url=${encodeURIComponent(linkedinUrl)}`;
    console.log(`🔍 Récupération du profil : ${apiUrl}`);
    
    const options = {
      'method': 'GET',
      'headers': {
        'Authorization': `Bearer ${GHOST_GENIUS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      const profileData = JSON.parse(responseText);
      
      // Extraire l'URL enrichie du profil
      let enrichedUrl = linkedinUrl;
      if (profileData.data && profileData.data.url) {
        enrichedUrl = profileData.data.url;
      } else if (profileData.url) {
        enrichedUrl = profileData.url;
      }
      
      // Sauvegarder dans le cache si c'est une URL ACo
      if (isACoUrl_visit_profil(linkedinUrl) && enrichedUrl !== linkedinUrl) {
        saveToEnrichmentCache_visit_profil(linkedinUrl, enrichedUrl, profileData.data || profileData);
      }
      
      return {
        success: true,
        originalUrl: linkedinUrl,
        enrichedUrl: enrichedUrl,
        source: 'api',
        profileInfo: profileData.data || profileData
      };
    } else if (responseCode === 404) {
      console.error(`❌ Erreur lors de la récupération du profil - Code: ${responseCode}`);
      console.log(`⚠️ Impossible d'enrichir le profil, utilisation de l'URL originale: ${linkedinUrl}`);
      
      if (isACoUrl_visit_profil(linkedinUrl)) {
        console.log("⚠️ URL au format ACo détectée, mais aucune conversion disponible.");
      }
      
      return {
        success: false,
        originalUrl: linkedinUrl,
        enrichedUrl: linkedinUrl,
        error: `API returned ${responseCode}`
      };
    } else if (responseCode === 429) {
      console.log("⚠️ Rate limit atteint sur l'API d'enrichissement");
      Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_AFTER_429);
      
      return {
        success: false,
        originalUrl: linkedinUrl,
        enrichedUrl: linkedinUrl,
        error: 'Rate limit exceeded'
      };
    } else {
      console.error(`❌ Erreur lors de la récupération du profil - Code: ${responseCode}`);
      
      return {
        success: false,
        originalUrl: linkedinUrl,
        enrichedUrl: linkedinUrl,
        error: `API returned ${responseCode}`
      };
    }
  } catch (error) {
    console.log(`❌ Exception lors de l'enrichissement: ${error.toString()}`);
    return {
      success: false,
      originalUrl: linkedinUrl,
      enrichedUrl: linkedinUrl,
      error: error.toString()
    };
  }
}

// ============================================
// FONCTION DE DÉTECTION URL ACo
// ============================================
function isACoUrl_visit_profil(url) {
  return url && url.includes('/in/ACo');
}

// ============================================
// FONCTION DE VÉRIFICATION DU CACHE
// ============================================
function checkEnrichmentCache_visit_profil(originalUrl) {
  try {
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      return { found: false };
    }
    
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    };
    
    const encodedUrl = encodeURIComponent(originalUrl);
    const url = `${SUPABASE_URL}/rest/v1/enriched_contacts?original_url=eq.${encodedUrl}&select=enriched_url,profile_data`;
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: headers,
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data && data.length > 0) {
        return {
          found: true,
          enrichedUrl: data[0].enriched_url,
          profileInfo: data[0].profile_data
        };
      }
    }
    
    return { found: false };
  } catch (error) {
    console.log(`⚠️ Erreur lors de la vérification du cache: ${error.toString()}`);
    return { found: false };
  }
}

// ============================================
// FONCTION DE SAUVEGARDE DANS LE CACHE
// ============================================
function saveToEnrichmentCache_visit_profil(originalUrl, enrichedUrl, profileData) {
  try {
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      return false;
    }
    
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    };
    
    const url = `${SUPABASE_URL}/rest/v1/enriched_contacts`;
    
    const dataToInsert = {
      original_url: originalUrl,
      enriched_url: enrichedUrl,
      profile_data: profileData,
      updated_at: new Date().toISOString()
    };
    
    const response = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: headers,
      payload: JSON.stringify(dataToInsert),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    return responseCode >= 200 && responseCode < 300;
  } catch (error) {
    console.log(`⚠️ Erreur lors de la sauvegarde dans le cache: ${error.toString()}`);
    return false;
  }
}

// ============================================
// FONCTION D'UPSERT SUPABASE (CORRIGÉE - SANS updated_at)
// ============================================
function upsertVisitsToSupabase_visit_profil(profileViews, profileVisited) {
  try {
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL" || 
        !SUPABASE_KEY || SUPABASE_KEY === "YOUR_SUPABASE_KEY") {
      console.log("ERREUR: Veuillez définir vos informations d'authentification Supabase");
      return {
        success: false,
        message: "Informations Supabase non définies",
        inserted_count: 0,
        updated_count: 0,
        skipped_count: 0
      };
    }
    
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation"
    };
    
    const url = `${SUPABASE_URL}/rest/v1/scrapped_visit`;
    
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    console.log(`Début de l'upsert de ${profileViews.length} visites dans la table scrapped_visit...`);
    
    // Préparer les données en batch
    const batchData = [];
    
    for (let i = 0; i < profileViews.length; i++) {
      const view = profileViews[i];
      
      if (!view.profile) {
        console.log(`Ignoré: Vue #${i+1} - Pas de profil associé`);
        skippedCount++;
        continue;
      }
      
      const lastViewedTime = view.last_viewed_time || "";
      const calculatedDate = view.calculated_date || calculateDateFromTime_visit_profil(lastViewedTime);
      const profile = view.profile;
      
      // Déterminer l'URL à utiliser
      let profileUrl = profile.url || "";
      if (view.enrichedProfileInfo && view.enrichedProfileInfo.success) {
        profileUrl = view.enrichedProfileInfo.enrichedUrl;
      }
      
      // CORRIGÉ : suppression de updated_at
      const dataToUpsert = {
        type_reaction: "visit_profil",
        profil_linkedin_url_reaction: profileUrl,
        profil_fullname: profile.full_name || "",
        headline: profile.headline || "",
        linkedin_url_profil_visited: profileVisited,
        date_scrapped: lastViewedTime,
        date_scrapped_calculated: calculatedDate || null
      };
      
      batchData.push(dataToUpsert);
    }
    
    // Upsert en batch
    if (batchData.length > 0) {
      try {
        const response = UrlFetchApp.fetch(url, {
          method: "POST",
          headers: headers,
          payload: JSON.stringify(batchData),
          muteHttpExceptions: true
        });
        
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();
        
        if (responseCode >= 200 && responseCode < 300) {
          // Analyser la réponse pour compter inserts vs updates
          try {
            const responseData = JSON.parse(responseText);
            insertedCount = responseData.length;
            console.log(`✅ Batch upsert réussi: ${insertedCount} enregistrements traités`);
          } catch (e) {
            insertedCount = batchData.length;
            console.log(`✅ Batch upsert réussi: ${batchData.length} enregistrements`);
          }
        } else if (responseCode === 409) {
          // En cas de conflit, essayer un par un
          console.log("⚠️ Conflit détecté en batch, passage en mode individuel...");
          
          for (let i = 0; i < batchData.length; i++) {
            try {
              const singleResponse = UrlFetchApp.fetch(url, {
                method: "POST",
                headers: headers,
                payload: JSON.stringify(batchData[i]),
                muteHttpExceptions: true
              });
              
              const singleCode = singleResponse.getResponseCode();
              
              if (singleCode >= 200 && singleCode < 300) {
                insertedCount++;
                console.log(`✅ Upsert individuel #${i+1}: ${batchData[i].profil_fullname}`);
              } else {
                const errorText = singleResponse.getContentText();
                if (errorText.includes("already exists") || singleCode === 409) {
                  skippedCount++;
                  console.log(`⏭️ Déjà existant #${i+1}: ${batchData[i].profil_fullname}`);
                } else {
                  errors.push(`Erreur #${i+1}: Code ${singleCode}`);
                  console.log(`❌ Échec upsert #${i+1}: Code ${singleCode}`);
                }
              }
              
              // Pause périodique
              if (i > 0 && i % RATE_LIMIT_CONFIG.PAUSE_EVERY_N_INSERTS === 0) {
                Utilities.sleep(RATE_LIMIT_CONFIG.PAUSE_INSERT_BATCH);
              }
            } catch (singleError) {
              errors.push(`Exception #${i+1}: ${singleError.toString()}`);
            }
          }
        } else {
          console.log(`❌ Erreur batch upsert: Code ${responseCode}`);
          console.log(`Réponse: ${responseText}`);
          errors.push(`Batch error: ${responseCode}`);
        }
      } catch (batchError) {
        console.log(`❌ Exception batch upsert: ${batchError.toString()}`);
        errors.push(`Batch exception: ${batchError.toString()}`);
      }
    }
    
    console.log(`Fin de l'upsert: ${insertedCount} insérés/mis à jour, ${skippedCount} ignorés, ${errors.length} erreurs`);
    
    return {
      success: insertedCount > 0 || skippedCount > 0,
      message: `${insertedCount} upserts, ${skippedCount} ignorés`,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      errors: errors.length,
      error_details: errors
    };
  } catch (error) {
    console.log(`Exception générale lors de l'upsert dans Supabase: ${error.toString()}`);
    return {
      success: false,
      message: `Exception: ${error.toString()}`,
      inserted_count: 0,
      updated_count: 0,
      skipped_count: 0
    };
  }
}

// ============================================
// FONCTION DE RÉCUPÉRATION DES PROFILS D'ÉQUIPE
// ============================================
function getTeamProfiles_visit_profil() {
  try {
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      return {
        success: false,
        message: "Supabase URL non définie",
        profiles: []
      };
    }
    
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    };
    
    // Récupérer les profils avec un ghost_genius_account_id valide
    const url = `${SUPABASE_URL}/rest/v1/workspace_team?select=id,linkedin_url_owner_post,ghost_genius_account_id&ghost_genius_account_id=not.is.null`;
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: headers,
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      const profiles = JSON.parse(response.getContentText());
      
      // Filtrer pour ne garder que les profils avec des données valides
      const validProfiles = profiles.filter(p => 
        p.linkedin_url_owner_post && 
        p.ghost_genius_account_id &&
        p.linkedin_url_owner_post.includes('linkedin.com')
      );
      
      console.log(`✅ ${validProfiles.length} profils valides trouvés`);
      
      return {
        success: true,
        message: `${validProfiles.length} profils récupérés`,
        profiles: validProfiles
      };
    } else {
      console.log(`❌ Erreur lors de la récupération des profils: Code ${responseCode}`);
      return {
        success: false,
        message: `Erreur API: ${responseCode}`,
        profiles: []
      };
    }
  } catch (error) {
    console.log(`❌ Exception: ${error.toString()}`);
    return {
      success: false,
      message: error.toString(),
      profiles: []
    };
  }
}