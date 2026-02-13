# Comparatif Ghost Genius vs Unipile — Endpoints LinkedIn

> Contexte : migration depuis Ghost Genius (API actuelle) vers Unipile.
> Scope : Sales Nav Search, Connections (get/remove), Messaging (get), Employee Growth, Followers.

---

## 1. Sales Navigator Search

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/sales-navigator` | `GET /private/sales-navigator-saved-search` |
| **Auth** | Bearer token | Bearer token |
| **Rate limit** | 100 req/jour par compte SN | 100 req/jour par compte SN |
| **Pagination** | `page` (int, 1-100) | `page` (int, 1-100) |
| **Params requis** | `account_id` (uuid) | `account_id` (uuid), `saved_search_id` |
| **Filtres** | `keywords`, `locations`, `current_company`, `company_headcount`, `company_headquarters`, `recently_changed_jobs`, `posted_on_linkedin`, `past_company`, `company_type`, `function` (26 IDs mappés), `current_title`, `seniority_level` (10 niveaux), `past_title`, `years_at_current_company`, `years_in_current_position`, `industry`, `first_name`, `last_name`, `profile_language`, `years_of_experience`, `school`, `excluded_locations` | `last_viewed_at` (timestamp ms) |

**Réponse Ghost Genius :**
```json
{
  "total": 10583438,
  "data": [{
    "id": "ACwAAAfwCps...",
    "type": "person",
    "full_name": "string",
    "url": "https://www.linkedin.com/in/...",
    "headline": "string",
    "profile_picture": [{ "height": 100, "width": 100, "url": "string", "expires_at": 1737590400000 }]
  }]
}
```

### Unipile

| | |
|---|---|
| **Route** | `POST /api/v1/linkedin/search` |
| **Auth** | `X-API-KEY` header |
| **Rate limit** | Recommandé ~1000 résultats/jour (classic), ~2500/jour (SN/Recruiter) |
| **Pagination** | `cursor` (string, cursor-based) |
| **Params requis** | `account_id`, `api` ("classic" / "sales_navigator" / "recruiter"), `category` ("people" / "companies" / "jobs" / "posts") |
| **Filtres people** | `keywords`, `location` (array IDs), `industry` (include/exclude), `company` (include/exclude), `tenure` (min/max), `profile_language`, `network_distance` (recruiter), `skills` (recruiter, avec priorité MUST_HAVE/DOESNT_HAVE), `role` (recruiter, avec scope CURRENT_OR_PAST) |
| **Bonus** | Peut aussi chercher companies, jobs, posts avec le même endpoint. Supporte `url` (passer une URL de recherche LinkedIn directement). Endpoint helper `GET /api/v1/linkedin/search/parameters` pour lookup des IDs (locations, industries, skills). |

**Réponse Unipile :**
```json
{
  "object": "LinkedinSearch",
  "items": [{
    "type": "PEOPLE",
    "id": "string",
    "name": "string",
    "first_name": "string",
    "last_name": "string",
    "member_urn": "string",
    "public_identifier": "string",
    "public_profile_url": "string",
    "profile_picture_url": "string",
    "location": "string",
    "headline": "string",
    "network_distance": "DISTANCE_1",
    "current_positions": [{
      "company": "string",
      "company_id": "string",
      "role": "string",
      "location": "string",
      "tenure_at_company": { "years": 3 },
      "tenure_at_role": { "years": 1 }
    }],
    "pending_invitation": false,
    "premium": true,
    "open_profile": true,
    "industry": "string"
  }],
  "paging": { "start": 0, "page_count": 25, "total_count": 10000 },
  "cursor": "string | null"
}
```

### Verdict Sales Nav Search

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Filtres SN** | 22 filtres dédiés, tous en query params simples (string, comma-separated) | Filtres via body JSON, moins nombreux nativement mais extensible via `url` param | GG — plus de filtres SN natifs |
| **Saved searches** | Endpoint dédié (par ID) | Pas d'endpoint par ID, mais on peut passer l'URL complète de la saved search via le param `url` → même résultat | Parité |
| **Réponse** | Minimaliste (id, name, headline, picture) | Riche (positions, tenure, network_distance, pending_invitation, premium, open_profile, industry) | Unipile |
| **Multi-plateforme** | SN uniquement (classic deprecated) | Classic + SN + Recruiter dans un seul endpoint | Unipile |
| **Pagination** | Page-based (max 100 pages) | Cursor-based (max 2500 résultats SN) | Comparable |
| **Lookup IDs** | 3 endpoints dédiés (industries, locations, titles) | 1 endpoint unifié (locations, industries, skills, companies) | Unipile |
| **Rate limit** | 100/jour par compte SN | ~2500 résultats/jour recommandé | Unipile |

**Impact migration** : Les filtres SN de Ghost Genius sont plus granulaires en params discrets (ex: `seniority_level` avec 10 niveaux mappés, `function` avec 26 IDs). Chez Unipile, ces filtres sont transmissibles via le param `url` : on copie l'URL complète depuis la barre d'adresse de Sales Navigator (qui contient tous les filtres encodés) et Unipile l'exécute. Même chose pour les saved searches : on copie l'URL de la saved search au lieu de passer un ID. **En pratique, pas de perte fonctionnelle.**

---

## 2. Connections — Get

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/connections` | `GET /private/connection-status` |
| **Params** | `account_id` (uuid, requis), `page` (int, opt) | `account_id` (uuid, requis), `url` (string, requis) |
| **Rate limit** | 1 req/sec, 50/jour | 1 req/sec, 50/jour |
| **Pagination** | Page-based | N/A (1 profil) |

