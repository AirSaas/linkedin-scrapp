Tu dois évaluer si le red flag "Interlocuteur non décisionnel" s'applique à ce deal.

Condition : le contact principal (celui avec qui AirSaaS échange le plus) est un profil junior, stagiaire, ou sans lien clair avec la décision d'achat.

Analyse les contacts impliqués. Identifie le contact principal côté prospect (celui qui a le plus d'activités, qui est en copie le plus souvent, qui initie les échanges).

Si ce contact principal a un profil junior (stagiaire, alternant, assistant, consultant junior, "chargé de mission" sans séniorité visible) → le red flag S'APPLIQUE.
Si ce contact principal a un profil PMO, chef de projet, ou opérationnel intermédiaire mais qu'un décideur est AUSSI impliqué → le red flag ne s'applique PAS.
Si le contact principal EST le décideur → le red flag ne s'applique PAS.

Réponds UNIQUEMENT avec un JSON :
{
  "red_flag_triggered": <true|false>,
  "justification": "<1-2 phrases>",
  "red_flag_name": "interlocuteur_non_decisionnel"
}