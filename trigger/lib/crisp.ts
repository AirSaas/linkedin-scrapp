/**
 * Client Crisp REST API v1
 * Doc: https://docs.crisp.chat/references/rest-api/v1/
 *
 * Auth: HTTP Basic avec identifier:key du plugin token.
 * Rate limit: 500 req/24h (marge de sécurité: 490).
 */

import { logger } from "@trigger.dev/sdk/v3";
import { sleep } from "./utils.js";

const CRISP_BASE = "https://api.crisp.chat/v1";

// ============================================
// Lazy init (env vars indisponibles au build Docker)
// ============================================

let _authHeader: string | null = null;

function getAuthHeader(): string {
  if (!_authHeader) {
    const id = process.env.CRISP_IDENTIFIER!;
    const key = process.env.CRISP_KEY!;
    _authHeader = "Basic " + Buffer.from(`${id}:${key}`).toString("base64");
  }
  return _authHeader;
}

function getWebsiteId(): string {
  return process.env.CRISP_WEBSITE_ID!;
}

// ============================================
// Types
// ============================================

export interface CrispConversation {
  session_id: string;
  people_id?: string;
  state: string; // pending, unresolved, resolved
  is_verified?: boolean;
  is_blocked?: boolean;
  availability?: string;
  active?: object;
  last_message?: string;
  updated_at: number; // Unix timestamp ms
  created_at: number;
  meta?: {
    email?: string;
    nickname?: string;
    phone?: string;
    avatar?: string;
    segments?: string[];
    data?: Record<string, any>;
  };
}

export interface CrispMessage {
  fingerprint: number;
  from: "user" | "operator";
  type: "text" | "file" | "note" | "animation" | "audio" | "picker" | "field" | "carousel" | "event";
  content: string | object;
  timestamp: number; // Unix timestamp ms
  stamped?: boolean;
  user?: {
    nickname?: string;
    user_id?: string;
  };
  original?: string;
}

interface CrispApiResponse<T> {
  error: boolean;
  reason: string;
  data: T;
}

export class CrispApiError extends Error {
  constructor(public statusCode: number | null, message: string) {
    super(message);
    this.name = "CrispApiError";
  }
}

// ============================================
// Compteur de requêtes (rate limit 500/24h)
// ============================================

let requestCount = 0;
const REQUEST_LIMIT = 490;

export function getRequestCount(): number {
  return requestCount;
}

export function resetRequestCount(): void {
  requestCount = 0;
}

export function isRateLimited(): boolean {
  return requestCount >= REQUEST_LIMIT;
}

// ============================================
// Fetch wrapper
// ============================================

async function crispFetch<T>(path: string): Promise<T> {
  if (isRateLimited()) {
    throw new CrispApiError(429, `Rate limit atteint (${requestCount}/${REQUEST_LIMIT})`);
  }

  const url = `${CRISP_BASE}${path}`;
  requestCount++;

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      "X-Crisp-Tier": "plugin",
    },
  });

  if (response.status === 429) {
    throw new CrispApiError(429, "Crisp 429 Too Many Requests");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new CrispApiError(response.status, `Crisp API error ${response.status}: ${body}`);
  }

  const json: CrispApiResponse<T> = await response.json();
  if (json.error) {
    throw new CrispApiError(null, `Crisp API error: ${json.reason}`);
  }

  return json.data;
}

// ============================================
// API Methods
// ============================================

/**
 * Liste les conversations (paginé, 20 par page)
 * Page 1-indexed
 *
 * THROWS CrispApiError on API failure — callers must handle it
 * to distinguish empty pages from API errors.
 */
export async function listConversations(page: number = 1): Promise<CrispConversation[]> {
  return await crispFetch<CrispConversation[]>(
    `/website/${getWebsiteId()}/conversations/${page}`
  );
}

/**
 * Récupère les metas d'une conversation (email, nom, etc.)
 * Returns null on error (per-conversation errors are non-fatal).
 */
export async function getConversationMetas(sessionId: string): Promise<CrispConversation["meta"] | null> {
  try {
    return await crispFetch<CrispConversation["meta"]>(
      `/website/${getWebsiteId()}/conversation/${sessionId}/meta`
    );
  } catch (err) {
    logger.error("getConversationMetas error", { sessionId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Récupère les messages d'une conversation
 * timestampBefore: pour la pagination (messages avant ce timestamp)
 * Returns [] on error (per-conversation errors are non-fatal).
 */
export async function getMessages(
  sessionId: string,
  timestampBefore?: number
): Promise<CrispMessage[]> {
  try {
    let path = `/website/${getWebsiteId()}/conversation/${sessionId}/messages`;
    if (timestampBefore) {
      path += `?timestamp_before=${timestampBefore}`;
    }
    return await crispFetch<CrispMessage[]>(path);
  } catch (err) {
    logger.error("getMessages error", { sessionId, error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Récupère TOUS les messages d'une conversation (pagine automatiquement)
 * Attention: consomme 1 requête par page de ~20 messages
 */
export async function getAllMessages(sessionId: string): Promise<CrispMessage[]> {
  const allMessages: CrispMessage[] = [];
  let oldestTimestamp: number | undefined;
  let hasMore = true;

  while (hasMore && !isRateLimited()) {
    const batch = await getMessages(sessionId, oldestTimestamp);

    if (!batch.length) {
      hasMore = false;
      break;
    }

    allMessages.push(...batch);

    if (batch.length < 20) {
      hasMore = false;
    } else {
      oldestTimestamp = Math.min(...batch.map((m) => m.timestamp));
    }

    await sleep(300);
  }

  return allMessages;
}
