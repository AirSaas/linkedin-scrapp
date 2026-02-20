# Project: LinkedIn Scrapp — Trigger.dev Tasks

## Architecture

- **Runtime**: Trigger.dev v3 (`schedules.task`)
- **Deploy**: GitHub Actions → Trigger.dev (on push to `main` or `staging`)
- **Project ref**: `proj_qnvzrrduyvfunicemipq`
- **Env vars**: configured in Trigger.dev dashboard (not in code), per environment
- **Cron**: configured via Trigger.dev dashboard (not in code)
- **Secret key (prod)**: `tr_prod_TOBy4NubZXOQASLQDR2n` — used for Management API auth

## Trigger.dev Management API

Base URL: `https://api.trigger.dev`, auth via `Authorization: Bearer <secret_key>`.

- **List env vars**: `GET /api/v1/projects/proj_qnvzrrduyvfunicemipq/envvars`
- **Create env var**: `POST /api/v1/projects/proj_qnvzrrduyvfunicemipq/envvars/{env}` with `{"name":"VAR_NAME","value":"value"}` (env = `dev`, `staging`, or `prod`)
- **List runs**: `GET /api/v1/runs?filter[status]=FAILED&page[size]=10`
- **Get run details**: `GET /api/v3/runs/{runId}` (includes `error` field with name, message, stackTrace)

## Key Files

- `trigger/get-profil-views.ts` — scrapes LinkedIn profile viewers via GraphQL Voyager endpoint
- `trigger/get-strategic-connections.ts` — scrapes Sales Navigator saved searches for new concurrent profiles
- `trigger/get-strategic-people.ts` — scrapes Sales Navigator saved searches for strategic people (CIO, PMO, etc.)
- `trigger/get-team-connections.ts` — fetches 1st-degree LinkedIn connections for all team members
- `trigger/lgm-process-intent-events.ts` — processes J-1 intent events + concurrent contacts → routes to LGM or HubSpot, sends grouped Slack recap. Also exports `lgm-process-intent-events-10-days` backfill task (same logic, 10-day lookback)
- `trigger/hubspot-cleanup-email-associations.ts` — removes parasitic email-contact associations in HubSpot (emails with >3 contacts where contact not in from/to/cc/bcc)
- `trigger/import-linkedin-messages.ts` — imports LinkedIn messages from last 24h via Unipile → Supabase, sends 1:1 messages to HubSpot (communication) + Zapier webhook
- `trigger/weekly-meetings-recap.ts` — weekly Monday recap of HubSpot meetings in SQL pipeline, enriched with AI (Anthropic Sonnet) and sent to Slack
- `trigger/deal-clean-alert.ts` — alerts on deals needing cleanup (date dépassée, sans date en RDV à planifier, sans montant après Demo) via Zapier webhook
- `trigger/data-freshness-check.ts` — daily monitoring of Supabase table freshness (PRC_INTENT_EVENTS, scrapped_visit, scrapped_reaction, messages, threads), uses Claude Sonnet for anomaly detection, alerts on script_logs
- `trigger/sync-modjo-calls.ts` — syncs Modjo calls (transcripts, participants, HubSpot IDs, AI summaries) to Supabase `modjo_calls` table via Modjo API, hourly cron
- `trigger/lib/unipile.ts` — Unipile API client (rawRoute, getUser, search, getRelations, getChats, getChatMessages, getChatAttendees)
- `trigger/lib/supabase.ts` — Supabase client (lazy-init via Proxy)
- `trigger/lib/utils.ts` — shared helpers (sleep, parseViewedAgoText, etc.)

## Task Flow Diagrams

> **Rule**: Update these diagrams whenever a task is modified.

### Overview

