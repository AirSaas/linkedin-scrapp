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
};