**Réponse connections :**
```json
[{
  "connected_at": "2025-03-26T22:34:23.000Z",
  "profile": {
    "id": "string", "type": "person", "full_name": "string",
    "url": "string", "headline": "string",
    "profile_picture": [{ "height": 100, "width": 100, "url": "string", "expires_at": 123 }]
  }
}]
```

**Réponse connection-status :**
```json
{
  "status": "connected",  // "invited" | "connected" | "not_connected"
  "connected_at": "2025-03-26T22:34:23.000Z",
  "profile": { /* MiniProfile */ }
}
```

### Unipile

| | |
|---|---|
| **Route** | `GET /api/v1/relations` |
| **Params** | `account_id` (string, requis), `cursor` (string, opt), `limit` (int, opt) |
| **Rate limit** | Non documenté explicitement. Recommandation : quelques appels/jour avec espacement aléatoire. |
| **Pagination** | Cursor-based |

**Réponse :**
```json
{
  "object": "RelationList",
  "items": [{
    "object": "Relation",
    "provider": "LINKEDIN",
    "provider_id": "string",
    "public_identifier": "string",
    "first_name": "string",
    "last_name": "string",
    "headline": "string",
    "profile_picture_url": "string",
    "network_distance": "string",
    "connected_at": "string (ISO 8601)"
  }],
  "cursor": "string | null"
}
```

### Verdict Get Connections

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Liste connexions** | Endpoint dédié | Endpoint dédié | Parité |
| **Check statut** | Endpoint dédié (`connection-status`) avec 3 statuts | Pas d'équivalent direct (il faut check `network_distance` sur le profil) | GG |
| **Données retournées** | `connected_at` + MiniProfile (id, name, headline, picture) | `connected_at` + first/last name séparés + `public_identifier` + `network_distance` | Unipile (plus de champs) |
| **Pending connections** | Endpoint dédié (`POST /private/pending-connections`) | `GET /api/v1/invitations/sent` | Parité |
| **Rate limit** | 50/jour explicite | Non documenté, recommandation prudente | GG (plus clair) |

**Impact migration** : Le `connection-status` de GG n'a pas d'équivalent direct chez Unipile. Il faudrait faire un `GET /api/v1/users/{id}` et vérifier le champ `network_distance` (FIRST_DEGREE = connected). Moins pratique, et ça consomme un appel profil.

---

## 3. Connections — Remove

### Ghost Genius