```mermaid
flowchart LR
    subgraph src ["Data Sources"]
        UN(Unipile API)
        SB[(Supabase)]
        HS_I(HubSpot API)
        MJ(Modjo API)
    end

    subgraph dst ["Destinations"]
        LGM_O(LGM API)
        HS_O(HubSpot API)
        SB_O[(Supabase)]
        SL(Slack)
        ZP(Zapier)
    end

    UN --> GPV[get-profil-views] & GSC[get-strategic-connections] & GSP[get-strategic-people] & GTC[get-team-connections] & ILM[import-linkedin-messages]
    SB --> LPI[lgm-process-intent-events] & DCA[deal-clean-alert] & DFC[data-freshness-check]
    HS_I --> HCE[hubspot-cleanup-email-assoc] & WMR[weekly-meetings-recap] & LPI & ILM
    MJ --> SMC[sync-modjo-calls]

    GPV --> SB_O & SL
    GSC --> SB_O & SL
    GSP --> SB_O & SL
    GTC --> SB_O & SL
    LPI --> LGM_O & HS_O & SL
    HCE --> HS_O & SL
    ILM --> SB_O & HS_O & ZP & SL
    WMR --> SL
    DCA --> ZP
    DFC --> SL
    SMC --> SB_O & SL
```

### `get-profil-views` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[Fetch workspace_team<br/>with unipile_account_id]
    B --> C{For each<br/>team member}
    C --> D[Fetch LinkedIn Voyager GraphQL<br/>profile viewers — paginated]
    D --> E{Filter each viewer}
    E -->|URL contains /search/| F[Skip: anonymous]
    E -->|URL without /in/| G[Skip: non-profile]
    E -->|Age > 24h| H[Skip: too old]
    E -->|Valid| I[Resolve ACo URL → slug<br/>via enriched_contacts cache<br/>or Unipile getUser]
    I --> J[Upsert to scrapped_visit]
    J --> K[Upsert to enriched_contacts]
    C -->|All done| L{{Slack: webhook_succes_profil_view}}
    C -->|Errors| M{{Slack: script_logs}}
```

### `get-strategic-connections` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[2 configs: Adrien Cousa + Laurent Defer<br/>each with saved_search + account + LGM audience]
    B --> C{For each config}
    C --> D[Fetch Sales Nav search<br/>via Unipile — lastViewedAt 72h<br/>paginated cursor]
    D --> E{For each profile}
    E --> F[Extract public identifier]
    F --> G[Call /functions/v1/enrich]
    G --> H[Upsert to<br/>scrapped_strategic_connection_concurrent]
    C -->|All done| I{{Slack: SLACK_WEBHOOK_CONCURRENT}}
    C -->|Errors| J{{Slack: script_logs}}
```

### `get-strategic-people` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[3 saved searches:<br/>CIO/DSI, PMO, Head of Transfo<br/>single Unipile account]
    B --> C{For each search}
    C --> D[Fetch Sales Nav search<br/>via Unipile — lastViewedAt 72h<br/>paginated cursor]
    D --> E{For each profile}
    E --> F[Extract identifier]
    F --> G[Call /functions/v1/enrich]
    G --> H[Upsert to<br/>new_scrapp_strategic_people_salesnav]
    C -->|All done| I{{Slack: SLACK_WEBHOOK_CONCURRENT}}
    C -->|Errors| J{{Slack: script_logs}}
```

### `get-team-connections` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[Fetch workspace_team<br/>with unipile_account_id]
    B --> C{For each<br/>team member}
    C --> D[Fetch Unipile getRelations<br/>paginated — max 10 pages]
    D --> E{For each relation}
    E --> F[Extract public_profile_url<br/>member_id, connected_at]
    F --> G{Already in<br/>scrapped_connection?}
    G -->|Yes| H[Update existing]
    G -->|No| I[Insert new]
    D -->|All page = dupes| K[Stop pagination early]
    C -->|All done| L{{Slack: SLACK_WEBHOOK_CONCURRENT}}
    C -->|Errors| M{{Slack: script_logs}}
```

### `lgm-process-intent-events` (daily + 10-day backfill)

#### Intent Events Routing

