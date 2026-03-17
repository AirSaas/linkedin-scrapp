/**
 * Trigger.dev Task — Import Circle posts + comments → Supabase
 * Channel : https://club.airsaas.io/c/ca-vient-de-sortir/
 *
 * ENV requis dans Trigger.dev :
 *   CIRCLE_API_TOKEN                      → token Admin v2
 *   CIRCLE_COMMUNITY_HOST                 → "club.airsaas.io"
 *   TCHAT_SUPPORT_SYNC_SUPABASE_URL       → https://oqiowupiczgrezgyopfm.supabase.co
 *   TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY → service_role key
 *
 * Cron : vendredi 8h (configuré dans le dashboard Trigger.dev)
 * Sync incrémentale via curseur circle_sync_cursor (updated_at)
 */

import { task, logger } from "@trigger.dev/sdk/v3";
import {
  getSyncCursor,
  updateSyncCursor,
  upsertPosts,
} from "./lib/circle-supabase.js";
import { sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";

// ---------------------------------------------------------------------------
// Types Circle API
// ---------------------------------------------------------------------------

interface CircleBody {
  id: number;
  name: string;
  body: string; // HTML
  record_type: string;
  record_id: number;
  created_at: string;
  updated_at: string;
}

interface CircleTipTapBody {
  body: {
    type: string;
    content: object[];
  };
  circle_ios_fallback_text?: string;
  attachments?: object[];
  inline_attachments?: object[];
  sgids_to_object_map?: Record<string, object>;
  format?: string;
  community_members?: object[];
  entities?: object[];
  group_mentions?: object[];
  polls?: object[];
}

interface CirclePost {
  id: number;
  status: string;
  name: string | null;
  slug: string;
  url: string;
  space_name: string;
  space_slug: string;
  space_id: number;
  community_id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  user_avatar_url: string | null;
  body: CircleBody;
  tiptap_body: CircleTipTapBody | null;
  body_plain_text?: string;
  cover_image_url: string | null;
  likes_count: number;
  comments_count: number;
  is_comments_enabled: boolean;
  is_liking_enabled: boolean;
  hide_meta_info: boolean;
  topics: number[];
  published_at: string;
  created_at: string;
  updated_at: string;
  gallery?: {
    id: number;
    downloadable_images: boolean;
    images: {
      id: number;
      signed_id: string;
      original_url: string;
      url: string;
      filename: string;
      width: number;
      height: number;
    }[];
  };
}

interface CircleComment {
  id: number;
  parent_comment_id: number | null;
  body: {
    id: number;
    body: string;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: number;
    name: string;
    avatar_url: string | null;
    email: string;
  };
  replies_count: number;
  replies: CircleComment[];
  url: string;
  likes_count: number;
  created_at?: string;
}

interface CircleSpace {
  id: number;
  name: string;
  slug: string;
}

interface PaginatedResponse<T> {
  page: number;
  per_page: number;
  has_next_page: boolean;
  count: number;
  page_count: number;
  records: T[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractImages(post: CirclePost): object[] {
  const images: object[] = [];

  if (post.gallery?.images?.length) {
    for (const img of post.gallery.images) {
      images.push({
        source: "gallery",
        id: img.id,
        url: img.url,
        original_url: img.original_url,
        filename: img.filename,
        width: img.width,
        height: img.height,
      });
    }
  }

  if (post.tiptap_body?.body?.content) {
    extractTipTapImages(
      post.tiptap_body.body.content,
      post.tiptap_body.sgids_to_object_map ?? {},
      images
    );
  }

  return images;
}

function extractTipTapImages(
  nodes: object[],
  sgidMap: Record<string, object>,
  acc: object[]
): void {
  for (const node of nodes as Record<string, unknown>[]) {
    if (node.type === "image") {
      const attrs = node.attrs as Record<string, string> | undefined;
      if (attrs?.sgid && sgidMap[attrs.sgid]) {
        const meta = sgidMap[attrs.sgid] as Record<string, unknown>;
        acc.push({
          source: "tiptap_inline",
          sgid: attrs.sgid,
          url: meta.url ?? attrs.src ?? null,
          filename: meta.filename ?? null,
          width: meta.width ?? null,
          height: meta.height ?? null,
          content_type: meta.content_type ?? null,
        });
      } else if (attrs?.src) {
        acc.push({
          source: "tiptap_inline",
          url: attrs.src,
          width: attrs.width ?? null,
          height: attrs.height ?? null,
        });
      }
    }
    if (Array.isArray(node.content)) {
      extractTipTapImages(node.content as object[], sgidMap, acc);
    }
  }
}

/** Strip HTML tags and decode common entities → plain text */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapPostToRow(
  post: CirclePost,
  comments: CircleComment[] | null
): Record<string, unknown> {
  return {
    id: post.id,
    slug: post.slug,
    url: post.url,
    name: post.name,
    status: post.status,
    post_type: "basic",
    space_id: post.space_id,
    space_name: post.space_name,
    space_slug: post.space_slug,
    community_id: post.community_id,
    user_id: post.user_id,
    user_name: post.user_name,
    user_email: post.user_email,
    user_avatar_url: post.user_avatar_url,
    body_html: post.body?.body ?? null,
    tiptap_body: post.tiptap_body ?? null,
    images: extractImages(post),
    attachments: post.tiptap_body?.attachments ?? null,
    body_plain_text: post.body?.body ? htmlToPlainText(post.body.body) : null,
    cover_image_url: post.cover_image_url,
    likes_count: post.likes_count ?? 0,
    comments_count: post.comments_count ?? 0,
    comments: comments,
    topics: post.topics ?? [],
    is_comments_enabled: post.is_comments_enabled ?? true,
    is_liking_enabled: post.is_liking_enabled ?? true,
    hide_meta_info: post.hide_meta_info ?? false,
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
    last_synced_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Circle API client
// ---------------------------------------------------------------------------

class CircleClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(token: string, host: string) {
    this.baseUrl = `https://${host}/api/admin/v2`;
    this.headers = {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    };
  }

  async getSpaceBySlug(slug: string): Promise<CircleSpace | null> {
    const url = `${this.baseUrl}/spaces?per_page=100`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok)
      throw new Error(
        `Circle spaces API error: ${res.status} ${await res.text()}`
      );
    const data = (await res.json()) as PaginatedResponse<CircleSpace>;
    return data.records.find((s) => s.slug === slug) ?? null;
  }

  async getPosts(
    spaceId: number,
    page: number,
    perPage = 20,
    status: "published" | "draft" = "published"
  ): Promise<PaginatedResponse<CirclePost>> {
    const params = new URLSearchParams({
      space_id: String(spaceId),
      page: String(page),
      per_page: String(perPage),
      status,
    });
    const url = `${this.baseUrl}/posts?${params}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok)
      throw new Error(
        `Circle posts API error: ${res.status} ${await res.text()}`
      );
    return res.json() as Promise<PaginatedResponse<CirclePost>>;
  }

  async getPostComments(
    postId: number,
    page = 1,
    perPage = 20
  ): Promise<PaginatedResponse<CircleComment>> {
    const params = new URLSearchParams({
      post_id: String(postId),
      page: String(page),
      per_page: String(perPage),
    });
    const url = `${this.baseUrl}/comments?${params}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok)
      throw new Error(
        `Circle comments API error: ${res.status} ${await res.text()}`
      );
    return res.json() as Promise<PaginatedResponse<CircleComment>>;
  }

  async getAllCommentsForPost(postId: number): Promise<CircleComment[]> {
    const allComments: CircleComment[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const data = await this.getPostComments(postId, page);
      allComments.push(...data.records);
      hasNextPage = data.has_next_page;
      page++;
      if (hasNextPage) await new Promise((r) => setTimeout(r, 300));
    }

    return allComments;
  }
}

// ---------------------------------------------------------------------------
// Trigger.dev Task
// ---------------------------------------------------------------------------

const DEFAULT_SPACE_SLUGS = [
  "ca-vient-de-sortir",
  "utilisateurs-d-airsaas",
  "debuter-sur-airsaas",
];

export const importCirclePosts = task({
  id: "import-circle-posts",
  maxDuration: 600,

  run: async (payload: {
    spaceSlugs?: string[];
    dryRun?: boolean;
    fullSync?: boolean;
  }) => {
    const {
      spaceSlugs = DEFAULT_SPACE_SLUGS,
      dryRun = false,
      fullSync = false,
    } = payload;

    // --- Init ---
    const circleToken = process.env.CIRCLE_API_TOKEN;
    const circleHost =
      process.env.CIRCLE_COMMUNITY_HOST ?? "club.airsaas.io";

    if (!circleToken) throw new Error("Env manquante : CIRCLE_API_TOKEN");

    const circle = new CircleClient(circleToken, circleHost);

    logger.info("Import Circle → Supabase", {
      spaceSlugs,
      dryRun,
      fullSync,
      circleHost,
    });

    const allGroups: TaskResultGroup[] = [];
    const spaceResults: Array<{
      space: { id: number; name: string; slug: string };
      upserted: number;
      skipped: number;
      comments: number;
      errors: number;
    }> = [];

    for (const spaceSlug of spaceSlugs) {
      logger.info(`\n--- Space: ${spaceSlug} ---`);

      // --- 1. Get space ---
      const space = await circle.getSpaceBySlug(spaceSlug);
      if (!space) {
        logger.error(`Space "${spaceSlug}" introuvable sur ${circleHost}`);
        allGroups.push({
          label: `Circle ${spaceSlug}`,
          inserted: 0,
          skipped: 0,
          errors: [
            {
              type: "Circle Import",
              code: "NOT_FOUND",
              message: `Space "${spaceSlug}" introuvable`,
            },
          ],
        });
        continue;
      }
      logger.info(`Space trouvé : "${space.name}" (id=${space.id})`);

      // --- 2. Read cursor ---
      const cursorDate = fullSync ? null : await getSyncCursor(spaceSlug);
      if (cursorDate) {
        logger.info(`Curseur : ${cursorDate} (incremental)`);
      } else {
        logger.info("Pas de curseur — full sync");
      }

      // --- 3. Paginate posts + fetch comments ---
      let totalUpserted = 0;
      let totalSkipped = 0;
      let totalCommentsFetched = 0;
      const errors: string[] = [];
      let latestUpdatedAt: string | null = null;

      for (const status of ["published", "draft"] as const) {
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
          const data = await circle.getPosts(space.id, page, 20, status);
          logger.info(
            `[${spaceSlug}] Page ${page}/${data.page_count} (${status}) — ${data.records.length} posts`
          );

          if (data.records.length === 0) break;

          const rowsToUpsert: Record<string, unknown>[] = [];

          for (const post of data.records) {
            if (
              !latestUpdatedAt ||
              new Date(post.updated_at) > new Date(latestUpdatedAt)
            ) {
              latestUpdatedAt = post.updated_at;
            }

            if (
              cursorDate &&
              new Date(post.updated_at) <= new Date(cursorDate)
            ) {
              totalSkipped++;
              continue;
            }

            let comments: CircleComment[] | null = null;
            if (post.comments_count > 0) {
              try {
                comments = await circle.getAllCommentsForPost(post.id);
                totalCommentsFetched += comments.length;
                logger.info(
                  `Post ${post.id}: ${comments.length} commentaires`
                );
              } catch (err) {
                const msg = `Comments post ${post.id}: ${err instanceof Error ? err.message : String(err)}`;
                logger.error(msg);
                errors.push(msg);
              }
            }

            rowsToUpsert.push(mapPostToRow(post, comments));
          }

          if (dryRun) {
            logger.info(
              `[DRY RUN] ${rowsToUpsert.length} posts seraient upsertés`,
              { posts: rowsToUpsert.map((r) => ({ id: r.id, name: r.name })) }
            );
            totalUpserted += rowsToUpsert.length;
          } else {
            const result = await upsertPosts(rowsToUpsert);
            totalUpserted += result.upserted;
            errors.push(...result.errors);
          }

          hasNextPage = data.has_next_page;
          page++;
          if (hasNextPage) await new Promise((r) => setTimeout(r, 300));
        }
      }

      // --- 4. Update cursor ---
      if (!dryRun && latestUpdatedAt) {
        await updateSyncCursor(spaceSlug, latestUpdatedAt);
        logger.info(`[${spaceSlug}] Curseur mis à jour : ${latestUpdatedAt}`);
      }

      if (errors.length > 0) {
        allGroups.push({
          label: `Circle ${spaceSlug}`,
          inserted: totalUpserted,
          skipped: totalSkipped,
          errors: errors.map((msg) => ({
            type: "Circle Import",
            code: "ERROR",
            message: msg,
          })),
        });
      }

      spaceResults.push({
        space: { id: space.id, name: space.name, slug: space.slug },
        upserted: totalUpserted,
        skipped: totalSkipped,
        comments: totalCommentsFetched,
        errors: errors.length,
      });

      logger.info(
        `[${spaceSlug}] Terminé: ${totalUpserted} upserted, ${totalSkipped} skipped, ${totalCommentsFetched} comments, ${errors.length} errors`
      );
    }

    // --- 5. Error reporting ---
    if (allGroups.length > 0) {
      await sendErrorToScriptLogs("Import Circle Posts", allGroups);
    }

    const summary = {
      spaces: spaceResults,
      dryRun,
      fullSync,
      completedAt: new Date().toISOString(),
    };

    logger.info("Import terminé", summary);
    return summary;
  },
});
