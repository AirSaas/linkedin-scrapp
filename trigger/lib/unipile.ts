import { logger } from "@trigger.dev/sdk/v3";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${process.env.UNIPILE_BASE_URL!}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      logger.warn(`Retry ${attempt}/${MAX_RETRIES} for ${method} ${path}`);
      await sleep(RETRY_DELAY_MS);
    }

    const res = await fetch(url, {
      method,
      headers: {
        "X-API-KEY": process.env.UNIPILE_API_KEY!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      logger.warn(`Rate limit 429 on ${method} ${path}`);
      lastError = new Error(`429 Rate Limit on ${method} ${path}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Unipile ${method} ${path} failed: ${res.status} — ${text}`
      );
    }

    return res.json();
  }

  throw lastError ?? new Error(`Failed after ${MAX_RETRIES} retries`);
}

export const unipile = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),

  /**
   * Raw route: proxy a request to LinkedIn's internal Voyager API.
   * POST /linkedin with { account_id, request_url, method }
   * request_url must be a full URL: https://www.linkedin.com/voyager/api/...
   */
  rawRoute: (accountId: string, requestUrl: string, encoding?: boolean) =>
    request("POST", "/linkedin", {
      account_id: accountId,
      request_url: requestUrl,
      method: "GET",
      ...(encoding !== undefined && { encoding }),
    }),

  /**
   * Get user profile by identifier (LinkedIn URL or slug).
   * GET /users/{identifier}?account_id={accountId}
   */
  getUser: (identifier: string, accountId: string) =>
    request(
      "GET",
      `/users/${encodeURIComponent(identifier)}?account_id=${accountId}`
    ),

  /**
   * Search LinkedIn (Sales Navigator saved searches, etc.).
   * POST /linkedin/search?account_id={accountId}
   */
  search: (accountId: string, body: Record<string, unknown>) =>
    request("POST", `/linkedin/search?account_id=${accountId}`, body),

  /**
   * Get user relations (1st-degree connections).
   * GET /users/relations?account_id={accountId}&limit={limit}&cursor={cursor}
   * Returns UserRelationsList with items sorted by created_at desc.
   */
  getRelations: (accountId: string, limit?: number, cursor?: string) => {
    let path = `/users/relations?account_id=${accountId}`;
    if (limit) path += `&limit=${limit}`;
    if (cursor) path += `&cursor=${cursor}`;
    return request("GET", path);
  },

  /**
   * List chats (messaging threads).
   * GET /chats?account_id={accountId}&limit={limit}&after={after}&cursor={cursor}
   * `after` is an ISO date string to filter chats with activity since that date.
   */
  getChats: (
    accountId: string,
    limit?: number,
    after?: string,
    cursor?: string
  ) => {
    let path = `/chats?account_id=${accountId}`;
    if (limit) path += `&limit=${limit}`;
    if (after) path += `&after=${after}`;
    if (cursor) path += `&cursor=${cursor}`;
    return request("GET", path);
  },

  /**
   * Get messages for a specific chat.
   * GET /chats/{chatId}/messages?limit={limit}&cursor={cursor}
   */
  getChatMessages: (chatId: string, limit?: number, cursor?: string) => {
    let path = `/chats/${chatId}/messages`;
    const params: string[] = [];
    if (limit) params.push(`limit=${limit}`);
    if (cursor) params.push(`cursor=${cursor}`);
    if (params.length > 0) path += `?${params.join("&")}`;
    return request("GET", path);
  },

  /**
   * Get attendees (participants) of a chat.
   * GET /chats/{chatId}/attendees
   */
  getChatAttendees: (chatId: string) =>
    request("GET", `/chats/${chatId}/attendees`),
};
