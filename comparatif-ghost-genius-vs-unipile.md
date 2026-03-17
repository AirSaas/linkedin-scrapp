# Comparatif Ghost Genius vs Unipile — Endpoints LinkedIn

> Contexte : migration depuis Ghost Genius (API actuelle) vers Unipile.
> Scope : Profile Views, Sales Nav Search, Connections (get/remove), Messaging (get), Employee Growth, Followers.
>
> **Audit API réalisé le 13 février 2026** — tous les endpoints testés avec de vrais appels.
> DSN : `api25.unipile.com:15595` | Compte : `Irl2c_8SRZKQdv9JU2R8YQ` (bertranruiz)

---

## Référence rapide des paths Unipile

| Feature | Path Unipile | Méthode | Statut |
|---|---|---|---|
| Search (classic/SN/recruiter) | `POST /api/v1/linkedin/search` | POST | ✅ |
| Search parameters lookup | `GET /api/v1/linkedin/search/parameters` | GET | ✅ |
| Company profile + insights | `GET /api/v1/linkedin/company/{identifier}` | GET | ✅ |
| User profile / enrichment | `GET /api/v1/users/{identifier}` | GET | ✅ |
| Connections (relations) | `GET /api/v1/users/relations` | GET | ✅ |
| Followers (perso) | `GET /api/v1/users/followers` | GET | ✅ |
| Following | `GET /api/v1/users/following` | GET | 501 (planned) |
| Invitations envoyées | `GET /api/v1/users/invite/sent` | GET | ✅ |
| Inviter un user | `POST /api/v1/users/invite` | POST | ✅ (doc) |
| Chats (threads) | `GET /api/v1/chats` | GET | ✅ |
| Messages d'un chat | `GET /api/v1/chats/{id}/messages` | GET | ✅ |
| Raw route (proxy Voyager) | `POST /api/v1/linkedin` | POST | ✅ |
| Profile viewers (GraphQL) | Raw route → `voyager/api/graphql` | POST | ✅ paginé |

---

## 1. Profile Views (Who Viewed My Profile)

### Ghost Genius

| | |
|---|---|
| **Route** | `GET /private/profile-views` (endpoint interne Ghost Genius) |
| **Pagination** | `page` (int, max 3 pages = 30 résultats) |
| **Données** | `profil_linkedin_url_reaction`, `profil_fullname`, `headline`, `date_scrapped` (texte relatif "10 hours"), `date_scrapped_calculated` (ISO date) |

### Unipile

Deux options disponibles :

#### Option A — Raw route GraphQL (recommandée, avec pagination)

| | |
|---|---|
| **Route** | `POST /api/v1/linkedin` (raw route) |
| **URL Voyager** | `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(start:0,count:10,query:(),analyticsEntityUrn:(activityUrn:urn%3Ali%3Adummy%3A-1),surfaceType:WVMP)&queryId=voyagerPremiumDashAnalyticsObject.c31102e906e7098910f44e0cecaa5b5c` |
| **Pagination** | `start` et `count` dans les variables → **500+ viewers sur 90 jours** |
| **Body** | `{ "account_id": "...", "method": "GET", "request_url": "...", "encoding": false }` |

**Réponse** (dans `data.data.premiumDashAnalyticsObjectByAnalyticsEntity.elements[]`) :
```json
{
  "content": {
    "analyticsEntityLockup": {
      "entityLockup": {
        "title": { "text": "Nicolas Tellier" },
        "subtitle": { "text": "CIO at House of ABY" },
        "caption": { "text": "Viewed 5h ago" },
        "navigationUrl": "https://www.linkedin.com/in/ACoAAAGoWjgB..."
      }
    }
  }
}
```

**Pagination** : `paging.start`, `paging.count`. Itérer avec `start += count` jusqu'à ce que `elements` soit vide.

#### Option B — Raw route wvmpCards (sans pagination, ~25 viewers)

| | |
|---|---|
| **URL Voyager** | `https://www.linkedin.com/voyager/api/identity/wvmpCards` |
| **Pagination** | Aucune (~25 viewers max, dashboard LinkedIn) |
| **Avantage** | Retourne `viewedAt` en timestamp Unix ms + `publicIdentifier` (slug propre) |
| **Inconvénient** | Limité à ~25 viewers, pas de pagination |

### Verdict Profile Views

