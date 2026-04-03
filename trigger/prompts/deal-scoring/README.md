# Modèle de Scoring Forecast AirSaaS

Pipeline AI d'évaluation de la probabilité de closing des deals HubSpot.

## Principe

Chaque deal est évalué sur **8 signaux clés** (0-4 points chacun, total /32), répartis en deux catégories :
- **6 signaux d'engagement prospect** — le prospect démontre des preuves concrètes
- **2 signaux d'exécution commerciale** — le commercial fait le job

Le score peut être dégradé par **6 red flags** (malus). Le résultat final est converti en % de probabilité de closing.

## Les 8 signaux

| # | Signal | Catégorie | Fichier |
|---|--------|-----------|---------|
| 1 | Décideur identifié et rencontré | Engagement | `signal-1-decideur-identifie.md` |
| 2 | Budget validé avec le décideur | Engagement | `signal-2-budget-valide.md` |
| 3 | Urgence et planning discutés | Engagement | `signal-3-urgence-planning.md` |
| 4 | Porteur de projet qualifié (Champion) | Engagement | `signal-4-champion-qualifie.md` |
| 5 | Pain aligné avec AirSaaS | Engagement | `signal-5-pain-aligne.md` |
| 6 | Effet waouh démo collecté | Engagement | `signal-6-effet-waouh-demo.md` |
| 7 | Qualité de la relation décideur | Exécution | `signal-7-relation-decideur.md` |
| 8 | Qualité des relances | Exécution | `signal-8-qualite-relances.md` |

## Les 6 red flags

| # | Red Flag | Type | Malus | Fichier |
|---|----------|------|-------|---------|
| 1 | Deal zombie (>45j même étape) | Déterministe | -3 pts | — (calculé depuis HubSpot) |
| 2 | Date repoussée ≥2 fois | Déterministe | -3 pts | — (calculé depuis HubSpot) |
| 3 | Aucun C-Level en vue post-démo | LLM | -2 pts | `redflag-3-aucun-clevel.md` |
| 4 | Interlocuteur non décisionnel | LLM | -3 pts | `redflag-4-interlocuteur-non-decisionnel.md` |
| 5 | Concurrent non traité | LLM | -1 pt | `redflag-5-concurrent-non-traite.md` |
| 6 | Discount sans contrepartie | LLM | -2 pts | `redflag-6-discount-sans-contrepartie.md` |

## Calcul du score

```
Score brut     = Σ (Signal 1..8)           → 0 à 32
Malus total    = Σ (Red flags déclenchés)  → 0 à 14
Score ajusté   = max(0, brut - malus)      → 0 à 32
% de closing   = (ajusté / 32) × 100
```

## Zones

| Zone | Score ajusté | % closing | Action |
|------|-------------|-----------|--------|
| ROUGE | 0 – 10 | 0% – 31% | Qualifier ou disqualifier rapidement |
| ORANGE | 11 – 21 | 32% – 65% | Identifier les signaux manquants |
| VERT | 22 – 32 | 66% – 100% | Accélérer le closing |

## Contexte AirSaaS

Le contexte métier injecté dans chaque prompt est dans `context-airsaas.md`.
