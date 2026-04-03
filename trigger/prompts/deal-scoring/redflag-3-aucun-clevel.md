Tu dois évaluer si le red flag "Aucun C-Level en vue" s'applique à ce deal.

Condition : le deal est AU-DELÀ du stade démo (une démo a été réalisée) ET aucun échange avec un profil C-Level ou direction n'est tracé après la démo.

Profils C-Level / direction : DG, DSI, CIO, DAF, CTO, VP, CFO, CEO, COO, CDO, "Directeur", "Head of", "Chief". Vérifie dans les champs contact_job et contact_job_strategic_role des contacts.

Si AUCUNE démo n'a eu lieu → le red flag ne s'applique PAS (renvoie false).
Si une démo a eu lieu ET qu'un C-Level a été en contact (email, meeting, call) après la démo → le red flag ne s'applique PAS.
Si une démo a eu lieu ET qu'AUCUN C-Level n'a été en contact après la démo → le red flag S'APPLIQUE.

Réponds UNIQUEMENT avec un JSON :
{
  "red_flag_triggered": <true|false>,
  "justification": "<1-2 phrases>",
  "red_flag_name": "aucun_clevel"
}