| Critère | Ghost Genius | Unipile (GraphQL) | Gagnant |
|---|---|---|---|
| **Pagination** | 3 pages max (30 résultats) | `start`/`count` illimité (500+ testés) | Unipile |
| **Volume** | ~30 viewers max | 500+ viewers sur 90 jours | Unipile |
| **Données** | Slug propre, timestamp | Nom, headline, temps relatif ("5h ago"), URL ACo | Comparable |
| **Enrichissement nécessaire** | Non | Oui (URLs ACo → slug via `GET /users/{id}`) | GG |

**Impact migration** : L'endpoint GraphQL paginé couvre largement le besoin. Les URLs retournées sont en format ACo, nécessitant un enrichissement via `GET /users/{id}` pour obtenir le `public_identifier`. Le code actuel (`get-profil-views.ts`) utilise wvmpCards — à migrer vers le GraphQL paginé.

---

## 2. Sales Navigator Search

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/sales-navigator` | `GET /private/sales-navigator-saved-search` |
| **Auth** | Bearer token | Bearer token |
| **Rate limit** | 100 req/jour par compte SN | 100 req/jour par compte SN |
| **Pagination** | `page` (int, 1-100) | `page` (int, 1-100) |
| **Params requis** | `account_id` (uuid) | `account_id` (uuid), `saved_search_id` |
| **Filtres** | `keywords`, `locations`, `current_company`, `company_headcount`, `company_headquarters`, `recently_changed_jobs`, `posted_on_linkedin`, `past_company`, `company_type`, `function` (26 IDs mappés), `current_title`, `seniority_level` (10 niveaux), `past_title`, `years_at_current_company`, `years_in_current_position`, `industry`, `first_name`, `last_name`, `profile_language`, `years_of_experience`, `school`, `excluded_locations` | `last_viewed_at` (timestamp ms) |

### Unipile

| | |
|---|---|
| **Route** | `POST /api/v1/linkedin/search?account_id={id}` |
| **Auth** | `X-API-KEY` header |
| **Rate limit** | ~1000 résultats/jour (classic), ~2500/jour (SN/Recruiter) |
| **Pagination** | `cursor` (string, cursor-based) |
| **Params requis** | `api` ("classic" / "sales_navigator" / "recruiter"), `category` ("people" / "companies" / "jobs" / "posts") |
| **Filtres** | `keywords`, `location` (array IDs), `industry` (include/exclude), `company` (include/exclude), `tenure` (min/max), `profile_language`, `network_distance` (recruiter), `skills` (recruiter), `role` (recruiter) |
| **Bonus** | Param `url` pour passer une URL de recherche LinkedIn directement. Endpoint `GET /api/v1/linkedin/search/parameters?type=LOCATION&keywords=...` pour lookup des IDs. |

**Réponse testée (classic, keywords="CTO") :**
```json
{
  "object": "LinkedinSearch",
  "items": [{
    "type": "PEOPLE",
    "name": "Dalil ZAÏDI",
    "public_identifier": "dalil-zaidi",
    "public_profile_url": "https://www.linkedin.com/in/dalil-zaidi",
    "location": "Paris",
    "headline": "CTO",
    "network_distance": "DISTANCE_2",
    "verified": true,
    "premium": true
  }],
  "paging": { "start": 0, "page_count": 10, "total_count": 1000 },
  "cursor": "eyJ..."
}
```

**Note :** `type` du search/parameters doit être en MAJUSCULES (`LOCATION`, `INDUSTRY`, `SKILL`, etc.).

### Verdict Sales Nav Search

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Filtres SN** | 22 filtres dédiés en query params | Filtres body JSON + param `url` pour filtres avancés | Parité (via `url`) |
| **Saved searches** | Endpoint dédié (par ID) | Param `url` avec l'URL de la saved search | Parité |
| **Réponse** | Minimaliste (id, name, headline, picture) | Riche (positions, tenure, network_distance, premium, verified) | Unipile |
| **Multi-plateforme** | SN uniquement | Classic + SN + Recruiter dans un seul endpoint | Unipile |
| **Rate limit** | 100/jour | ~2500 résultats/jour | Unipile |

---

## 3. Connections — Get

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/connections` | `GET /private/connection-status` |
| **Params** | `account_id`, `page` | `account_id`, `url` |
| **Réponse** | `connected_at` + MiniProfile | `status` ("connected" / "invited" / "not_connected") |

### Unipile

