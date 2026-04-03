Tu dois évaluer si le red flag "Discount agressif sans contrepartie" s'applique à ce deal.

Condition : une remise significative est mentionnée dans les échanges mais SANS contrepartie du prospect (engagement pluriannuel, volume, accélération du closing, référence client).

Cherche dans les emails et notes des mentions de : remise, discount, geste commercial, réduction, prix réduit, "prix spécial", "offre", "promotion", "%", "gratuit", "offert".

Si AUCUNE remise n'est mentionnée → le red flag ne s'applique PAS.
Si une remise est mentionnée AVEC une contrepartie explicite (engagement 2-3 ans, volume de licences, paiement anticipé, accord de témoignage client) → le red flag ne s'applique PAS.
Si une remise est mentionnée SANS contrepartie visible → le red flag S'APPLIQUE.

Réponds UNIQUEMENT avec un JSON :
{
  "red_flag_triggered": <true|false>,
  "justification": "<1-2 phrases>",
  "red_flag_name": "discount_sans_contrepartie"
}