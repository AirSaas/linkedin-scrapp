/**
 * Deal Scoring HubSpot — property provisioning, deal update, timeline note.
 *
 * Uses callHubSpot() from ./hubspot.ts for all API calls (retries, 429 handling).
 */

import { logger } from "@trigger.dev/sdk/v3";
import { callHubSpot } from "./hubspot.js";
import { sleep } from "./utils.js";
import type { SignalResult, RedFlagResult } from "./deal-scoring-prompts.js";

const HS = "https://api.hubapi.com";
const BETWEEN_CALLS = 150;

// ============================================
// TYPES
// ============================================

export interface ScoringResult {
  dealId: string;
  dealName: string;
  dealStage: string;
  dealOwnerName: string;
  signals: {
    signalName: string;
    hubspotProperty: string;
    score: number;
    justification: string;
    verbatims: string[];
  }[];
  redFlags: {
    flagName: string;
    triggered: boolean;
    malus: number;
    justification: string;
  }[];
  scoreRaw: number;
  totalMalus: number;
  scoreAdjusted: number;
  closingPct: number;
  zone: "ROUGE" | "ORANGE" | "VERT";
  scoredAt: string; // ISO
}

// ============================================
// PROPERTY DEFINITIONS
// ============================================

const PROPERTY_GROUP = {
  name: "ai_forecast_scoring",
  label: "AI Forecast Scoring",
  displayOrder: 1,
};

interface PropertyDef {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description: string;
  options?: { label: string; value: string; displayOrder: number }[];
}

const PROPERTIES: PropertyDef[] = [
  {
    name: "ai_decision_maker_access",
    label: "Decision Maker Access",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Decision maker identified and engaged",
  },
  {
    name: "ai_budget_validation",
    label: "Budget Validation",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Budget discussed and validated",
  },
  {
    name: "ai_urgency_timeline",
    label: "Urgency & Timeline",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Urgency and timeline established",
  },
  {
    name: "ai_champion_strength",
    label: "Champion Strength",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Champion influence and commitment",
  },
  {
    name: "ai_pain_fit",
    label: "Pain-Product Fit",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Pain aligned with AirSaaS value prop",
  },
  {
    name: "ai_demo_impact",
    label: "Demo Impact",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Demo engagement and wow effect",
  },
  {
    name: "ai_exec_relationship_depth",
    label: "Exec Relationship Depth",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Depth of relationship with decision maker",
  },
  {
    name: "ai_outreach_quality",
    label: "Outreach Quality",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Score 0-4: Outreach quality, responsiveness, multichannel",
  },
  {
    name: "ai_forecast_score_raw",
    label: "Forecast Score (Raw)",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Raw score 0-32 (sum of 8 signals)",
  },
  {
    name: "ai_forecast_score",
    label: "Forecast Score",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Adjusted score 0-32 (after red flag penalties)",
  },
  {
    name: "ai_forecast_closing_pct",
    label: "Forecast Closing %",
    type: "number",
    fieldType: "number",
    description: "AI Forecast — Closing probability 0-100%",
  },
  {
    name: "ai_forecast_zone",
    label: "Forecast Zone",
    type: "enumeration",
    fieldType: "select",
    description:
      "AI Forecast — Deal zone: ROUGE (at risk), ORANGE (building), VERT (engaged)",
    options: [
      { label: "ROUGE", value: "ROUGE", displayOrder: 1 },
      { label: "ORANGE", value: "ORANGE", displayOrder: 2 },
      { label: "VERT", value: "VERT", displayOrder: 3 },
    ],
  },
  {
    name: "ai_forecast_scored_at",
    label: "Forecast Last Scored",
    type: "datetime",
    fieldType: "date",
    description: "AI Forecast — Date of last AI scoring",
  },
];

// ============================================
// ENSURE HUBSPOT PROPERTIES (idempotent)
// ============================================

/**
 * Creates the property group + 13 properties if they don't exist.
 * Idempotent: 409 Conflict is silently caught.
 */