| | |
|---|---|
| **Route** | `POST /private/remove-connection` |
| **Params** | `account_id` (uuid, query, requis) |
| **Body** | `{ "id", "publi_id", "member_id", "first_name", "last_name", "invitation_id" }` |
| **Rate limit** | 1 req/sec, 50/jour |
| **Réponse** | `{ "success": true, "message": "Connection removed successfully" }` |

### Unipile

| | |
|---|---|
| **Route** | `POST /api/v1/linkedin` (raw route / proxy) |
| **Méthode interne** | POST vers `https://www.linkedin.com/voyager/api/relationships/dash/memberRelationships` |
| **Body** | `{ "account_id": "...", "method": "POST", "request_url": "https://www.linkedin.com/voyager/api/relationships/dash/memberRelationships", "query_params": { "action": "removeFromMyConnections" }, "body": { "connectionUrn": "urn:li:fsd_connection:[ID]" } }` |
| **Rate limit** | Non documenté pour la raw route |
| **Réponse** | Réponse brute de l'API LinkedIn (format variable) |

### Verdict Remove Connection

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Endpoint natif** | Oui | Non (raw route) | GG |
| **Simplicité** | Body simple, réponse standardisée | Requête complexe avec URL interne LinkedIn + URN format | GG |
| **Stabilité** | Abstraction maintenue par GG | Dépend de l'API interne LinkedIn (peut casser sans prévenir) | GG |
| **Rate limit** | 50/jour documenté | Non documenté | GG |

**Impact migration** : C'est un **gap significatif**. Unipile n'a pas d'endpoint natif pour retirer une connexion. La raw route fonctionne mais c'est fragile : il faut connaître les URLs internes de LinkedIn, gérer les URN formats, et LinkedIn peut modifier ces endpoints internes sans prévenir. Il faudra wrapper cette logique côté app.

---

## 4. Messaging — Get Threads & Messages

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/message-threads` | `GET /private/message` |
| **Params** | `account_id` (requis), `pagination_token` (opt) | `account_id` (requis), `thread_id` (requis) |
| **Rate limit** | 1 req/sec, 50/jour | 1 req/sec, 50/jour |
| **Pagination** | Token-based | N/A (tous les messages du thread) |

**Réponse threads :**
```json
{
  "threads": [{
    "id": "string",
    "last_activity_at": 1747218001724,
    "read": true,
    "participants": [{
      "id": "string", "type": "person", "full_name": "string",
      "url": "string",
      "profile_picture": [{ "height": 100, "width": 100, "url": "string", "expires_at": 123 }]
    }]
  }],
  "pagination_token": "string"
}
```

**Réponse messages :**
```json
[{
  "id": "urn:li:msg_message:(...)",
  "date": "2025-07-05T22:11:55.021Z",
  "is_read": null,
  "text": "string",
  "post_shared": "https://www.linkedin.com/feed/update/...",
  "reaction": "heart_emoji",
  "sender": {
    "id": "string", "type": "person", "full_name": "string",
    "url": "string", "headline": "string",
    "profile_picture": [{ "height": 100, "width": 100, "url": "string", "expires_at": 123 }]
  }
}]
```

### Unipile

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /api/v1/chats` | `GET /api/v1/chats/{chat_id}/messages` |
| **Params** | `account_id` (opt), `account_type` (opt), `limit` (opt), `after` (timestamp, opt), `cursor` (opt) | `chat_id` (path, requis), `cursor` (opt), `limit` (opt, default 100) |
| **Rate limit** | Non documenté (sync server-side) | Non documenté (sync server-side) |
| **Pagination** | Cursor-based | Cursor-based |

**Réponse chats :**
```json
{
  "object": "ChatList",
  "items": [{
    "object": "Chat",
    "id": "string",
    "account_id": "string",
    "provider": "LINKEDIN",
    "timestamp": "string (ISO 8601)",
    "last_message": { "text": "string", "sender_id": "string", "timestamp": "string" },
    "attendees": [{ "id": "string", "name": "string", "provider_id": "string" }],
    "unread_count": 0,
    "is_group": false,
    "title": "string | null"
  }],
  "cursor": "string | null"
}
```

