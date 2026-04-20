/**
 * Shared helpers for Circle article audits.
 *
 * Used by:
 *   - trigger/audit-circle-documentation.ts
 *   - trigger/audit-circle-vs-faq.ts
 */

import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Convert Circle HTML to markdown, replacing <img> with [IMAGE_N] placeholders.
 * Returns the markdown + a mapping of placeholder → original image URL.
 */
export function htmlToMarkdownWithImages(html: string): {
  markdown: string;
  imageMapping: Record<string, string>;
} {
  const imageMapping: Record<string, string> = {};
  let imageCounter = 0;

  let md = html.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, (_match, src) => {
    imageCounter++;
    const key = `[IMAGE_${imageCounter}]`;
    imageMapping[key] = src;
    return `\n\n${key}\n\n`;
  });

  md = md
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i>(.*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, "$1\n\n")
    .replace(/<\/?(ul|ol|div|span|section|article|figure|figcaption|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown: md, imageMapping };
}

/**
 * Flatten Circle comments (including nested replies) into a readable string.
 */
export function formatComments(comments: unknown[] | null): string {
  if (!comments || !Array.isArray(comments) || comments.length === 0) return "";

  const lines: string[] = [];

  for (const c of comments as Record<string, unknown>[]) {
    const user = c.user as Record<string, string> | undefined;
    const body = c.body as Record<string, string> | undefined;
    if (!user?.name || !body?.body) continue;

    const text = body.body
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (text) lines.push(`**${user.name}** : ${text}`);

    if (Array.isArray(c.replies)) {
      for (const r of c.replies as Record<string, unknown>[]) {
        const rUser = r.user as Record<string, string> | undefined;
        const rBody = r.body as Record<string, string> | undefined;
        if (!rUser?.name || !rBody?.body) continue;

        const rText = rBody.body
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\n{2,}/g, "\n")
          .trim();

        if (rText) lines.push(`  ↳ **${rUser.name}** : ${rText}`);
      }
    }
  }

  return lines.join("\n\n");
}

/**
 * Call Claude Opus with 1 retry after 5s. Returns null if both attempts fail.
 */
export async function callOpus(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature = 0.3
): Promise<string | null> {
  const callOnce = async () => {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    return textBlock.text.trim();
  };

  try {
    return await callOnce();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Opus call failed, retrying in 5s: ${msg}`);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await callOnce();
    } catch (retryErr) {
      logger.error(
        `Opus call failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`
      );
      return null;
    }
  }
}
