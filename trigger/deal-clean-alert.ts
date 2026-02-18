import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";

// ============================================
// CONFIGURATION
// ============================================
const SLACK_WEBHOOK_DEAL_CLEAN_ALERT =
  "https://hooks.zapier.com/hooks/catch/8419032/uw8ipql/";
const HUBSPOT_PORTAL_ID = "7979190";

// Pipelines
const PIPELINE_SQL = "3165468";
const PIPELINE_UPSELL = "3055879";

// Stages "RDV à planifier"
const STAGE_RDV_A_PLANIFIER_SQL = "3165469";
const STAGE_RDV_A_PLANIFIER_UPSELL = "10589794";

// Stage "GO !" (considered closed)
const STAGE_GO_SQL = "3165473";

// Stages "après Demo" - SQL
const STAGES_AFTER_DEMO_SQL = [
  "53408106", // No Show - retry
  "1014381320", // N-1 Champion paradigme in process
  "156812060", // Executive à attraper avec le champion
  "949675659", // Standby
  "190180115", // ABM pour attraper l'executive
  "3165470", // 1-1 Executive attrapé
  "140572552", // Go Meeting Pro2LT Avant vente
  "3165471", // Présentation Equipe planifié
  "3165472", // 1-1 Executive Debrief
  "19720555", // Go Meeting Pro2LT Vente
  "1014381321", // Présentation planning accompagnement
  "3165473", // GO !
];

// Stages "après Demo" - Upsell
const STAGES_AFTER_DEMO_UPSELL = [
  "10589795", // Waiting for Feedback
  "10589796", // Quote sent
];

// ============================================
// TYPES
// ============================================
interface Deal {
  DEAL_NAME: string | null;
  DEAL_AMOUNT: string | null;
  DEAL_CLOSED_DATE: string | null;
  IS_DEAL_CLOSED: boolean | string | null;
  DEAL_STAGE_ID: string | null;
  PIPELINE_ID: string | null;
  DEAL_HUBSPOT_ID: string | null;
  DEAL_OWNER_HUBSPOT_ID: string | null;
  DEAL_OWNER_FULL_NAME: string | null;
}

interface TeamMember {
  hubspot_id: string | null;
  slack_id: string | null;
  slack_username: string | null;
  firstname: string | null;
  lastname: string | null;
}