```mermaid
flowchart TD
    A([Cron daily / backfill 10d]) --> B[Fetch PRC_INTENT_EVENTS<br/>J-1 or J-10<br/>CONTACT_JOB_STRATEGIC_ROLE not null]
    B --> C[Fetch workspace_team<br/>hubspot_connected_with_value + hubspot_id]
    C --> D{For each event}

    D --> E{Excluded<br/>profile?}
    E -->|Yes| F[Skip]

    E -->|No| G{INTENT_EVENT_TYPE<br/>= Follow Page?}

    G -->|Yes| H[Lookup PAGE_AUDIENCES<br/>via EVENT_RECORD_ORIGIN<br/>Airsaas / ProDeLaTransfo]
    H --> I(LGM: page audience)

    G -->|No| J{CONNECTED_WITH<br/>INTENT_OWNER?}

    J -->|false| K[Lookup AUDIENCE_MAPPING<br/>intentOwner + eventType + connected_false]
    K --> L(LGM: owner audience)

    J -->|true| M{BUSINESS_OWNER?}

    M -->|null| N[HubSpot PATCH:<br/>hubspot_owner_id = intent owner<br/>agent_ia_activated = true]

    M -->|= INTENT_OWNER| O{cancel_agent_ia<br/>empty?}
    O -->|Yes| P[HubSpot PATCH:<br/>agent_ia_activated = true]
    O -->|No| Q[Skip: cancelled]

    M -->|different from INTENT_OWNER| R[Skip: cross-owner]

    D -->|All done| S[Process concurrent contacts]
    S --> T{{Slack: webhook_intent_events_lgm_activity<br/>grouped by INTENT_OWNER}}
    D -->|Errors| U{{Slack: script_logs}}
```

#### Concurrent Contacts Routing

```mermaid
flowchart TD
    A([After intent events]) --> B[Fetch scrapped_strategic_connection_concurrent<br/>J-1 or J-10, job_strategic_role not null]
    B --> C{For each contact}

    C --> D{Excluded<br/>profile?}
    D -->|Yes| E[Skip]

    D -->|No| F{Connected<br/>with Bertran?}

    F -->|No| G(LGM: CONCURRENT_LGM_AUDIENCES<br/>by sales_nav_source)

    F -->|Yes| H{Exists in<br/>PRC_CONTACTS?}

    H -->|Yes| I{cancel_agent_ia<br/>empty?}
    I -->|Yes| J[HubSpot PATCH:<br/>agent_ia_activated = true]
    I -->|No| K[Skip: cancelled]

    H -->|No| L[HubSpot POST:<br/>create contact<br/>assign Bertran + activate]
```

### `hubspot-cleanup-email-associations` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[Fetch HubSpot emails<br/>created in last 24h]
    B --> C{For each email}
    C --> D[Get associated contacts]
    D --> E{Contacts > 3?}
    E -->|No| F[Skip email]
    E -->|Yes| G[Extract from/to/cc/bcc<br/>email addresses]
    G --> H{For each contact}
    H --> I{Contact email<br/>in from/to/cc/bcc?}
    I -->|Yes| J[Keep association]
    I -->|No| K{Internal domain<br/>airsaas.io?}
    K -->|Yes| L[Keep: internal]
    K -->|No| M[DELETE association<br/>parasitic contact]
    C -->|All done| N{{Slack: script_logs}}
```

### `import-linkedin-messages` (hourly)

```mermaid
flowchart TD
    A([Cron hourly]) --> B[Fetch workspace_team<br/>with linkedin_urn + unipile_account_id]
    B --> C{For each<br/>team account}
    C --> D[Fetch Unipile chats<br/>since 24h ago — paginated]
    D --> E{For each thread}
    E --> F[Fetch attendees]
    F --> G{Thread exists<br/>in DB?}
    G -->|No| H[Insert to<br/>scrapped_linkedin_threads]
    G -->|Yes| I[Continue]
    H --> I
    I --> J[Fetch messages — paginated]
    J --> K{For each message}
    K --> L{Message exists<br/>in DB?}
    L -->|Yes| M[Skip]
    L -->|No| N[Insert to<br/>scrapped_linkedin_messages]
    N --> O{1:1 thread?<br/>participants = 2}
    O -->|No| P[Done]
    O -->|Yes| Q[POST HubSpot communication<br/>with contact + deal associations]
    Q --> R{{POST Zapier: webhook_linkedin_message}}
    C -->|Errors| S{{Slack: script_logs}}
