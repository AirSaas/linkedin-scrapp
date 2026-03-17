# linkedin-scrapp / tokyo

Monitoring des visites de profil LinkedIn via Trigger.dev + Unipile.

Remplace le script Google Apps Script `get_profil_view` (Ghost Genius) par une task Trigger.dev (TypeScript) qui utilise l'API Unipile.

## Comment ca marche

1. Récupère les profils d'équipe depuis Supabase (`workspace_team` avec `unipile_account_id`)
2. Pour chaque profil, appelle l'endpoint GraphQL Voyager via la raw route Unipile (paginé, 500+ viewers sur 90 jours)
3. Parse les viewers : nom, headline, temps relatif ("Viewed 5h ago")
4. Filtre : exclut les anonymes, les semi-anonymes ("Someone at Company") et les vues > 24h
5. Enrichit les URLs ACo → slug propre via `GET /users/{id}` (cache dans `enriched_contacts`)
6. Upsert dans Supabase (`scrapped_visit`)

## Setup

```bash
npm install
```

Créer un fichier `.env` à la racine :

```
TRIGGER_SECRET_KEY=tr_dev_xxx
UNIPILE_API_KEY=xxx
UNIPILE_BASE_URL=https://api25.unipile.com:15595/api/v1
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
```

## Dev

```bash
npm run dev
```

Lance le CLI Trigger.dev en mode dev. La task `get-profil-views` apparaît dans le dashboard et peut être déclenchée manuellement.

## Structure

```
trigger/
├── get-profil-views.ts     Task principale (scheduled 1x/jour)
└── lib/
    ├── unipile.ts          Client API Unipile (get, post, rawRoute, getUser)
    ├── supabase.ts         Client Supabase
    └── utils.ts            Helpers (sleep, parseViewedAgoText, filtrage)
```

| Dossier | Contenu |
|---|---|
| `scripts-google-apps-a-migrer/` | Script GAS original (référence) |
| `tables-supabase/` | Schéma SQL + données sample de `scrapped_visit` |

## Docs

- `comparatif-ghost-genius-vs-unipile.md` — Comparaison API Ghost Genius vs Unipile (audit complet 13 février 2026)
- `plan-migration-raw-route-profile-views.md` — Plan de migration initial

## Endpoints Unipile utilisés

| Feature | Endpoint | Notes |
|---|---|---|
| Profile viewers | `POST /linkedin` (raw route GraphQL) | Paginé via `start`/`count`, 500+ viewers |
| Enrichissement profil | `GET /users/{identifier}` | ACo → slug propre |