interface CleaningRule {
  id: string;
  name: string;
  emoji: string;
  filterFn: (deal: Deal) => boolean;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const dealCleanAlertTask = schedules.task({
  id: "deal-clean-alert",
  maxDuration: 120,
  run: async () => {
    logger.info("=== START deal-clean-alert ===");

    // 1. Fetch deals
    const allDeals = await fetchDeals();
    logger.info(`${allDeals.length} deals fetched`);

    // 2. Fetch team
    const team = await fetchTeam();
    logger.info(`${team.length} team members fetched`);

    // 3. Apply cleaning rules
    const rules = getCleaningRules();
    const dealsByRule: Record<string, Deal[]> = {};

    for (const rule of rules) {
      dealsByRule[rule.id] = allDeals.filter(rule.filterFn);
      logger.info(
        `${rule.emoji} ${rule.name}: ${dealsByRule[rule.id].length} deals`
      );
    }

    // 4. Group by owner and rule
    const groupedByOwnerAndRule = groupDealsByOwnerAndRule(dealsByRule);

    // 5. Build owner mapping
    const ownerMapping = buildOwnerMapping(team);

    // 6. Build and send message
    const message = buildSlackMessage(
      groupedByOwnerAndRule,
      ownerMapping,
      rules
    );
    await sendToSlack(message);

    const totalFlagged = Object.values(dealsByRule).reduce(
      (sum, deals) => sum + deals.length,
      0
    );

    const summary = {
      success: true,
      dealsScanned: allDeals.length,
      dealsFlagged: totalFlagged,
      owners: Object.keys(groupedByOwnerAndRule).length,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// CLEANING RULES
// ============================================
function isDealClosed(deal: Deal): boolean {
  const isClosedFlag =
    deal.IS_DEAL_CLOSED === true || deal.IS_DEAL_CLOSED === "true";
  const isStageGo =
    deal.PIPELINE_ID === PIPELINE_SQL && deal.DEAL_STAGE_ID === STAGE_GO_SQL;
  return isClosedFlag || isStageGo;
}

function getCleaningRules(): CleaningRule[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [
    {
      id: "date_depassee",
      name: "Date dépassée",
      emoji: "📅",
      filterFn: (deal) => {
        if (!deal.DEAL_CLOSED_DATE) return false;
        const closedDate = new Date(deal.DEAL_CLOSED_DATE);
        return closedDate < today && !isDealClosed(deal);
      },
    },
    {
      id: "sans_date_rdv_planifier",
      name: 'Sans date en "RDV à planifier"',
      emoji: "⚠️",
      filterFn: (deal) => {
        if (isDealClosed(deal)) return false;
        if (deal.DEAL_CLOSED_DATE) return false;

        const isSQL =
          deal.PIPELINE_ID === PIPELINE_SQL &&
          deal.DEAL_STAGE_ID === STAGE_RDV_A_PLANIFIER_SQL;
        const isUpsell =
          deal.PIPELINE_ID === PIPELINE_UPSELL &&
          deal.DEAL_STAGE_ID === STAGE_RDV_A_PLANIFIER_UPSELL;

        return isSQL || isUpsell;
      },
    },
    {
      id: "sans_montant_apres_demo",
      name: "Sans montant après Demo",
      emoji: "💰",
      filterFn: (deal) => {
        if (isDealClosed(deal)) return false;
        if (deal.DEAL_AMOUNT && parseFloat(deal.DEAL_AMOUNT) > 0) return false;

        const isSQL =
          deal.PIPELINE_ID === PIPELINE_SQL &&
          STAGES_AFTER_DEMO_SQL.includes(deal.DEAL_STAGE_ID ?? "");
        const isUpsell =
          deal.PIPELINE_ID === PIPELINE_UPSELL &&
          STAGES_AFTER_DEMO_UPSELL.includes(deal.DEAL_STAGE_ID ?? "");

        return isSQL || isUpsell;
      },
    },
  ];
}

// ============================================
// SUPABASE HELPERS
// ============================================
async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await getSupabase()
    .from("PRC_DEAL_UPSELL_AND_SQL")
    .select(
      "DEAL_NAME, DEAL_AMOUNT, DEAL_CLOSED_DATE, IS_DEAL_CLOSED, DEAL_STAGE_ID, PIPELINE_ID, DEAL_HUBSPOT_ID, DEAL_OWNER_HUBSPOT_ID, DEAL_OWNER_FULL_NAME"
    );

  if (error) throw new Error(`Failed to fetch deals: ${error.message}`);
  return (data ?? []) as Deal[];
}

async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("hubspot_id, slack_id, slack_username, firstname, lastname");

  if (error) throw new Error(`Failed to fetch team: ${error.message}`);
  return (data ?? []) as TeamMember[];
}

// ============================================
// GROUPING & MAPPING
// ============================================
function buildOwnerMapping(
  team: TeamMember[]
): Record<
  string,
  { slack_id: string | null; slack_username: string | null; firstname: string | null; lastname: string | null }
> {
  const mapping: Record<string, { slack_id: string | null; slack_username: string | null; firstname: string | null; lastname: string | null }> = {};

  for (const member of team) {
    if (member.hubspot_id) {
      mapping[member.hubspot_id] = {
        slack_id: member.slack_id,
        slack_username: member.slack_username,
        firstname: member.firstname,
        lastname: member.lastname,
      };
    }
  }

  return mapping;
}

function groupDealsByOwnerAndRule(
  dealsByRule: Record<string, Deal[]>
): Record<string, Record<string, Deal[]>> {
  const grouped: Record<string, Record<string, Deal[]>> = {};

  for (const ruleId of Object.keys(dealsByRule)) {
    for (const deal of dealsByRule[ruleId]) {
      const ownerId = deal.DEAL_OWNER_HUBSPOT_ID ?? "unknown";

      if (!grouped[ownerId]) grouped[ownerId] = {};
      if (!grouped[ownerId][ruleId]) grouped[ownerId][ruleId] = [];
      grouped[ownerId][ruleId].push(deal);
    }
  }

  return grouped;
}

// ============================================
// SLACK MESSAGE
// ============================================
function formatAmount(amount: string | null): string {
  if (!amount) return "N/A";
  const num = parseFloat(amount);
  if (isNaN(num)) return "N/A";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

function buildHubSpotLink(dealId: string): string {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${dealId}`;
}

function buildSlackMessage(
  groupedByOwnerAndRule: Record<string, Record<string, Deal[]>>,
  ownerMapping: Record<string, { slack_id: string | null; slack_username: string | null; firstname: string | null; lastname: string | null }>,
  rules: CleaningRule[]
): string {
  const ownerIds = Object.keys(groupedByOwnerAndRule);

  if (ownerIds.length === 0) {
    return "🎉 *Félicitations à tous !* Pas de deal à nettoyer 🙂\n\nTous les deals sont en ordre. Bravo pour la rigueur ! 💪";
  }

  let message = "🚨 *Deals à nettoyer*\n\n";

  for (const ownerId of ownerIds) {
    const ruleDeals = groupedByOwnerAndRule[ownerId];
    const owner = ownerMapping[ownerId];

    let totalDeals = 0;
    for (const deals of Object.values(ruleDeals)) {
      totalDeals += deals.length;
    }

    let ownerMention: string;
    if (owner?.slack_username) {
      ownerMention = `@${owner.slack_username}`;
    } else if (owner) {
      ownerMention = `${owner.firstname} ${owner.lastname}`;
    } else {
      ownerMention = `Owner inconnu (ID: ${ownerId})`;
    }

    message += `${ownerMention} tu as *${totalDeals} deal(s)* à vérifier :\n\n`;

    for (const rule of rules) {
      const deals = ruleDeals[rule.id];
      if (!deals || deals.length === 0) continue;

      message += `${rule.emoji} *${rule.name}* (${deals.length}) :\n`;

      for (const deal of deals) {
        const name = deal.DEAL_NAME ?? "Sans nom";
        const amount = formatAmount(deal.DEAL_AMOUNT);
        const link = buildHubSpotLink(deal.DEAL_HUBSPOT_ID ?? "");

        if (rule.id === "date_depassee") {
          message += `• ${name} - ${amount} - Date: ${deal.DEAL_CLOSED_DATE} - <${link}|Voir>\n`;
        } else if (rule.id === "sans_montant_apres_demo") {
          message += `• ${name} - <${link}|Voir>\n`;
        } else {
          message += `• ${name} - ${amount} - <${link}|Voir>\n`;
        }
      }

      message += "\n";
    }

    message += "---\n\n";
  }

  message += "_Merci de mettre à jour ces deals 🙏_";

  return message;
}

// ============================================
// SLACK WEBHOOK
// ============================================
async function sendToSlack(message: string): Promise<void> {
  try {
    const res = await fetch(SLACK_WEBHOOK_DEAL_CLEAN_ALERT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (res.ok) {
      logger.info("Slack alert sent successfully");
    } else {
      const body = await res.text();
      logger.error(`Slack webhook failed: ${res.status} — ${body}`);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.error(`Slack webhook error: ${m}`);
  }
}