```

### `weekly-meetings-recap` (weekly Monday)

```mermaid
flowchart TD
    A([Cron weekly Monday]) --> B[Calculate week Mon-Fri<br/>Paris timezone]
    B --> C[Fetch HubSpot meetings<br/>in SQL pipeline 3165468]
    C --> D{For each meeting}
    D --> E[Fetch associated deals<br/>filter SQL pipeline only]
    E --> F[Fetch deal props:<br/>name, amount, stage, owner]
    F --> G[Fetch company name]
    D -->|All done| H[Build WeekData<br/>grouped by day]
    H --> I[Send to Anthropic Sonnet<br/>for AI recap]
    I -->|Success| J[Format with AI insight]
    I -->|Failure| K[Format with static template]
    J --> L{{Slack: webhook_sql_activity}}
    K --> L
    A -->|Fatal error| M{{Slack: script_logs}}
```

### `deal-clean-alert` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B[Fetch PRC_DEAL_UPSELL_AND_SQL]
    B --> C[Fetch workspace_team<br/>for owner → Slack mapping]
    C --> D{Apply 3 rules}
    D --> E["Rule 1: Date dépassée<br/>DEAL_CLOSED_DATE < today<br/>+ deal not closed"]
    D --> F["Rule 2: Sans date<br/>stage = RDV à planifier<br/>+ no DEAL_CLOSED_DATE"]
    D --> G["Rule 3: Sans montant<br/>stage post-Demo<br/>+ amount null/0"]
    E & F & G --> H[Group flagged deals<br/>by owner + rule]
    H --> I{Any deals<br/>flagged?}
    I -->|Yes| J{{Zapier: webhook_team_sales<br/>per-owner alert with @mentions}}
    I -->|No| K[Done]
    A -->|Fatal error| L{{Slack: script_logs}}
```

### `data-freshness-check` (daily)

```mermaid
flowchart TD
    A([Cron daily]) --> B{Monday?}
    B -->|Yes| C[Lookback: 7 days]
    B -->|No| D[Lookback: J-1 only]
    C & D --> E["Count records in 5 tables:<br/>PRC_INTENT_EVENTS, scrapped_visit,<br/>scrapped_reaction, messages, threads"]
    E --> F{For each table}
    F --> G{Records = 0?}
    G -->|Yes| H[Mark anomaly<br/>find last record date]
    G -->|No| I[Fetch 30-day<br/>daily history]
    I --> J[Send to Anthropic Sonnet<br/>evaluate: ok / warning / anomaly]
    J --> K[Collect results]
    H --> K
    K --> L{All OK?}
    L -->|Yes| M{{Slack: script_logs<br/>light format — just counts}}
    L -->|No| N{{Slack: script_logs<br/>detailed: anomalies/warnings/ok}}
```

### `sync-modjo-calls` (hourly)

```mermaid
flowchart TD
    A([Cron hourly]) --> B[Fetch Modjo calls<br/>last 90 days — paginated<br/>50/page, max 4 pages]
    B --> C{For each call}
    C --> D[Build speaker mapping<br/>speakerId → name, email, type]
    D --> E["Format transcript:<br/>[HH:MM] speaker: text"]
    E --> F[Build participants JSON<br/>with HubSpot IDs]
    F --> G[Extract topics + tags]
    G --> H[Batch upsert to modjo_calls<br/>groups of 50]
    H -->|Errors| I{{Slack: script_logs}}
    H -->|Success| J[Done]
```

## Important Rules