**Réponse messages :**
```json
{
  "object": "MessageList",
  "items": [{
    "object": "Message",
    "id": "string",
    "chat_id": "string",
    "sender_id": "string",
    "text": "string",
    "timestamp": "string (ISO 8601)",
    "is_sender": true,
    "attachments": [{ "id": "string", "type": "string", "url": "string", "filename": "string" }],
    "reactions": []
  }],
  "cursor": "string | null"
}
```

### Verdict Messaging (Get)

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Liste threads** | Oui, avec participants enrichis (full_name, picture, url) | Oui, avec `last_message` preview + `unread_count` + `is_group` | Unipile (plus de métadonnées) |
| **Messages d'un thread** | Array directe, tous les messages | Paginé avec cursor + limit (default 100) | Unipile (plus flexible) |
| **Données message** | `text`, `date`, `is_read`, `post_shared`, `reaction`, `sender` (profil complet) | `text`, `timestamp`, `is_sender`, `attachments`, `reactions` | Comparable (champs différents) |
| **Filtre temporel** | Non | `after` param sur les chats | Unipile |
| **Attachments** | `post_shared` (URL) uniquement | Attachments complets (id, type, url, filename) + endpoint dédié download | Unipile |
| **Multi-provider** | LinkedIn uniquement | LinkedIn + WhatsApp + Instagram + Messenger + Telegram | Unipile |
| **Rate limit** | 50/jour par endpoint | Non documenté (server-side sync) | Ambigu |

**Impact migration** : La migration est assez directe. Unipile offre plus de fonctionnalités (filtre `after`, attachments, multi-provider). Le mapping des champs nécessite un travail d'adaptation : `sender.full_name` (GG) → lookup via `sender_id` (Unipile), `post_shared` (GG) → `attachments` (Unipile), `is_read` (GG) → `unread_count` au niveau chat (Unipile).

---

## 5. Employee Growth

### Ghost Genius

| | |
|---|---|
| **Route** | `GET /private/employees-growth` |
| **Params** | `account_id` (uuid, requis), `url` (string, requis — URL ou ID company) |
| **Prérequis** | Compte Sales Navigator ou Premium |
| **Rate limit** | 1 req/sec, 50/jour |

**Réponse :**
```json
{
  "growth_6_months": 11,
  "growth_1_year": 27,
  "growth_2_years": 31,
  "employees": 89533,
  "headcount_growth": [
    { "date": "2023-09-01T00:00:00.000Z", "employees": 68237 },
    { "date": "2023-10-01T00:00:00.000Z", "employees": 68729 }
  ]
}
```

### Unipile

| | |
|---|---|
| **Route** | `GET /api/v1/linkedin/company/{identifier}` (champ `insights` dans la réponse) |
| **Params** | `identifier` (path, requis — nom ou ID company), `account_id` (query, requis) |
| **Prérequis** | Compte Sales Navigator connecté (confirmé par le CEO Unipile) |
| **Rate limit** | Non documenté explicitement |