| | Endpoint 1 | Endpoint 2 (workaround) |
|---|---|---|
| **Route** | `GET /api/v1/users/relations` | `GET /api/v1/users/{identifier}` |
| **Params** | `account_id`, `cursor`, `limit` | `account_id` |
| **Pagination** | Cursor-based | N/A |

**Réponse `/users/relations` testée :**
```json
{
  "object": "UserRelationsList",
  "items": [{
    "object": "UserRelation",
    "first_name": "Maxime",
    "last_name": "Robbeets",
    "headline": "General Manager - Hospitality Industry",
    "public_identifier": "maximerobbeets",
    "public_profile_url": "https://www.linkedin.com/in/maximerobbeets/",
    "profile_picture_url": "https://media.licdn.com/...",
    "connection_urn": "urn:li:fsd_connection:ACoAAC2kEtwB...",
    "created_at": 1770749845000
  }],
  "cursor": "eyJ..."
}
```

**Connection status** via `GET /users/{identifier}` :
- `network_distance: "FIRST_DEGREE"` + `is_relationship: true` = connecté
- `network_distance: "SECOND_DEGREE"` + `is_relationship: false` = pas connecté

### Verdict Get Connections

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Liste connexions** | Endpoint dédié | `GET /users/relations` | Parité |
| **Check statut** | Endpoint dédié (3 statuts) | `GET /users/{id}` → `network_distance` + `is_relationship` | GG (plus simple) |
| **Données** | MiniProfile | first/last name + public_identifier + headline + picture + created_at | Unipile |
| **Invitations envoyées** | `POST /private/pending-connections` | `GET /users/invite/sent` | Parité |

---

## 4. Connections — Remove

### Ghost Genius

| | |
|---|---|
| **Route** | `POST /private/remove-connection` |
| **Body** | `{ "id", "publi_id", "member_id", "first_name", "last_name", "invitation_id" }` |
| **Réponse** | `{ "success": true }` |

### Unipile

| | |
|---|---|
| **Route** | `POST /api/v1/linkedin` (raw route) |
| **URL Voyager** | `https://www.linkedin.com/voyager/api/relationships/dash/memberRelationships` |
| **Body** | `{ "account_id": "...", "method": "POST", "request_url": "...", "query_params": { "action": "removeFromMyConnections" }, "body": { "connectionUrn": "urn:li:fsd_connection:[ID]" } }` |

### Verdict Remove Connection

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Endpoint natif** | Oui | Non (raw route) | GG |
| **Stabilité** | Maintenu par GG | Dépend de l'API interne LinkedIn | GG |

**Impact** : Seul gap restant. Raw route fonctionnelle mais fragile. La doc Unipile documente le format exact (section "Delete Relation" dans `get-raw-data-example`).

---

## 5. Messaging — Get Threads & Messages

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/message-threads` | `GET /private/message` |
| **Params** | `account_id`, `pagination_token` | `account_id`, `thread_id` |
| **Rate limit** | 50/jour | 50/jour |

### Unipile

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /api/v1/chats` | `GET /api/v1/chats/{chat_id}/messages` |
| **Params** | `account_id`, `limit`, `after`, `cursor` | `chat_id`, `cursor`, `limit` |
| **Pagination** | Cursor-based | Cursor-based |

**Réponse messages testée :**
```json
{
  "object": "MessageList",
  "items": [{
    "object": "Message",
    "text": "Hey Bertran...",
    "sender_id": "ACoAAC_a-MUB...",
    "timestamp": "2026-02-13T14:22:34.188Z",
    "is_sender": false,
    "attachments": [],
    "reactions": [],
    "seen": 0,
    "delivered": 1
  }],
  "cursor": "eyJ..."
}
```

### Verdict Messaging

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Threads** | Participants enrichis | `last_message` preview + `unread_count` + `is_group` | Unipile |
| **Messages** | Tous d'un coup | Paginé avec cursor | Unipile |
| **Filtre temporel** | Non | `after` param | Unipile |
| **Attachments** | `post_shared` uniquement | Complets (id, type, url, filename) | Unipile |
| **Multi-provider** | LinkedIn | LinkedIn + WhatsApp + Instagram + Messenger + Telegram | Unipile |

---

## 6. Employee Growth

### Ghost Genius

| | |
|---|---|
| **Route** | `GET /private/employees-growth` |
| **Réponse** | `growth_6_months`, `growth_1_year`, `growth_2_years`, `employees`, `headcount_growth[]` |

### Unipile