- **Edge Function `/functions/v1/enrich`**: This is the enrichment function hosted on Supabase. **Never reinvent or replace it.** Always call it as-is with `{ parameter: "all", contact_linkedin_url: "http://linkedin.com/in/{id}" }`.
- **Lazy initialization**: Supabase and Unipile clients must NOT initialize at import time (env vars unavailable during Trigger.dev Docker build). Use lazy-init patterns.
- **Ghost Genius account IDs**: Still used as keys in `workspace_team` to look up `unipile_account_id`. The Ghost Genius API itself is no longer used.
- **Error reporting sur Slack** : Toute task Trigger.dev doit envoyer un recap d'erreur sur le webhook `script_logs` quand il y a des erreurs, via `sendErrorToScriptLogs()` de `trigger/lib/utils.ts`. Le message doit identifier clairement la task et être lisible d'un coup d'oeil. Exemple de bon message :
  ```
  [Strategic People SalesNav] ⚠️ Erreurs — 2026-02-18 14:30

  📊 Résultats
  • CIO - DSI France: 5 insérés | 0 ignorés
  • PMO France: 3 insérés | 1 ignoré

  ❌ Erreurs (3)
  • CIO - DSI France: 1x Enrichissement (404), 1x Supabase Upsert (23505)
  • PMO France: 1x Enrichissement (timeout)

  Total: 3 erreurs
  ```
  Les webhooks d'activité existants (recap succès, notifications métier) sont séparés et ne remplacent pas cette alerte erreur.

## Supabase Tables

### `scrapped_visit`
- Profile view visits (from `get-profil-views`)
- Unique on: `(profil_linkedin_url_reaction, linkedin_url_profil_visited, date_scrapped_calculated)`

### `scrapped_strategic_connection_concurrent`
- Sales Navigator concurrent profiles (from `get-strategic-connections`)
- Unique on: `(linkedin_private_id, sales_nav_description)`

### `workspace_team`
- Maps `ghost_genius_account_id` → `unipile_account_id`
- Contains LinkedIn URLs and team member info

### `scrapped_connection`
- 1st-degree LinkedIn connections (from `get-team-connections`)
- PK composite: `(profil_linkedin_url_connection, linkedin_url_owner_post)`
- `created_at`: scraping date (YYYY-MM-DD), `connected_at`: connection date
- `contact_urn`: LinkedIn member ID (ACoAA... format)
- ⚠️ URLs stored without trailing `/`

### `new_scrapp_strategic_people_salesnav`
- Strategic people from Sales Navigator (from `get-strategic-people`)
- PK composite: `(linkedin_private_url, saved_search_name)`

### `enriched_contacts`
- Cache for ACo URL → enriched slug resolution

### `PRC_INTENT_EVENTS`
- Intent events (reactions, comments, visits, follows) from `lgm-process-intent-events`
- Read-only: filtered on `EVENT_RECORDED_ON` J-1, `CONTACT_JOB_STRATEGIC_ROLE` non null
- Fields: `CONTACT_FIRST_NAME`, `CONTACT_LAST_NAME`, `CONTACT_LINKEDIN_PROFILE_URL`, `COMPANY_NAME`, `CONTACT_JOB`, `CONTACT_HUBSPOT_ID`, `BUSINESS_OWNER`, `INTENT_EVENT_TYPE`, `CONNECTED_WITH_BUSINESS_OWNER`, `INTENT_OWNER`, `CONNECTED_WITH_INTENT_OWNER`, `EVENT_RECORD_ORIGIN`

### `PRC_CONTACTS`
- Read-only: lookup `CONTACT_HUBSPOT_ID` by `CONTACT_LINKEDIN_PROFILE_URL`
- Used by `lgm-process-intent-events` for concurrent contacts HubSpot routing

### `scrapped_linkedin_threads`
- LinkedIn messaging threads (from `import-linkedin-messages`)
- PK: `id` (LinkedIn thread ID, format `2-base64...`)
- `last_activity_at`: ISO timestamp, `is_read`: boolean
- `participants`: JSON array in Ghost Genius format (`{id, type, full_name, url, profile_picture}`)
- `participant_owner_id`: team member's `linkedin_urn` (ACoAA...)
- `participants_ids`: array of all participant URNs, `participants_numbers`: count
- `main_participant_id`: other participant URN for 1:1 threads