**Réponse (champ `insights` de l'endpoint company) :**
```json
{
  "insights": {
    "totalCount": 89533,
    "averageTenure": "string",
    "employeesCountGraph": [
      { "date": "2023-09-01T00:00:00.000Z", "count": 68237 },
      { "date": "2023-10-01T00:00:00.000Z", "count": 68729 }
    ],
    "growthGraph": [
      { "monthRange": 6, "growthPercentage": 11 },
      { "monthRange": 12, "growthPercentage": 27 },
      { "monthRange": 24, "growthPercentage": 31 }
    ]
  }
}
```

> **Source** : confirmation mail de Julien Crépieux (CEO Unipile). Les champs exacts (`totalCount`, `averageTenure`, `employeesCountGraph`, `growthGraph`) sont disponibles dans le champ `insights` de la réponse company. À tester avec un compte Sales Navigator connecté.

### Verdict Employee Growth

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Endpoint natif** | Oui, dédié | Oui, intégré dans l'endpoint company (`insights`) | Parité |
| **Données historiques** | `headcount_growth` : time-series mensuelle (date + employees) | `employeesCountGraph` : time-series (date + count) | Parité |
| **Croissance calculée** | `growth_6_months`, `growth_1_year`, `growth_2_years` (%) | `growthGraph` : array (monthRange + growthPercentage) — plus flexible | Parité |
| **Effectif actuel** | `employees` (int) | `totalCount` (int) | Parité |
| **Bonus** | — | `averageTenure` (ancienneté moyenne) | Unipile |

**Impact migration** : ~~Plus gros gap~~ **Corrigé** — les données sont disponibles nativement chez Unipile dans le champ `insights` de l'endpoint company. Le mapping est quasi direct. Unipile offre en plus l'ancienneté moyenne (`averageTenure`). **Prérequis** : compte Sales Navigator connecté. À valider en testant l'endpoint avec un identifier concret.

---

## 6. Followers — Personal & Company

### Ghost Genius

| | Endpoint 1 | Endpoint 2 |
|---|---|---|
| **Route** | `GET /private/followers` | `GET /private/company/followers` |
| **Params** | `account_id` (requis), `page` (opt) | `account_id` (requis), `url` (requis), `follower_type` (opt: "MEMBER" / "ORGANIZATIONAL_PAGE"), `page` (opt, 1-100) |
| **Rate limit** | 1 req/sec, 50/jour | 1 req/sec, 50/jour |

**Réponse (même format pour les deux) :**
```json
[{
  "profile": {
    "id": "string", "type": "person", "full_name": "string",
    "url": "string", "headline": "string",
    "profile_picture": [{ "height": 100, "width": 100, "url": "string", "expires_at": 123 }]
  }
}]
```

### Unipile

| | Endpoint 1 | Company followers |
|---|---|---|
| **Route** | `GET /api/v1/followers` | **Pas d'endpoint natif** |
| **Params** | `account_id` (requis), `cursor` (opt), `limit` (opt) | Raw route nécessaire |
| **Pagination** | Cursor-based | — |

**Réponse followers perso :**
```json
{
  "object": "FollowerList",
  "items": [{
    "object": "Follower",
    "provider_id": "string",
    "public_identifier": "string",
    "first_name": "string",
    "last_name": "string",
    "headline": "string",
    "profile_picture_url": "string"
  }],
  "cursor": "string | null"
}
```

**Note :** Unipile a aussi `GET /api/v1/following` (comptes que vous suivez), que Ghost Genius n'a pas.

### Verdict Followers

| Critère | Ghost Genius | Unipile | Gagnant |
|---|---|---|---|
| **Followers perso** | Oui | Oui | Parité |
| **Followers company** | Oui, endpoint dédié avec filtre `follower_type` | Non natif (raw route) | GG |
| **Following (qui je suis)** | Non | Oui (`GET /api/v1/following`) | Unipile |
| **Filtre type follower** | MEMBER / ORGANIZATIONAL_PAGE | Non applicable | GG |
| **Données** | Profil complet (id, name, url, headline, picture) | first/last name séparés + public_identifier | Comparable |

**Impact migration** : Les followers perso sont couverts. Le **gap est sur les company followers** : Ghost Genius a un endpoint dédié avec filtre par type, Unipile nécessite la raw route. Le `followers_count` est disponible dans le profil company Unipile, mais pas la liste des followers.

---

## Synthèse globale

### Parité ou avantage Unipile

| Feature | Commentaire |
|---|---|
| **Search (multi-type)** | Unipile supporte Classic + SN + Recruiter + recherche companies/jobs/posts dans un seul endpoint |
| **Réponse search enrichie** | Positions, tenure, network_distance, pending_invitation, premium, open_profile |
| **Messaging** | Plus riche : filtre `after`, attachments, multi-provider, `unread_count` |
| **Following** | Endpoint dédié que GG n'a pas |
| **Lookup IDs** | 1 endpoint unifié vs 3 chez GG |

### Gaps Unipile — état actuel

| Feature | Sévérité | Statut | Alternative Unipile |
|---|---|---|---|
| ~~Employee Growth~~ | ~~Critique~~ | **Résolu** | Natif via `insights` dans `GET /api/v1/linkedin/company/{id}` (confirmé par CEO Unipile). Requiert compte SN. |
| ~~Saved searches SN~~ | ~~Faible~~ | **Résolu** | Passer l'URL complète de la recherche SN via le param `url` de `POST /api/v1/linkedin/search`. |
| ~~Filtres SN granulaires~~ | ~~Faible~~ | **Résolu** | Même solution : le param `url` transmet tous les filtres encodés dans l'URL SN. |
| ~~Connection status check~~ | ~~Faible~~ | **Contournable** | `GET /users/{id}` → check `network_distance` (FIRST_DEGREE = connected). Pour le statut "invited", appeler `GET /api/v1/invitations/sent`. Coûte 2 appels au lieu de 1. |
| **Remove connection** | **Moyen** | **Raw route** | Pas d'endpoint natif. Nécessite la raw route (voir explication ci-dessous). Mail envoyé à Unipile pour demander un endpoint natif. |
| **Company followers (liste)** | **Moyen** | **Raw route** | Pas d'endpoint natif pour la liste. `followers_count` (le nombre) est disponible sur le profil company. Mail envoyé à Unipile pour demander un endpoint natif. |

### Qu'est-ce que la "raw route" et quel est l'impact réel ?

Unipile propose un endpoint proxy `POST /api/v1/linkedin` qui permet d'appeler n'importe quelle API **interne** de LinkedIn.

**La différence avec un endpoint natif :**

| | Endpoint natif | Raw route |
|---|---|---|
| **Qui maintient l'URL ?** | Unipile — si LinkedIn change, Unipile adapte son code, transparent pour nous | **Nous** — on hardcode l'URL interne LinkedIn dans notre code |
| **Si LinkedIn change ?** | Rien à faire de notre côté | Notre code casse, on doit trouver la nouvelle URL |
| **Réponse** | Format standardisé Unipile (`{ object, items, cursor }`) | Réponse brute de LinkedIn (format variable) |
| **Documentation** | Documenté par Unipile | Il faut trouver les URLs via DevTools navigateur ou forums |

**Exemple concret pour remove connection :**
```javascript
// C'est NOUS qui hardcodons l'URL interne LinkedIn
await unipile.post("/api/v1/linkedin", {
  account_id: "xxx",
  request_url: "https://www.linkedin.com/voyager/api/relationships/dash/memberRelationships",
  method: "POST",
  query_params: { action: "removeFromMyConnections" },
  body: { connectionUrn: "urn:li:fsd_connection:ABC123" }
});
```

Si demain LinkedIn renomme `memberRelationships` en `memberConnections`, notre appel retourne une 404. C'est à nous de trouver la nouvelle URL (via DevTools du navigateur sur linkedin.com, ou forums/communautés).

**Risque réel** : les URLs Voyager de LinkedIn changent rarement (quelques fois par an max). Quand ça arrive, la communauté trouve la nouvelle URL rapidement. C'est un **risque de maintenance ponctuel**, pas un bloquant.

**Action en cours** : mail envoyé à Julien Crépieux (CEO Unipile) pour demander des endpoints natifs pour remove connection et company followers list. Si ajoutés, ces gaps disparaissent.

### Différences structurelles

| | Ghost Genius | Unipile |
|---|---|---|
| **Auth** | Bearer token | X-API-KEY header |
| **Base URL** | `https://api.ghostgenius.fr/v2` | `https://{DSN}/api/v1` |
| **Pagination** | Mix page-based + token-based | Cursor-based partout |
| **Format réponse** | Array directe ou `{ data: [...] }` | `{ object: "...", items: [...], cursor: "..." }` standardisé |
| **Rate limits** | Explicites et documentés (50-100/jour) | Recommandations vagues, pas de limites dures documentées |
| **Scope** | LinkedIn uniquement | Multi-provider (LinkedIn, WhatsApp, Instagram, Messenger, Telegram) |
| **Raw route** | Non | Oui — proxy vers les API internes LinkedIn (voir section ci-dessus) |
