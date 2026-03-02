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

async function crispFetch<T>(path: string): Promise<T | null> {
  if (isRateLimited()) {
    logger.warn(`Rate limit atteint (${requestCount}/${REQUEST_LIMIT}), arrêt`);
    return null;
  }

  const url = `${CRISP_BASE}${path}`;
  requestCount++;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(),
        "X-Crisp-Tier": "plugin",
      },
    });

    if (response.status === 429) {
      logger.error("Crisp 429 Too Many Requests");
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      logger.error(`Crisp API error ${response.status}`, { url, body });
      return null;
    }

    const json: CrispApiResponse<T> = await response.json();
    if (json.error) {
      logger.error("Crisp API error", { reason: json.reason, url });
      return null;
    }

    return json.data;
  } catch (error) {
    logger.error("Crisp fetch error", { url, error });
    return null;
  }
}

// ============================================
// API Methods
// ============================================

/**
 * Liste les conversations (paginé, 20 par page)
 * Page 1-indexed
 */
export async function listConversations(page: number = 1): Promise<CrispConversation[]> {
  const data = await crispFetch<CrispConversation[]>(
    `/website/${getWebsiteId()}/conversations/${page}`
  );
  return data || [];
}

/**
 * Récupère les metas d'une conversation (email, nom, etc.)
 */
export async function getConversationMetas(sessionId: string): Promise<CrispConversation["meta"] | null> {
  return crispFetch<CrispConversation["meta"]>(
    `/website/${getWebsiteId()}/conversation/${sessionId}/meta`
  );
}

/**
 * Récupère les messages d'une conversation
 * timestampBefore: pour la pagination (messages avant ce timestamp)
 */
export async function getMessages(
  sessionId: string,
  timestampBefore?: number
): Promise<CrispMessage[]> {
  let path = `/website/${getWebsiteId()}/conversation/${sessionId}/messages`;
  if (timestampBefore) {
    path += `?timestamp_before=${timestampBefore}`;
  }
  const data = await crispFetch<CrispMessage[]>(path);
  return data || [];
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