### `scrapped_linkedin_messages`
- LinkedIn messages (from `import-linkedin-messages`)
- PK: `id` (format `urn:li:msg_message:(urn:li:fsd_profile:${owner_urn},${msg_provider_id})`)
- `thread_id`: references `scrapped_linkedin_threads.id`
- `message_date`: ISO timestamp, `is_read`: boolean, `text`: message content
- `sender_id`: sender's LinkedIn URN (ACoAA...)
- `sender_data`: JSON in Ghost Genius format (`{id, type, full_name, url, profile_picture}`)
- `hubspot_communication_id`: HubSpot communication ID (set after HubSpot sync for 1:1 threads)
- `participant_owner_id`, `participants_numbers`, `main_participant_id`: denormalized from thread

### `modjo_calls`
- Modjo calls synced hourly (from `sync-modjo-calls`)
- PK: `call_id` (Modjo call ID)
- `hubspot_deal_id`, `hubspot_account_id`, `hubspot_contact_ids`: HubSpot associations
- `participants`: JSON array `[{name, email, type, hubspot_id}]`
- `ai_summary`: Modjo AI-generated summary
- `transcript_clean`: formatted transcript with speaker names and timestamps
- `topics`, `tags`: string arrays
- `raw_data`: full Modjo API response

## External APIs (non-Unipile)

- **LGM (LaGrowthMachine)**: `POST https://apiv2.lagrowthmachine.com/flow/leads?apikey=X` — send leads with audience name. Env var: `LGM_API_KEY`
- **HubSpot**: `GET/PATCH/POST https://api.hubapi.com/crm/v3/objects/contacts` — manage contacts, `agent_ia_activated` property. Env var: `HUBSPOT_ACCESS_TOKEN`
- **Anthropic**: `POST https://api.anthropic.com/v1/messages` — AI-generated Slack recaps (claude-sonnet-4-20250514). Env var: `ANTHROPIC_API_KEY`
- **Slack Webhook** (meetings recap): `POST` to `webhook_sql_activity` — weekly meetings recap channel
- **Slack Webhook** (intent events): `POST` to `webhook_intent_events_lgm_activity` — daily intent events recap
- **Slack Webhook** (error log): `POST` to `script_logs` — script error alerts
- **Zapier Webhook** (LinkedIn messages): `POST` to `webhook_linkedin_message` — LinkedIn message enrichment
- **Zapier Webhook** (deal clean alert): `POST` to `webhook_team_sales` — deal cleaning alerts
- **Modjo**: `POST https://api.modjo.ai/v1/calls/exports` — export calls with transcripts, speakers, HubSpot relations. Auth: `X-API-KEY` header. Env var: `MODJO_API_KEY`

## Unipile API

- **Search**: `POST /linkedin/search?account_id=X` with `{ url: "...savedSearchId=...&lastViewedAt=<timestamp_ms>" }` — cursor-based pagination, 10 items/page. `lastViewedAt` is a native Sales Navigator URL parameter that filters to only new results since that timestamp.
- **Raw route**: `POST /linkedin` — proxy to LinkedIn Voyager GraphQL
- **Get user**: `GET /users/{identifier}?account_id=X`
- **Get relations**: `GET /users/relations?account_id=X&limit=N&cursor=C` — returns `UserRelationsList` with items sorted by `created_at` desc. Each `UserRelation` has `first_name`, `last_name`, `headline`, `public_profile_url` (trailing `/`), `member_id` (ACoAA...), `created_at` (timestamp ms)
- **Get chats**: `GET /chats?account_id=X&limit=N&after=ISO&cursor=C` — list messaging threads, cursor-based pagination. `after` filters by activity date.
- **Get chat messages**: `GET /chats/{chatId}/messages?limit=N&cursor=C` — messages for a thread, cursor-based pagination
- **Get chat attendees**: `GET /chats/{chatId}/attendees` — participants of a thread (only returns non-self, `is_self: 0`)