| | |
|---|---|
| **Route** | `GET /api/v1/linkedin/company/{identifier}?account_id={id}` |
| **Champ** | `insights.employeesCount` dans la réponse company |

**Réponse testée (identifier="airsaas") :**
```json
{
  "insights": {
    "employeesCount": {
      "totalCount": 13,
      "averageTenure": "4.3 years",
      "growthGraph": [
        { "monthRange": 6, "growthPercentage": -7 },
        { "monthRange": 12, "growthPercentage": -7 },
        { "monthRange": 24, "growthPercentage": 44 }
      ],
      "employeesCountGraph": [
        { "count": 9, "date": "2024-02-01" },
        { "count": 13, "date": "2026-02-01" }
      ]
    }
  }
}
```

### Verdict Employee Growth

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Données** | growth %, headcount time-series | growth %, headcount time-series + `averageTenure` | Unipile |
| **Prérequis** | Compte SN/Premium | Compte SN | Parité |

---

## 7. Followers — Personal & Company

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/followers` | `GET /private/company/followers` |
| **Params** | `account_id`, `page` | `account_id`, `url`, `follower_type` |

### Unipile

| | Endpoint 1 | Company followers |
|---|---|---|
| **Route** | `GET /api/v1/users/followers` | Pas d'endpoint natif |
| **Params** | `account_id`, `cursor`, `limit` | — |
| **Pagination** | Cursor-based | — |

**Réponse `/users/followers` testée :**
```json
{
  "object": "UserFollowersList",
  "items": [{
    "object": "UserFollower",
    "id": "ACoAABBp8x0B...",
    "name": "Simon Brossard",
    "headline": "Sales",
    "profile_url": "https://www.linkedin.com/in/ACoAABBp8x0B...",
    "profile_picture_url": "https://media.licdn.com/..."
  }],
  "cursor": "eyJ..."
}
```

### Verdict Followers

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Followers perso** | Oui | `GET /users/followers` | Parité |
| **Followers company** | Endpoint dédié | Pas d'endpoint (nombre dispo via company profile) | GG |
| **Following** | Non | `GET /users/following` (501 — planned, pas encore implémenté) | — |

---

## Synthèse globale

### Parité ou avantage Unipile

| Feature | Commentaire |
|---|---|
| **Profile Views** | GraphQL paginé : 500+ viewers vs 30 max chez GG |
| **Search** | Classic + SN + Recruiter dans un seul endpoint, réponse plus riche |
| **Messaging** | Filtre `after`, attachments, multi-provider, `unread_count` |
| **Employee Growth** | Natif + `averageTenure` en bonus |
| **Connections** | `GET /users/relations` avec données riches |
| **Followers perso** | `GET /users/followers` avec pagination |
| **Invitations envoyées** | `GET /users/invite/sent` avec détails complets |

### Gaps Unipile restants

| Feature | Sévérité | Statut | Alternative |
|---|---|---|---|
| **Remove connection** | Moyen | Raw route uniquement | Doc Unipile fournit le format exact. Fragile (URLs internes LinkedIn). |
| **Company followers (liste)** | Moyen | Pas d'endpoint | `followers_count` disponible sur company profile. Pas de liste. |
| **Following** | Faible | 501 (planned) | Endpoint prévu mais pas encore implémenté. |

### Différences structurelles

| | Ghost Genius | Unipile |
|---|---|---|
| **Auth** | Bearer token | X-API-KEY header |
| **Base URL** | `https://api.ghostgenius.fr/v2` | `https://{DSN}/api/v1` |
| **Pagination** | Mix page-based + token-based | Cursor-based partout |
| **Format réponse** | Array ou `{ data: [...] }` | `{ object: "...", items: [...], cursor: "..." }` |
| **Rate limits** | Explicites (50-100/jour) | Recommandations (~100 profils/jour, ~2500 search/jour) |
| **Raw route** | Non | `POST /api/v1/linkedin` — proxy vers API interne LinkedIn |

### Rate limits recommandés (Unipile)

| Action | Limite recommandée |
|---|---|
| Invitations | 80-100/jour (payant), 150/semaine sans note (gratuit) |
| Profils | ~100/jour par compte |
| Search | ~1000 résultats/jour (classic), ~2500 (SN/Recruiter) |
| Relations/Followers | Quelques appels/jour, espacement aléatoire |
| Messaging | Pas de limite documentée (sync server-side) |
| Raw route | ~100 actions/jour par compte |