export async function ensureHubSpotProperties(): Promise<void> {
  // 1. Create property group
  try {
    await callHubSpot(
      `${HS}/crm/v3/properties/deals/groups`,
      "POST",
      PROPERTY_GROUP
    );
    logger.info("Created HubSpot property group: ai_forecast_scoring");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("409")) {
      logger.debug("Property group ai_forecast_scoring already exists");
    } else {
      throw err;
    }
  }
  await sleep(BETWEEN_CALLS);

  // 2. Create each property
  for (const prop of PROPERTIES) {
    const payload: Record<string, unknown> = {
      groupName: PROPERTY_GROUP.name,
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      description: prop.description,
    };
    if (prop.options) {
      payload.options = prop.options;
    }

    try {
      await callHubSpot(`${HS}/crm/v3/properties/deals`, "POST", payload);
      logger.info(`Created HubSpot property: ${prop.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409")) {
        logger.debug(`Property ${prop.name} already exists`);
      } else {
        throw err;
      }
    }
    await sleep(BETWEEN_CALLS);
  }
}

// ============================================
// UPDATE DEAL SCORING
// ============================================

/**
 * PATCH deal with the 13 ai_* properties.
 */
export async function updateDealScoring(
  dealId: string,
  scoring: ScoringResult
): Promise<void> {
  const properties: Record<string, string> = {
    ai_forecast_score_raw: String(scoring.scoreRaw),
    ai_forecast_score: String(scoring.scoreAdjusted),
    ai_forecast_closing_pct: String(scoring.closingPct),
    ai_forecast_zone: scoring.zone,
    ai_forecast_scored_at: String(new Date(scoring.scoredAt).getTime()),
  };

  for (const signal of scoring.signals) {
    properties[signal.hubspotProperty] = String(signal.score);
  }

  await callHubSpot(`${HS}/crm/v3/objects/deals/${dealId}`, "PATCH", {
    properties,
  });
  logger.info(
    `HubSpot deal ${dealId} updated: score=${scoring.scoreAdjusted}/32 zone=${scoring.zone}`
  );
  await sleep(BETWEEN_CALLS);
}

// ============================================
// CREATE SCORING NOTE
// ============================================

/**
 * Create a timeline note on the deal with the scoring summary.
 * Uses the format from the spec (section 9).
 */
export async function createScoringNote(
  dealId: string,
  scoring: ScoringResult
): Promise<string | null> {
  const noteBody = formatScoringNote(scoring);

  // Create the note with deal association inline
  const noteResponse = await callHubSpot(`${HS}/crm/v3/objects/notes`, "POST", {
    properties: {
      hs_timestamp: new Date(scoring.scoredAt).getTime().toString(),
      hs_note_body: noteBody,
    },
    associations: [
      {
        to: { id: dealId },
        types: [
          { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 },
        ],
      },
    ],
  });
  await sleep(BETWEEN_CALLS);

  const noteId = noteResponse.id as string | undefined;
  if (!noteId) {
    logger.warn(`Failed to create scoring note for deal ${dealId}`);
    return null;
  }

  logger.info(`Scoring note ${noteId} created and associated to deal ${dealId}`);
  return noteId;
}

// ============================================
// NOTE FORMATTING
// ============================================

function formatScoringNote(scoring: ScoringResult): string {
  const date = new Date(scoring.scoredAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const signalLabels: Record<string, string> = {
    decideur_identifie: "Décideur identifié",
    budget_valide: "Budget validé",
    urgence_planning: "Urgence/planning",
    champion_qualifie: "Champion qualifié",
    pain_aligne: "Pain aligné",
    effet_waouh_demo: "Effet waouh démo",
    relation_decideur: "Relation décideur",
    qualite_relances: "Qualité relances",
  };

  // Engagement signals (1-6)
  const engagementSignals = scoring.signals.slice(0, 6);
  const executionSignals = scoring.signals.slice(6, 8);

  let note = `🎯 SCORING FORECAST — ${scoring.dealName} — ${date}\n\n`;
  note += `Score : ${scoring.scoreAdjusted}/32 (${scoring.closingPct}%) — Zone ${scoring.zone}\n\n`;

  note += `📊 SIGNAUX D'ENGAGEMENT PROSPECT\n`;
  engagementSignals.forEach((s, i) => {
    const label = signalLabels[s.signalName] ?? s.signalName;
    note += `${i + 1}. ${label} : ${s.score}/4 — ${s.justification}\n`;
  });

  note += `\n🏋️ SIGNAUX D'EXÉCUTION COMMERCIALE\n`;
  executionSignals.forEach((s, i) => {
    const label = signalLabels[s.signalName] ?? s.signalName;
    note += `${i + 7}. ${label} : ${s.score}/4 — ${s.justification}\n`;
  });

  const triggeredFlags = scoring.redFlags.filter((rf) => rf.triggered);
  note += `\n🚩 RED FLAGS\n`;
  if (triggeredFlags.length === 0) {
    note += `Aucun red flag détecté\n`;
  } else {
    for (const rf of triggeredFlags) {
      note += `• ${rf.flagName} (-${rf.malus} pts) — ${rf.justification}\n`;
    }
  }

  note += `\nMalus total : -${scoring.totalMalus} pts`;

  return note;
}
