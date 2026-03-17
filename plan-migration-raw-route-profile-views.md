# Plan : Correction raw route Profile Views (Unipile)

## Contexte

Les étapes 1 à 5 du plan initial sont implémentées (init Trigger.dev, clients, helpers, task).
Le code actuel dans `trigger/get-profil-views.ts` contient des **placeholders** pour l'appel Voyager et le parsing de la réponse.

On a testé la raw route Unipile et obtenu des données réelles. Il faut corriger le code pour utiliser les résultats du test.

---

## Résultats du test Unipile (13 février 2026)

### Raw route validée

- **Endpoint** : `POST /api/v1/linkedin`
- **Body** : `{ "account_id": "...", "request_url": "https://www.linkedin.com/voyager/api/identity/wvmpCards", "method": "GET" }`
- **Champ** : `request_url` (pas `url`) — doit être une URL complète `https://www.linkedin.com/...`
- **Account ID test** : `Irl2c_8SRZKQdv9JU2R8YQ` (profil bertranruiz, trouvé dans `workspace_team`)

### Structure de la réponse Voyager

```
response.data.elements[0]
  .value["com.linkedin.voyager.identity.me.wvmpOverview.WvmpViewersCard"]
  .insightCards[]   ← 7 cards au total
```

Chaque insightCard contient un tableau `.cards[]` avec des viewers :

| # | Type | Contenu | Viewers |
|---|---|---|---|
| 0 | WvmpSummaryInsightCard | 5 vues les plus récentes | ✅ avec `viewedAt` |
| 1 | WvmpNotableViewersInsightCard | Viewers "influenceurs" | ✅ avec `viewedAt` |
| 2-4 | WvmpCompanyInsightCard | Viewers par entreprise | ✅ avec `viewedAt` |
| 5 | WvmpJobTitleInsightCard | Viewers par poste | ✅ avec `viewedAt` |
| 6 | WvmpSourceInsightCard | Viewers par source | ✅ avec `viewedAt` |

**En consolidant toutes les cards → 25 viewers uniques identifiés** (+ anonymes filtrés).

### Structure d'un viewer

```json
{
  "viewedAt": 1770981360000,
  "viewer": {
    "com.linkedin.voyager.identity.me.FullProfileViewer": {
      "profile": {
        "distance": { "value": "DISTANCE_2" },
        "miniProfile": {
          "firstName": "Nicolas",
          "lastName": "Tellier",
          "publicIdentifier": "nicolastellier",
          "occupation": "CIO at House of ABY"
        }
      }
    }
  }
}
```

Les anonymes → type `ObfuscatedProfileViewer` (pas de nom/URL, on les filtre).

### Comparaison des données

| Champ | Ghost Genius (en base) | Voyager/Unipile | Action |
|---|---|---|---|
| `profil_linkedin_url_reaction` | `https://www.linkedin.com/in/slug` | `publicIdentifier` → `https://www.linkedin.com/in/{publicIdentifier}` | Direct, même format |
| `profil_fullname` | `"A. A"` (parfois abrégé) | `firstName + " " + lastName` (complet même DISTANCE_2) | Nom plus complet, OK |
| `headline` | texte libre | `occupation` | Direct |
| `date_scrapped` | `"10 hours"` (texte relatif) | `viewedAt` = timestamp Unix ms | **Convertir** timestamp → texte relatif |
| `date_scrapped_calculated` | `"2025-07-02"` (ISO date) | `viewedAt` = timestamp Unix ms | **Convertir** timestamp → ISO date (plus précis) |

---

## ⚠️ Limitation : pas de pagination — À METTRE À JOUR

**L'endpoint `wvmpCards` ne supporte PAS la pagination.** Il retourne la vue "dashboard" LinkedIn :
- 5 viewers récents dans la SummaryCard
- ~20 viewers supplémentaires répartis dans les autres cards (Notable, Company, JobTitle, Source)
- **~25 viewers uniques max** par appel

Ghost Genius paginait par 10 (max 3 pages = 30 résultats) — probablement via un endpoint dédié ou propriétaire.

**Action future** : demander à Julien (CEO Unipile) un endpoint natif `GET /profile-views` avec pagination. Si ajouté, remplacer l'appel `wvmpCards` par l'endpoint natif dans `fetchProfileViews()` sans changer le reste du code.

**En attendant** : en exécutant 1x/jour, on capture les vues récentes (< 24h). Le filtre existant (exclure > 24h) fait que ~4-5 viewers passent par run, ce qui est suffisant pour le monitoring quotidien.

---

## Modifications à apporter aux fichiers existants

### 1. `trigger/lib/unipile.ts` — Corriger `rawRoute()`

```typescript
// AVANT (incorrect)
rawRoute: (accountId, voyagerUrl, voyagerBody?) =>
  request("POST", "/linkedin", {
    account_id: accountId,
    method: voyagerBody ? "POST" : "GET",
    url: voyagerUrl,
  })

// APRÈS (corrigé)
rawRoute: (accountId, requestUrl) =>
  request("POST", "/linkedin", {
    account_id: accountId,
    request_url: requestUrl,   // URL complète https://www.linkedin.com/...
    method: "GET",
  })
```

### 2. `trigger/lib/utils.ts` — Ajouter helpers timestamp

```typescript
// Convertit timestamp Unix ms → texte relatif ("2 hours", "30 minutes")
export function timestampToRelativeTime(viewedAtMs: number): string

// Convertit timestamp Unix ms → ISO date "2026-02-13"
export function timestampToISODate(viewedAtMs: number): string
```

### 3. `trigger/get-profil-views.ts` — Corrections majeures

- **`fetchProfileViews()`** : un seul appel à `https://www.linkedin.com/voyager/api/identity/wvmpCards` (pas de pagination)
- **`parseVoyagerProfileViews()`** : réécrire pour parser TOUTES les insightCards, dédupliquer les viewers, extraire `publicIdentifier` + `viewedAt` + `firstName/lastName` + `occupation`
- **Filtrage** : exclure `ObfuscatedProfileViewer` + viewers > 24h via `viewedAt`
- **Enrichissement** : plus nécessaire car Voyager retourne directement le `publicIdentifier` (slug propre, pas ACo). Garder le code mais skip si URL déjà propre.
- **Conversion dates** : `viewedAt` ms → `date_scrapped` (texte relatif) + `date_scrapped_calculated` (ISO date)

---

## Vérification

1. `npx tsc --noEmit` — compilation TS sans erreur
2. `npm run dev` → task visible dans le dashboard Trigger.dev
3. Trigger manuellement → vérifier les logs structurés
4. Vérifier que les données insérées dans `scrapped_visit` matchent le format existant
