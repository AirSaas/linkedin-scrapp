# FAQ Produit AirSaas / PRC

> Document généré automatiquement le 2026-03-17 à partir de 502 entrées FAQ extraites de conversations support Crisp.
> 330 questions uniques identifiées, regroupées en 35 thèmes.

## Table des matières

1. [Vues et filtres](#vues-et-filtres) (22)
2. [Gestion des utilisateurs](#gestion-des-utilisateurs) (21)
3. [Quarter Plan et capacité](#quarter-plan-et-capacite) (24)
4. [Droits et permissions](#droits-et-permissions) (21)
5. [Jalons et dépendances](#jalons-et-dependances) (19)
6. [Intégrations et API](#integrations-et-api) (17)
7. [Navigation et interface](#navigation-et-interface) (22)
8. [Modules et fonctionnalités](#modules-et-fonctionnalites) (8)
9. [Configuration et personnalisation](#configuration-et-personnalisation) (20)
10. [Budget et finances](#budget-et-finances) (13)
11. [Gestion des équipes](#gestion-des-equipes) (13)
12. [Export et import](#export-et-import) (14)
13. [Intelligence Artificielle](#intelligence-artificielle) (4)
14. [Authentification et sécurité](#authentification-et-securite) (12)
15. [Gestion des projets](#gestion-des-projets) (12)
16. [Notifications](#notifications) (9)
17. [Comptes rendus et reporting](#comptes-rendus-et-reporting) (9)
18. [Météo et statuts projet](#meteo-et-statuts-projet) (8)
19. [Présentations](#presentations) (7)
20. [Gestion documentaire](#gestion-documentaire) (5)
21. [Attributs personnalisés](#attributs-personnalises) (5)
22. [Partage et collaboration](#partage-et-collaboration) (3)
23. [Programmes et projets](#programmes-et-projets) (5)
24. [Priorisation et demandes](#priorisation-et-demandes) (5)
25. [Historique et suivi](#historique-et-suivi) (5)
26. [Formation et support](#formation-et-support) (5)
27. [Automatisations](#automatisations) (4)
28. [Structure et organisation](#structure-et-organisation) (4)
29. [Multilinguisme](#multilinguisme) (3)
30. [Communication projet](#communication-projet) (3)
31. [Risques et points d'attention](#risques-et-points-d-attention) (2)
32. [Dates et calendrier](#dates-et-calendrier) (2)
33. [Performance et stabilité](#performance-et-stabilite) (2)
34. [Templates et modèles](#templates-et-modeles) (1)
35. [Roadmap produit](#roadmap-produit) (1)

---

## Vues et filtres

### Comment filtrer les projets par rôles personnalisés dans les vues ?

**Oui, vous pouvez filtrer les projets par rôles personnalisés !**

Dans vos vues, vous pouvez filtrer par :
- **Responsable** : projets dont une personne est responsable
- **Personne impliquée** : projets où une personne est impliquée
- **Rôle spécifique** : projets où une personne occupe un rôle particulier (ex: "Responsable de lot SI")

**Limitation actuelle :**
Il n'est pas possible de combiner rôle + équipe (ex: "tous les projets où le Responsable de lot SI appartient à l'équipe X") car il n'existe pas de notion d'appartenance entre un rôle et une équipe.

**Ressources utiles :**
- [Filtrer les projets par le rôle des personnes impliquées](https://club.airsaas.io/c/ca-vient-de-sortir/filtrer-les-projets-par-le-role-des-personnes-impliquees)


### Comment afficher les valeurs approximatives (> X mois, > X k€) dans les vues ?

**Pour les durées :**
- Utilisez les attributs **"Date"** et **"Durée"** (et non "Date de début" / "Date de fin")
- Les valeurs approximatives (ex: "> 6 mois") s'afficheront correctement

**Pour les budgets (Capex/Opex) :**
- **Projet sur une seule année fiscale** : les valeurs approximatives s'affichent normalement
- **Projet sur plusieurs années fiscales** : 
  - Les valeurs approximatives ne peuvent pas être additionnées
  - Elles sont visibles dans le **tooltip au survol de la cellule**
  - Utilisez "Capex budget initial total" pour voir le total

**Astuce** : Si vous ne voyez pas les bonnes valeurs, vérifiez que vous utilisez les bons champs dans votre vue.


### Comment afficher le nom du projet dans une vue jalons ?

Pour voir à quel projet appartient chaque jalon dans votre vue :

1. Ouvrez votre vue jalons
2. Cliquez sur **Paramètres** de la vue (icône engrenage)
3. Dans la section des attributs à afficher, cochez **"Parent"**
4. Sauvegardez vos paramètres

Le nom du projet parent s'affichera maintenant pour chaque jalon dans votre vue.

**Astuce** : Cette configuration est particulièrement utile quand vous gérez un portefeuille de 20+ projets.

**Ressources utiles :**
- [Comment créer une vue du portfolio projets ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-creer-une-vue-du-portfolio-projets)


### Comment modifier des jalons sans quitter ma vue reporting ?

Pour modifier vos jalons sans perdre votre position dans le reporting :

**Solution recommandée** : Utilisez une vue de type **"Tableau"**
- Les jalons peuvent être modifiés directement dans le tableau
- Pas besoin d'ouvrir chaque jalon individuellement
- Vous gardez votre vue d'ensemble

**Alternative** : Dans les autres types de vues
- Utilisez la flèche retour de votre navigateur après modification
- Ouvrez le jalon dans un nouvel onglet (clic droit > ouvrir dans un nouvel onglet)

Cette fonctionnalité est particulièrement pratique pour les revues de portefeuille avec de nombreux jalons à mettre à jour.


### Pourquoi mon projet n'apparaît pas dans la vue timeline de mon programme ?

Si un projet configuré dans un programme n'apparaît pas dans votre vue timeline, vérifiez ces points :

**1. Le projet a-t-il des dates ?**
- Les vues timeline excluent par défaut les projets sans dates
- Vérifiez que les dates de début et fin sont renseignées sur le projet

**2. Vérifiez les réglages de votre vue :**
- Ouvrez les paramètres de la vue (icône engrenage)
- Dans la section "Filtres", vérifiez si "Exclure les projets sans dates" est coché
- Décochez cette option si vous voulez voir tous les projets, même sans dates

**3. Autres filtres à vérifier :**
- Statut du projet (la vue filtre-t-elle certains statuts ?)
- Équipes (la vue est-elle limitée à certaines équipes ?)
- Période affichée (le projet est-il dans la plage de dates visible ?)

**Solution rapide :** Ajoutez des dates au projet ou modifiez le filtre de la vue pour inclure les projets sans dates.


### Comment filtrer les jalons par sponsor dans le Quarter plan ?

Le champ "sponsor" n'est pas directement disponible comme critère de filtre dans les vues Quarter ou Jalon. Voici les alternatives :

**Solution recommandée : Filtrer par équipe en demande**
- Utilisez le filtre "équipe en demande"
- Dans la plupart des cas, les sponsors sont les responsables des équipes en demande
- Cela vous permettra d'obtenir une vue des jalons par sponsor indirect

**Autres options :**
- Créer une vue portfolio projet filtrée par sponsor, puis naviguer vers les jalons
- Utiliser les vues partagées pour transmettre l'information aux sponsors

**Ressources utiles :**
- [Partagez vos vues privées du portfolio](https://club.airsaas.io/c/ca-vient-de-sortir/partagez-vos-vues-privees-du-portfolio)


### Quelle est la différence entre la vue 'Mes jalons en retard' (portfolio projets) et 'Jalons en retard' (portfolio jalons) ?

Ces deux vues affichent des informations différentes :

**Vue 'Mes jalons en retard' (Portfolio Projets)** :
- Affiche la liste des **projets** qui ont au moins un jalon en retard
- Un projet n'apparaît qu'une seule fois, même s'il a plusieurs jalons en retard
- Permet de voir rapidement quels projets sont impactés

**Vue 'Jalons en retard' (Portfolio Jalons)** :
- Affiche la liste de **tous les jalons** en retard individuellement
- Si un projet a 3 jalons en retard, vous verrez 3 lignes
- Permet de voir le détail de chaque jalon en retard

**Exemple** : Si le projet 'Refonte CRM' a 2 jalons en retard :
- Dans 'Mes jalons en retard' : 1 ligne (le projet)
- Dans 'Jalons en retard' : 2 lignes (les 2 jalons)


### Comment créer une vue qui affiche uniquement les jalons où je suis assigné(e) ?

Pour voir uniquement vos jalons assignés :

1. Allez dans le **portefeuille de jalons** (pas le portefeuille de projets)
2. Créez une nouvelle vue
3. Ajoutez un filtre sur "Responsable" = vous-même

**Important** : Les filtres créés depuis le portefeuille de projets s'appliquent aux projets entiers. Quand vous ouvrez un projet depuis cette vue, tous ses jalons seront visibles. Pour filtrer les jalons eux-mêmes, vous devez créer la vue depuis le portefeuille de jalons.

**Ressources utiles :**
- [Montrez les différentes réalités de votre portfolio grâces aux vues](https://club.airsaas.io/c/debuter-sur-airsaas/montrez-les-differentes-realites-de-votre-portfolio-graces-aux-vues)


### Comment filtrer les jalons selon les critères de leurs projets ?

Pour filtrer des jalons selon des critères de leurs projets (statut, équipe, etc.) :

1. **Créez d'abord une vue projet** avec vos critères
   - Exemple : projets dont le statut n'est pas "en pause"
2. **Dans votre vue jalons**, ajoutez une condition supplémentaire :
   - "Vue projet" = [sélectionnez la vue créée à l'étape 1]

Cette technique permet de combiner des filtres sur les jalons ET sur leurs projets parents. Très utile pour exclure les jalons de projets en pause, ou ne voir que les jalons de projets d'une équipe spécifique.

**Ressources utiles :**
- [Vue Projets / Jalons](https://club.airsaas.io/c/utilisateurs-d-airsaas/vue-projets-jalons)


### Comment exclure les jalons des projets abandonnés d'une vue ?

Par défaut, les vues jalons incluent tous les jalons, même ceux des projets abandonnés. Pour les masquer :

1. **Créez une vue de référence dans le portfolio Projet**
   - Allez dans le portfolio **Projet**
   - Créez une vue "Projets actifs" (ou "Projets pas abandonnés")
   - Ajoutez le filtre : Statut n'est pas "Abandonné"

2. **Utilisez cette vue comme filtre dans votre vue Jalon**
   - Dans votre vue du portfolio **Jalon**
   - Ajoutez une nouvelle condition : "Vue portfolio projet" est "Projets actifs"
   - Cela n'inclura que les jalons dont le projet parent est dans la vue de référence

Cette méthode fonctionne pour tout type d'exclusion basée sur les attributs du projet parent.

**Ressources utiles :**
- [Utiliser les vues projets pour filtrer vos décisions, points d'attention, jalons](https://club.airsaas.io/c/ca-vient-de-sortir/utiliser-les-vues-projets-pour-filtrer-vos-decisions-points-d-attention-jalons)


### Comment afficher uniquement les jalons filtrés dans une vue ?

Lorsque vous créez une vue depuis le portfolio **Projet** avec un filtre sur les jalons, vous obtenez tous les projets qui ont au moins un jalon correspondant au critère, avec TOUS leurs jalons affichés.

Pour n'afficher que les jalons filtrés :
1. Allez dans le portfolio **Jalon** (et non Projet)
2. Créez une vue avec vos critères de filtrage sur les jalons
3. Groupez par projet pour conserver une organisation claire

Cette approche vous montrera uniquement les jalons qui correspondent à vos critères, regroupés par projet.


### Comment créer une vue timeline de mes jalons en tant que chef de projet ?

Pour créer une vue privée de vos jalons en tant que chef de projet :

1. Allez dans le portfolio **Jalon**
2. Créez une nouvelle vue privée
3. Configurez les filtres :
   - "Projet > Chef de projet" est "Moi"
4. Dans les options d'affichage :
   - Grouper par : **Projet**
   - Type de vue : **Timeline**

Cette vue vous montrera tous les jalons des projets dont vous êtes chef de projet, organisés par projet sur une timeline.

**Ressources utiles :**
- [Le portfolio de jalons 🥳](https://club.airsaas.io/c/ca-vient-de-sortir/le-portfolio-de-jalons)


### Comment créer une vue des jalons/livrables des 4 prochaines semaines ?

**Pour créer une vue des prochains jalons à traiter :**

1. Allez dans le portfolio Jalons
2. Créez une nouvelle vue ou modifiez une vue existante
3. Ajoutez les filtres suivants :
   - Type : "Jalon" ou "Livrable" selon votre usage
   - Statut : "Est à faire"
   - Date d'échéance : "Entre" [date début] et [date fin]
   - Équipe (optionnel) : filtrez par équipe DSI si nécessaire

**Limitation actuelle :**
- Les dates ne sont pas "glissantes" - vous devrez ajuster manuellement les dates du filtre avant chaque réunion
- Exemple : pour voir les 4 prochaines semaines au 27/11, filtrez du 27/11 au 25/12

**Alternative recommandée :**
- Utilisez la vue "Jalons qui arrivent" existante
- Triez par date d'échéance
- Groupez par équipe ou par semaine

**Amélioration à venir :**
L'option de semaines glissantes est prévue dans la roadmap produit pour automatiser ce type de vue.


### Comment créer une vue Gestion de la demande avec filtres sur statuts ET jalons ?

**Pour créer une vue combinant statuts projet et période des jalons :**

1. **Créez ou modifiez une vue dans le portfolio Projets**
2. **Ajoutez les filtres sur les projets :**
   - Statut : "En demande" OU "Échange sur le besoin"
   - Utilisez l'opérateur OU entre les statuts

3. **Ajoutez un filtre sur les jalons associés :**
   - Cliquez sur "+ Ajouter un filtre"
   - Choisissez "Jalons" > "Date d'échéance"
   - Sélectionnez la période Q4 souhaitée
   - Ou utilisez "Quarter" = "Q4 2025"

4. **Configuration recommandée :**
   - Vue : Kanban groupé par statut
   - Affichage : Inclure les jalons à venir
   - Tri : Par date du prochain jalon

**Astuce :** Cette vue combinée permet de voir uniquement les projets en phase amont qui ont des actions prévues sur Q4, parfait pour les revues de gestion de la demande.

**Sauvegardez** la vue pour la réutiliser à chaque revue.

**Ressources utiles :**
- [Améliorer le process de gestion de la demande](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande)


### Comment créer une vue pour voir uniquement les projets de mon équipe ?

Pour voir uniquement les projets de votre équipe :

1. Depuis la page **Tous les projets**, cliquez sur le bouton **colonnes/filtres** en haut à droite
2. Ajoutez le filtre **"Équipe"** et sélectionnez votre équipe
3. **Important** : Pour ne pas modifier la vue de tous les utilisateurs :
   - Créez une **nouvelle vue** en cliquant sur "Créer une vue"
   - Nommez-la (ex: "Projets de mon équipe SEC")
   - Laissez le bouton **"Public"** désactivé pour que la vue reste privée

**Différence entre vue privée et publique** :
- **Vue privée** : visible uniquement par vous
- **Vue publique** : visible par tous les membres de l'organisation

Les modifications sur une vue publique impactent tous les utilisateurs qui l'utilisent.

**Ressources utiles :**
- [Comment créer une vue du portfolio projets ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-creer-une-vue-du-portfolio-projets)


### Comment filtrer pour afficher plusieurs projets spécifiques dans une vue ?

Pour afficher plusieurs projets spécifiques dans une vue, utilisez la condition **"est parmi"** plutôt que plusieurs conditions **"est"**.

**Pourquoi votre filtre ne fonctionne pas :**
Quand vous ajoutez plusieurs conditions "Projet est X" ET "Projet est Y", vous demandez à AirSaas de trouver un projet qui est À LA FOIS le projet X et le projet Y, ce qui est impossible.

**Solution correcte :**
1. Créez votre vue
2. Dans les filtres, ajoutez : **Projet → est parmi**
3. Sélectionnez tous les projets souhaités dans la liste
4. Validez

**Exemple :**
- ❌ Incorrect : Projet est "Projet A" ET Projet est "Projet B"
- ✅ Correct : Projet est parmi ["Projet A", "Projet B", "Projet C"]

**Note :** Si vous voulez aussi filtrer par programme, vous pouvez combiner :
- Programme est "Windows FR"
- ET Projet est parmi [liste de vos projets]


### Peut-on combiner des conditions ET/OU dans les filtres des vues ?

Il n'est pas possible de mixer les opérateurs ET et OU dans un même groupe de filtres. Cette limitation existe pour éviter l'ambiguïté d'interprétation (exemple : (A ET B) OU C versus A ET (B OU C)).

**Solutions de contournement :**

1. **Utilisez des attributs différents** pour vos critères :
   - Au lieu de : Statut = Terminé OU Statut = Abandonné ET Chef de projet = X
   - Faites : Statut n'est pas parmi (Terminé, Abandonné) ET Au moins une personne impliquée est parmi (X, Y)

2. **Créez plusieurs vues** :
   - Une vue pour chaque combinaison de critères
   - Utilisez les vues favorites pour y accéder rapidement

3. **Exploitez les attributs personnalisés** :
   - Créez un attribut qui regroupe vos critères complexes
   - Exemple : un attribut "Projets prioritaires" que vous mettez à jour manuellement


### Comment créer un diagramme de Gantt dans AirSaas ?

AirSaas propose des **vues timeline** qui fonctionnent comme des diagrammes de Gantt :

**Pour accéder à la vue Gantt :**
1. Allez dans votre portfolio projets ou jalons
2. Cliquez sur le sélecteur de vue et choisissez "Timeline"
3. Vous obtenez alors une vue type Gantt de vos éléments

**Options d'affichage disponibles :**
- Afficher/masquer les dépendances entre jalons
- Ajuster l'échelle temporelle (jours, semaines, mois)
- Personnaliser les éléments affichés

Cette vue permet de visualiser la répartition temporelle de vos projets et jalons, exactement comme un diagramme de Gantt traditionnel.


### Comment créer des filtres complexes dans les Smart Views ?

Les Smart Views permettent de filtrer vos projets, mais avec certaines limitations :

**Limitation principale : Pas de mixage ET/OU**
- Vous ne pouvez pas combiner des opérateurs ET et OU dans le même filtre
- Solution : Utilisez l'opérateur "est parmi"

**Exemple concret :**
Pour afficher 3 programmes spécifiques ET uniquement les projets en cours :
1. Créez un filtre : `Programme est parmi [Programme 1, Programme 2, Programme 3]`
2. Ajoutez un ET : `Statut est "En cours"`

**Masquer les groupes vides :**
- En vue Kanban : cochez "Masquer les groupes vides" dans le menu de groupage
- Cette option n'est disponible qu'en vue Kanban (pas en vue tableau ou liste)

**Astuce** : Si vous groupez par un attribut, tous les groupes s'affichent par défaut, même vides. L'option "Masquer les groupes vides" résout ce problème.

**Ressources utiles :**
- [Comment utiliser les vues intelligentes ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-utiliser-les-vues-intelligentes)
- [Masquer les groupes vides 🎭](https://club.airsaas.io/c/ca-vient-de-sortir/masquer-les-groupes-vides)


### Comment créer et organiser mes propres vues ?

Vous pouvez créer vos propres vues personnalisées dans AirSaas :

**Pour créer une nouvelle vue :**
1. Cliquez sur le bouton **"Créer une vue"** en haut à gauche
2. Définissez vos critères :
   - Groupement (par statut, équipe, programme...)
   - Filtrage (projets actifs, météo dégradée...)
   - Tri (par date, priorité...)
   - Colonnes à afficher

**Bonnes pratiques :**
- Créez une vue par contexte d'usage (revue hebdo, CODIR, suivi équipe...)
- Épinglez vos vues favorites avec l'étoile ⭐
- Partagez vos vues privées avec d'autres utilisateurs

**Ressources utiles :**
- [Des vues pour montrer les différentes facettes votre portfolio](https://club.airsaas.io/c/debuter-sur-airsaas/des-vues-pour-montrer-les-differentes-facettes-votre-portfolio)


### Pourquoi mes vues publiques disparaissent-elles régulièrement ?

Si vos vues publiques disparaissent, voici les causes possibles et solutions :

**Causes fréquentes :**
- Un administrateur a modifié les permissions de la vue (publique → privée)
- Le créateur de la vue a été désactivé ou a perdu ses droits admin
- Un changement temporaire de licence/droits du créateur affecte la visibilité de ses vues

**Solutions immédiates :**
1. Vérifiez dans vos vues privées si elles s'y trouvent
2. Demandez aux autres administrateurs s'ils ont modifié les permissions
3. Vérifiez que le créateur original a toujours des droits actifs

**Pour éviter le problème :**
- Documentez qui crée et maintient les vues critiques
- Assurez-vous que plusieurs admins ont accès aux vues importantes
- Évitez les changements fréquents de droits/licences des créateurs de vues

**Note :** Si le problème persiste malgré ces vérifications, contactez le support car il peut s'agir d'un comportement non souhaité du système.

**Ressources utiles :**
- [Partagez vos vues privées du portfolio](https://club.airsaas.io/c/ca-vient-de-sortir/partagez-vues-privees-du-portfolio)


### Comment rechercher efficacement mes projets ?

**Limitation actuelle**
La barre de recherche globale ne permet de chercher que par nom de projet.

**Solutions de contournement**

**1. Créez des vues filtrées**
- Créez une vue par critère de recherche fréquent (équipe, statut, année, attribut personnalisé...)
- Nommez-les clairement : "[Recherche] Projets Équipe Marketing", "[Recherche] Projets 2024"
- Épinglez vos vues de recherche favorites avec l'étoile

**2. Utilisez les filtres avancés dans les vues**
- Combinez plusieurs critères de filtrage
- Sauvegardez ces combinaisons comme des vues réutilisables

**3. Organisez vos projets**
- Utilisez des conventions de nommage incluant des codes (ex: "2024-MKT-Projet X")
- Renseignez systématiquement les attributs clés (équipe en demande, programme, etc.)

**4. Distinguez projets actifs et archivés**
- La fonction d'archivage permet de réduire le nombre de projets visibles dans les recherches
- Créez des vues séparées pour les projets en cours vs terminés/archivés

**Ressources utiles :**
- [Archiver les vieux trucs pour y voir plus clair 🥸](https://club.airsaas.io/c/ca-vient-de-sortir/archiver-les-vieux-trucs-pour-y-voir-plus-clair)


### Comment fusionner un utilisateur fantôme avec un compte existant ?

Si vous avez un utilisateur en double (fantôme et actif), voici comment les fusionner :

1. Allez dans **Paramètres** > **Onglet Fantômes**
2. Trouvez l'utilisateur fantôme concerné
3. Cliquez sur **Fusionner** et sélectionnez le compte actif correspondant
4. Confirmez la fusion

**Résultat** : Toutes les références au fantôme seront automatiquement remplacées par l'utilisateur actif dans tout le système.

**Note** : Après la fusion, vous pouvez ajuster le rôle de l'utilisateur (viewer, contributeur, créateur, etc.) selon vos besoins.

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)


### Comment réactiver un utilisateur inactif ?

**Bonne nouvelle !** Vous pouvez maintenant réactiver les utilisateurs inactifs vous-même.

**Pour réactiver un utilisateur inactif :**
1. Allez dans **Paramètres** > **Utilisateurs**
2. Affichez les utilisateurs **Inactifs**
3. Trouvez l'utilisateur concerné
4. Cliquez sur **Réactiver**
5. Ajustez son rôle si nécessaire (Créateur, Contributeur, etc.)

**Après réactivation :**
- L'utilisateur peut se connecter avec son email
- S'il a oublié son mot de passe, il peut le réinitialiser sur la page de connexion
- Tous ses accès et données précédentes sont restaurés

**Note** : Cette fonctionnalité est particulièrement utile pour gérer les consultants externes ou les retours de congés.

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### Pourquoi un utilisateur externe ne voit aucun projet ?

**Les utilisateurs externes ont des accès limités par défaut.**

Un utilisateur externe :
- Ne voit **QUE** les projets où il a été explicitement ajouté comme membre
- N'a pas accès aux projets publics de l'organisation
- Ne voit que certains attributs des projets (limités)

**Pour donner accès à un externe :**
1. Ouvrez le projet concerné
2. Ajoutez l'externe comme membre du projet
3. Il verra alors ce projet dans son interface

**Important :** Il faut ajouter l'externe à AU MOINS un projet, sinon il ne verra rien à la connexion.

**Ressources utiles :**
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)
- [Inviter des externes sur vos projets](https://club.airsaas.io/c/ca-vient-de-sortir/inviter-des-externes-sur-vos-projets)


### Comment convertir un utilisateur externe en interne ?

**Vous pouvez le faire vous-même !**

1. Allez dans **Settings > Utilisateurs**
2. Trouvez l'utilisateur externe concerné
3. Cliquez sur l'option de modification
4. Changez le statut de "Externe" à "Interne"

**Points importants :**
- **Externe → Interne** : possible par tout administrateur
- **Interne → Externe** : nécessite l'intervention du support AirSaas

**Cas d'usage typique** : Lorsqu'un consultant ou freelance est embauché en interne et doit accéder à l'ensemble du portfolio sans restriction.

**Ressources utiles :**
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)


### Où consulter les droits et permissions de chaque rôle utilisateur ?

Pour consulter les droits associés à chaque rôle utilisateur dans AirSaas :

**Option 1 : Au moment de l'invitation**
- Allez dans la section d'invitation d'utilisateurs
- Un lien explicatif apparaît pour détailler les permissions de chaque rôle

**Option 2 : Documentation complète**
- Consultez l'article détaillé : https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles

**Les 5 rôles disponibles :**
- **Administrateur** : tous les droits
- **Ambassadeur** : peut inviter et gérer des utilisateurs
- **Créateur** : peut créer et gérer des projets
- **Contributeur** : peut participer aux projets
- **Observateur** : accès en lecture seule

**Note :** Dans la vue des utilisateurs actifs, les rôles sont affichés mais sans le détail des permissions.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Que faire quand j'ai atteint la limite d'utilisateurs de ma licence ?

Si vous recevez un message indiquant que tous les postes sont utilisés, cela signifie que vous avez atteint la limite d'utilisateurs de votre licence AirSaas.

**Pour vérifier votre situation :**
- Allez dans les paramètres de votre espace
- Consultez le nombre d'utilisateurs actifs vs votre limite de licence
- Dans l'exemple : "26/22" signifie 26 utilisateurs actifs pour 22 licences

**Solutions possibles :**
- **Désactiver des utilisateurs inactifs** : passez en "inactif" les utilisateurs qui n'ont plus besoin d'accès
- **Réactiver des utilisateurs** : vous pouvez maintenant réactiver des utilisateurs précédemment désactivés
- **Augmenter votre licence** : contactez votre commercial AirSaas pour ajouter des licences

**Bon à savoir :** Depuis avril 2025, vous pouvez réactiver les utilisateurs inactifs, ce qui facilite la gestion des entrées/sorties dans vos équipes.

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### Pourquoi je ne peux créer que des observateurs ?

Si vous ne pouvez créer que des utilisateurs avec le rôle "Observateur", c'est que vous avez atteint votre limite de licences contributeur.

**Les rôles consommant une licence :**
- Administrateur
- Ambassadeur
- Créateur
- Contributeur

**Les solutions disponibles :**
1. **Libérer des licences existantes**
   - Basculez des utilisateurs actuels vers le rôle "Observateur" (ne consomme pas de licence)
   - Désactivez les utilisateurs inactifs

2. **Augmenter votre nombre de licences**
   - Contactez votre responsable compte pour acheter des licences supplémentaires

**Pour vérifier votre consommation** : Allez dans Paramètres > Utilisateurs pour voir le nombre de licences utilisées/disponibles.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Que faire quand un utilisateur ne peut pas se connecter ?

Deux cas possibles quand un utilisateur ne peut pas se connecter :

**1. L'utilisateur a déjà un compte actif**
- Il peut utiliser le lien "Mot de passe oublié" sur la page de connexion
- Il recevra un email de réinitialisation

**2. L'utilisateur a été invité mais n'a jamais finalisé son inscription**
- Vérifiez dans la gestion des membres s'il apparaît comme "En attente"
- Dans ce cas, il n'a pas de mot de passe car il n'a pas encore de compte
- **Solution** : Renvoyez-lui son invitation depuis la gestion des membres
- Il devra suivre le lien d'invitation pour créer son compte

**Astuce** : Le support peut vérifier le statut exact de l'utilisateur si besoin.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Comment activer un utilisateur fantôme ?

**Pour transformer un utilisateur fantôme en utilisateur actif :**

1. **Depuis la fiche du fantôme :**
   - Trouvez l'utilisateur fantôme dans un projet ou via la recherche
   - Cliquez sur son nom pour ouvrir sa fiche
   - Cliquez sur "Inviter" directement depuis la fiche fantôme
   - L'utilisateur recevra un email d'invitation

2. **Si vous utilisez le SSO (Azure/Google) :**
   - **AVANT d'inviter**, assurez-vous que l'utilisateur est ajouté au groupe d'accès AirSaas dans votre Azure AD
   - C'est une opération à faire pour chaque nouvel utilisateur
   - Sans cela, l'utilisateur aura l'erreur "Vous n'êtes pas autorisé à accéder à cette application"

3. **Après activation réussie :**
   - L'utilisateur peut se connecter avec ses identifiants
   - Fusionnez le compte fantôme avec le nouveau compte actif depuis la fiche fantôme
   - Cela transférera tout l'historique du fantôme vers le compte actif

**Erreur fréquente :** Si l'utilisateur ne peut pas valider son compte, vérifiez d'abord les droits SSO avant de recréer un compte.

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)
- [Assignez des utilisateurs sans les inviter sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/assignez-des-utilisateurs-sans-les-inviter-sur-airsaas)


### Que faire si un nouvel utilisateur ne reçoit pas son invitation AirSaas ?

Si un nouvel utilisateur ne reçoit pas son email d'invitation AirSaas, voici la procédure à suivre :

**1. Vérifier l'adresse email**
- Confirmez l'orthographe exacte de l'adresse email
- Attention aux fautes de frappe courantes (exemple : .con au lieu de .com)

**2. Vérifier le statut de l'utilisateur dans AirSaas**
- Allez dans la gestion des utilisateurs
- Vérifiez s'il existe :
  - Un utilisateur fantôme avec cette adresse
  - Un utilisateur en attente d'activation

**3. Renvoyer l'invitation**
- Cliquez sur l'utilisateur concerné
- Utilisez le bouton "Renvoyer l'invitation"

**4. Si l'email n'arrive toujours pas**
- L'utilisateur a peut-être marqué un email AirSaas comme spam par le passé
- Contactez le support via le chat pour débloquer l'adresse email

**Note importante** : L'option "Mot de passe oublié" ne fonctionne que pour les comptes déjà activés. Un nouvel utilisateur doit d'abord cliquer sur le lien d'activation reçu par email.

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### Pourquoi je ne peux pas inviter de nouveaux utilisateurs sur AirSaas ?

Si vous ne parvenez pas à inviter de nouveaux utilisateurs et que rien ne se passe lorsque vous cliquez sur "Envoyer l'invitation", vérifiez d'abord que vous avez des licences disponibles.

**Pour vérifier vos licences disponibles :**
1. Accédez aux paramètres de votre espace de travail
2. Consultez la section "Licences" pour voir combien sont utilisées et disponibles

**Si toutes vos licences sont utilisées :**
- Contactez votre responsable compte pour augmenter le nombre de licences
- Ou désactivez des utilisateurs inactifs pour libérer des licences (voir l'article Circle "Moins de frustration dans la gestion des utilisateurs")

**Où inviter des utilisateurs :**
- Depuis un projet spécifique
- Depuis le menu utilisateur en haut à droite > "Envoyer une invitation"
- Depuis les paramètres de l'espace de travail

**Note :** Un message d'erreur explicite sera bientôt ajouté pour clarifier cette limitation.

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)
- [Comment inviter des utilisateurs sur AirSaas ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-inviter-des-nouveaux-utilisateurs-sur-airsaas)


### Comment sont comptabilisées les licences et comment gérer les utilisateurs inactifs ?

**Comptabilisation des licences :**
- Les collaborateurs AirSaas (support, consultants) ne consomment PAS vos licences
- Les invitations en attente COMPTENT dans vos licences
- Pour voir le détail : survolez le compteur de licences

**Gestion des invitations en attente :**
- Supprimez les invitations des personnes qui ne rejoindront jamais l'espace
- Les utilisateurs qui n'ont pas validé leur invitation restent "en attente"

**Changer le rôle d'un utilisateur inactif :**
- Si l'utilisateur est "en attente" : impossible de changer son rôle directement
- Solution : contactez le support pour passer ces utilisateurs en observateur (ne consomme pas de licence)
- Alternative : supprimez l'invitation et recréez l'utilisateur avec le bon rôle

**Astuce :** Faites régulièrement le ménage dans vos invitations en attente pour libérer des licences

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### La licence d'un utilisateur désactivé est-elle récupérée immédiatement ?

**Oui, la licence est libérée immédiatement** lorsque vous désactivez un utilisateur.

**Comment ça fonctionne :**
- Dès que vous désactivez un utilisateur avec une licence Créateur
- La licence devient disponible instantanément
- Le compteur de licences se met à jour automatiquement
- Au pire, un simple refresh de la page affichera le compteur actualisé

**Bon à savoir :**
- Vous pouvez réactiver un utilisateur désactivé à tout moment
- Il faudra alors lui réattribuer une licence disponible

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment gérer les doublons d'utilisateurs fantômes ?

**Ne supprimez pas les doublons - fusionnez-les !**

Lorsque vous avez des utilisateurs fantômes en doublon :
1. **Utilisez la fonction de fusion** plutôt que la suppression
2. La fusion conserve automatiquement toutes les affectations (projets, jalons, décisions, etc.)
3. Vous n'aurez aucune modification manuelle à faire

**Avantages de la fusion :**
- Préserve l'historique complet
- Maintient toutes les affectations
- Évite les références cassées
- Pas de risque de perte de données

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### Comment gérer un changement d'adresse email suite à un changement de nom ?

Si vous avez changé de nom et d'adresse email, voici comment conserver votre historique AirSaas :

**Deux options selon votre situation :**

**Option 1 : Si le nouveau compte est récent et peu utilisé**
- Le support supprime le nouveau compte
- Votre email est modifié sur l'ancien compte
- Vous conservez tout votre historique, vos responsabilités et vos vues
- **Avantage** : conservation complète de toutes vos données

**Option 2 : Si vous avez déjà beaucoup utilisé le nouveau compte**
- Le support transfère vos responsabilités de l'ancien vers le nouveau compte :
  - Responsable décision
  - Membre de projet
  - Autres assignations
- **Limitation** : les vues de portfolio personnelles et messages dans les fils d'activité ne sont pas transférés

**Procédure à suivre :**
1. Contactez le support via le chat ou support@airsaas.io
2. Indiquez quelle option vous préférez
3. Déconnectez-vous d'AirSaas
4. Reconnectez-vous avec votre nouvelle adresse une fois la modification effectuée

**Important :** Privilégiez l'option 1 si votre nouveau compte est récent pour une transition sans perte de données.


### Comment gérer un utilisateur créé par erreur ?

**Il est préférable de renommer plutôt que de supprimer un utilisateur créé par erreur.**

**Pourquoi ne pas supprimer ?**
- L'utilisateur peut avoir été assigné/mentionné dans des projets, décisions, etc.
- La suppression casserait ces références historiques

**Solution recommandée :**
1. Demandez au support de renommer l'utilisateur inactif
2. Ajoutez "(à ne pas utiliser)" ou "(erreur)" au nom
3. L'utilisateur reste dans les inactifs mais n'est plus source de confusion

**Alternative :** Si l'utilisateur n'a jamais été utilisé (aucune affectation), la suppression peut être envisagée avec le support.

**Ressources utiles :**
- [Moins de frustration dans la gestion des utilisateurs](https://club.airsaas.io/c/ca-vient-de-sortir/moins-de-frustration-dans-la-gestion-des-utilisateurs)


### Comment corriger une erreur dans l'email d'invitation ?

Si vous avez fait une erreur dans l'email d'invitation :

1. Cliquez sur l'icône **corbeille** à côté de l'invitation erronée pour l'annuler
2. Créez une nouvelle invitation avec l'email correct

**Note importante** : Ne tentez pas de réinviter avec l'email erroné, cela recréerait la même invitation incorrecte.

**Cas SSO** : Si votre organisation utilise le SSO, le bouton "accepter/refuser" n'apparaît pas. Utilisez uniquement la corbeille pour annuler.


### Comment changer mon adresse email de connexion ?

Si vous devez changer votre adresse email de connexion (changement de statut, nouveau nom, correction d'erreur), voici la procédure :

**Étapes à suivre :**
1. Contactez le support AirSaas via le chat intégré
2. Indiquez :
   - Votre email actuel
   - Le nouvel email souhaité
   - La raison du changement (optionnel)

**Important à savoir :**
- Votre mot de passe reste inchangé
- Le changement est effectué sous 24-48h ouvrées
- Vous devrez utiliser le nouvel email dès la modification effectuée
- Vos données, projets et historique sont conservés

**Note :** Cette modification doit être effectuée par le support car elle impacte votre identifiant unique dans le système.


### Comment inviter des utilisateurs externes dans mon organisation ?

Pour inviter des utilisateurs externes dans votre organisation :

1. Allez dans Administration > Utilisateurs
2. Cliquez sur "Ajouter un nouvel utilisateur"
3. Choisissez "Externe" comme type d'utilisateur
4. Remplissez les informations (email, nom, prénom)
5. **Important** : Sélectionnez un rôle pour l'externe (obligatoire)
6. Validez l'invitation

**Note sur les emails génériques** : Les adresses email génériques (ex: contact@entreprise.com) sont bloquées.

---

## Quarter Plan et capacité

### Comment filtrer les projets dans le Quarter Planning ?

Dans le Quarter Planning, vous pouvez sélectionner précisément quels projets inclure selon plusieurs critères :

**Filtrage par statut :**
- Choisissez les statuts des projets à inclure (ex: uniquement les projets "En cours" et "À venir")
- Excluez automatiquement les projets terminés ou abandonnés

**Filtrage par équipe :**
- Sélectionnez uniquement les équipes participant à la démarche Quarter Planning
- Idéal pour exclure les petits projets ou ceux non pertinents

**Pour configurer ces filtres :**
1. Accédez aux paramètres du Quarter Planning
2. Dans la section "Projets entrants", définissez vos critères
3. Les projets seront automatiquement filtrés selon vos choix

**Ressources utiles :**
- [Le Quarter plan](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Comment activer et accéder au Quarter Plan ?

Le Quarter Plan permet de :
- Clarifier les priorités trimestrielles
- Valoriser les réalisations des équipes
- Éviter la dispersion sur trop de projets simultanés

**Vérifier si c'est activé :**
1. Allez dans les paramètres de votre workspace
2. Cherchez la section Quarter Plan
3. Si vous ne la voyez pas, contactez le support

**Pour l'activer :**
- Contactez le support en précisant votre workspace
- L'activation est immédiate

**Après activation :**
- Configurez vos quarters (dates, objectifs)
- Assignez vos jalons aux quarters
- Suivez l'avancement vs les engagements

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Suivre l'avancée du Quarter plan, et comparer aux engagements](https://club.airsaas.io/c/ca-vient-de-sortir/suivre-l-avancee-du-quarter-plan-et-comparer-aux-engagements)

### Comment sont comptabilisés les jalons qui chevauchent plusieurs trimestres dans le Quarter Plan ?

**Les jalons à cheval sur plusieurs quarters ne sont PAS pris en compte dans le calcul de capacité.**

Pourquoi cette limitation ?
- Le Quarter Plan est conçu pour une planification par trimestre
- L'objectif est de faire un bilan clair de ce qui est fait/pas fait par quarter
- Des jalons à cheval rendraient la lecture moins lisible

**Que faire si mon jalon dure plus d'un trimestre ?**
- Scindez le jalon en plusieurs jalons (un par quarter)
- Chaque partie sera alors comptabilisée dans son quarter respectif
- Un message d'avertissement apparaît automatiquement sur les jalons concernés

**À noter** : Cette approche est volontaire pour maintenir la cohérence du Quarter Plan et faciliter le suivi trimestriel des engagements.

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)

### Comment visualiser et coordonner les jalons sur une timeline dans un Quarter Plan ?

**Visualisation actuelle des jalons dans le Quarter Plan** :

Le Quarter Plan permet de regrouper et prioriser les jalons par trimestre. Pour visualiser la séquence temporelle :

**Solutions disponibles** :
- Utilisez une vue timeline filtrée sur les jalons du quarter depuis le portfolio jalons
- Créez une vue dédiée avec les jalons du trimestre en cours
- Utilisez les dépendances entre jalons pour matérialiser les contraintes

**Évolutions à venir** :
AirSaas développe actuellement la possibilité de :
- Générer automatiquement une vue timeline avec tous les jalons d'un Quarter
- Visualiser les dépendances inter-équipes directement dans le QP
- Créer des vues de toutes les décisions à prendre dans le quarter

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)

### Comment activer et configurer le Capacitaire ?

Le Capacitaire est une fonctionnalité avancée d'AirSaas qui permet de visualiser et planifier la charge de vos équipes sur plusieurs trimestres.

**Pour l'activer :**
1. Contactez le support AirSaas via le chat
2. Un accompagnement personnalisé vous sera proposé pour :
   - Configurer vos équipes et leurs capacités
   - Paramétrer votre année fiscale si nécessaire
   - Former vos utilisateurs clés

**Prérequis recommandés :**
- Avoir défini vos équipes dans AirSaas
- Avoir quelques projets avec des jalons positionnés
- Prévoir 30 minutes pour la configuration initiale avec le support

**Fonctionnalités associées :**
- Vue Quarter Plan pour la planification trimestrielle
- Vue Budget pour le suivi financier
- Scenarios pour tester différentes hypothèses de charge

**Ressources utiles :**
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)
- [Le capacity planning](https://club.airsaas.io/c/ca-vient-de-sortir/le-capacity-planning-wait-what)
- [Capacité](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacite)

### Pourquoi mon équipe n'apparaît pas dans le Quarter Plan alors qu'elle a des jalons ?

Pour qu'une équipe apparaisse dans le Quarter Plan, elle doit être **activée dans les paramètres de capacité**.

**Pour activer une équipe :**
1. Allez dans **Paramètres > Capacité > Équipes** : https://app.airsaas.io/space/[votre-espace]/settings/capacity/teams
2. Cochez les équipes qui participent au Quarter Plan
3. Les équipes non cochées restent "parties prenantes" mais n'estiment pas leurs efforts

**Bon à savoir :**
- Les équipes "métiers" peuvent être ajoutées comme parties prenantes sans estimation
- Cela permet d'associer leurs noms aux livrables sans gérer leur capacité
- Exemple : l'équipe magasin valide la recette sans estimer d'efforts

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)

### Comment est calculé le besoin en ETP dans le Quarter Plan ?

Le calcul des ETP dans le Quarter Plan suit cette logique :

**Formule de base :**
- 1 ETP sur 1 quarter = 60 jours de capacité
- Calcul : 3 mois × 20 jours ouvrés = 60 jours

**Exemple concret :**
Si vous avez un delta de 142 jours à combler :
- 2 ETP complets = 120 jours (2 × 60)
- 0,37 ETP supplémentaire = 22 jours
- **Total : 2,37 ETP nécessaires**

**Personnalisation future :**
AirSaas prévoit de permettre la personnalisation du nombre de jours par trimestre par équipe pour tenir compte :
- Des congés
- Des jours fériés
- Des spécificités par équipe

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Comment sont sélectionnés les jalons dans un Quarter Plan ?

**Les jalons sont automatiquement inclus dans un Quarter Plan selon 3 critères cumulatifs :**

1. **Dates du jalon** : La date du jalon doit être comprise dans la période du quarter
2. **Équipe porteuse** : Le jalon doit être porté par une équipe qui participe au Quarter Plan
3. **Statut du jalon** : Le jalon doit être dans un des statuts configurés pour le Quarter Plan

**Pour vérifier les jalons inclus :**
- Allez sur la page Quarter Plan
- En bas de page, consultez la liste complète des jalons inclus
- Vous y verrez tous les jalons qui répondent aux 3 critères

**Attention :** Si vous ajoutez une nouvelle équipe au Quarter Plan en cours, tous ses jalons correspondants apparaîtront d'un coup, impactant les statistiques (capacité, projets terminés, etc.).

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Pourquoi je ne vois pas l'année suivante dans mon capacitaire équipe ?

Le capacitaire affiche automatiquement les années pour lesquelles vous avez des jalons éligibles.

**Pour qu'une année apparaisse, vous devez avoir au moins un jalon qui remplit TOUS ces critères :**
- Le jalon a des dates de début ET de fin (ou au minimum une date de fin)
- Ces dates sont incluses dans un trimestre de l'année souhaitée
- Le jalon a un effort renseigné (en jours)
- Le jalon est assigné à une équipe
- Le projet du jalon a un statut inclus dans votre quarter plan
- L'équipe du jalon fait partie des équipes paramétrées dans votre quarter plan

**Vérifiez vos paramètres :** Rendez-vous dans `/settings/capacity/general` pour vérifier que les équipes concernées sont bien incluses.

**Cas particulier des jalons à cheval :** Un jalon qui chevauche deux trimestres n'est pas éligible. La bonne pratique est de le découper en deux jalons distincts, un par trimestre.

**Ressources utiles :**
- [Capacitaire équipes externes / prestataires](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacitaire-equipes-externes-prestataires)
- [Capacité](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacite)
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)

### Comment gérer les jalons qui se décalent d'un quarter à l'autre ?

Lorsqu'un jalon se décale d'un quarter à l'autre, voici la bonne pratique recommandée :

1. **Laissez le jalon du quarter initial non terminé**
   - Cela montre que l'engagement n'a pas été tenu
   - Permet de garder la traçabilité des engagements initiaux

2. **Créez un nouveau jalon sur le quarter suivant**
   - Avec le même nom/objectif
   - Avec une charge ajustée selon ce qui reste à faire

**À venir :** Une fonctionnalité dédiée est en cours de développement pour gérer automatiquement ces décalages en fin de quarter.

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Nouvelle fonctionnalité de gestion des jalons non-terminés](https://club.airsaas.io/c/ca-vient-de-sortir/que-faire-des-jalons-non-termines-en-fin-de-quarter)

### Comment gérer les jalons non terminés lors du passage au quarter suivant ?

**Nouvelle fonctionnalité : Extension des jalons**

Depuis décembre 2025, vous pouvez utiliser la fonction "Étendre" pour les jalons non terminés :

1. **Deux semaines avant la fin du quarter** : une bannière d'alerte apparaît automatiquement
2. **Cliquez sur la bannière** pour accéder à la vue des jalons non terminés
3. **Pour chaque jalon** : cliquez sur "Étendre" pour :
   - Créer automatiquement un jalon de continuation sur le quarter suivant
   - Reporter l'effort restant à réaliser
   - Conserver l'historique et le lien avec le jalon d'origine

**Avantages de l'extension vs duplication :**
- Conserve la traçabilité entre quarters
- Calcul automatique de l'effort restant
- Évite la confusion pour les utilisateurs
- Maintient la cohérence des reportings

**Important :** Attendez d'utiliser cette fonctionnalité plutôt que de dupliquer manuellement pour éviter d'embrouiller vos équipes pendant leur bilan de quarter.

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Que faire des jalons non-terminés en fin de quarter ? 🤔](https://club.airsaas.io/c/ca-vient-de-sortir/que-faire-des-jalons-non-termines-en-fin-de-quarter)

### Pourquoi mes projets en difficulté n'apparaissent pas dans les KPI du Quarter Plan ?

Les KPI du Quarter Plan ne comptabilisent que les projets qui répondent à **tous** les critères suivants :

**1. Statut du projet**
- Le projet doit être dans un statut actif (généralement "En cours")
- Les projets en "Standby" ou autres statuts inactifs ne sont pas comptés

**2. Configuration des équipes**
- Les jalons du projet doivent être assignés aux équipes configurées dans votre Quarter Plan
- Si un projet a des jalons assignés à des équipes non incluses dans le Quarter Plan, il n'apparaîtra pas dans les KPI

**3. Période du Quarter Plan**
- Les jalons doivent être planifiés sur la période du quarter en cours

**Pour vérifier et corriger :**
1. Accédez à votre vue portfolio et filtrez sur les projets "C'est compliqué"
2. Vérifiez le statut de chaque projet (doit être "En cours")
3. Vérifiez que les jalons de ces projets sont bien assignés aux équipes de votre Quarter Plan
4. Si nécessaire, ajustez la configuration de votre Quarter Plan pour inclure les bonnes équipes

**Ressources utiles :**
- [Le Quarter Plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Comment est calculée la progression des équipes dans le Quarter Plan ?

**La progression des équipes dans le Quarter Plan se calcule uniquement sur le nombre de jalons terminés.**

**Formule :**
Progression équipe = (Nombre de jalons terminés / Nombre total de jalons) × 100

**Important :** Le pourcentage d'avancement individuel de chaque jalon n'est PAS pris en compte. Seuls les jalons avec un statut "Terminé" sont comptabilisés.

**Exemple :**
- Vous avez 2 jalons assignés à une équipe
- Jalon 1 : avancement à 80%
- Jalon 2 : avancement à 50%
- **Progression de l'équipe = 0%** (car aucun jalon n'est terminé)

Cette approche permet une vision binaire claire : le jalon est livré ou ne l'est pas.

**Ressources utiles :**
- [Suivre l'avancée du Quarter plan, et comparer aux engagements](https://club.airsaas.io/c/ca-vient-de-sortir/suivre-l-avancee-du-quarter-plan-et-comparer-aux-engagements)

### Pourquoi mes modifications de vue dans le capacitaire disparaissent ?

**Les modifications de vue doivent être sauvegardées "pour tous" pour persister.**

Dans le capacitaire par équipe :
1. Ajoutez vos champs (ex: "Parent du jalon")
2. **Important** : Cliquez sur "Sauvegarder pour tous" (et non pas juste pour vous)
3. Cela rendra la modification permanente pour tous les utilisateurs

**Si les champs disparaissent encore :**
- Vérifiez que vous avez les droits pour sauvegarder pour tous
- Rafraîchissez la page après sauvegarde
- Contactez le support si le problème persiste

**Astuce :** Le champ "Parent du jalon" (projet concerné) est souvent nécessaire pour contextualiser les jalons dans cette vue.

**Ressources utiles :**
- [Préparez Q1 2025 avec le nouveau Capacitaire 🔋](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)

### Comment modifier le statut d'un Quarter déjà lancé ?

Une fois qu'un Quarter est passé en statut "En cours", vous ne pouvez pas le repasser en "Préparation" par vous-même.

**Pour modifier le statut d'un Quarter :**
- Contactez le support via le chat
- Précisez quel Quarter vous souhaitez modifier (ex: Q1 2026)
- Indiquez le nouveau statut souhaité
- Le support effectuera la manipulation pour vous

**Conseil :** Avant de passer un Quarter en "En cours", assurez-vous d'avoir tous les éléments nécessaires pour éviter de devoir revenir en arrière.

**Ressources utiles :**
- [Le Quarter plan](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Comment suivre les sollicitations faites à mes équipes par d'autres projets ?

Pour visualiser les sollicitations faites à vos équipes par d'autres projets, vous avez deux options principales :

**Option 1 : Vue projets filtrée**
- Créez une vue dans le portfolio projets
- Filtrez sur : équipe impliquée = votre équipe ET responsable ≠ membre de votre équipe
- Cela vous montrera tous les projets où votre équipe contribue sans en être responsable

**Option 2 : Portfolio des jalons**
- Utilisez le portfolio des jalons
- Créez une vue groupée par projet ou par manager de projet
- Filtrez sur votre équipe participante
- Vous verrez ainsi tous les jalons (livrables) attendus de votre équipe

**Avec les jalons multi-équipes** (nouveauté 2026)
Depuis février 2026, les jalons peuvent être assignés à plusieurs équipes simultanément, ce qui facilite grandement le suivi des sollicitations inter-équipes.

**Ressources utiles :**
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)

### Comment piloter la charge des équipes à partir des jalons ?

AirSaas propose plusieurs fonctionnalités pour piloter la charge des équipes :

**1. Module Capacité** :
- Visualisez la charge prévisionnelle des équipes
- Comparez avec leur capacité disponible
- Identifiez les périodes de surcharge

**2. Jalons et efforts** :
- Renseignez les efforts estimés sur vos jalons
- Les jalons multi-équipes permettent de répartir la charge entre plusieurs équipes
- Déclarez les efforts consommés au niveau des jalons pour un suivi précis

**3. Quarter Plan** :
- Planifiez vos jalons par trimestre
- Visualisez la charge consolidée par équipe
- Ajustez en fonction de la capacité disponible

**Pour aller plus loin** :
- Activez le module Capacité en contactant le support
- Consultez les articles sur le capacity planning et le Quarter Plan

**Ressources utiles :**
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)
- [Déclarer les efforts consommés au jalon](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)
- [Le Quarter plan](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Pourquoi je ne vois plus les efforts T-shirt sur mes jalons ?

Les efforts T-shirt (S, M, L, XL) sur les jalons sont liés à l'activation du module Quarter Plan.

**Pour faire réapparaître les efforts T-shirt :**
1. Allez dans Paramètres > Modules
2. Activez le module "Quarter Plan"
3. Rafraîchissez la page
4. Les efforts T-shirt seront de nouveau visibles dans l'édition des jalons

**Pourquoi ce lien ?**
Les efforts sont utilisés pour la planification capacitaire qui est au cœur du Quarter Planning. Si vous utilisez uniquement le capacitaire sans Quarter Plan, contactez le support pour une configuration adaptée.

**Configuration alternative :**
- Si vos équipes participent au Quarter Plan mais que vous n'utilisez pas le board QP
- Si le capacitaire est actif mais pas le Quarter Plan
→ Le support peut adapter la configuration pour votre cas d'usage

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Déclarer les efforts consommés au jalon](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)

### Quelle est la différence entre le poids et l'effort d'un jalon ?

**Le poids** et **l'effort** sont deux attributs différents des jalons :

**Le poids du jalon**
- Sert à moduler la vision de la **barre de progression** du projet
- Utile avant d'avoir la feature effort
- Permet de pondérer l'importance relative des jalons dans l'avancement global

**L'effort du jalon** 
- **Plus important à renseigner** que le poids
- Permet de visualiser le **capacitaire** (charge de travail)
- Offre des **gains rapides** en termes de planification
- Essentiel pour le Quarter Planning

**Recommandation** : Priorisez le renseignement de l'effort sur tous vos jalons. Le poids est optionnel et moins critique pour la planification capacitaire.

**Ressources utiles :**
- [Capacité](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacite)
- [Le poids des jalons, c'est quoi ?](https://club.airsaas.io/c/utilisateurs-d-airsaas/le-poids-des-jalons-c-est-quoi)

### Pourquoi certaines équipes n'apparaissent pas dans le Capacitaire par équipe ?

Si vous ne voyez pas toutes vos équipes dans le menu **Capacitaire par équipe**, c'est parce qu'elles n'ont pas été sélectionnées comme participant au process Quarter plan.

**Solution :**
1. Accédez aux paramètres de vos équipes
2. Pour chaque équipe que vous souhaitez voir dans le capacitaire, cochez l'option indiquant qu'elle participe au Quarter plan
3. Les équipes sélectionnées apparaîtront alors dans le capacitaire

**Pourquoi cette configuration ?**
Toutes les équipes d'une organisation ne participent pas nécessairement au Quarter plan (Capacitaire, Quarter plan, Scénario). Cette option permet de filtrer uniquement les équipes pertinentes pour la planification capacitaire.

**Ressources utiles :**
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)
- [Le Quarter plan](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)

### Comment visualiser le capacitaire consolidé d'un service ou d'une direction ?

Pour visualiser le capacitaire consolidé d'un service (ex: toute la DSI) :

**Prérequis** :
- Les niveaux d'équipe doivent être activés sur votre espace
- Contactez le support pour l'activation si ce n'est pas déjà fait

**Configuration recommandée** :
- **Niveau 1** : Équipes qui délivrent (IT projet, IT tests, etc.) - "Les muscles" qui s'engagent à livrer des jalons
- **Niveau 2** : Équipes en demande/directions (type CODIR) - Les directions métier pour qui on travaille

**Bonnes pratiques** :
- Découper la DSI par responsable
- Créer des équipes unipersonnelles si besoin pour des compétences spécifiques
- Pour les directions, rester au niveau N-1 DG

**Important** : Posez bien la hiérarchie avant de commencer car les modifications de niveau après coup sont chronophages.

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)

### Comment gérer des jalons qui s'étendent sur plusieurs trimestres dans le Quarter Plan ?

**Le défi** :
Le Quarter Plan fonctionne par trimestre calendaire, mais vos jalons peuvent s'étendre au-delà d'un trimestre.

**La solution : Extension des jalons** :
Il est possible d'étendre un jalon sur plusieurs trimestres. Cette fonctionnalité permet de :
- Garder la vision Quarter Plan pour le pilotage
- Refléter la réalité des jalons qui dépassent les frontières trimestrielles
- Visualiser la charge répartie sur plusieurs quarters

**Comment faire** :
1. Créez votre jalon avec sa date de début dans le quarter initial
2. Utilisez la fonctionnalité d'extension pour l'étendre aux quarters suivants
3. La capacité sera automatiquement répartie sur la période

**Note** : Si vous rencontrez des difficultés avec cette fonctionnalité, contactez le support pour une démonstration personnalisée.

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Que faire des jalons non-terminés en fin de quarter ? 🤔](https://club.airsaas.io/c/ca-vient-de-sortir/que-faire-des-jalons-non-termines-en-fin-de-quarter)

### La charge des projets privés est-elle visible dans le capacitaire ?

**Non, seuls les projets publics sont pris en compte dans le capacitaire et le quarter plan.**

Lorsque vous planifiez des charges sur les jalons d'un projet privé, ces efforts ne seront pas visibles dans :
- Le module Capacité
- Les vues Quarter Plan
- Les consolidations d'équipe

**Pourquoi cette distinction ?**
Les projets privés sont généralement des initiatives confidentielles ou exploratoires qui ne doivent pas impacter la planification globale de l'organisation.

**Que faire si vous voulez inclure ces charges ?**
Si vous souhaitez que les efforts d'un projet soient comptabilisés dans le capacitaire, vous devez passer le projet en mode "Public" dans ses paramètres.

**Ressources utiles :**
- [Capacité](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacite)
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)

### Peut-on gérer la capacité par ressource individuelle ou seulement par équipe ?

Sur AirSaas, la gestion capacitaire se fait **uniquement au niveau des équipes**, pas au niveau des ressources individuelles.

Cela signifie que :
- Vous définissez une capacité globale pour chaque équipe
- Vous ne pouvez pas détailler la capacité personne par personne
- Si vous recevez des données capacitaires individuelles, vous devrez les consolider par équipe avant de les saisir dans AirSaas

**Pourquoi ce choix ?**
Cette approche permet une gestion plus macro et évite la microgestion des ressources individuelles, tout en gard

---

## Droits et permissions

### Quels rôles permettent de créer des projets ?

La création de projets nécessite au minimum le rôle **Créateur**.

**Hiérarchie des rôles pour la création de projets :**
- **Contributeur** : ❌ Ne peut PAS créer de projets (peut seulement participer aux projets existants)
- **Créateur** : ✅ Peut créer des projets publics
- **Ambassadeur** : ✅ Peut créer des projets (y compris privés)
- **Administrateur** : ✅ Peut créer tous types de projets

**Pour modifier le rôle d'un utilisateur :**
1. Allez dans **Paramètres** > **Utilisateurs**
2. Trouvez l'utilisateur concerné
3. Changez son rôle en **Créateur** ou supérieur
4. L'utilisateur doit **rafraîchir son navigateur** pour voir les changements

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Qui peut créer des projets privés et comment gérer la confidentialité ?

**Seuls les Ambassadeurs et Administrateurs peuvent créer des projets privés.**

**Hiérarchie des permissions :**
- **Créateur** : ❌ Ne peut créer que des projets publics
- **Ambassadeur** : ✅ Peut créer des projets privés
- **Administrateur** : ✅ Peut créer des projets privés

**Solutions pour un projet confidentiel :**

**Option 1 - Promouvoir l'utilisateur :**
1. Changez le rôle de l'utilisateur en **Ambassadeur**
2. Il pourra créer et gérer des projets privés

**Option 2 - Création déléguée :**
1. Un admin/ambassadeur crée le projet privé
2. Assigne l'utilisateur comme **responsable du projet**
3. L'utilisateur a tous les droits sur ce projet spécifique

**Note importante** : Un projet privé limite l'accès aux seules personnes explicitement ajoutées au projet.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment créer un projet confidentiel visible uniquement par moi ?

Pour créer un projet confidentiel sur AirSaas :

1. Cliquez sur le bouton de création de projet
2. Remplissez les informations du projet dans les premières étapes
3. **À la dernière étape du formulaire**, vous verrez une option pour choisir la visibilité :
   - Sélectionnez **"Privé"** pour que le projet ne soit visible que par vous et les personnes que vous ajouterez explicitement
   - L'option **"Public"** rend le projet visible à tous les membres de votre espace de travail

**Note importante** : Un projet créé en mode public ne peut pas être repassé en privé par la suite. Choisissez donc bien la confidentialité dès la création.

**Ressources utiles :**
- [Qui peut voir et éditer mon projet ?](https://club.airsaas.io/c/debuter-sur-airsaas/qui-peut-voir-et-editer-mon-projet)


### Un administrateur peut-il voir tous les projets privés de l'organisation ?

**Non, être administrateur ne donne pas accès automatique aux projets privés.**

**Ce que voit un administrateur :**
- Tous les projets publics de l'organisation
- Les projets privés où il est personnellement impliqué
- Les droits d'administration concernent la gestion des utilisateurs et paramètres, pas l'accès aux projets

**Pour voir un projet privé, il faut :**
- Être ajouté comme personne impliquée dans le projet
- Peu importe votre rôle (admin, DG, etc.), la règle est la même

**Bonnes pratiques :**
- La norme sur AirSaas est d'avoir des projets publics par défaut
- Réservez le mode privé aux projets ultra-confidentiels
- Pour filtrer l'information, utilisez les vues filtrées plutôt que de multiplier les projets privés

**Astuce pour les gestionnaires de portefeuille :**
Depuis une vue tableau du portefeuille, vous pouvez ajouter rapidement une personne (ex: le DG) à plusieurs projets en cliquant sur l'attribut 'Sponsor' de chaque projet.

**Ressources utiles :**
- [Qui peut voir et éditer mon projet ?](https://club.airsaas.io/c/debuter-sur-airsaas/qui-peut-voir-et-editer-mon-projet)


### Comment voir tous les projets de mon organisation ?

**Règle importante :** Sur AirSaas, personne ne peut voir les projets privés où il n'est pas membre, même les administrateurs.

**Ce que vous pouvez voir :**
- Tous les projets ouverts à tous
- Tous les projets privés où vous êtes membre
- Pour voir tous vos projets accessibles : créez une vue sans filtre sur le portfolio

**Pour avoir accès à plus de projets :**
1. **Projets ouverts** : vous les voyez automatiquement
2. **Projets privés** : demandez à être ajouté comme membre ou sponsor
3. **Vision globale** : demandez aux responsables de projets de vous ajouter systématiquement

**Astuce pour les dirigeants :**
- Établissez une règle interne : tous les nouveaux projets doivent vous inclure comme sponsor
- Utilisez la fonctionnalité d'utilisateur fantôme pour être pré-ajouté aux projets
- Privilégiez les projets "ouverts à tous" quand la confidentialité n'est pas requise

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas 👑](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)


### Comment passer un projet public en privé ?

Par défaut, le passage d'un projet public vers privé n'est pas disponible directement dans l'interface AirSaas car les conséquences peuvent être importantes :

**Impacts à considérer :**
- Si le projet est utilisé dans un Quarter Plan, il deviendra invisible pour les personnes non-membres
- Si le projet apparaît dans des priorisations d'équipes, ces références seront perdues
- Tous les utilisateurs non-membres perdront immédiatement l'accès au projet

**Prérequis avant le changement :**
- Vous devez être membre du projet (sponsor, chef de projet ou autre rôle)
- Vérifier que le projet n'est pas utilisé dans des Quarter Plans actifs
- S'assurer que toutes les personnes devant conserver l'accès sont bien membres du projet

**Comment procéder :**
1. Contactez le support AirSaas via le chat
2. Fournissez le lien du projet concerné
3. Confirmez que vous êtes bien membre du projet
4. Le support effectuera le changement dans le backend

**Note importante :** Une fois un projet passé en privé, vous ne pourrez plus le repasser en public sans l'aide du support.

**Ressources utiles :**
- [Qui peut voir et éditer mon projet ?](https://club.airsaas.io/c/debuter-sur-airsaas/qui-peut-voir-et-editer-mon-projet)


### Les points d'attention et décisions héritent-ils de la privacité du projet ?

**Règle générale** : Oui, les points d'attention et décisions héritent automatiquement de la privacité du projet parent.

**Qui a accès** :
- Seules les personnes présentes dans le projet privé ont accès aux décisions et points d'attention de ce projet
- Les comptes rendus héritent également de cette privacité
- Cette règle s'applique aussi dans les smart views : les éléments privés ne sont visibles que par les membres du projet

**Exception importante pour les décisions** :
- Si vous créez une décision dans un projet privé et que vous ajoutez un décisionnaire qui n'est pas membre du projet
- Cette personne aura accès uniquement à la décision (pas au projet)
- Exemple : Projet privé avec Thomas et Simon → Arnaud ajouté comme décisionnaire → Arnaud voit la décision mais pas le projet

**Cas d'usage** : Parfait pour créer des espaces confidentiels comme des instances de Steering Committee avec PV et actions centralisés.

**Ressources utiles :**
- [Qui peut voir et éditer mon projet ?](https://club.airsaas.io/c/debuter-sur-airsaas/qui-peut-voir-et-editer-mon-projet)


### Comment gérer la confidentialité des projets dans un programme ?

Dans AirSaas, la gestion de la confidentialité fonctionne selon ces principes :

**Pour les projets privés dans un programme :**
- Un utilisateur n'a accès qu'aux projets privés où il est explicitement ajouté
- Les autres projets privés du programme restent invisibles pour lui
- Cela permet de compartimenter l'information par direction ou équipe

**Pour les responsables de jalons :**
- Une personne peut être responsable d'un jalon sans avoir accès au projet complet
- Elle verra uniquement le jalon qui lui est assigné
- C'est idéal pour des collaborations ponctuelles sans exposer toutes les informations du projet

**Cas d'usage typique :** Plan de transformation avec des actions confidentielles par direction, où certains utilisateurs interviennent sur des jalons spécifiques sans accéder à l'ensemble du projet.


### Comment gérer la confidentialité d'un programme et ses projets ?

Les programmes ne peuvent pas être rendus privés dans AirSaas. Voici comment gérer la confidentialité :

**Pour un programme confidentiel :**
1. Créez chaque projet en mode **privé**
2. Ajoutez manuellement les membres autorisés sur chaque projet
3. Utilisez une smartview tableau avec l'attribut "personnes impliquées" pour gagner du temps
4. Partagez manuellement les smartviews nécessaires

**Astuce pour gagner du temps :**
- Créez un rôle générique (ex: "Suivi confidentiel") qui englobe la majorité des utilisateurs
- Ajoutez ce rôle + les rôles spécifiques sur chaque projet
- Vous pouvez ajouter des personnes directement depuis une smartview sans ouvrir chaque projet

**Recommandation :** Pour un plan stratégique COMEX, définissez dès le départ quand le projet deviendra public.


### Quelle est la différence entre les rôles projet et les droits d'accès AirSaas ?

**Il existe deux types de rôles dans AirSaas :**

**1. Les droits d'accès AirSaas** (au niveau de votre organisation)
- Administrateur : peut tout faire, gérer les utilisateurs et les paramètres
- Ambassadeur : peut créer des projets et inviter des utilisateurs
- Créateur : peut créer et gérer ses propres projets
- Contributeur : peut participer aux projets où il est ajouté
- Observateur : accès en lecture seule

**2. Les rôles dans un projet** (au niveau de chaque projet)
- Responsable du projet
- Sponsor
- Personne impliquée
- Autres rôles personnalisés selon vos besoins

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Quels sont les droits nécessaires pour créer et modifier des jalons ?

Les droits sur les jalons dépendent du rôle utilisateur dans votre espace AirSaas :

**Contributeurs** :
- Peuvent voir les jalons existants
- Ne peuvent PAS créer de nouveaux jalons
- Ne peuvent PAS modifier les jalons existants
- Ne peuvent PAS éditer les propriétés des projets

**Créateurs** :
- Ont tous les droits sur les jalons (voir, créer, modifier)
- Peuvent éditer les propriétés des projets

**Solution** : Si un contributeur a besoin de gérer les jalons, un administrateur doit modifier son rôle en Créateur.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment obtenir les droits pour modifier des jalons créés par d'autres utilisateurs ?

Pour pouvoir modifier des jalons créés par d'autres utilisateurs, votre rôle doit être au minimum **Créateur**.

**Si vous êtes actuellement Contributeur :**
- Demandez à un administrateur de votre organisation d'augmenter votre rôle
- L'administrateur peut faire cette modification depuis les paramètres utilisateurs
- Une fois votre rôle mis à jour en "Créateur" ou plus, vous pourrez modifier tous les jalons du projet

**Les différents niveaux de droits :**
- **Contributeur** : peut consulter et commenter, mais pas modifier les jalons
- **Créateur** : peut créer et modifier les jalons
- **Ambassadeur** et **Administrateur** : droits complets incluant la modification des jalons

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Un contributeur peut-il créer des jalons ?

**Non**, un contributeur ne peut pas créer de jalons.

**Permissions de création de jalons par rôle :**
- **Observateur** : ❌ Ne peut pas créer de jalons
- **Contributeur** : ❌ Ne peut pas créer de jalons
- **Créateur** : ✅ Peut créer des jalons
- **Ambassadeur** : ✅ Peut créer des jalons
- **Administrateur** : ✅ Peut créer des jalons

**Conseil :** Si vous avez des utilisateurs qui doivent créer des jalons mais que vous ne souhaitez pas leur donner les permissions étendues d'un ambassadeur (comme la modification des attributs personnalisés), le rôle "Créateur" est le plus adapté.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Pourquoi je ne peux pas modifier les informations d'un projet en tant qu'externe ?

La modification des propriétés d'un projet ne dépend pas de votre statut d'externe, mais du **rôle** qui vous a été assigné.

**Les différents rôles et leurs droits :**
- **Contributeur** : ne peut pas modifier les propriétés des projets
- **Créateur** : peut modifier la plupart des propriétés des projets
- **Administrateur** : accès complet

**Pour obtenir plus de droits :**
1. Demandez à un administrateur de votre organisation
2. L'admin doit vous passer du rôle "Contributeur" au rôle "Créateur"
3. Une fois le changement effectué, vous pourrez modifier les propriétés des projets

**Note importante** : Même avec le rôle Créateur, certaines données sensibles (score MAREVA, budgets) restent par défaut cachées aux externes. Un admin peut vous autoriser spécifiquement à y accéder via "Modifier l'accès" sur votre profil.

**Ressources utiles :**
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment accéder aux budgets et données sensibles en tant qu'externe ?

Par défaut, les données sensibles (score MAREVA, budgets) ne sont **pas visibles aux utilisateurs externes**, même avec le rôle Créateur.

**Pour y accéder :**
1. Un **administrateur** doit vous autoriser spécifiquement
2. L'admin doit cliquer sur "Modifier l'accès" depuis votre profil
3. Il peut alors vous donner accès aux données sensibles

**Important** : Seuls les **administrateurs** peuvent effectuer cette action. Les ambassadeurs ne peuvent pas modifier ces accès, même s'ils voient l'option dans l'interface.

**Si les modifications ne sont pas prises en compte :**
- Vérifiez que la personne qui tente de modifier vos accès est bien administrateur
- Si c'est un ambassadeur, demandez à un administrateur de faire la modification


### Quels sont les droits d'un externe project leader sur un projet ?

**Le rôle de project leader ne suffit pas**

Être désigné comme project leader d'un projet ne donne pas automatiquement les droits de modification. Les permissions dépendent du rôle global de l'utilisateur dans l'espace de travail.

**Permissions selon le rôle**

**Contributeur** (même si project leader) :
- Peut poster des messages dans le projet
- Peut commenter
- **Ne peut PAS modifier les attributs du projet**
- Ne peut pas créer de projets privés

**Créateur** :
- Peut modifier les attributs des projets publics
- Peut modifier les attributs des projets privés où il est impliqué
- Peut créer des projets publics
- Peut faire tout ce que fait un contributeur

**Solution pour les externes project leaders**

Si vous avez des externes qui doivent gérer des projets en tant que project leaders, vous devez :
1. Les passer du rôle "Contributeur" au rôle "Créateur"
2. Accepter qu'ils puissent techniquement créer des projets publics (limitation actuelle)

**Note** : Il manque actuellement un profil intermédiaire qui permettrait de modifier les attributs sans pouvoir créer des projets.


### Les utilisateurs externes peuvent-ils accéder à l'onglet Stratégie/Programmes ?

**Non**, les utilisateurs externes n'ont pas accès à l'onglet "Stratégie > Programmes" par mesure de sécurité.

**Comment un externe accède à ses programmes :**
- Depuis sa **page d'accueil**, dans la colonne de gauche
- Il voit uniquement les programmes dont il est responsable
- En cliquant dessus, il accède bien à la page complète du programme

**Pourquoi cette limitation ?**
Pour éviter que les externes aient accès à l'ensemble des programmes de l'organisation. C'est une mesure de confidentialité volontaire.

**Note** : Même avec un profil "créateur" et tous les droits possibles, cette limitation s'applique aux externes.

**Ressources utiles :**
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)


### Quelles sont les limitations de visibilité pour les utilisateurs externes ?

Les utilisateurs externes ont des accès limités pour protéger la confidentialité de votre portfolio :

**Ce qu'un externe PEUT voir :**
- Ses vues privées personnelles
- Les vues privées que d'autres utilisateurs lui ont explicitement partagées
- Les projets sur lesquels il est ajouté

**Ce qu'un externe NE PEUT PAS voir :**
- Les vues publiques du portfolio
- Les programmes
- Les quarter plans
- L'ensemble des projets publics de l'organisation

Cette limitation est volontaire : les vues publiques et programmes n'ont de sens que si l'utilisateur peut voir l'ensemble des informations. Or un externe n'a accès qu'aux projets spécifiques sur lesquels il travaille.

**Solution :** Pour donner accès à une vue spécifique à un externe, créez une vue privée et partagez-la avec lui.

**Ressources utiles :**
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)
- [Partagez vos vues privées du portfolio 💌](https://club.airsaas.io/c/ca-vient-de-sortir/partagez-vos-vues-privees-du-portfolio)


### Pourquoi certains attributs sont grisés quand je crée une vue en tant qu'utilisateur externe ?

**Comportement par défaut**
Les attributs personnalisés sont par défaut inaccessibles aux profils externes pour des raisons de confidentialité.

**Solution**
Demandez à votre administrateur AirSaas de vous donner accès aux attributs personnalisés dont vous avez besoin.

**Attributs disponibles**
En attendant, scrollez dans la liste de choix : vous verrez d'autres propriétés standards qui sont déjà sélectionnables pour créer vos vues.

**Ressources utiles :**
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)


### Comment partager une vue du portfolio avec des utilisateurs externes ?

**Situation actuelle**

Les utilisateurs externes ne peuvent pas accéder aux vues publiques du portfolio. Pour partager une vue avec des externes, vous devez :

1. Créer une vue privée (et non publique)
2. Ajouter manuellement chaque utilisateur externe et interne à cette vue
3. Appliquer les filtres souhaités (par exemple sur les programmes)

**Points d'attention**
- Si la liste des externes change fréquemment, vous devrez mettre à jour manuellement la liste des personnes ayant accès à la vue
- Les externes ont des restrictions sur certaines parties des projets selon leur rôle
- Même avec une vue publique (si la fonctionnalité était disponible), deux externes ne verraient pas forcément les mêmes projets car ils ne voient que ceux auxquels ils participent

**Alternative suggérée**

Selon votre contexte, il peut être pertinent de considérer certains externes comme des "internes durant la période de transition" s'ils ont besoin d'un accès élargi.

**Évolution prévue**

L'équipe AirSaas étudie la possibilité de permettre aux externes d'accéder aux vues publiques, mais cette fonctionnalité n'est pas encore disponible.

**Ressources utiles :**
- [Partagez vos vues privées du portfolio 💌](https://club.airsaas.io/c/ca-vient-de-sortir/partagez-vos-vues-privees-du-portfolio)


### Comment donner accès en consultation à la direction sur certains projets ?

Il existe deux approches pour donner de la visibilité à la direction, selon que vos projets sont publics ou privés :

**Pour des projets publics** (recommandé) :
1. Assurez-vous que les membres de la direction ont un compte **Lecteur** sur AirSaas
2. Créez une vue publique du portefeuille projet filtrée sur les projets pertinents
3. Partagez le lien de cette vue avec eux

**Avantages** : Pas besoin de les ajouter individuellement aux projets, vue centralisée et mise à jour automatique

**Alternative - A

---

## Jalons et dépendances

### Comment visualiser et piloter les dépendances entre projets ?

**Visualisation des dépendances actuelles**

Pour l'instant, AirSaas ne propose pas de filtre direct pour afficher uniquement les jalons avec des dépendances bloquantes. Cependant, voici les options disponibles :

- **Vue Timeline** : Affiche les liens de dépendance entre jalons
- **Portfolio de jalons** : Permet de voir tous les jalons avec leurs dates et responsables
- **Attributs personnalisés** : Créez un attribut pour marquer manuellement les jalons critiques

**Besoins identifiés pour le pilotage des dépendances**

Les utilisateurs recherchent généralement :
- Liste des projets avec jalons à dépendances bloquantes
- Dates et responsables des jalons
- Alertes si la date d'un prérequis dépasse celle du jalon dépendant
- Description des dépendances
- Vue roadmap ou tableau de bord dédié

**Solution temporaire**

En attendant une fonctionnalité dédiée :
1. Utilisez la vue Timeline pour visualiser les dépendances
2. Créez une vue Smart View filtrée sur vos projets critiques
3. Documentez les dépendances dans les descriptions de jalons
4. Utilisez les points d'attention pour signaler les risques de blocage

**Ressources utiles :**
- [Les dépendances de jalons, pour de vrai !](https://club.airsaas.io/c/ca-vient-de-sortir/help-les-dependances-de-jalons)


### Comment créer une dépendance bloquante entre jalons ?

Lorsque vous créez une dépendance bloquante entre jalons, certains jalons peuvent apparaître **grisés** et non sélectionnables.

**Raison** : Un jalon ne peut bloquer que des jalons **futurs**. Si le jalon cible a une date antérieure ou égale au jalon source, il sera grisé.

**Exemple** :
- Jalon A : 15 mars 2026
- Jalon B : 10 mars 2026
→ Le jalon A ne peut pas bloquer le jalon B car B est antérieur

**Solution** : Vérifiez les dates de vos jalons. Le jalon bloquant doit toujours avoir une date antérieure au jalon bloqué.

**Astuce** : Passez votre souris sur un jalon grisé pour voir une infobulle explicative.

**Ressources utiles :**
- [Les dépendances de jalons, pour de vrai !](https://club.airsaas.io/c/ca-vient-de-sortir/help-les-dependances-de-jalons)


### Comment gérer des jalons avec plusieurs équipes ?

**Depuis février 2026**, AirSaas permet d'associer plusieurs équipes à un même jalon et de déclarer des efforts distincts pour chacune.

**Comment faire :**
1. Ouvrez le jalon concerné
2. Dans la section "Équipes", ajoutez toutes les équipes participantes
3. Pour chaque équipe, vous pouvez déclarer un effort spécifique
4. Le suivi de charge se fait ensuite par équipe dans les vues capacitaires

**Avantages :**
- Meilleure visibilité sur la répartition de la charge entre équipes
- Suivi plus précis des efforts par équipe
- Capacité planning plus réaliste

**Note :** Si vous utilisez le Quarter Plan, cette fonctionnalité est particulièrement utile pour les équipes participant aux jalons du quarter.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)
- [Déclarer les efforts consommés au jalon ⏳](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)


### Comment étendre un jalon non terminé au trimestre suivant ?

Lorsqu'un jalon n'est pas terminé à la fin d'un trimestre, vous pouvez l'étendre au trimestre suivant :

**Méthode recommandée :**
1. Ouvrez la page détaillée du jalon (pas depuis le tableau du Quarter Plan)
2. Utilisez la fonction d'extension pour créer automatiquement une partie 2/2
3. Sur cette nouvelle extension, définissez manuellement la charge restante (RAF)

**Points importants :**
- L'extension crée une nouvelle partie du jalon (ex: "2/2 Livraison") qui conserve l'historique
- La charge restante n'est pas calculée automatiquement, vous devez la saisir
- **Calcul du RAF suggéré** : RAF = Effort estimé initial - Effort consommé (ajustez selon la dérive projet)
- La partie 2/2 sera prise en compte dans le capacitaire du nouveau trimestre

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)


### Comment identifier et gérer les jalons étendus dans le Quarter Plan ?

Lorsqu'un jalon est étendu au quarter suivant, AirSaas propose plusieurs moyens de l'identifier :

**Identification automatique :**
- Un indicateur **"1/2"** apparaît automatiquement sur les jalons étendus
- Cet indicateur montre que le jalon s'étend sur plusieurs quarters

**Statut personnalisé (optionnel) :**
- Demandez au support d'ajouter un statut **"Jalon étendu"**
- Une fois créé, appliquez manuellement ce statut après avoir étendu un jalon
- Permet de filtrer facilement les jalons étendus dans vos vues

**Bonnes pratiques :**
- Utilisez le statut "Jalon étendu" pour isoler ces jalons des jalons normalement en cours
- Créez une vue dédiée pour suivre spécifiquement les jalons étendus
- Documentez la raison de l'extension dans les commentaires du jalon

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Comment être alerté des modifications sur les jalons dont dépend mon projet ?

**Fonctionnalité en développement**

AirSaas prévoit de mettre en place un système d'alertes automatiques pour vous prévenir lorsqu'un jalon prérequis est modifié ou supprimé.

**Ce qui est prévu :**
- Notification automatique au chef de projet du projet impacté
- Alerte en cas de modification de date d'un jalon prérequis
- Alerte en cas de suppression d'un jalon prérequis

**En attendant cette fonctionnalité :**
- Utilisez la vue des dépendances pour visualiser les liens entre jalons
- Communiquez régulièrement avec les chefs de projet des projets liés
- Documentez les dépendances critiques dans les points d'attention

**Ressources utiles :**
- [Être au courant des impacts quand on décale un jalon](https://club.airsaas.io/c/ca-vient-de-sortir/etre-au-courant-des-impacts-quand-on-decale-un-jalon)


### Comment gérer des jalons qui s'étendent sur plusieurs quarters ?

**État actuel des extensions de jalons :**
- Les extensions apparaissent comme des jalons distincts dans la timeline
- Vous devez créer manuellement une extension pour chaque quarter
- Vous ne pouvez créer une extension que pour le quarter suivant (pas au-delà)

**Limitations actuelles :**
- Pas de visualisation unifiée d'un jalon et ses extensions
- Pas de saisie directe début/fin avec découpage automatique
- Risque d'oubli pour les projets long terme

**Évolutions demandées (pas encore disponibles) :**
1. Affichage continu des extensions comme un seul jalon
2. Saisie de dates début/fin avec découpage automatique par quarter
3. Création d'extensions sur plusieurs quarters d'avance

**En attendant :**
- Utilisez les extensions quarter par quarter
- Épinglez-les pour les voir dans les présentations
- Notez dans vos jalons les dates cibles long terme

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/ca-vient-de-sortir/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Pourquoi la progression de mes jalons ne se met pas à jour automatiquement ?

Lorsqu'un jalon passe au statut "terminé", sa progression devrait automatiquement passer à 100%. Si ce n'est pas le cas :

**Vérifications à effectuer :**
- Assurez-vous que le jalon a bien été marqué comme terminé directement dans AirSaas
- Pour les jalons synchronisés via une intégration (Asana, Jira, etc.), vérifiez que la synchronisation s'est bien effectuée

**Solution temporaire :**
1. Passez manuellement la progression de chaque jalon terminé à 100%
2. Cela mettra automatiquement à jour l'avancement global du projet

**Note :** Les jalons créés avant la mise en place du mécanisme automatique (jalons "historiques") peuvent nécessiter une mise à jour manuelle de leur progression.

**Ressources utiles :**
- [Déclarer les efforts consommés au jalon](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)


### Comment visualiser les dépendances entre jalons dans les vues ?

Les dépendances entre jalons s'affichent différemment selon leur nature et la vue utilisée :

**Dépendances inter-projets :**
- Visibles sur les vues timeline et roadmap
- Représentées par des flèches reliant les jalons entre différents projets
- Permettent d'identifier les chemins critiques du portfolio

**Dépendances intra-projet (au sein du même projet) :**
- Visibles uniquement sur la ligne du projet parent dans la timeline
- Représentées par une petite flèche entre les jalons concernés
- Ne s'affichent PAS quand vous ouvrez le détail du projet

**Dans les vues tableau :**
- Les indicateurs de dépendances ne sont pas visibles directement
- Vous devez ouvrir le détail du jalon pour consulter ses dépendances

**Note :** L'équipe produit a été informée du besoin d'améliorer la visualisation des dépendances pour le pilotage à la maille chef de projet.

**Ressources utiles :**
- [Les dépendances de jalons, pour de vrai !](https://club.airsaas.io/c/ca-vient-de-sortir/help-les-dependances-de-jalons)
- [Être au courant des impacts quand on décale un jalon 😱](https://club.airsaas.io/c/ca-vient-de-sortir/etre-au-courant-des-impacts-quand-on-decale-un-jalon)
- [Visualisation des projets avec dépendances bloquantes](https://club.airsaas.io/c/utilisateurs-d-airsaas/visualisation-des-projets-avec-dependances-bloquantes)


### Comment dupliquer un jalon ?

La duplication de jalons est maintenant disponible sur AirSaas !

**Pour dupliquer un jalon :**
1. Ouvrez le jalon à dupliquer
2. Cliquez sur le menu à 3 points
3. Sélectionnez "Dupliquer"
4. Modifiez le titre et les dates du nouveau jalon

**Éléments dupliqués :**
- Description et livrables attendus
- Équipes assignées
- Attributs personnalisés
- Poids et effort estimé

**Note :** Les dates et le statut d'avancement ne sont pas dupliqués.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Comment réorganiser l'ordre des jalons ?

**Situation actuelle** : Les jalons s'affichent dans l'ordre de création et ne peuvent pas être réorganisés manuellement.

**Solutions de contournement :**
1. **Planification** : Créez vos jalons dans l'ordre chronologique souhaité dès le départ
2. **Duplication** : Utilisez la fonction de duplication de jalons pour recréer rapidement les jalons dans le bon ordre
3. **Vue chronologique** : Utilisez la vue timeline qui affiche automatiquement les jalons par ordre de date
4. **Tri par date** : Dans le panneau latéral du projet, les jalons sont triés par date d'échéance

**Évolutions à venir** : L'équipe produit travaille sur :
- La possibilité de réorganiser les jalons par glisser-déposer
- L'ajout de codes couleur pour catégoriser les jalons (par phase, équipe, typologie)
- Des options de tri (alphabétique, par date, par statut)

**Astuce** : En attendant, nommez vos jalons avec un préfixe numérique (1-, 2-, 3-) pour forcer un ordre d'affichage.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Comment mettre à jour la météo des jalons depuis le portfolio ?

Pour mettre à jour la météo d'un jalon depuis le portfolio :

**Depuis une vue tableau** :
- Cliquez sur l'icône météo du jalon
- Sélectionnez la nouvelle météo
- Ajoutez un commentaire d'explication
- Cliquez sur 'Changer la météo'

**Note** : La mise à jour depuis une vue timeline fonctionne également. Si vous rencontrez des difficultés, essayez de rafraîchir la page ou de passer temporairement en vue tableau.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Comment créer un jalon dans un projet ?

Pour créer un jalon dans votre projet :

1. Ouvrez la fiche de votre projet
2. Accédez au panel **"Jalons"** (dans la barre latérale)
3. Cliquez sur **"Ajouter un jalon"** en haut à droite
4. Remplissez les champs obligatoires :
   - Nom du jalon
   - Date de fin prévue
   - Effort précis (optionnel, pour les estimations)
5. Validez la création

**Prérequis :** Vous devez avoir au minimum le rôle **Créateur** pour pouvoir ajouter des jalons.

**Ressources utiles :**
- [Comment utiliser les jalons ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-utiliser-les-jalons)


### Comment ajouter des estimations d'effort sur un jalon ?

Pour renseigner les estimations d'un jalon, utilisez le champ **"Effort précis"** :

**Lors de la création d'un jalon :**
- Dans le formulaire de création, remplissez le champ "Effort précis"
- Indiquez le nombre de jours/homme estimés

**Pour un jalon existant :**
1. Ouvrez la fiche du jalon
2. Cliquez sur le bouton d'édition
3. Modifiez le champ "Effort précis"
4. Sauvegardez vos modifications

Ces estimations permettent ensuite de :
- Calculer la charge totale du projet
- Suivre le consommé vs. le planifié
- Gérer la capacité des équipes

**Ressources utiles :**
- [Déclarer les efforts consommés au jalon ⏳](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)


### Comment regrouper les jalons par programme ?

**Bonne nouvelle !** Suite aux demandes de plusieurs clients, il est maintenant possible de regrouper vos jalons par programme.

**Pour activer ce regroupement** :

1. Allez dans le portfolio des jalons
2. Créez ou éditez une vue
3. Dans les options de regroupement, sélectionnez "Programme"
4. Vos jalons seront automatiquement organisés par programme

**Avantages** :
- Vue consolidée de l'avancement par programme
- Meilleure lisibilité pour le suivi des jalons
- Facilite les revues de programme en montrant tous les jalons associés

**Note** : Cette fonctionnalité fait partie des améliorations continues du module jalons. Si vous ne voyez pas l'option de regroupement par programme, contactez votre administrateur pour vérifier que vous disposez de la dernière version.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Comment faire apparaître les extensions de jalons dans les présentations ?

Les extensions de jalons n'apparaissent pas automatiquement dans la timeline des présentations. Voici comment les afficher :

**Solution immédiate :**
1. Ouvrez le jalon concerné
2. Sur chaque extension, cliquez sur l'icône **📌 Épingler**
3. Les extensions épinglées apparaîtront dans la présentation

**Pourquoi ce comportement ?**
- Les extensions ne sont pas épinglées par défaut (comportement qui sera corrigé)
- Seuls les jalons épinglés apparaissent dans les présentations

**À noter :** L'équipe AirSaas travaille sur une correction pour épingler automatiquement les extensions.

**Ressources utiles :**
- [Choisir les jalons affichés dans la présentation](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-les-jalons-affiches-dans-la-presentation)


### Comment identifier le chemin critique à travers les dépendances ?

**Fonctionnalité en cours d'analyse**

La visualisation complète des dépendances en cascade pour identifier le chemin critique est un besoin identifié par l'équipe AirSaas.

**Objectif visé :**
- Visualiser toutes les dépendances en cascade (pas seulement le niveau direct)
- Identifier automatiquement le chemin critique
- Comprendre l'impact complet d'un retard

**Solutions actuelles :**
- Utilisez la vue Timeline pour voir les dépendances directes
- Documentez manuellement les chemins critiques dans la description du programme
- Créez des jalons "points de synchronisation" pour matérialiser les étapes critiques

**Bonnes pratiques :**
- Limitez le nombre de niveaux de dépendances (3 maximum recommandé)
- Identifiez et documentez vos "jalons de convergence" critiques
- Organisez des revues régulières des dépendances inter-projets


### Comment identifier les jalons en retard dans mes extractions Power BI ?

AirSaas sépare volontairement deux notions complémentaires :
- Le **statut** du jalon (non commencé, en cours, terminé, abandonné)
- L'état de **retard** (basé sur la date d'échéance)

Un jalon peut être "non commencé et en retard" ou "en cours et en retard".

**Solution pour Power BI :**
1. Récupérez la date d'échéance du jalon depuis l'API
2. Comparez-la à la date du jour
3. Créez une propriété calculée "En retard" si :
   - Date échéance < Aujourd'hui
   - ET statut ≠ "Terminé" ou "Abandonné"

**Exemple de formule Power BI :**
```
En retard = IF(
    AND(
        [Date échéance] < TODAY(),
        NOT([Statut] IN {"Terminé", "Abandonné"})
    ),
    "En retard",
    "Dans les temps"
)
```

Cette approche vous permet de créer vos propres visualisations combinant statut et retard.


### À quoi sert le poids des jalons ?

**Le poids des jalons : un coefficient de pondération**

Le poids d'un jalon sert à calculer l'avancement global des jalons du projet. Plus un jalon a un poids élevé, plus son avancement impacte l'avancement global.

**Exemple de calcul**
- Jalon A : 50% d'avancement, poids 3
- Jalon B : 100% d'avancement, poids 1
- Avancement global = (50% × 3 + 100% × 1) / (3 + 1) = 62,5%

**Comment réinitialiser le poids ?**
Le poids est un **attribut obligatoire** qui ne peut pas être supprimé. La valeur par défaut est **1**, qui équivaut à un poids neutre. Si vous avez modifié le poids par erreur, remettez simplement la valeur à **1**.

**Alternative suggérée : utiliser l'effort**

Certains clients préfèrent utiliser l'effort (charge de travail) plutôt que le poids pour la pondération, ce qui peut être plus représentatif dans un contexte de gestion quantitative des projets.

**Ressources utiles :**
- [🏋️‍♀️ Le poids des jalons, c'est quoi ?](https://club.airsaas.io/c/utilisateurs-d-airsaas/le-poids-des-jalons-c-est-quoi)


### Que faire quand mon intégration (Asana, Jira, Monday) ne fonctionne plus ?

**Symptômes courants**
- Les listes déroulantes sont vides lors de la création de projets
- Impossible de synchroniser les données
- Erreurs lors de l'utilisation de l'intégration

**Vérification du statut**
1. Allez dans Automatisation > Intégrations
2. Vérifiez le statut de votre intégration (vert = OK, rouge = déconnecté)

**Si le statut est rouge**
- La personne qui a initialement connecté l'intégration doit se reconnecter
- Cliquez sur "Reconnecter" sur la page de l'intégration
- Suivez le processus d'authentification

**Causes possibles de déconnexion**
- L'utilisateur a révoqué l'accès côté Asana/Jira/Monday
- Changement de mot de passe
- Politique de sécurité forçant une reconnexion périodique
- L'utilisateur a quitté l'organisation

**Prévention**
- Utilisez un compte de service dédié pour les intégrations
- Documentez qui gère chaque intégration
- Vérifiez régulièrement le statut des connexions

**Ressources utiles :**
- [Connectez vos projets avec Jira et Asana](https://club.airsaas.io/c/ca-vient-de-sortir/connectez-vos-projets-avec-jira-et-asana-pour-noel)


### Comment activer l'intégration Microsoft Teams ?

L'intégration MS Teams permet de recevoir les notifications AirSaas directement dans Teams et de synchroniser vos projets avec des canaux Teams.

**Prérequis :**
- Être administrateur AirSaas
- L'admin Teams doit également être admin AirSaas (ou être présent lors de la configuration)
- Avoir les droits pour installer des applications dans votre tenant Teams

**Pour activer l'intégration :**
1. Consultez le guide complet : [AirSaas et MS Teams](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)
2. Deux options :
   - **Autonome** : Suivez le guide étape par étape
   - **Accompagné** : Réservez un créneau avec le support pour une configuration guidée

**Fonctionnalités disponibles :**
- Notifications personnelles dans Teams
- Connexion projet/programme AirSaas ↔ canal Teams
- Posts automatiques des mises à jour importantes
- Notifications des décisions à prendre et points d'attention

**Important :** Prévoyez 30 minutes pour la configuration initiale, idéalement avec votre admin Teams.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)


### Pourquoi mon intégration Teams ne fonctionne plus ?

Si votre intégration Teams affiche une erreur (croix rouge) même après reconnexion, vérifiez ces points :

**1. Le compte qui a créé l'intégration est-il toujours actif ?**
- Si la personne qui a connecté Teams a été désactivée dans AirSaas, l'intégration ne fonctionnera plus
- Solution : Un administrateur Teams actif doit reconnecter l'intégration

**2. Avez-vous les droits suffisants ?**
- Seul un administrateur Teams peut créer/reconnecter l'intégration
- Les utilisateurs standards ne peuvent pas réparer une intégration défaillante

**3. Bonnes pratiques :**
- L'administrateur Teams qui installe l'intégration doit rester administrateur AirSaas
- Ne désactivez pas le compte de la personne qui gère les intégrations
- Si cette personne doit partir, transférez d'abord les intégrations à un autre admin

**Note** : Nous vérifions actuellement s'il est possible de passer l'utilisateur qui gère l'intégration en mode 'Observateur' sans casser la connexion.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)
- [Synchroniser votre projet AirSaas avec MS Teams 🫶](https://club.airsaas.io/c/ca-vient-de-sortir/synchroniser-votre-projet-airsaas-avec-ms-teams)


### Comment connecter AirSaas avec Microsoft Teams et Planner ?

**Configuration de Microsoft Teams :**

1. Allez dans les paramètres d'intégrations d'AirSaas
2. Connectez votre compte Teams et autorisez les permissions
3. Créez un workflow pour lier un projet à un canal Teams
4. Si le workflow affiche un warning, installez l'app AirSaas dans votre équipe Teams :
   - Allez dans les paramètres de l'équipe sur Teams
   - Section "Apps"
   - Ajoutez l'application AirSaas
5. Le workflow devrait passer au vert une fois l'app installée

**Configuration de Microsoft Planner :**

1. Connectez votre compte Microsoft avec les droits administrateur
2. Autorisez les permissions demandées
3. Créez un workflow pour synchroniser vos jalons avec Planner
4. Sélectionnez l'équipe Teams dans la liste déroulante

**Note :** Si vous rencontrez une erreur 500 avec Planner ou si la liste des équipes ne s'affiche pas, contactez le support car cela peut être un problème temporaire de synchronisation.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)
- [Intégration MS Planner ✅ !](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)


### Quelles intégrations Microsoft sont disponibles dans AirSaas ?

**Intégrations Microsoft disponibles** :

✅ **Microsoft Planner**
- Intégration native disponible
- Synchronisation des tâches et jalons
- Quelques clients l'utilisent activement
- [En savoir plus](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)

✅ **Microsoft Teams**
- Connexion projets/programmes avec canaux Teams
- Notifications automatiques
- Partage des mises à jour
- [Guide complet](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)

❌ **Microsoft Project**
- Pas d'intégration disponible actuellement
- Alternative : export/import via CSV

**Pour activer une intégration** :
1. Vous devez être admin sur Azure ET admin AirSaas
2. Planifiez un call avec l'équipe support
3. Suivez le processus documenté (similaire à Teams)

**Processus de setup** :
- Durée : environ 30 minutes
- Prérequis : droits admin Azure
- Support : accompagnement par l'équipe AirSaas
- [Réserver un créneau](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)
- [Intégration MS Planner ✅ !](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)


### Comment configurer les templates Monday pour la synchronisation avec AirSaas ?

Pour pouvoir sélectionner un modèle de projet Monday lors de la création depuis AirSaas, une configuration préalable est nécessaire :

**Prérequis :**
- Avoir des templates créés dans Monday
- Récupérer les IDs techniques de ces templates
- Planifier un call avec le support AirSaas

**Configuration (avec le support) :**
1. Le support listera les IDs des templates Monday que vous souhaitez exposer
2. Ces IDs seront configurés dans le backend AirSaas pour votre organisation
3. Les templates apparaîtront ensuite dans l'interface de création

**Important :** Sans cette configuration, seuls les jalons (livrables intermédiaires qu'on doit s'engager à produire dans un trimestre maximum) sont créés dans Monday, pas la structure complète du projet.

**Pour planifier la configuration :** Contactez le support pour un call de 30 minutes où vous définirez ensemble les templates à exposer.

**Ressources utiles :**
- [Nouvelle intégration : Monday](https://club.airsaas.io/c/ca-vient-de-sortir/nouvelle-integration-monday)


### Comment fonctionne le connecteur JIRA et comment le documenter pour mon organisation ?

Le connecteur JIRA d'AirSaas permet de synchroniser vos projets entre les deux outils. Voici comment le préparer :

**Documentation disponible**
- Présentation du fonctionnement général : https://www.figma.com/proto/sZqL9ygFtG2cAnIE3413eT/How-to-get-started-with-Jira-integration--template-
- Cette présentation détaille les objets synchronisés et les flux entre AirSaas et JIRA

**Pour aller plus loin**
- Nous recommandons d'organiser un call avec notre équipe pour :
  - Comprendre vos besoins spécifiques
  - Identifier les objets et flux pertinents pour votre organisation
  - Créer une documentation personnalisée

**Ressources utiles :**
- [Connectez vos projets avec Jira et Asana](https://club.airsaas.io/c/ca-vient-de-sortir/connectez-vos-projets-avec-jira-et-asana-pour-noel)
- [Connectez AirSaas à votre outil de gestion de projet](https://club.airsaas.io/c/debuter-sur-airsaas/connectez-airsaas-a-votre-outil-de-gestion-de-projet)


### Comment connecter AirSaas à Power BI via l'API ?

AirSaas propose une API REST qui permet d'extraire vos données projets pour les exploiter dans Power BI.

**Pour mettre en place cette intégration** :

1. **Contactez l'équipe AirSaas** pour :
   - Obtenir vos clés d'API
   - Comprendre la structure des données disponibles
   - Définir vos besoins spécifiques de reporting

2. **Données accessibles via l'API** :
   - Projets (statuts, dates, budgets, équipes)
   - Jalons (livrables intermédiaires qu'on doit s'engager à produire dans un trimestre maximum) et leur avancement
   - Décisions et points d'attention
   - Attributs personnalisés
   - Données de capacité

3. **Côté Power BI** :
   - Utilisez le connecteur Web pour appeler l'API REST
   - Configurez l'authentification avec vos clés API
   - Créez vos tableaux de bord personnalisés

**Recommandation** : Planifiez un call avec l'équipe AirSaas pour une présentation complète de l'API et un accompagnement sur votre cas d'usage spécifique.


### Comment spécifier l'année lors de la déclaration des efforts consommés via l'API ?

Avec l'introduction des efforts annualisés dans AirSaas, il est maintenant nécessaire de spécifier l'année lors de la déclaration des efforts consommés via l'API.

**Structure requise :**
- Incluez un champ "year" ou "annee" dans votre payload API
- Format attendu : YYYY (ex: 2026)
- L'année doit correspondre à votre année fiscale configurée

**Exemple de structure :**
```
{
  "effort_consomme": 10,
  "year": 2026,
  "equipe_id": "xxx"
}
```

**Important :**
- Si votre année fiscale ne commence pas au 1er janvier, assurez-vous que l'année spécifiée correspond à la bonne période
- Les efforts sans année spécifiée peuvent causer des erreurs d'agrégation

**Ressources utiles :**
- [Estimez les efforts à fournir par les équipes projets, sur plusieurs années](https://club.airsaas.io/c/ca-vient-de-sortir/estimez-les-efforts-a-fournir-par-les-equipes-projets-sur-plusieurs-annees)
- [Découper les budgets par année fiscale](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Quelles intégrations de gestion de projet sont disponibles dans AirSaas ?

AirSaas s'intègre actuellement avec les outils de gestion de projet suivants :

- **Microsoft Planner**
- **Jira**
- **Monday.com**
- **ClickUp**
- **Asana**

**MS Project n'est pas encore supporté**, mais pourrait être ajouté si nous recevons suffisamment de demandes.

Ces intégrations permettent de :
- Synchroniser vos projets et jalons (livrables intermédiaires qu'on doit s'engager à produire dans un trimestre maximum)
- Éviter la double saisie
- Centraliser le pilotage dans AirSaas tout en gardant l'exécution dans votre outil habituel

**Ressources utiles :**
- [Intégration MS Planner ✅ !](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)
- [Connectez vos projets avec Jira et Asana](https://club.airsaas.io/c/ca-vient-de-sortir/connectez-vos-projets-avec-jira-et-asana-pour-noel)


### Problème de mapping des colonnes lors de la synchronisation avec Monday

Si les colonnes de votre board Monday n'apparaissent pas lors de la configuration de la synchronisation :

**Vérifications à effectuer :**
1. **Testez avec un autre board** pour identifier si le problème est spécifique
2. **Vérifiez les colonnes du board Monday :**
   - Pas de changements récents dans les statuts
   - Pas de colonnes avec des caractères spéciaux
   - Board accessible avec les permissions correctes

**Informations à fournir au support :**
- Screenshot des colonnes du board Monday problématique
- Screenshot d'un board qui fonctionne (pour comparaison)
- Nom exact du board et du workspace Monday

**Solutions temporaires :**
- Utilisez un board différent si possible
- Dupliquez un board fonctionnel et adaptez-le

**Note :** Ce type de problème nécessite généralement une investigation technique par le support car il peut être lié à des cas spécifiques de configuration Monday.

**Ressources utiles :**
- [Nouvelle intégration : Monday](https://club.airsaas.io/c/ca-vient-de-sortir/nouvelle-integration-monday)


### L'intégration Teams est activée mais je ne vois pas les canaux dans mes workflows

Si l'intégration Teams apparaît comme activée mais que vous ne voyez aucun canal disponible lors de la création d'un workflow, c'est probablement que l'installation initiale n'est pas dans un bon état.

**Solution :**
1. Allez dans Automatisation > Intégrations > Microsoft Teams
2. Cliquez sur les 3 points (...) en haut et sélectionnez "Déconnecter"
3. Relancez le processus de connexion Teams
4. Attendez l'approbation de votre administrateur MS365

**Note importante :** Si l'approbation par l'admin MS365 ne fonctionne pas, demandez à votre administrateur de venir directement sur AirSaas pour installer l'intégration lui-même. Dans certains cas, l'approbation à distance ne passe pas correctement.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)


### Comment configurer l'intégration complète entre AirSaas et MS Teams ?

L'intégration AirSaas avec MS Teams se fait en deux étapes :

**1. Installation du bot AirSaas** (ce que vous avez déjà)
- Permet de voir vos projets depuis Teams
- Renvoie vers AirSaas pour les actions

**2. Configuration de l'intégration complète depuis le portail**
- Connectez vos projets AirSaas à des canaux Teams spécifiques
- Activez les notifications bidirectionnelles
- Permettez la collaboration directe depuis Teams

**Documentation complète** : https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de

**Note** : Si vous n'avez pas accès à la configuration depuis le portail, vérifiez vos droits d'administrateur ou contactez votre admin AirSaas.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)


### Que faire si la connexion avec une intégration tourne en boucle ?

Si vous rencontrez un problème où la connexion avec une intégration (ClickUp, Asana, Jira, etc.) tourne en boucle sans aboutir, voici les étapes à suivre :

**1. Vérifiez l'état de l'installation précédente**
- Allez dans Paramètres > Intégrations
- Vérifiez si une installation précédente existe encore
- Si oui, supprimez-la complètement avant de recommencer

**2. Pour une nouvelle installation**
- Assurez-vous d'avoir les droits administrateur sur l'outil tiers
- Désactivez temporairement les bloqueurs de publicités
- Utilisez Chrome ou Edge (évitez Safari)
- Autorisez les pop-ups pour AirSaas

**3. Si le problème persiste**
- Notez à quelle étape exacte la connexion bloque
- Contactez le support via le chat en précisant :
  - L'outil que vous essayez de connecter
  - Si vous aviez une connexion fonctionnelle avant
  - L'étape où le processus bloque

**Note :** Si vous aviez supprimé une installation précédente, mentionnez-le au support car cela peut impacter la reconnexion.

**Ressources utiles :**
- [Connectez vos projets avec Jira et Asana](https://club.airsaas.io/c/ca-vient-de-sortir/connectez-vos-projets-avec-jira-et-asana-pour-noel)
- [Intégration MS Planner ✅ !](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)


### Comment mettre en place une intégration entre AirSaas et un outil tiers ?

Pour mettre en place une intégration entre AirSaas et un outil tiers, plusieurs éléments sont à prendre en compte :

**Principes généraux des intégrations AirSaas**
- AirSaas propose des intégrations natives avec certains outils (Jira, Asana, Monday, MS Planner, MS Teams)
- Les intégrations permettent généralement de synchroniser les projets, jalons (livrables intermédiaires qu'on doit s'engager à produire dans un trimestre maximum) et informations clés
- Chaque intégration a ses spécificités selon l'outil cible

**Prérequis techniques**
- Avoir les droits d'administration sur les deux outils
- Disposer des accès API nécessaires
- Définir le périmètre de synchronisation souhaité

**Prérequis organisationnels**
- Identifier les cas d'usage précis (synchronisation unidirectionnelle ou bidirectionnelle)
- Définir les règles de mapping entre les objets des deux systèmes
- Former les équipes aux nouvelles pratiques

**Pour aller plus loin**
Nous recommandons de planifier un rendez-vous avec notre équipe pour étudier votre cas spécifique et vous accompagner dans la mise en place. Contactez le support pour organiser une session de 30 minutes.

**Ressources utiles :**
- [Nouvelle intégration : Monday](https://club.airsaas.io/c/ca-vient-de-sortir/nouvelle-integration-monday)
- [Connectez vos projets avec Jira et Asana](https://club.airsaas.io/c/ca-vient-de-sortir/connectez-vos-projets-avec-jira-et-asana-pour-noel)
- [Intégration MS Planner ✅ !](https://club.airsaas.io/c/ca-vient-de-sortir/integration-ms-planner)


### Comment intégrer Tempo avec AirSaas pour le suivi des coûts humains ?

L'intégration entre Tempo et AirSaas n'est pas encore native, mais plusieurs options s'offrent à vous :

**Solution actuelle** :
- Utilisez l'API AirSaas (bien documentée) pour créer un connecteur custom
- Plusieurs clients ont déjà développé cette intégration avec succès
- Le connecteur permet de pousser les données budgétaires de Tempo vers AirSaas

**Processus type** :
1. Les développeurs déclarent leurs efforts dans Jira/Tempo
2. Les données sont consolidées dans Tempo
3. Le connecteur custom pousse ces données vers AirSaas via l'API
4. Les coûts humains sont mis à jour dans vos projets AirSaas

**Points d'attention** :
- Jira on-premise : l'intégration directe n'est pas possible
- Export depuis Tempo : vérifiez la qualité des données exportées
- Développement : comptez quelques jours de développement pour le connecteur

**Alternative** : En attendant, vous pouvez exporter les données depuis Tempo et les importer manuellement dans AirSaas.

**Ressources utiles :**
- [Quel est le coût humain de nos projets ?](https://club.airsaas.io/c/ca-vient-de-sortir/quel-est-le-cout-humain-de-nos-projets)


### Problèmes d'affichage : le champ titre des jalons n'apparaît pas et le scroll horizontal ne fonctionne pas

Ces deux problèmes d'affichage sont liés au niveau de zoom de votre navigateur.

**Pour le champ titre des jalons qui n'apparaît pas :**
- Le curseur de texte peut devenir invisible à certains niveaux de zoom (notamment autour de 105%)
- **Solution** : Ajustez votre niveau de zoom (Ctrl/Cmd + ou - ou Ctrl/Cmd+0 pour revenir à 100%)
- Le champ titre existe toujours, vous pouvez cliquer dessus et taper même si le curseur n'est pas visible

**Pour le scroll horizontal qui ne fonctionne pas :**
- C'est un problème connu sur lequel l'équipe travaille
- **Solutions de contournement** :
  - Avec une souris : maintenez **Shift + molette** pour scroller horizontalement
  - Avec un touchpad : utilisez le scroll tactile (généralement 2 ou 3 doigts)
  - Réduire le zoom permet aussi de voir plus de contenu sans avoir besoin de scroller

**Note** : L'équipe AirSaas travaille sur une correction permanente de ces problèmes d'affichage.


### Comment ajuster la période affichée sur la timeline d'une roadmap ?

La position temporelle de la timeline est entièrement personnalisable, indépendamment de son contenu :

**Pour ajuster le début de la timeline :**
- Cliquez et maintenez sur la timeline
- Faites glisser horizontalement jusqu'à la position souhaitée
- Relâchez pour fixer la nouvelle position

**Pour ajuster le niveau de zoom :**
- Utilisez les boutons + et - en haut à droite de la vue

**Sauvegarde des réglages :**
Lorsque vous modifiez la position depuis une vue projet, le système vous proposera de sauvegarder ces paramètres pour les retrouver à chaque consultation.

**Note :** La timeline affiche par défaut tous les jalons des projets inclus dans la vue. Si des jalons existent en dehors de votre période cible, vous pouvez simplement ajuster l'affichage sans avoir à modifier vos données.

**Ressources utiles :**
- [Une toute nouvelle timeline, et plein d'améliorations](https://club.airsaas.io/c/ca-vient-de-sortir/une-toute-nouvelle-timeline-et-plein-d-ameliorations)


### Comment créer un nouveau programme ?

Pour créer un nouveau programme :

1. Cliquez sur le **chevron** (petite flèche) à droite du nom de votre programme actuel dans la barre supérieure
2. Une liste déroulante des programmes s'affiche
3. Cliquez sur le bouton **"Créer"** en bas de cette liste

**Note importante** : Seuls les utilisateurs avec le rôle Ambassadeur ou Administrateur peuvent créer des programmes. Les programmes créés sont visibles par tous les membres de l'organisation (pas de notion de programme privé).

**Ressources utiles :**
- [Quels sont les rôles utilisateur disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment voir tous les projets que je suis ?

**Actuellement**, il n'est pas encore possible de voir tous les projets que vous suivez dans une vue consolidée.

**Solution à venir** :
- Un attribut "follow" sera ajouté aux projets
- Vous pourrez cliquer rapidement sur cet attribut pour suivre/ne plus suivre un projet
- Cela permettra de créer des smart views filtrées sur les projets suivis

**En attendant** :
- Utilisez les notifications pour rester informé des mises à jour des projets que vous suivez
- Créez des smart views basées sur d'autres critères (équipe, programme, etc.) pour regrouper vos projets clés


### Comment ouvrir un projet dans un nouvel onglet ?

Pour ouvrir un projet dans un nouvel onglet et conserver votre vue actuelle :

- **Clic droit** sur le nom du projet → sélectionner "Ouvrir dans un nouvel onglet"
- **Clic avec le bouton du milieu** de votre souris (molette) sur le nom du projet
- **Ctrl + clic** (Windows) ou **Cmd + clic** (Mac) sur le nom du projet

**Note** : Il n'existe pas de paramétrage automatique pour forcer l'ouverture systématique dans un nouvel onglet. Cette approche vous permet de choisir au cas par cas si vous souhaitez ouvrir le projet dans l'onglet actuel ou dans un nouveau.


### Comment accéder à la page météo des projets ?

Pour accéder à la page météo des projets :

1. Rafraîchissez votre page (F5 ou Cmd+R)
2. Dans le header principal, cliquez sur **Automatisation**
3. Sélectionnez **Météo des projets**

Cette fonctionnalité vous permet de voir et mettre à jour l'état de santé de tous vos projets publics en un seul endroit.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Puis-je afficher simultanément les informations des projets et de leurs programmes/jalons associés ?

Actuellement, les vues portfolio sont spécialisées par type d'objet (projets, programmes, jalons). Pour voir les informations croisées, vous devez naviguer entre les différentes vues.

**Contournement recommandé :**
- Utilisez cette navigation comme un atout pour structurer vos présentations
- Commencez par une vue macro (programmes) pour donner la synthèse globale
- Puis zoomez sur les projets spécifiques nécessitant attention
- Terminez par les jalons critiques de la période

Cette approche vous permet de :
- Maîtriser le rythme de votre présentation
- Éviter les interruptions sur des détails
- Guider votre audience du général au particulier


### Comment naviguer horizontalement dans une vue kanban ?

Si la barre de défilement horizontale n'apparaît pas automatiquement dans votre vue kanban, vous pouvez naviguer de gauche à droite avec ces méthodes :

**Avec une souris :**
- Maintenez la touche Shift de votre clavier + utilisez la molette de la souris

**Avec un touchpad :**
- Faites un glissé horizontal avec 2 doigts

**Note :** La barre de défilement horizontale peut parfois ne pas s'afficher selon votre navigateur ou configuration. Les méthodes ci-dessus fonctionnent dans tous les cas.


### Comment rechercher un projet par mot-clé ?

**Pour rechercher un projet dans AirSaas :**

- Utilisez la barre de recherche globale en haut de l'interface
- Tapez le nom du projet ou des mots-clés contenus dans le titre
- Les résultats s'affichent en temps réel

**Astuces de recherche :**
- La recherche fonctionne sur les titres de projets
- Vous pouvez aussi filtrer vos vues portfolio pour affiner la recherche
- Utilisez les vues intelligentes pour sauvegarder vos critères de recherche fréquents

💡 **Conseil :** Adoptez une convention de nommage cohérente pour vos projets afin de faciliter les recherches futures.


### Comment rechercher un projet par son numéro ?

La recherche par numéro de projet fonctionne depuis la barre de recherche principale.

**Pour rechercher un projet :**
1. Utilisez la barre de recherche en haut de l'écran
2. Tapez directement le numéro du projet (ex: 216)
3. Le projet apparaît dans les résultats

**Formats acceptés :**
- Numéro seul : 216
- Avec préfixe : #216
- Dans le titre : "216 - Nom du projet"

**Astuce :** La recherche fonctionne aussi avec une partie du nom du projet.


### Comment centrer la timeline sur mes projets actuels ?

La timeline peut parfois s'ouvrir sur une période éloignée de vos projets actuels.

**Solution rapide**
Cliquez sur le bouton "Zoom to fit" en haut à droite de la timeline. Cela centrera automatiquement la vue sur l'ensemble de vos projets, quelle que soit leur période.

**Navigation manuelle**
Vous pouvez aussi :
- Faire défiler horizontalement pour naviguer dans le temps
- Utiliser les boutons de zoom + et - pour ajuster l'échelle temporelle
- Cliquer et glisser sur la timeline pour vous déplacer

**Note** : La timeline ne se centre pas automatiquement sur la date du jour mais sur l'ensemble des projets affichés dans votre vue.

**Ressources utiles :**
- [Une toute nouvelle timeline, et plein d'améliorations](https://club.airsaas.io/c/ca-vient-de-sortir/une-toute-nouvelle-timeline-et-plein-d-ameliorations)


### Pourquoi voit-on l'année en cours lors de la création d'un projet ?

L'interface peut prêter à confusion lors de la création d'un projet pour l'année suivante.

**Points importants :**
- Les **équipes** ne sont pas annualisées, elles sont globales au projet
- Seuls les **efforts** et **budgets** sont annualisés

**Pour un projet démarrant l'année suivante :**
1. À la création, laissez vides les champs d'effort et de budget
2. Une fois le projet créé, accédez aux panneaux Efforts et Budget
3. Vous pourrez alors ajouter l'année souhaitée (2026, 2027...)

**Note :** L'interface affiche l'année en cours par défaut, mais cela n'impacte pas votre projet. Dans quelques jours, l'année suivante s'affichera automatiquement.


### Comment accéder à la liste de tous mes programmes ?

Pour voir tous vos programmes :

1. Allez dans le menu **Stratégie**
2. Cliquez sur **Programmes**
3. Utilisez le bouton dédié pour afficher la liste

**Note :** Il n'existe pas encore de page dédiée qui recense tous les programmes comme pour les projets. Cette fonctionnalité est en réflexion mais n'est pas prévue à court terme.

**Ressources utiles :**
- [Piloter et présenter l'avancée des programmes](https://club.airsaas.io/c/ca-vient-de-sortir/piloter-et-presenter-l-avancee-des-programmes)
- [Suivre les programmes, niveau pro 🏆](https://club.airsaas.io/c/ca-vient-de-sortir/grosse-amelioration-des-programmes)


### Comment sont affichés les pourcentages d'avancement dans le Quarter plan ?

Les pourcentages d'avancement dans le Quarter plan sont affichés avec **une seule décimale** pour une meilleure lisibilité.

Ceci s'applique sur toutes les vues :
- Vue progression par équipe
- Vue Domaine
- Toutes les autres vues du Quarter plan

Si vous constatez des pourcentages avec plus de décimales, n'hésitez pas à le signaler au support.


### Pourquoi je vois des programmes dans 'Mes programmes' alors que je n'y suis pas actif ?

Actuellement, la section **'Mes programmes'** affiche tous les programmes que vous avez créés, même si vous n'y êtes plus actif.

**Ce comportement va être modifié** pour n'afficher que :
- Les programmes où vous avez des projets actifs
- Les programmes que vous suivez explicitement
- Les programmes où vous avez un rôle actif

**En attendant cette amélioration**, vous verrez toujours les programmes que vous avez créés dans cette section, même si vous n'avez aucun projet dans ces programmes.


### Peut-on ouvrir les vues dans un nouvel onglet avec le clic droit ?

Cette fonctionnalité n'est **pas encore disponible** mais elle est prévue dans notre roadmap.

**En attendant**, voici des alternatives :
- Dupliquez votre onglet navigateur actuel (Ctrl+D ou Cmd+D)
- Naviguez ensuite vers la vue souhaitée dans le nouvel onglet
- Utilisez les favoris de votre navigateur pour accéder rapidement à vos vues principales

**À venir** : Le clic droit pour ouvrir dans un nouvel onglet sera ajouté prochainement.


### Peut-on personnaliser l'ordre d'affichage des jalons ?

**Actuellement :** L'ordre d'affichage des jalons est chronologique (basé sur les dates) et ne peut pas être modifié manuellement.

**À venir (septembre 2025) :** AirSaas prévoit d'ajouter la possibilité de :
- Trier les jalons selon différents critères
- Grouper les jalons par catégories
- Personnaliser l'ordre d'affichage dans le panneau des jalons

Cette amélioration permettra une meilleure organisation visuelle et une lecture plus cohérente de vos projets.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Comment sauvegarder la position des colonnes dans les vues ?

La personnalisation de l'ordre des colonnes dans les vues dépend de vos droits utilisateur.

**Pour les Créateurs/Ambassadeurs/Admins :**
- Les modifications de colonnes sont normalement sauvegardées automatiquement pour tous
- Recherchez le bouton **"Sauvegarder pour tous"** qui devrait apparaître après modification
- Si le bouton n'apparaît pas, vérifiez vos droits utilisateur

**Points à vérifier :**
1. Confirmez que vous avez bien le rôle "Créateur" ou supérieur
2. Après avoir déplacé une colonne, cherchez le bouton "Sauvegarder pour tous"
3. Cliquez sur ce bouton pour que la modification soit permanente pour tous les utilisateurs

**Si le problème persiste :**
- Vérifiez que vous n'êtes pas en mode "vue privée"
- Contactez votre administrateur AirSaas pour vérifier vos permissions
- Le support peut investiguer si c'est un problème technique


### Les filtres et tris sont-ils conservés lors de la navigation ?

Actuellement, les tris appliqués sur la page rapport ne sont pas conservés lors d'un changement de page. Cette fonctionnalité a été identifiée comme une amélioration souhaitable pour faciliter la préparation des réunions.

**En attendant cette évolution :**
- Appliquez vos tris à chaque consultation
- Utilisez les vues sauvegardées dans le portfolio pour conserver vos préférences de filtrage

Cette suggestion a été transmise à l'équipe produit pour une future implémentation.


### Comment réduire/développer rapidement toutes les sections dans les vues ?

**Besoin identifié**
Dans la vue Quarter, il n'est actuellement pas possible de réduire toutes les équipes en un seul clic pour masquer les jalons et obtenir une vue d'ensemble simplifiée.

**Solution actuelle**
Vous devez réduire chaque équipe individuellement en cliquant sur chacune d'elles.

**Évolution prévue**
Cette fonctionnalité a été ajoutée à la liste des améliorations possibles suite aux retours utilisateurs. Elle permettrait de :
- Réduire toutes les sections en un clic
- Développer toutes les sections en un clic
- Faciliter la navigation dans les vues complexes


### Pourquoi je ne vois pas les jalons en tant qu'externe ?

**Mise à jour** : Les utilisateurs externes ont maintenant accès aux jalons ! Si vous rencontrez encore des problèmes d'accès, contactez le support.

**Si vous avez des problèmes de performance :**
- Vérifiez votre connexion réseau
- Essayez de rafraîchir la page
- Si le problème persiste uniquement sur certaines pages (comme les jalons), il peut s'agir d'un problème de droits

**Note** : Si vous pouvez accéder à un jalon spécifique via le fil d'actualité mais pas à la liste complète des jalons, contactez le support car cela peut indiquer un problème de configuration.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


---

## Modules et fonctionnalités

### Comment activer l'assistant IA pour les briefs de projets ?

L'assistant IA pour les briefs de projets est une fonctionnalité qui vous aide à mieux cadrer vos projets grâce à l'intelligence artificielle.

**Pour l'activer :**
1. Un administrateur doit valider les CGU spécifiques à l'IA dans les paramètres du workspace
2. Contactez le support AirSaas pour demander l'activation
3. L'équipe vérifiera que votre workspace est éligible
4. Une fois activé, vous verrez apparaître l'option IA lors de la création d'un projet

**Formation recommandée :**
Une session de 30 minutes avec l'équipe AirSaas est proposée pour découvrir toutes les possibilités. Cette formation peut être mutualisée avec plusieurs membres de l'équipe.

**Ressources utiles :**
- [Les briefs projet assistés par IA](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)


### Comment activer le module Priorisation / Gestion de la demande ?

Le module **Priorisation / Gestion de la demande** est une fonctionnalité avancée qui doit être activée par l'équipe AirSaas.

**Si vous voyez le message "Contactez-nous pour activer cette fonctionnalité" :**
- C'est que le module n'est pas encore activé sur votre espace
- Contactez le support via le chat ou votre Customer Success Manager
- L'activation peut nécessiter un ajustement de votre abonnement

**Une fois activé, vous pourrez :**
- Créer des vues "Gestion de la demande"
- Accéder au menu Priorisation
- Gérer le processus de priorisation des projets

**À savoir sur la Priorisation :**
- Par défaut, la priorisation se fait au niveau le plus bas : celui des équipes
- L'équipe en demande priorise toutes ses demandes les unes par rapport aux autres
- Il est possible de passer la priorisation au niveau supérieur, mais cela a beaucoup d'impact sur votre organisation
- Plus tôt ce changement est fait, moins l'impact est grand

**Ressources utiles :**
- [Améliorer le process de gestion de la demande](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande)
- [On améliore le process de priorisation des projets](https://club.airsaas.io/c/ca-vient-de-sortir/on-ameliore-le-process-de-priorisation-des-projets)


### Comment accéder au Capacitaire et au Quarter Plan ?

Le Capacitaire et le Quarter Plan sont des fonctionnalités avancées qui nécessitent une activation par le support.

**Capacitaire :**
- Permet de visualiser la charge de vos équipes sur plusieurs mois/trimestres
- Aide à identifier les surcharges et sous-charges
- Prérequis : avoir défini vos équipes et quelques projets

**Quarter Plan :**
- Planification par trimestre avec engagement sur les livrables intermédiaires à produire dans un trimestre maximum
- Vue consolidée des jalons importants par quarter
- Prérequis : avoir des jalons bien définis et datés

**Pour les activer :**
1. Contactez le support via le chat
2. Le support évaluera avec vous :
   - L'état de votre portfolio (nombre de jalons, complétude)
   - Vos besoins spécifiques
   - L'ordre d'activation recommandé

**Conseil :** Si vous avez peu de jalons complétés, commencez par le Capacitaire seul pour éviter une vue Quarter Plan peu représentative.

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Préparez Q1 2025 avec le nouveau Capacitaire](https://club.airsaas.io/c/ca-vient-de-sortir/preparez-q1-2025-avec-le-nouveau-capacitaire)


### Comment activer la gestion des scénarios ?

**Activation des Scénarios**

La fonctionnalité Scénarios permet de trouver le meilleur équilibre entre vos projets et la capacité réelle de vos équipes.

**Pour activer les Scénarios :**
1. Contactez le support via le chat
2. Précisez le nom de votre workspace
3. L'activation est immédiate
4. Une fois l'activation confirmée, rafraîchissez votre page

**À quoi servent les Scénarios ?**
- Visualiser dynamiquement les contraintes de capacité
- Tester différentes configurations de portfolio
- Maximiser les chances de réussite des projets
- Simuler différentes configurations pour préparer vos quarter plans

**Prérequis**
- Avoir configuré le capacitaire de vos équipes
- Avoir estimé les efforts sur vos projets

**Ressources utiles :**
- [Trouver le meilleur Scénario pour maximiser les réussites](https://club.airsaas.io/c/ca-vient-de-sortir/trouver-le-meilleur-scenario-pour-maximiser-les-reussites)


### Comment activer le Manifeste pour mon organisation ?

Le Manifeste est une fonctionnalité qui permet d'aligner vos équipes sur votre culture projet.

**Pour l'activer :**
1. Contactez le support AirSaas via le chat
2. Précisez le workspace concerné
3. L'activation est généralement effectuée dans la journée

**Accès au Manifeste :**
Le Manifeste est réservé aux **administrateurs** du workspace. Si vous ne le voyez pas :
- Vérifiez votre rôle (Ambassadeur = pas d'accès)
- Demandez à un administrateur de vous passer en rôle administrateur

**Personnalisation disponible :**
- Les couleurs peuvent être adaptées à votre charte graphique sur demande
- La terminologie et les définitions sont personnalisables
- **Limitation** : Le Manifeste est mono-langue (pas de traduction simultanée)

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)
- [Quels sont les différents droits d'accès disponibles ?](https://club.airsaas.io/c/debuter-sur-airsaas/quels-sont-les-roles-utilisateur-disponibles)


### Comment activer la traduction automatique dans les présentations ?

**Le bouton Traduire n'apparaît pas ?**

La fonctionnalité de traduction automatique doit être activée par le support AirSaas pour votre espace de travail.

**Pour l'activer :**
1. Contactez le support via le chat
2. Demandez l'activation de la traduction automatique
3. L'activation est immédiate

**Autres fonctionnalités à activer à la demande :**
- Human cost (coûts humains)
- Users externes
- Et bien d'autres...

**Bon à savoir**
Certaines fonctionnalités ne sont pas activées par défaut pour simplifier l'onboarding. L'activation dépend de votre montée en puissance sur l'outil.

**Pour connaître toutes les options disponibles :**
Demandez au support la liste des feature flags disponibles ou consultez : https://airsaas.slite.page/p/NTYtV95K0UF5tT/Available-feature-flags-and-workspace-configurations

**Ressources utiles :**
- [¿Hola como estas? 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/hola-como-estas)


### Pourquoi certaines fonctionnalités restent bloquées après un changement de licence ?

Après un changement de niveau de licence, certaines fonctionnalités peuvent sembler bloquées pour différentes raisons :

**1. Bot IA**
- Nécessite l'acceptation des CGU spécifiques à l'IA
- Une fois acceptées, l'activation est faite par notre équipe support
- Accessible ensuite lors de la création de projet dans AirSaas

**2. Budgets consolidés (Stratégie > Budget)**
- Cette fonctionnalité est encore en cours de développement
- Sortie prévue fin Q3 / début Q4 2026
- En attendant, vous pouvez utiliser le détail des budgets par projet (disponible sur chaque fiche projet)

**3. Autres fonctionnalités**
Si d'autres fonctionnalités semblent bloquées, contactez le support en précisant lesquelles pour une vérification rapide.

**Bon à savoir :** Certaines fonctionnalités nécessitent une activation manuelle par notre équipe après le changement de licence. N'hésitez pas à nous solliciter.

**Ressources utiles :**
- [Les biefs projet assistés par IA ✨](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)
- [💰 Le détail des budgets et dépenses pour un suivi financier au top](https://club.airsaas.io/c/ca-vient-de-sortir/le-detail-des-budgets-et-depenses-pour-un-suivi-financier-au-top)


### Comment activer les fonctionnalités avancées (Manifeste, Scénario, Coût humain) ?

Certaines fonctionnalités avancées d'AirSaas nécessitent une activation manuelle par notre équipe :

**Fonctionnalités activables sur demande :**
- **Manifeste** : Permet d'aligner vos équipes sur votre culture projet
- **Scénario** : Aide à planifier votre transformation en testant différents scénarios
- **Coût humain des projets** : Calcule automatiquement les coûts RH basés sur les TJM
- **Budget** : Suivi détaillé des budgets projets (Capex/Opex)
- **Capacitaire** : Gestion avancée de la capacité des équipes
- **Quarter Plan** : Planification par trimestre

**Fonctionnalités en accès restreint :**
- **Plan Stratégique** : Actuellement en phase de customisation chez certains clients pilotes

**Comment les activer :**
1. Contactez le support via le chat
2. Précisez quelle(s) fonctionnalité(s) vous souhaitez tester
3. Notre équipe l'activera sous 24h sur votre workspace
4. Une formation peut être organisée si nécessaire

**Bon à savoir :** Ces fonctionnalités sont gratuites pendant la phase de test. Nous vous accompagnons pour évaluer si elles correspondent à vos besoins avant un déploiement plus large.

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet 🌾](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)
- [Trouver le meilleur Scénario pour maximiser les réussites](https://club.airsaas.io/c/ca-vient-de-sortir/trouver-le-meilleur-scenario-pour-maximiser-les-reussites)
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)


---

## Configuration et personnalisation

### Comment personnaliser les sections du Manifeste ?

**Personnalisation du Manifeste**

Vous pouvez activer ou désactiver les différentes sections du Manifeste selon vos besoins :
- Nos commandements
- Vocab (vocabulaire)
- Process
- Et autres sections disponibles

**Pour modifier votre Manifeste :**
1. Contactez le support en précisant :
   - Le nom exact de votre workspace
   - Les sections à activer/désactiver
2. La modification est immédiate

**Important**
- Les couleurs du Manifeste doivent être demandées séparément
- Les couleurs du workspace ne s'appliquent pas automatiquement au Manifeste

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


### Comment modifier la description des attributs natifs dans le manifeste ?

Pour modifier la description d'un attribut natif (comme "Importance") dans le manifeste :

1. Allez dans **Paramètres** (icône engrenage)
2. Cliquez sur **Projets**
3. Sélectionnez **Attributs natifs**
4. Modifiez la description de l'attribut souhaité
5. **Important** : Cliquez en dehors du champ pour sauvegarder automatiquement

**Note :** Si la modification ne se sauvegarde pas, assurez-vous de bien cliquer à l'extérieur du champ de texte avant de quitter la page.

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


### Comment créer un attribut personnalisé (flag) pour les projets ?

En tant qu'administrateur, vous pouvez créer des attributs personnalisés pour enrichir vos fiches projets :

**Étapes** :
1. Accédez aux **Paramètres workspace** (icône engrenage)
2. Cliquez sur l'onglet **Projet**
3. Sélectionnez **Attributs personnalisés**
4. Créez votre nouvel attribut (texte, liste, date, etc.)

**Points importants** :
- L'attribut s'applique automatiquement à **tous les projets** du workspace
- Seuls les administrateurs peuvent créer/modifier des attributs
- Les utilisateurs pourront ensuite renseigner ces attributs dans chaque projet

**Ressources utiles :**
- [Choisir à partir de quand afficher les attributs projet](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-a-partir-de-quand-afficher-les-attributs-projet)


### Pourquoi la météo n'est pas disponible sur certains projets ?

La disponibilité de la météo dépend du statut de votre projet et de la configuration de votre espace.

**Pour vérifier et corriger :**

1. Ouvrez le panneau des attributs affichés sur votre page projet
2. Vérifiez si la météo est activée pour le statut actuel du projet
3. Si la météo n'est pas activée, c'est que dans vos settings, elle est désactivée pour certains statuts (ex: statut de cadrage)

**Pour modifier la configuration (administrateurs uniquement) :**
- Allez dans Settings > Attributs projet
- Configurez sur quels statuts la météo doit être disponible

Cette configuration permet d'adapter l'affichage selon les phases du projet - par exemple, désactiver la météo en phase de cadrage où elle n'est pas encore pertinente.

**Ressources utiles :**
- [Choisir à partir de quand afficher les attributs projet](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-a-partir-de-quand-afficher-les-attributs-projet)


### Comment activer la météo sur un projet en cadrage ?

Par défaut, la météo n'est pas activée pour les projets en cadrage. Elle s'active automatiquement lorsque vous passez le projet en exécution.

Si vous souhaitez l'activer dès la phase de cadrage :

1. Allez sur la page de votre projet
2. Cliquez sur le menu en haut à droite (trois points)
3. Sélectionnez **"Attributs affichés"**
4. Descendez tout en bas du panneau
5. Activez l'option **"Météo"**

La météo apparaîtra alors en haut à droite de votre projet, même en phase de cadrage.

**Ressources utiles :**
- [Choisir à partir de quand afficher les attributs projet](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-a-partir-de-quand-afficher-les-attributs-projet)


### Comment ajouter des modèles de sections dans les projets ?

Vous pouvez créer des modèles de sections personnalisées pour vos projets depuis les paramètres :

**Comment faire :**
1. Accédez aux Settings de votre espace de travail
2. Créez vos modèles personnalisés (ex: "Origine du projet", "Analyse des risques", etc.)
3. Ces modèles apparaîtront lors de la création de nouveaux projets

**Limitations actuelles :**
- Les modèles ne s'appliquent qu'aux **nouveaux projets**
- Impossible d'ajouter des modèles sur des projets existants
- Cette fonctionnalité est prévue pour évoluer : à terme, vous pourrez utiliser les templates sur des projets existants si la section concernée est vide

**Alternative pour les projets existants :**
Si vous avez besoin de cette information sur des projets existants, utilisez temporairement les attributs personnalisés en attendant l'évolution de la fonctionnalité.


### Comment activer et publier le Manifeste de culture projet ?

Le Manifeste est une fonctionnalité qui doit être activée par l'équipe AirSaas pour votre espace.

**Pour activer le Manifeste :**
- Contactez le support via le chat pour demander l'activation
- Une fois activé, actualisez votre page (refresh)

**Pour publier votre Manifeste :**
- Le Manifeste apparaît d'abord en mode draft, visible uniquement aux administrateurs
- Rédigez ou importez votre contenu
- Une fois finalisé, publiez-le pour le rendre accessible à tous les utilisateurs en lecture seule

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


### Comment personnaliser la fréquence de mise à jour météo des projets ?

Actuellement, AirSaas propose des fréquences prédéfinies pour la mise à jour météo des projets (hebdomadaire, mensuelle, trimestrielle).

**Fréquences disponibles :**
- Toutes les semaines
- Tous les mois
- Tous les 3 mois

**Pour des fréquences personnalisées :**
Si votre organisation suit un rythme différent (par exemple toutes les 6 semaines pour des comités de pilotage bimestriels), cette option n'est pas encore disponible. Les fréquences sont actuellement codées en dur dans l'application.

**Astuce pratique :**
En attendant, une bonne pratique partagée par d'autres clients consiste à faire de la météo un des outputs de vos revues de projet. Plutôt que de laisser le chef de projet mettre à jour seul la météo, cela devient l'objectif des 5 dernières minutes d'un COPER ou d'une revue opérationnelle.

**Pour accéder aux paramètres de météo automatique :**
Header > Automatisation > Météo des projets

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Comment reprendre en main un espace AirSaas abandonné ?

Pour reprendre un espace AirSaas qui contient des données obsolètes :

**1. Commencez par un état des lieux**
- Utilisez les vues portfolio pour identifier les projets actifs vs abandonnés
- La vue tableau vous donnera une vision synthétique par statut
- Filtrez par date de dernière mise à jour pour repérer les projets obsolètes

**2. Nettoyez progressivement**
- Archivez les vieux projets terminés ou abandonnés (fonctionnalité disponible depuis octobre 2025)
- Passez en revue les utilisateurs actifs vs inactifs
- Vérifiez les équipes et leur pertinence actuelle

**3. Formez-vous aux bonnes pratiques**
- Le bootcamp AirSaas Expert est recommandé pour une remise à niveau complète
- Les articles du Club AirSaas dans la section "Débuter sur AirSaas" sont un bon point de départ

**Ressources utiles :**
- [Archiver les vieux trucs pour y voir plus clair](https://club.airsaas.io/c/ca-vient-de-sortir/archiver-les-vieux-trucs-pour-y-voir-plus-clair)


### Peut-on personnaliser les statuts de jalons ?

Oui, les statuts de jalons sont entièrement personnalisables ! Vous pouvez :
- **Renommer** les statuts existants (ex: "Non finalisé" → "À valider")
- **Ajouter** de nouveaux statuts selon vos besoins

**Contrainte importante :** Vous devez respecter les 4 groupes de statuts obligatoires, avec au moins un statut dans chaque groupe :
1. **À faire**
2. **En cours**
3. **Fait**
4. **Abandonné**

**Exemple :** Vous ne pouvez pas supprimer tous les statuts "Abandonné", mais vous pouvez les renommer ou en ajouter d'autres dans cette catégorie.

**Note :** Cette personnalisation doit être effectuée par le support AirSaas. Contactez l'équipe pour mettre en place vos statuts personnalisés.


### Comment mettre à jour le logo de mon organisation ?

Pour mettre à jour le logo de votre organisation dans AirSaas :

1. **Préparez votre logo** au format carré de préférence (ou vertical) pour un affichage optimal
2. **Contactez le support** via le chat en leur envoyant le nouveau logo
3. **Formats acceptés** : SVG, JPG, PNG
4. Le support effectuera la mise à jour rapidement (généralement dans la journée)

**Note** : Le logo mis à jour apparaîtra automatiquement dans tous vos rapports flash et présentations après rafraîchissement de la page.


### Peut-on personnaliser le format des identifiants de projets ?

Les identifiants de projets dans AirSaas suivent par défaut le format [CODE_ESPACE]-P[ANNÉE]-[NUMÉRO] (exemple : CHV-P2026-01).

Actuellement, ce format n'est pas modifiable directement par les utilisateurs. Si votre organisation a des besoins spécifiques en termes de format d'identifiants (par exemple pour s'aligner sur vos conventions internes ou vos systèmes existants), nous vous invitons à contacter le support pour étudier les possibilités.

**Note** : L'identifiant projet est utilisé dans de nombreux endroits de l'application (URLs, exports, intégrations) donc toute modification doit être étudiée avec attention pour éviter les impacts.


### Puis-je ajouter des définitions d'objets personnalisés dans le manifeste ?

**Non, le manifeste ne permet pas de définir des objets qui n'existent pas nativement dans AirSaas.**

Le vocabulaire du manifeste est limité aux objets existants dans la plateforme (projets, programmes, jalons, etc.).

**Alternatives possibles :**
- Ajouter vos définitions personnalisées dans la description d'un objet existant (par exemple dans la description de "projet")
- Attendre que l'objet devienne natif (exemple : l'objet "Produit" est en cours de développement)

**Note :** Cette limitation est volontaire pour maintenir la cohérence entre le manifeste et les fonctionnalités réelles de l'outil.

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


### Comment masquer les métriques (budget, progression) sur les vues Roadmap ?

Si vous souhaitez masquer temporairement les métriques affichées en haut à gauche des vues Roadmap (budget, progression, etc.), contactez le support AirSaas.

**Pourquoi masquer ces métriques ?**
- Faciliter l'adoption progressive de l'outil
- Éviter la confusion lors du déploiement initial
- Permettre aux équipes de se familiariser d'abord avec les fonctionnalités de base

**Note :** Cette fonctionnalité a été développée suite aux retours utilisateurs pour améliorer l'adoption de l'outil, notamment dans les contextes où les budgets et progressions ne sont pas encore maîtrisés par toutes les équipes.


### Comment personnaliser les descriptions des valeurs de risque ?

Vous pouvez maintenant modifier les descriptions des valeurs de risque dans AirSaas. Cette personnalisation vous permet :

- D'adapter la terminologie des risques à votre contexte organisationnel
- D'afficher ces descriptions personnalisées dans le **Manifest**
- De créer une échelle de risques qui parle à vos équipes

**Pour modifier les descriptions :**
1. Accédez aux paramètres de votre espace de travail
2. Recherchez la section "Valeurs de risque"
3. Modifiez les descriptions selon vos besoins
4. Les changements seront automatiquement reflétés dans le Manifest

Cette fonctionnalité est particulièrement utile pour aligner le vocabulaire d'AirSaas avec votre culture projet interne.

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


### Comment maintenir l'ordre des valeurs dans un attribut personnalisé ?

Lors de la création de valeurs dans un attribut personnalisé, l'ordre défini initialement peut ne pas être conservé.

**Solution :**
1. Créez toutes vos valeurs d'attribut
2. Retournez dans la configuration de l'attribut
3. Réorganisez les valeurs dans l'ordre souhaité
4. Sauvegardez

**Note :** C'est un comportement connu qui nécessite cette manipulation supplémentaire. L'ordre sera ensuite conservé dans toutes les vues et sélecteurs.


### Peut-on renommer les attributs système comme 'Risque' dans le manifeste projet ?

**Non, les attributs système ne peuvent pas être renommés.**

Les attributs comme 'Risque', 'Statut', 'Météo' sont des attributs système d'AirSaas et leur nom ne peut pas être modifié.

**Solution à venir :**
- AirSaas travaille sur une fonctionnalité pour afficher les définitions des valeurs directement dans le manifeste
- Cela permettra de clarifier ce que signifie chaque niveau (risque élevé, moyen, faible) sans avoir à renommer l'attribut

**En attendant :**
- Utilisez la section 'Points d'attention' pour détailler les risques spécifiques
- Communiquez en interne sur la différence entre l'attribut 'Risque' (niveau global) et les risques détaillés (points d'attention)


### Le chatbot Teams se connecte au mauvais espace de travail

Si le chatbot AirSaas dans Teams se connecte à un mauvais espace de travail, c'est probablement parce que vous avez plusieurs espaces et que l'espace principal n'est pas le bon.

**Solution :**
1. Contactez le support AirSaas pour modifier votre espace principal
2. Une fois le changement effectué par le support :
   - Dans le chatbot Teams, tapez `logout`
   - Puis tapez `login` pour vous reconnecter
3. Le chatbot pointera maintenant vers le bon espace

**Note :** L'espace principal est déterminé historiquement par ordre de création. Si vous avez migré d'un espace de test vers un espace de production, ce changement est nécessaire.


### Pourquoi mon nom apparaît-il comme responsable sur tous les projets ?

Si votre nom apparaît sur tous les projets de l'espace de travail, c'est probablement dû à un paramètre de personnalisation modifié par erreur.

**Cause fréquente** : Lors de la modification des paramètres de l'espace de travail, votre navigateur peut avoir auto-complété le champ "Nom du responsable projet" avec votre nom.

**Pour corriger** :
1. Allez dans **Paramètres** > **Espace de travail**
2. Cherchez le champ **Personnalisation du nom du responsable projet**
3. Videz ce champ ou remettez la valeur par défaut
4. Sauvegardez et rafraîchissez votre page

**Note** : Ce paramètre affecte l'affichage pour tous les utilisateurs de votre espace de travail.


### Peut-on réorganiser l'ordre des éléments épinglés dans la vue Présentation ?

**Actuellement, cette fonctionnalité n'est pas disponible.**

Les éléments épinglés dans la vue Présentation s'affichent automatiquement par ordre chronologique (du plus ancien au plus récent). Il n'est pas possible de les réorganiser manuellement pour l'instant.

**Alternative suggérée :**
- Si vous avez besoin d'un ordre spécifique pour votre présentation, vous pouvez désépingler puis réépingler les éléments dans l'ordre souhaité (le plus récent apparaîtra en dernier)
- Utilisez la fonctionnalité de personnalisation de présentation pour structurer votre contenu

**Note :** Cette fonctionnalité a été notée comme demande d'amélioration. Si ce besoin est important pour votre organisation, n'hésitez pas à contacter le support pour appuyer cette demande.


---

## Budget et finances

### Comment créer un projet avec des budgets pour l'année suivante ?

Lors de la création d'un projet en fin d'année, le formulaire propose par défaut l'année en cours. Pour créer un projet avec des budgets pour l'année suivante :

**Solution recommandée** :
1. À la création, remplissez **uniquement le titre** du projet (seul champ obligatoire)
2. Validez la création
3. Une fois dans la fiche projet, modifiez les budgets pour l'année souhaitée

**Pourquoi cette approche ?**
- Plus de flexibilité dans la fiche projet
- Possibilité de configurer les budgets par année fiscale
- Évite les erreurs de saisie dans le formulaire initial

**Note** : Dès le Q4, il est courant de planifier les projets de l'année suivante. Cette méthode vous permet de le faire efficacement.

**Ressources utiles :**
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Comment suivre les budgets CAPEX/OPEX par année dans AirSaas ?

**Solution actuelle (temporaire) :**

1. Créez une vue portfolio dédiée (ex: "COMEX Budget")
2. Ajoutez les colonnes budget CAPEX et OPEX
3. Filtrez par statut de projet pour voir les budgets à venir
4. Exportez en CSV pour retravailler les données par année

**Solution à venir :**

AirSaas développe actuellement une page dédiée au suivi budgétaire qui permettra :
- Visualisation des budgets par année fiscale
- Séparation CAPEX/OPEX
- Vue des estimations d'atterrissage
- Consolidation multi-projets

**Note :** Cette fonctionnalité est prévue pour l'été 2026. Le découpage se fera à l'année (pas au trimestre) pour maintenir la lisibilité.

**Ressources utiles :**
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Comment activer et configurer la vue Budget ?

La vue Budget permet de suivre les aspects financiers de vos projets (Capex/Opex, planifié/engagé/consommé).

**Pour l'activer :**
1. Contactez le support via le chat
2. L'activation est généralement effectuée sous 24h

**Configuration importante après activation :**
- Allez dans `/settings/budgets/budget`
- Paramétrez vos axes analytics en cohérence avec votre modèle financier
- Définissez vos catégories de dépenses
- Configurez votre année fiscale si nécessaire

**Bonnes pratiques :**
- Commencez par saisir les budgets validés
- Le consommé peut être ajouté progressivement
- Utilisez les lignes de dépenses pour détailler vos budgets
- Exportez en CSV pour vos reportings financiers

**Ressources utiles :**
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)
- [💰 Le détail des budgets et dépenses pour un suivi financier au top](https://club.airsaas.io/c/ca-vient-de-sortir/le-detail-des-budgets-et-depenses-pour-un-suivi-financier-au-top)
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Où et comment saisir les jours consommés par équipe ?

La saisie des **jours consommés** dépend du statut de votre projet et du mode de participation de vos équipes.

**Pour les projets en exécution** :

1. **Équipes participant au Quarter Plan** :
   - Les consommés se saisissent directement sur les jalons dans le Quarter Plan
   - Cliquez sur le jalon de l'équipe concernée
   - Renseignez les jours consommés
   - Ces valeurs remontent automatiquement au niveau du projet (non éditable)

2. **Équipes ne participant PAS au Quarter Plan** :
   - Les consommés se saisissent dans le panel des équipes impliquées du projet
   - Le champ est directement éditable au niveau de l'équipe

**Pour les projets en cadrage** :
- Seul le budget initial est affiché
- Les consommés ne sont pas disponibles (pas de consommation en phase de cadrage)

**Astuce** : Pour voir où saisir les consommés, vérifiez d'abord si votre projet est en phase d'exécution et si vos équipes sont au Quarter Plan.

**Ressources utiles :**
- [Déclarer les efforts consommés au jalon ⏳](https://club.airsaas.io/c/ca-vient-de-sortir/declarer-les-efforts-consommes-au-jalon)
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)


### Comment fonctionnent les coûts humains des projets (TJM, efforts, budgets) ?

Les coûts humains des projets s'articulent autour de plusieurs éléments complémentaires :

**1. Configuration des TJM (Taux Journaliers Moyens)**
- Définissez un TJM par équipe dans les paramètres
- Ce TJM servira de base pour calculer automatiquement les coûts

**2. Estimation des efforts**
- **Effort macro par équipe** : estimation globale au niveau du projet
- **Effort des jalons** : répartition détaillée par jalon et par équipe
- Les efforts peuvent être estimés sur plusieurs années

**3. Visualisation des coûts**
- **Smart View dédiée** : créez une vue "Coût humain des projets" dans votre portfolio pour voir la valorisation financière
- **Board de suivi budgétaire** : suivez par équipe et par année l'utilisation des budgets

**4. Articulation avec les budgets**
- Le budget initial représente l'enveloppe globale allouée
- Les coûts humains (TJM × efforts) s'ajoutent aux autres dépenses
- Suivez le consommé vs le planifié

**Pour activer la visualisation des coûts humains**, contactez le support si la fonctionnalité n'est pas encore disponible dans votre espace.

**Ressources utiles :**
- [Quel est le coût humain de nos projets ?](https://club.airsaas.io/c/ca-vient-de-sortir/quel-est-le-cout-humain-de-nos-projets)
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)


### Pourquoi l'atterrissage budgétaire n'est-il pas calculé automatiquement ?

L'**atterrissage** est une estimation manuelle du chef de projet et non un calcul automatique. Voici pourquoi :

**La logique** : L'atterrissage représente l'estimation finale du budget nécessaire pour terminer le projet, selon la vision du chef de projet.

**Exemple concret** :
- Budget planifié : 20k€
- Montant engagé à date : 10k€
- Atterrissage estimé : 25k€

Dans cet exemple, le chef de projet a engagé 10k€ mais estime qu'il aura besoin de 15k€ supplémentaires (soit 25k€ au total) pour terminer le projet. Les 5k€ de dépassement ne sont pas encore engagés mais sont anticipés.

**Pourquoi pas automatique ?** : Seul le chef de projet peut estimer les dépenses futures non encore engagées, en fonction des risques, imprévus et besoins identifiés.

**Ressources utiles :**
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)


### Pourquoi mes budgets n'apparaissent pas dans le cadre 'Suivi des budgets' ?

Le cadre **'Suivi des budgets'** sur la page projet affiche uniquement les budgets **annualisés** (liés à l'année en cours).

**Si vos budgets n'apparaissent pas**, c'est probablement que votre projet utilise encore un budget global (non découpé par année). C'est souvent le cas pour les projets créés avant la mise en place de l'annualisation.

**Pour résoudre ce problème :**
1. Allez dans le panneau d'édition des budgets du projet
2. Cliquez sur le bouton **'Annualiser'** en haut à droite
3. Choisissez l'année sur laquelle reporter votre budget global
4. Validez - vos budgets apparaîtront maintenant dans le cadre de suivi

**Bon à savoir :** Tous les nouveaux projets créés aujourd'hui sont automatiquement annualisés. L'annualisation permet un meilleur suivi financier année par année.

**Ressources utiles :**
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Pourquoi certains projets n'apparaissent pas dans la vue budget ?

Pour qu'un projet apparaisse dans la vue budget, plusieurs conditions doivent être remplies :

**1. Activer le découpage par année**
- Accédez aux paramètres du projet
- Activez l'option "Découpage par année"
- Cette option est activée par défaut sur les nouveaux projets (depuis octobre 2025) mais doit être activée manuellement sur les anciens projets

**2. Vérifier l'année fiscale**
- Le projet doit être sur l'exercice fiscal que vous consultez (ex: 2025/26)
- Les dates du projet doivent correspondre à cette période

**3. Vérifier le financeur**
- Le projet doit être financé par l'entité sélectionnée dans le filtre

**4. Avoir des lignes de dépenses**
- Le projet doit contenir au moins une ligne de dépense pour apparaître
- Un projet sans aucune dépense ne sera pas visible dans la vue budget

**Conseil**
Même si vos dépenses n'ont lieu que sur un seul exercice, il est recommandé d'activer le découpage par année sur tous vos projets pour qu'ils soient pris en compte dans le budget.

**Ressources utiles :**
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Pourquoi la vue 'Total' du budget est vide sur mon projet multi-années ?

La vue 'Total' des budgets peut apparaître vide pour deux raisons :

**1. Utilisation d'intervalles de valeurs**
- AirSaas ne peut pas calculer un total avec des intervalles (ex: 50-100k€)
- Solution : Utilisez des valeurs précises pour chaque ligne budgétaire

**2. Projet à cheval sur plusieurs années fiscales**
- Les budgets sont découpés par année fiscale
- Pour voir l'ensemble : naviguez entre les onglets des différentes années
- La vue 'Total' consolidera automatiquement si vous utilisez des valeurs précises

**Astuce** : Pour les estimations en phase de cadrage, privilégiez une valeur médiane plutôt qu'un intervalle pour pouvoir visualiser les totaux.

**Ressources utiles :**
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Comment sont gérés les coûts humains par rapport aux budgets Capex/Opex ?

Dans AirSaas, le coût humain est traité **séparément** des budgets Capex/Opex. Cette séparation est volontaire car :

- Certaines entreprises passent les coûts humains en **Capex**
- D'autres les passent en **Opex**
- Cela vous laisse la flexibilité de gérer selon vos règles comptables internes

**Pour configurer le coût humain :**
1. Définissez le TJM (Taux Journalier Moyen) par équipe dans les paramètres
2. Les coûts humains seront calculés automatiquement sur vos projets
3. Vous pourrez les visualiser séparément des budgets Capex/Opex

**Ressources utiles :**
- [Quel est le coût humain de nos projets ?](https://club.airsaas.io/c/ca-vient-de-sortir/quel-est-le-cout-humain-de-nos-projets)


### Où visualiser le coût humain des projets ?

Le coût humain des projets est actuellement visible à deux endroits :

**1. Dans les vues portfolio :**
- Ajoutez la colonne "Coût humain" dans vos vues tableau
- Visible également dans les vues roadmap

**2. Sur la page Budget :**
- Module à activer sur demande auprès du support
- Vue consolidée de tous les coûts incluant le coût humain
- Précisez le workspace concerné lors de votre demande

**Note :** Le coût humain n'est pas encore affiché directement sur la page projet individuelle. Cette fonctionnalité est envisagée mais pas encore planifiée.

**Pour activer la page Budget :**
- Contactez le support en précisant votre workspace
- L'activation est immédiate
- Rafraîchissez votre page après activation

**Ressources utiles :**
- [Quel est le coût humain de nos projets ?](https://club.airsaas.io/c/ca-vient-de-sortir/quel-est-le-cout-humain-de-nos-projets)
- [Suivez les budgets annuels 💶](https://club.airsaas.io/c/ca-vient-de-sortir/suivez-les-budgets-annuels)


### Comment personnaliser le module Budget avec des références internes ?

**Fonctionnalité existante** : Vous pouvez déjà créer des axes analytiques personnalisés pour les lignes de dépenses dans le module Budget.

**Pour ajouter vos références internes** :
1. Accédez aux paramètres de votre espace
2. Configurez des axes analytiques personnalisés
3. Utilisez-les pour renseigner vos numéros de commande ou demandes d'investissement

**Limitation actuelle** : Les axes analytiques personnalisés sont principalement de type texte. Si vous avez besoin d'attributs de type nombre, cette fonctionnalité est en cours d'étude par l'équipe produit.

**Cas d'usage** : Cette personnalisation permet de faire le lien entre vos dépenses AirSaas et vos systèmes internes de gestion financière.

**Ressources utiles :**
- [💰 Le détail des budgets et dépenses pour un suivi financier au top](https://club.airsaas.io/c/ca-vient-de-sortir/le-detail-des-budgets-et-depenses-pour-un-suivi-financier-au-top)


### Peut-on voir les coûts humains au niveau des programmes ?

**Actuellement :**
- Les coûts humains sont visibles sur les **projets**, **portfolios**, **roadmaps** et **Quarter Plans**
- Les programmes affichent déjà les budgets **Capex** et **Opex** consolidés
- Les coûts humains ne remontent **pas encore** au niveau des programmes

**À venir :**
- La consolidation des coûts humains au niveau des programmes est prévue
- Cela permettra d'avoir une vision globale des coûts humains par programme
- Pas de date précise communiquée pour le moment

**En attendant :**
- Utilisez les vues portfolio filtrées par programme pour voir les coûts humains
- Exportez les données en CSV pour faire vos consolidations

**Ressources utiles :**
- [Quel est le coût humain de nos projets ?](https://club.airsaas.io/c/ca-vient-de-sortir/quel-est-le-cout-humain-de-nos-projets)


---

## Gestion des équipes

### Pourquoi je ne peux pas supprimer une équipe impliquée de mon projet ?

Une équipe ne peut pas être supprimée d'un projet si elle est **utilisée dans des jalons**.

**Pour identifier les jalons concernés :**
1. Créez une vue avec les équipes impliquées dans les projets
2. Filtrez sur votre projet et l'équipe concernée
3. Identifiez tous les jalons assignés à cette équipe

**Pour supprimer l'équipe :**
1. Réassignez d'abord tous les jalons concernés à une autre équipe
2. Une fois tous les jalons réassignés, la croix de suppression apparaîtra
3. Vous pourrez alors retirer l'équipe du projet

**Astuce :** Cette protection évite de perdre accidentellement l'assignation des jalons.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Comment structurer les équipes métier et IT dans l'arborescence AirSaas ?

Dans AirSaas, l'arborescence des équipes suit cette logique :

**Niveau 2 - Domaines = Équipes en demande**
- C'est ici que vous placez vos **équipes métier**
- Ce sont les équipes qui expriment des besoins
- Elles sont les "clientes" des projets

**Niveau 1 - Équipes = Équipes impliquées/responsables**
- C'est ici que vous placez vos **équipes IT**
- Ce sont les équipes qui réalisent les projets
- Elles travaillent sur les jalons

**En résumé :**
- Équipes métier → Domaine (niveau 2)
- Équipes IT → Équipe (niveau 1)

**Exemple concret :**
- Domaine "Marketing" (niveau 2) demande un projet
- Équipe "Développement Web" (niveau 1) le réalise

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)
- [Capacitaire équipes externes / prestataires](https://club.airsaas.io/c/utilisateurs-d-airsaas/capacitaire-equipes-externes-prestataires)


### Comment restructurer complètement la hiérarchie des équipes dans AirSaas ?

**Pourquoi je ne peux pas supprimer mes équipes ?**

Les équipes et domaines actuels sont utilisés partout dans AirSaas (projets, jalons, capacité, etc.). Les supprimer casserait toutes ces références, c'est pourquoi le système vous en empêche.

**La méthode recommandée pour restructurer :**

1. **Préparez votre nouvelle hiérarchie dans Excel**
   - Demandez un export Excel de votre hiérarchie actuelle au support
   - Travaillez sur ce fichier pour définir la nouvelle structure
   - Définissez ce que deviennent les anciennes équipes (migration, fusion, etc.)

2. **Planifiez la migration avec AirSaas**
   - Contactez votre CSM ou le support pour organiser la migration
   - L'équipe AirSaas opérera la migration pour vous
   - Toutes les références seront mises à jour automatiquement

**Important :** Cette opération est complexe car elle impacte tous vos projets, jalons et attributions. C'est pourquoi nous ne permettons pas de le faire directement depuis l'interface.


### Comment créer une nouvelle équipe dans AirSaas ?

**Création d'équipe = Droits administrateur requis**

**Pour ajouter une équipe existante à un projet :**
- Depuis la page projet, dans la colonne de gauche
- Cliquez sur "Équipes impliquées"
- Sélectionnez l'équipe dans la liste

**Pour créer une nouvelle équipe :**
1. Vous devez être **administrateur** de l'espace
2. Allez dans **Paramètres** (Settings)
3. Section **Équipes**
4. Créez votre nouvelle équipe
5. Elle sera ensuite disponible dans tous les projets

**Note** : Si vous n'êtes pas administrateur, contactez un admin de votre organisation pour créer l'équipe.

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


### Comment gérer un grand nombre d'équipes (métier + IT) sans surcharger l'interface ?

Lorsque vous devez ajouter de nombreuses équipes métier en plus de vos équipes IT, voici les options pour éviter une liste trop longue :

**Option 1 : Utiliser les niveaux d'équipes**
- Structurez vos équipes sur plusieurs niveaux (jusqu'à 3 niveaux disponibles)
- Regroupez les équipes par département, BU ou domaine fonctionnel
- Permet une vue consolidée et une navigation plus claire

**Option 2 : Jalons multi-équipes**
- Depuis février 2026, les jalons peuvent être attribués à plusieurs équipes
- Permet d'impliquer les équipes métier sans les ajouter comme équipes de niveau 1
- [En savoir plus sur les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)

**Option 3 : Approche hybride**
- Ajoutez uniquement les équipes métier principales en niveau 1
- Utilisez les attributs personnalisés pour identifier les sous-équipes
- Créez des vues filtrées par type d'équipe

**Recommandation :** Pour une situation complexe avec de nombreuses équipes, planifiez un call avec le support pour définir la meilleure structure selon vos besoins spécifiques.

**Ressources utiles :**
- [Les niveaux d'équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Comment configurer les niveaux d'équipes (directions, départements) pour la sélection dans les projets ?

Dans AirSaas, vous pouvez créer plusieurs niveaux d'organisation (équipes, départements, directions, etc.) mais **un seul niveau peut être sélectionné comme "équipe en demande" dans vos projets**.

**Points importants :**
- Ce paramètre s'applique à tout votre workspace
- Vous devez choisir entre sélectionner des équipes OU des directions
- Le changement de niveau impacte tous les projets existants et futurs

**Pour modifier le niveau sélectionnable :**
Contactez le support AirSaas qui peut ajuster ce paramètre pour votre workspace.

**Note :** Les équipes et directions peuvent mettre quelques heures à apparaître dans les listes déroulantes après leur création.

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


### Comment réorganiser mes équipes sans perdre les affectations de jalons ?

Lors d'une réorganisation d'équipes (par exemple, diviser une équipe Tech en 3 sous-équipes), vous avez deux options :

**Option 1 : Réaffectation manuelle**
- Créez d'abord vos nouvelles équipes dans les paramètres
- Ajoutez-les au Quarter Plan depuis les settings du QP
- Réaffectez manuellement chaque jalon à la bonne équipe

**Option 2 : Script automatisé (sur demande)**
- Contactez le support avec votre nouveau mapping d'équipes
- L'équipe AirSaas peut exécuter un script pour automatiser la réaffectation

**Points d'attention :**
- Si votre quarter a déjà commencé, les modifications impacteront le quarter en cours
- Il est recommandé de créer les équipes et de les ajouter au QP avant le début du quarter
- Vérifiez qu'il n'y a pas d'autres impacts non anticipés avant de procéder


### Comment ajouter un niveau d'équipe supérieur sans erreur ?

Lors de la création d'un niveau d'équipe supérieur, AirSaas exige que vous suiviez cet ordre précis :

1. **Créez d'abord une valeur dans le nouveau niveau**
   - Allez dans la section du nouveau niveau (ex: "Domaine en demande")
   - Ajoutez au moins une première valeur (ex: "Digital", "Marketing", etc.)

2. **Rattachez ensuite les équipes du niveau inférieur**
   - Éditez chaque équipe du niveau inférieur
   - Assignez-les à un parent du niveau supérieur

**Important** : AirSaas n'autorise pas d'avoir des équipes de niveau inférieur sans parent. C'est pourquoi vous devez créer la structure du haut vers le bas.

**Exemple concret :**
- Niveau 2 : Créez d'abord "Domaine Digital"
- Niveau 1 : Rattachez ensuite "Équipe Dev" et "Équipe UX" au "Domaine Digital"

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


### Comment dupliquer une équipe de contributeurs sur plusieurs projets ?

**Actuellement, il n'est pas possible de dupliquer automatiquement une équipe de contributeurs d'un projet vers d'autres projets.**

Pour ajouter la même équipe sur plusieurs projets d'un programme :

**Option 1 : Ajout manuel**
- Ouvrez chaque projet individuellement
- Ajoutez les contributeurs un par un via l'onglet "Équipe"

**Option 2 : Demande au support** (pour un grand nombre de projets)
- Préparez un fichier CSV listant les projets concernés
- Contactez le support AirSaas qui pourra effectuer l'opération en masse

**À noter :** La fonctionnalité de duplication d'équipes entre projets est dans notre roadmap. En attendant, n'hésitez pas à contacter le support pour les opérations en masse.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Comment supprimer une équipe qui apparaît comme bloquée ?

Pour supprimer une équipe dans AirSaas, vous devez d'abord la retirer de tous les endroits où elle est référencée :

**1. Identifier les blocages**
- Créez une vue portfolio filtrée sur l'équipe concernée
- Vérifiez les projets où elle est **équipe impliquée**
- Vérifiez les projets où elle est **équipe en demande**
- N'oubliez pas les **projets privés** (souvent la cause du blocage)
- Vérifiez aussi les **projets archivés**
- Contrôlez les **jalons** où l'équipe est assignée

**2. Retirer l'équipe partout**
- Ouvrez chaque projet identifié
- Retirez l'équipe des équipes impliquées/en demande
- Pour les projets archivés : désarchivez temporairement, retirez l'équipe, puis ré-archivez
- Pour les jalons : modifiez chaque jalon concerné

**3. Supprimer l'équipe**
- Une fois l'équipe retirée partout, la suppression sera possible

**Astuce** : Si vous avez les droits admin, demandez à un administrateur de créer une vue privée listant tous les projets concernés pour faciliter le travail.


### Comment configurer les niveaux d'équipes comme Requestors ou Execution ?

Dans AirSaas, vous pouvez organiser vos équipes en plusieurs niveaux hiérarchiques (Niveau 1, 2, 3...) et définir leur rôle :

**Équipes d'exécution (Execution capacity)** :
- Généralement les équipes de Niveau 1
- Ce sont les équipes qui réalisent concrètement les projets
- Elles ont une capacité de production mesurable

**Équipes en demande (Requestors)** :
- Généralement les équipes de Niveau 2 ou supérieur
- Ce sont les équipes qui expriment des besoins et demandent des projets
- Elles pilotent et coordonnent les équipes d'exécution

**Pour modifier cette configuration** :
- Contactez le support AirSaas via le chat
- Précisez votre workspace et la configuration souhaitée
- Le changement sera effectué rapidement par l'équipe support

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


### Pourquoi certaines équipes n'apparaissent pas dans la liste déroulante 'Équipe impliquée' ?

Lorsque vous ajoutez des équipes à un projet via l'attribut **Équipe impliquée**, les équipes déjà présentes dans le projet disparaissent de la liste déroulante.

Ce comportement est normal et permet d'éviter d'ajouter deux fois la même équipe au projet.

**Pour vérifier** :
- Regardez si l'équipe n'est pas déjà présente dans le projet
- Rafraîchissez la page si vous venez de créer de nouvelles équipes
- Une équipe peut être à la fois côté Demande et côté Effort dans le même projet

**Note** : Si vous venez de créer ou modifier des équipes (Niveau 1 ou 2), un rafraîchissement de la page peut être nécessaire pour qu'elles apparaissent dans les listes déroulantes.

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


### Pourquoi mes nouvelles équipes sponsors n'apparaissent pas dans les projets ?

Si vos équipes sponsors nouvellement créées n'apparaissent pas dans les projets, c'est probablement lié à votre **niveau de priorisation**.

**Diagnostic rapide :**
- Vérifiez votre niveau de priorisation actuel dans les paramètres
- Si vous êtes au niveau "Équipes" et non "Direction/Sponsors", les équipes sponsors ne seront pas disponibles

**Solution :**
Pour utiliser les équipes sponsors dans vos projets, vous devez passer au niveau de priorisation "Direction/Sponsors". 

⚠️ **Important** : Ce changement a des impacts sur votre organisation :
- La demande des projets se fera désormais au niveau Direction/Sponsors
- Le retour en arrière nécessite de la prudence

Nous recommandons de planifier ce changement avec votre équipe support AirSaas pour bien comprendre tous les impacts.

**Ressources utiles :**
- [Les niveaux d'équipes pour une meilleure consolidation](https://club.airsaas.io/c/ca-vient-de-sortir/les-niveaux-d-equipes-pour-une-meilleure-consolidation)


---

## Export et import

### Comment exporter des fiches projet pour les présentations officielles ?

**Limitation actuelle de l'export PPT**

L'export PowerPoint peut présenter des problèmes de mise en page lorsque :
- Les descriptions sont longues
- Il y a beaucoup d'équipes impliquées
- Le contenu dépasse la taille d'une slide

Cette limitation est due au format PowerPoint qui ne permet pas le défilement (scroll).

**Alternatives disponibles**

1. **Export PDF allégé**
   - Accédez à l'export PDF depuis le projet
   - Sélectionnez la version allégée pour un format plus compact
   - Idéal pour les fiches projet synthétiques

2. **Rapport Flash**
   - Génère une fiche d'identité projet complète
   - Format adapté aux présentations exécutives

**Solutions à venir**

- **Q4 2025** : Partage de présentation par lien (accessible sans compte AirSaas)
- **Date à définir** : Export PDF complet des présentations avec mise en page optimisée

**Recommandations pour la Business Review**

1. Utilisez l'export PDF pour les supports envoyés en avance
2. Préparez une vue Smart View dédiée avec uniquement les projets à présenter
3. Limitez les descriptions aux éléments essentiels
4. Créez une slide séparée pour les équipes si nécessaire

**Ressources utiles :**
- [Créer des liens de partage sur AirSaas](https://club.airsaas.io/c/ca-vient-de-sortir/creer-des-liens-de-partage-sur-airsaas)


### Comment importer des jalons en masse dans AirSaas ?

Pour créer des jalons en masse dans AirSaas, vous avez deux options :

**Option 1 : Via l'API (autonomie complète)**
- Utilisez l'endpoint de création : https://developers.airsaas.io/reference/projects_milestones_create
- Permet de scripter et automatiser l'import
- Idéal pour des imports récurrents

**Option 2 : Via import CSV**
- Contactez le support qui dispose d'un template CSV
- Le support effectue l'import pour vous
- Solution plus simple pour des imports ponctuels

**Format du template :**
- Colonnes requises : nom du jalon, projet parent, dates, effort, etc.
- Le nom du projet doit être orthographié exactement comme dans AirSaas
- Attention : la colonne effort doit être correctement positionnée (colonne 9)

**Conseil :** Commencez par un petit lot test avant d'importer l'ensemble de vos jalons.


### Comment exporter tous les attributs de mes projets (y compris les attributs personnalisés) vers Excel ?

Pour exporter l'ensemble de vos données projets vers Excel, incluant vos attributs personnalisés :

1. Accédez au portfolio projets
2. Créez une vue privée en mode **Tableau**
3. Ajoutez tous les attributs que vous souhaitez exporter :
   - Cliquez sur l'icône de configuration de la vue
   - Sélectionnez tous les attributs standards et personnalisés souhaités
4. Une fois votre vue configurée, cliquez sur le bouton **Export** en haut à droite
5. Choisissez **Export CSV**
6. Le fichier CSV téléchargé pourra être ouvert directement dans Excel

**Note** : En tant qu'administrateur, vous avez accès à tous les attributs. Les utilisateurs avec des droits plus restreints ne verront que les attributs auxquels ils ont accès.

**Astuce** : Sauvegardez cette vue pour pouvoir refaire l'export facilement à l'avenir.

**Ressources utiles :**
- [🚛 Exporter les projets en CSV !](https://club.airsaas.io/c/ca-vient-de-sortir/exporter-les-projets-en-csv)


### Comment partager le Quarter Plan avec des personnes n'ayant pas accès à AirSaas ?

**Situation actuelle** : L'export direct du Quarter Plan n'est pas encore disponible.

**Solution à venir** : Une fonctionnalité de **liens de partage** est en cours de développement et sera disponible fin juillet/début août. Elle permettra :
- De générer un lien de partage pour votre Quarter Plan
- D'envoyer ce lien à des personnes sans compte AirSaas
- De leur donner accès en lecture seule à la vue

**En attendant**, vous pouvez :
- Créer une vue portfolio filtrée sur le trimestre souhaité
- Faire une capture d'écran ou utiliser l'export PNG de la vue tableau
- Utiliser le mode présentation pour partager l'information en réunion

**Ressources utiles :**
- [Créer des liens de partage sur AirSaas](https://club.airsaas.io/c/ca-vient-de-sortir/creer-des-liens-de-partage-sur-airsaas)


### Comment exporter tous les jalons d'un programme spécifique ?

Pour exporter l'ensemble des jalons d'un programme :

1. **Créez une vue projets filtrée**
   - Allez dans le portfolio projets
   - Créez une nouvelle vue
   - Filtrez sur le programme souhaité

2. **Créez une vue jalons basée sur la vue projets**
   - Allez dans le portfolio jalons
   - Créez une nouvelle vue
   - Dans les filtres, utilisez la vue projets créée précédemment

3. **Configurez et exportez**
   - Affichez les propriétés souhaitées (dates, responsables, statuts...)
   - Cliquez sur le bouton d'export CSV

**Alternative :** L'API AirSaas permet également d'extraire ces données de manière automatisée si vous avez des besoins récurrents.

**Ressources utiles :**
- [Le portfolio de jalons 🥳](https://club.airsaas.io/c/ca-vient-de-sortir/le-portfolio-de-jalons)


### Comment exporter l'executive summary d'un programme en PDF ?

Vous pouvez désormais exporter les executive summaries de vos pages programme directement au format PDF.

**Pour exporter :**
1. Accédez à la page du programme concerné
2. Localisez l'option d'export PDF (généralement via un bouton ou menu d'export)
3. Le PDF généré contiendra toutes les informations clés du programme

**Avantages :**
- Partage facile avec des parties prenantes externes
- Documentation pour les comités de pilotage
- Archivage des états d'avancement

**Ressources utiles :**
- [Envoyez l'exec summary en amont de vos réunions 👌](https://club.airsaas.io/c/ca-vient-de-sortir/envoyer-l-exec-summary-en-amont-de-vos-reunions)


### Comment mettre à jour en masse les attributs de plusieurs projets ?

**Mise à jour en masse des projets**

Actuellement, AirSaas ne propose pas d'interface pour la mise à jour en masse des projets, mais plusieurs solutions existent :

**1. Pour les attributs simples** (programme, objectifs, statuts, avancement, importance, risque, effort) :
- Reprenez votre fichier Excel d'import initial
- Ajoutez les colonnes avec les nouvelles données
- Demandez au support de refaire l'import (environ 30 minutes)

**2. Pour les jalons** :
Préparez un fichier avec les colonnes suivantes :
- Titre du jalon
- Équipe
- Date de fin
- Nom du projet

**3. Pour l'extension de jalons** :
C'est la seule mise à jour en masse disponible directement depuis l'interface.

**Note** : Pour les phases d'onboarding avec beaucoup de projets, le support peut effectuer ces mises à jour en backoffice. N'hésitez pas à les contacter via le chat.

**Astuce** : Si vous êtes en phase de test/POC, préparez dès le départ un fichier Excel complet avec tous les attributs pour éviter les mises à jour manuelles ultérieures.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Pourquoi l'export CSV des jalons inclut l'effort dans le nom de l'équipe ?

Dans l'export CSV des jalons, le nom de l'équipe apparaît avec l'effort entre parenthèses (ex: "Équipe Digital (- / 50)"), ce qui empêche de regrouper facilement par équipe dans Excel.

**Format actuel :**
- Le champ équipe contient : "Nom équipe (effort consommé / effort initial)"
- Le tiret "-" s'affiche quand il n'y a pas d'effort consommé

**Pourquoi ce format ?**
C'est un choix volontaire pour afficher l'effort directement dans l'export, mais nous avons noté que cela pose des problèmes pour l'analyse des données.

**Solution temporaire :**
En attendant une amélioration, vous pouvez :
1. Utiliser une formule Excel pour extraire uniquement le nom de l'équipe (avant la parenthèse)
2. Faire un rechercher/remplacer pour supprimer les parenthèses et leur contenu

**À noter :** Avec l'arrivée des jalons multi-équipes, une cellule pourra contenir plusieurs noms d'équipes, ce qui rendra de toute façon le regroupement plus complexe.

L'équipe produit étudie une refonte de ce format d'export pour mieux répondre aux besoins d'analyse.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Peut-on exporter le Quarter Plan en PowerPoint ?

**Non**, l'export PowerPoint n'est pas encore disponible pour les pages Quarter Plan.

**Solution temporaire** :
- Faites des captures d'écran des indicateurs
- Copiez-collez les données dans votre présentation
- Utilisez l'export PNG des vues portfolio (disponible pour les vues tableau)

**À venir** :
Cette fonctionnalité est dans notre roadmap. L'export permettra de générer automatiquement une présentation avec tous les indicateurs du Quarter Plan.

**Ressources utiles :**
- [Le Quarter plan 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/le-quarter-plan)
- [Suivre l'avancée du Quarter plan, et comparer aux engagements 🔥](https://club.airsaas.io/c/ca-vient-de-sortir/suivre-l-avancee-du-quarter-plan-et-comparer-aux-engagements)


### Peut-on exporter toutes les colonnes visibles dans une vue projet ?

**Situation actuelle**

L'export CSV standard n'inclut pas toutes les colonnes personnalisées visibles dans vos vues, notamment :
- Les coûts humains calculés
- Certains attributs personnalisés
- Les colonnes calculées

**Solution en cours**

L'équipe AirSaas travaille sur l'amélioration de l'export pour inclure toutes les colonnes configurées dans vos vues.

**Workaround temporaire**

En attendant :
1. Utilisez l'export PNG de la vue tableau pour une capture visuelle
2. Exportez les données de base et recalculez dans Excel
3. Utilisez l'API si disponible pour votre organisation

**Ressources utiles :**
- [🚛 Exporter les projets en CSV !](https://club.airsaas.io/c/ca-vient-de-sortir/exporter-les-projets-en-csv)


### Comment importer des projets en masse dans AirSaas ?

Pour créer des projets (initiatives) en masse dans AirSaas :

**1. Demandez le template au support**
- Le support vous fournira un fichier Excel spécifique (scc_import_template)

**2. Complétez le template**
- Ne modifiez pas les onglets de configuration (Settings - xxx)
- Remplissez uniquement l'onglet "Projects"
- Suivez les instructions en commentaire dans les entêtes de colonnes

**3. Renvoyez le fichier au support**
- Le support effectuera l'import pour vous
- Vous pourrez ensuite vérifier et ajuster si nécessaire

**Important** : Ce processus est différent de l'import de jalons. Assurez-vous de bien préciser qu'il s'agit de projets/initiatives lors de votre demande.


### Comment exporter une vue timeline avec les jalons pour mes présentations ?

Actuellement, il n'est pas possible d'exporter directement une vue liste projet avec timeline incluant les jalons déployés.

**Alternatives disponibles :**
- Utiliser les vues Roadmap qui permettent de visualiser les projets dans le temps
- Créer une vue portfolio jalons timeline, groupée par projets
- Utiliser le mode présentation intégré d'AirSaas plutôt qu'un export PowerPoint

**Pour vos présentations :**
- Si vous devez absolument avoir un support PowerPoint, vous pouvez faire des captures d'écran de vos vues
- Le mode présentation AirSaas permet de projeter directement vos roadmaps en réunion

**Note :** Cette fonctionnalité d'export avec jalons intégrés est identifiée comme un besoin et pourrait être développée dans le futur.


### Comment exporter une présentation de programme pour des non-utilisateurs AirSaas ?

**Limitation actuelle** : L'export des flash reports de programmes ne génère pour l'instant que le tableau récapitulatif, pas la vue complète du mode présentation.

**Alternatives disponibles :**
- Créer une vue du portfolio projet filtrée sur le programme concerné
- Utiliser les liens de partage pour donner un accès temporaire en lecture seule
- Faire des captures d'écran du mode présentation

**Note** : L'export complet au format PDF/PPT du mode présentation est une évolution prévue dans la roadmap produit.

**Ressources utiles :**
- [Créer des liens de partage sur AirSaas](https://club.airsaas.io/c/ca-vient-de-sortir/creer-des-liens-de-partage-sur-airsaas)


### Comment exploiter les données d'effort exportées en CSV dans Excel ?

Lorsque vous exportez une vue portfolio contenant la colonne 'Effort' au format CSV, les données sont bien exportées en format numérique. Si vous rencontrez des difficultés pour convertir ces données en nombres dans Excel :

1. **Vérifiez les paramètres régionaux** de votre Excel (séparateur décimal, format de nombres)
2. **Utilisez la fonction 'Convertir'** d'Excel pour transformer le texte en nombre
3. **Vérifiez le format de cellule** : sélectionnez les cellules concernées et appliquez un format numérique

Si le problème persiste, contactez le support pour un accompagnement personnalisé.


---

## Intelligence Artificielle

### Comment activer l'assistant IA pour les briefs projets ?

Pour activer l'assistant IA qui vous aide à créer des briefs projets bien cadrés :

1. **Acceptez les conditions d'utilisation** : Un administrateur de votre workspace doit se rendre dans **Paramètres > AI** et accepter les CGU spécifiques à l'utilisation de l'IA

2. **Contactez le support** via le chat pour demander l'activation une fois les conditions acceptées

3. **Activation immédiate** : L'équipe AirSaas activera la fonctionnalité dans la foulée pour votre workspace

Une fois activé, vous pourrez utiliser l'assistant IA pour :
- Structurer vos briefs projets
- Anticiper les ressources nécessaires  
- Définir clairement les attendus et les gains
- Utiliser la dictée vocale (speech-to-text) pour créer vos briefs plus rapidement

**Accès direct** : Vous pouvez accéder à l'assistant via `https://app.airsaas.io/space/[votre-workspace]/redirect-ai-agent?agent_id=create_project_v1`

**Ressources utiles :**
- [Les biefs projet assistés par IA ✨](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)


### Comment accéder à l'assistant IA lors de la création d'un projet ?

L'assistant IA d'AirSaas vous aide à créer et cadrer vos nouveaux projets. Pour y accéder :

1. Allez dans **Portfolio > Projets**
2. Cliquez sur le bouton **"+"** pour créer un nouveau projet
3. Une bannière apparaîtra vous proposant de lancer l'assistance IA
4. Cliquez sur la bannière pour ouvrir l'assistant
5. Autorisez l'accès au microphone pour pouvoir dicter votre brief

**Important** : L'assistant IA n'intervient que lors de la création d'un nouveau projet. Il ne peut pas modifier ou analyser des projets existants.

Si vous voyez un bouton "Contactez-nous" à côté de "Votre assistant IA", c'est que la fonctionnalité n'est pas encore active sur votre workspace.

**Ressources utiles :**
- [Les biefs projet assistés par IA ✨](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)


### L'agent IA peut-il utiliser nos modèles de documentation internes ?

**État actuel** : L'agent IA génère du contenu basé sur ses propres modèles et les informations que vous lui fournissez pendant la conversation.

**Évolution prévue** : L'équipe produit a validé l'intégration future permettant à l'agent IA de :
- Se baser sur vos modèles de Gains configurés dans AirSaas
- Utiliser vos templates de Contexte projet
- Respecter automatiquement votre mise en forme standard

**Bénéfices attendus** :
- Cohérence avec vos standards internes
- Gain de temps (pas besoin de reformater)
- Meilleure adoption par les équipes

**Statut** : Cette amélioration sera intégrée dans les futures évolutions de l'agent IA.

**Ressources utiles :**
- [Les biefs projet assistés par IA ✨](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)


### Quelle technologie IA utilise AirSaas ?

Les informations détaillées sur le LLM (Large Language Model) utilisé par AirSaas sont disponibles dans votre interface :

**Où trouver ces informations :**
- Allez dans **Paramètres > AI ToS > General**
- Ces informations sont mises à jour à chaque nouvelle version

**Fonctionnalités IA disponibles :**
- **Assistant briefs projets** : aide au cadrage et à la structuration
- **Scénarios** : projections et anticipation de l'impact sur la charge (activation immédiate possible)

**Note** : Une nouvelle release avec des améliorations est prévue prochainement. Il est recommandé d'attendre cette version pour une expérience optimale.

**Ressources utiles :**
- [Les biefs projet assistés par IA](https://club.airsaas.io/c/ca-vient-de-sortir/les-biefs-projet-assistes-par-ia)


---

## Authentification et sécurité

### Comment configurer le SSO Microsoft (Azure AD/Entra ID) sur AirSaas ?

Pour configurer l'authentification SSO avec Microsoft Azure AD (Entra ID) sur AirSaas :

**1. Prérequis**
- Avoir un compte Azure AD avec les droits d'administration
- Identifier votre administrateur système qui gérera la configuration

**2. Configuration du SSO**
- La configuration nécessite l'intervention de notre équipe technique
- Prenez rendez-vous avec notre CTO via ce lien : https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2598d_9eh6MUQj9agRHpnU-3NC8VeC75gnEEObjDJ6zozMfVlaL4cjGqgTS2z4_BHqB3k5g_3J

**3. Intégration avec Microsoft Teams (optionnel)**
- Si vous souhaitez également connecter AirSaas avec Teams, consultez les prérequis ici : https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de
- Cette intégration permet à vos utilisateurs de recevoir des notifications AirSaas directement dans Teams

**Note** : La configuration SSO est spécifique à chaque organisation. Notre équipe technique vous accompagnera dans la mise en place pour garantir une intégration réussie.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)


### Comment mettre en place le SSO (Single Sign-On) sur AirSaas ?

Pour configurer le SSO AirSaas dans votre organisation :

**1. Documentation disponible**
- Consultez le guide complet : https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso
- Ce guide couvre les méthodes d'authentification disponibles et les étapes de configuration

**2. Interlocuteur dédié**
- **Matthieu Delanoë** est votre contact privilégié pour la mise en place du SSO
- Prenez rendez-vous directement : https://calendar.app.google/zstq2g46XG6mP4mr9

**3. Processus type**
- Un call de setup est organisé avec l'équipe support AirSaas
- Pendant ce call, votre équipe IT configure le SSO de votre côté
- L'équipe AirSaas effectue simultanément les paramétrages nécessaires côté plateforme
- Les deux configurations sont testées ensemble pour valider le bon fonctionnement
- Tests et validation avec quelques utilisateurs pilotes
- Déploiement à l'ensemble de l'organisation

**Note** : Le SSO permet à vos utilisateurs de se connecter avec leurs identifiants d'entreprise habituels, simplifiant l'adoption et renforçant la sécurité.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Comment activer le SSO après avoir configuré mon gestionnaire d'identité (Okta, Azure AD, etc.) ?

Si votre organisation a déjà configuré AirSaas dans votre gestionnaire d'identité (Okta, Azure AD, Google Workspace, etc.), voici comment finaliser l'activation du SSO :

**Prérequis**
- La configuration côté gestionnaire d'identité doit être complète
- Vous devez être administrateur AirSaas ou avoir les droits nécessaires

**Étapes d'activation**
1. Contactez le support AirSaas via le chat ou par email
2. Indiquez que la configuration côté IdP (Identity Provider) est terminée
3. Précisez le nom de votre gestionnaire d'identité (Okta, Azure AD, etc.)
4. Si possible, fournissez le contact de la personne qui a réalisé la configuration initiale

**Important**
- L'activation finale du SSO nécessite une intervention de l'équipe AirSaas
- Le processus prend généralement quelques heures une fois le contact établi
- Assurez-vous que les métadonnées SAML sont correctement configurées côté IdP

**Après activation**
- Les utilisateurs pourront se connecter via le bouton SSO sur la page de connexion
- L'authentification par login/mot de passe reste disponible selon votre configuration

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Comment configurer le rôle par défaut pour les utilisateurs SSO ?

Par défaut, les nouveaux utilisateurs qui accèdent via SSO peuvent recevoir un rôle trop permissif.

**Pour sécuriser l'accès :**
1. Demandez au support de configurer le rôle par défaut sur **Observateur**
2. Activez la validation obligatoire par les administrateurs pour les nouveaux membres

**Bonnes pratiques :**
- Le rôle Observateur permet la consultation sans modification
- Les administrateurs peuvent ensuite élever les droits selon les besoins
- La validation par les admins évite les accès non autorisés

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Que faire quand un utilisateur n'arrive pas à se connecter ?

Si un utilisateur ne parvient pas à se connecter, voici les étapes de diagnostic :

**1. Vérifier l'email utilisé**
- Assurez-vous qu'il n'y a pas de faute de frappe dans l'adresse email
- Vérifiez qu'un seul compte existe pour cet utilisateur (pas de doublon)

**2. Si l'utilisateur reçoit une demande de validation par email**
- Vérifier les spams
- S'assurer que l'adresse email est correcte
- Demander un renvoi du mail de validation

**3. Si vous utilisez le SSO (Single Sign-On)**
- Message "Accès refusé" → L'utilisateur doit être ajouté au groupe d'accès SSO par votre IT
- Contactez votre helpdesk informatique pour ajouter l'utilisateur

**4. Actions correctives**
- Se déconnecter complètement : https://app.airsaas.io/auth/logout
- Se reconnecter avec le bon email
- En cas de compte en double, contacter le support pour supprimer le compte erroné

**Prévention** : Activez l'option "Validation obligatoire par un admin" pour éviter les inscriptions avec des emails incorrects.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Pourquoi mes utilisateurs ne peuvent pas activer leur licence AirSaas avec le SSO ?

Si vos utilisateurs reçoivent une erreur lors de l'activation de leur licence AirSaas, c'est généralement lié à la configuration SSO.

**Solution :**
- Tous les utilisateurs invités sur AirSaas doivent d'abord être ajoutés dans le groupe de sécurité de votre Active Directory (Azure AD)
- Contactez le responsable de ce groupe d'accès dans votre organisation
- Une fois l'utilisateur ajouté au groupe de sécurité Azure, il pourra se connecter à AirSaas

**Important** : Cette étape est obligatoire pour chaque nouvel utilisateur dans les organisations utilisant le SSO.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Peut-on contourner le SSO pour certains utilisateurs ?

**Non, il n'est pas possible de contourner le SSO** pour les utilisateurs ayant une adresse email de votre domaine d'entreprise.

Le SSO a été activé pour des raisons de sécurité et nous devons l'appliquer systématiquement.

**Si un utilisateur ne peut pas se connecter avec le SSO :**
1. Vérifiez qu'il utilise bien son adresse email d'entreprise
2. Contactez votre département IT pour qu'ils ajoutent l'utilisateur au groupe autorisé dans votre annuaire
3. L'utilisateur pourra ensuite se connecter normalement via le SSO

**Note** : Les alias d'email ne devraient pas poser de problème, c'est le compte principal qui doit être autorisé.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Pourquoi mes utilisateurs externes n'arrivent pas à se connecter via SSO ?

Si vos utilisateurs externes rencontrent des erreurs de connexion ("utilisateur non reconnu" ou "identifiant/mot de passe invalide"), vérifiez ces points :

**1. Configuration dans votre IDP d'entreprise**
- L'utilisateur externe doit être autorisé à accéder à AirSaas dans votre Identity Provider
- Vérifiez que l'utilisateur apparaît bien dans la liste des accès autorisés

**2. Processus de réinitialisation**
- Après une réinitialisation, l'utilisateur doit refaire le processus complet de création de compte
- Il doit cliquer sur le lien reçu par email pour finaliser son inscription

**3. Distinction importante**
- Les captures d'écran d'erreur sur vos outils internes ne sont pas des erreurs AirSaas
- L'erreur "identifiant ou mot de passe invalide" provient généralement de votre système SSO, pas d'AirSaas

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)
- [Les utilisateurs externes sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/les-utilisateurs-externes-sur-airsaas)


### Pourquoi mes utilisateurs observateurs ne peuvent-ils pas se connecter (erreur SSO) ?

**Problème** : Les utilisateurs invités en tant qu'observateurs reçoivent une erreur lors de la connexion via SSO.

**Cause** : Il s'agit d'une restriction de sécurité de votre système SSO d'entreprise. Tous les utilisateurs externes invités sur AirSaas doivent être explicitement autorisés dans votre système SSO.

**Solution** :
1. Contactez le responsable de la gestion SSO de votre organisation
2. Demandez l'ajout des adresses email des observateurs à la liste blanche (whitelist) des accès autorisés
3. Cette autorisation doit être faite **avant** que les utilisateurs tentent de se connecter

**Important** : Cette configuration est gérée côté client, pas côté AirSaas. Chaque nouvel observateur devra être ajouté à cette liste blanche.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Comment accéder au Club AirSaas quand j'ai des problèmes de connexion ?

Si vous n'arrivez pas à accéder au Club AirSaas depuis l'application :

**1. Vérifiez votre connexion**
- Depuis AirSaas, cliquez sur le point d'interrogation en haut à droite
- Sélectionnez "Centre d'aide" puis "Voir la roadmap"
- Vérifiez que votre photo apparaît en haut à droite du Club

**2. Si vous n'êtes pas connecté automatiquement**
- Cherchez le bouton "Se connecter" en haut à droite
- Utilisez l'email professionnel associé à votre compte AirSaas

**3. Problèmes courants**
- **Conflit entre comptes** : Si vous avez un compte Gmail personnel et un email professionnel, des conflits peuvent survenir
- **Connexion SSO ancienne** : Une ancienne connexion Gmail peut bloquer l'authentification
- **Message "you cannot perform this action"** : Indique généralement un problème d'authentification

**Solution** : Si le problème persiste, contactez le support via le chat. Une connexion Gmail réalisée il y a longtemps peut nécessiter une intervention manuelle.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Que faire si un utilisateur ne peut pas accéder au workspace après avoir créé son compte ?

Si un utilisateur a finalisé toutes les étapes de création de compte mais ne peut toujours pas accéder à votre workspace, il s'agit probablement d'un problème de synchronisation des droits.

**Symptômes typiques :**
- Message d'erreur lors de l'accès au workspace
- Écran vide après connexion
- L'utilisateur a bien reçu et cliqué sur le lien d'invitation
- Les étapes de création de compte sont terminées

**Solution immédiate :**
Contactez le support AirSaas via le chat en indiquant :
- Le nom de l'utilisateur concerné
- Votre workspace
- Le message d'erreur exact (capture d'écran si possible)

Le support pourra resynchroniser les droits d'accès manuellement. L'utilisateur pourra ensuite réessayer de se connecter.

**Note :** Ce problème est en cours d'investigation par l'équipe technique pour une résolution définitive.


### Où trouver les informations sur la conformité RGPD et les traitements de données ?

Pour les questions juridiques et de conformité :

**1. Documentation disponible**
- Les CGU détaillent les traitements de données
- La politique de confidentialité est accessible depuis le site

**2. Pour des questions spécifiques**
- Contactez le support via le chat pour obtenir :
  - Les détails sur les traitements de données
  - Les mesures de sécurité mises en place
  - Les éventuels transferts de données hors UE
  - Les certifications et conformités

**3. Validation juridique**
- Le support peut fournir la documentation nécessaire pour votre service juridique
- Des calls peuvent être organisés avec vos équipes juridiques si nécessaire


---

## Gestion des projets

### Comment fonctionne la progression des projets : automatique ou manuelle ?

AirSaas propose **deux modes de calcul** pour la progression de vos projets :

**1. Mode manuel**
- Vous ajustez librement le curseur de progression selon votre appréciation
- Idéal quand la progression ne se résume pas uniquement aux jalons terminés

**2. Mode automatique**
- La progression se calcule automatiquement en fonction de l'avancement de vos jalons
- Le calcul peut prendre en compte la proportion de jalons terminés

**Note importante** : Le modèle de calcul de la progression est en cours d'évolution. Vous pouvez participer à la réflexion sur le Club AirSaas pour influencer les futures améliorations.

**Ressources utiles :**
- [Participez à la discussion sur l'évolution du calcul de progression](https://club.airsaas.io/c/proposez-vos-features/avancement-projet-vs-jalons)


### Comment fonctionnent l'avancement du projet et l'avancement des jalons ?

**Deux avancements indépendants**

- **Avancement du projet** : saisie manuelle par le chef de projet
- **Avancement des jalons** : calculé automatiquement

**Calcul automatique de l'avancement des jalons**

Le système calcule l'avancement global des jalons en :
1. Prenant l'avancement de chaque jalon (en %)
2. Pondérant par le poids de chaque jalon
3. Faisant la moyenne pondérée

**Pourquoi cette indépendance ?**

Cette flexibilité permet de :
- Tenir compte d'éléments non trackés dans les jalons
- Ajuster l'avancement projet selon d'autres facteurs (risques, contexte)
- Utiliser l'avancement des jalons comme indicateur lors des revues projet

**Suggestion d'amélioration**

Si vous gérez exhaustivement vos jalons, vous pouvez utiliser l'avancement calculé des jalons comme référence pour mettre à jour manuellement l'avancement du projet lors de vos revues régulières.


### Comment dupliquer un projet ?

Pour dupliquer un projet existant :

1. Ouvrez le projet que vous souhaitez dupliquer
2. Cliquez sur le menu du projet en haut à droite de la page
3. Sélectionnez l'option **Dupliquer**

Cette fonctionnalité est particulièrement utile lorsque vous lancez plusieurs projets similaires simultanément. La duplication vous permet de conserver la structure et les paramètres du projet original, vous faisant gagner un temps précieux lors de la création de nouveaux projets.

**Note** : Lors de la duplication, vous pourrez choisir quels éléments conserver (jalons, équipes, dates, etc.) selon vos besoins.

**Ressources utiles :**
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Comment récupérer un projet supprimé par erreur ?

Si vous avez supprimé un projet par erreur, pas de panique ! Il est possible de le récupérer.

**Marche à suivre :**
1. Contactez immédiatement le support via le chat ou par email
2. Indiquez le nom exact du projet supprimé
3. Le support pourra restaurer votre projet rapidement

**Bon à savoir :**
- La confusion entre "archiver" et "supprimer" est fréquente
- Pour masquer temporairement un projet sans le perdre, utilisez plutôt la fonction "Archiver" disponible depuis octobre 2025
- L'archivage permet de désencombrer votre portfolio tout en gardant l'accès aux projets terminés ou abandonnés

**Ressources utiles :**
- [Archiver les vieux trucs pour y voir plus clair](https://club.airsaas.io/c/ca-vient-de-sortir/archiver-les-vieux-trucs-pour-y-voir-plus-clair)


### Comment retrouver un projet archivé ?

Pour retrouver un projet archivé :

1. Allez dans votre vue portfolio habituelle
2. Activez l'option **"Afficher les projets archivés"** dans les paramètres de la vue
3. Les projets archivés apparaîtront alors dans votre vue avec les projets actifs

**Note** : Cette option est disponible sur toutes les vues du portfolio (kanban, liste, timeline, tableau).

**Ressources utiles :**
- [Archiver les vieux trucs pour y voir plus clair](https://club.airsaas.io/c/ca-vient-de-sortir/archiver-les-vieux-trucs-pour-y-voir-plus-clair)


### Comment fonctionne la revue de projet (project review) ?

La **revue de projet** est une fonctionnalité qui permet de collecter automatiquement les retours d'expérience à la fin d'un projet.

**Quand l'utiliser :**
- Lorsque vous livrez ou terminez un projet
- Pour capitaliser sur les apprentissages
- Pour améliorer vos pratiques futures

**Comment ça fonctionne :**
1. À la fin du projet, une option **"Project Review"** apparaît
2. Si vous l'activez, toutes les personnes impliquées dans le projet reçoivent une notification
3. Elles sont invitées à partager leurs feedbacks structurés
4. Les retours sont centralisés pour analyse

**Qui reçoit les notifications :**
- Toutes les personnes ajoutées au projet (responsable, équipes impliquées, sponsors, etc.)
- Uniquement si vous activez explicitement la fonctionnalité

**Note** : C'est optionnel - si vous ne l'activez pas, personne ne reçoit de notification.

**Ressources utiles :**
- [Faire un bilan projet efficace](https://club.airsaas.io/c/debuter-sur-airsaas/onglet-bilan-dans-les-pages-projet)


### Pourquoi mes projets disparaissent après création ?

Si vos projets semblent disparaître après leur création, voici les points à vérifier :

**1. Vérifiez le rattachement au programme**
- Lors de la création, assurez-vous de sélectionner le bon programme
- Un projet mal rattaché n'apparaîtra pas dans les vues filtrées sur un programme spécifique

**2. Contrôlez vos filtres de vue**
- Vos vues peuvent avoir des filtres actifs (statut, programme, équipe...)
- Créez une vue "Tous les projets" sans filtre pour retrouver vos projets

**3. Après création du projet**
- Vérifiez que vous arrivez bien sur la page du projet créé
- Si oui, le projet existe bien, c'est juste un problème de visibilité dans vos vues

**Solution rapide** : Allez dans la vue "Tous les projets" ou désactivez temporairement tous les filtres pour retrouver votre projet et corriger son rattachement.


### Pourquoi mon projet apparaît "en retard" malgré une mise à jour récente ?

Le statut **"en retard"** suit une logique précise liée à la fréquence de vos rappels de mise à jour.

**Marges de tolérance selon la fréquence :**
- **Rappel hebdomadaire** : mise à jour acceptée jusqu'à 1 jour avant
- **Rappel bi-mensuel** : mise à jour acceptée jusqu'à 2 jours avant
- **Rappel mensuel** : mise à jour acceptée jusqu'à 4 jours avant

**Exemple concret :**
Si votre rappel est le jeudi :
- ✅ Mise à jour mercredi = OK
- ❌ Mise à jour lundi = Trop tôt, considérée comme appartenant à la semaine précédente

**Pourquoi cette logique ?**
- Garantir que les informations sont à jour pour les réunions de gouvernance
- Éviter la confusion entre les itérations
- Maintenir un rythme régulier de suivi

**Conseil** : Planifiez vos mises à jour juste avant vos réunions de revue pour maximiser la fraîcheur des informations.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Pourquoi je ne peux pas modifier la progression du projet ?

La progression du projet peut être désactivée par vos administrateurs. Voici comment vérifier et comprendre votre situation :

**Où modifier la progression (si activée)** :
- Depuis la page projet
- Dans la colonne de droite, vers le haut
- Un champ permet de saisir le pourcentage

**Si vous ne voyez pas ce champ** :
Votre organisation a désactivé la progression globale des projets au profit de la progression des jalons. C'est un réglage global défini par vos administrateurs.

**Cas particulier - Vue présentation** :
Si la progression projet est désactivée mais apparaît toujours dans la vue présentation avec une valeur à 0%, c'est une incohérence. Dans ce cas :
- Utilisez plutôt la progression des jalons pour suivre l'avancement
- Contactez vos administrateurs pour clarifier la configuration

**Alternative** : La progression des jalons reste disponible et peut servir d'indicateur d'avancement plus précis.


### Comment supprimer un projet dans AirSaas ?

Pour supprimer un projet dans AirSaas :

**Méthode standard :**
1. Ouvrez la page du projet que vous souhaitez supprimer
2. Cliquez sur les trois petits points en haut à droite de la page
3. Sélectionnez "Supprimer" dans le menu déroulant

**Important à savoir :**
- Normalement, si vous avez créé un projet, vous devriez pouvoir le supprimer
- Cependant, dans certains cas, les droits de suppression peuvent être restreints par votre organisation
- Si vous ne voyez pas l'option "Supprimer" alors que vous avez créé le projet, contactez votre administrateur AirSaas ou le support

**Cas particuliers :**
- Les projets publics ne peuvent pas être repassés en privé avant suppression
- Les administrateurs peuvent supprimer n'importe quel projet de l'organisation


### Quelle est la différence entre Solutions et Produits dans AirSaas ?

**Concept actuel des Solutions**

Les solutions dans AirSaas sont traitées comme des produits qui peuvent être :
- Développés en interne
- Des produits du marché (ex: Salesforce)

Vous pouvez associer un projet à une solution. Par exemple, une évolution Salesforce = un projet AirSaas lié à la solution Salesforce.

**Limitations actuelles**
- Fonctionnalité legacy peu maintenue
- Une seule solution peut être liée à un projet (alors qu'en réalité, un projet impacte souvent plusieurs solutions)

**Évolution à venir : les Features**

Cette partie sera entièrement refaite avec un nouvel objet "Fonctionnalités" qui :
- Permettra de suivre les évolutions produits
- Contribuera au développement d'un produit
- Remplacera "Solutions" par "Produits"
- Nécessite d'abord la gestion multi-équipes sur les jalons

**Ressources utiles :**
- [Les jalons multi-équipes](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)


### Comment suivre le reste à faire sur un projet ?

Actuellement, AirSaas permet de suivre :
- Les efforts initiaux prévus
- Les efforts consommés
- Pour les budgets : la notion d'**atterrissage** qui permet d'estimer le budget final

En revanche, il n'existe pas encore de fonctionnalité pour saisir le "reste à faire" (RAF) sur les efforts. Cette notion est importante pour avoir une vision réaliste de l'avancement d'un projet au-delà du simple ratio consommé/initial.

**Alternative actuelle** : Vous pouvez utiliser les commentaires ou les posts dans le projet pour communiquer sur le reste à faire estimé par l'équipe.


---

## Notifications

### Quelles actualités déclenchent une notification email ?

**Notifications immédiates** - Vous recevez un email pour :
- Les mentions directes (@votrenom)
- Les décisions
- Les points d'attention
- Les mises à jour météo
- Les changements sur vos tâches assignées

**Pas de notification immédiate** pour :
- Les actualités simples (messages d'information)
- Les commentaires où vous n'êtes pas mentionné

**Récapitulatif hebdomadaire** :
Tous les vendredis, vous recevez un email récapitulatif de toutes les actualités de vos projets, y compris les actualités simples.

**Astuce** : Pour garantir une notification sur une actualité importante, utilisez :
- La fonction Météo (avec possibilité de rappels automatiques)
- Les mentions @ pour notifier des personnes spécifiques
- Les décisions ou points d'attention selon le contexte

### Comment activer la newsletter hebdomadaire pour les sponsors ?

La newsletter hebdomadaire (appelée "Bilan de santé") permet d'informer automatiquement les sponsors de l'avancement des projets :

**Activation :**
1. Allez dans vos paramètres de notifications (icône profil > Paramètres > Notifications)
2. Cochez la case "Bilan de santé"
3. Sauvegardez

**Fonctionnement :**
- **Qui reçoit la newsletter ?** Les utilisateurs qui suivent des projets (sponsors, membres d'équipe, ou abonnés manuels)
- **Quand ?** Deux envois : vendredi 15h et lundi matin
- **Conditions d'envoi :**
  - Au moins un projet vital suivi a eu sa météo mise à jour
  - OU un projet suivi est en retard de mise à jour météo

**Important :** 
- Chaque utilisateur doit activer individuellement cette option dans ses paramètres
- Les sponsors doivent être ajoutés comme sponsors sur les projets concernés
- La fonctionnalité doit être activée au niveau de votre organisation (contactez le support si ce n'est pas le cas)

**Astuce :** Pour s'assurer que vos sponsors reçoivent bien les informations, vérifiez qu'ils sont bien identifiés comme sponsors sur les projets et qu'ils ont activé l'option dans leurs paramètres.

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas 👑](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Qui reçoit une notification lors de la publication d'un compte-rendu ?

Lors de la publication d'un compte-rendu, **toutes les personnes participant au projet** reçoivent automatiquement une notification par email.

Pour vérifier qui recevra la notification :
1. Rendez-vous sur la page du projet concerné
2. Consultez le bloc **"Personnes impliquées"**
3. Toutes les personnes listées dans ce bloc recevront la notification

**Note importante** : Les sponsors seuls ne sont pas notifiés automatiquement, sauf s'ils font partie des personnes impliquées dans le projet.


### Comment notifier les participants qu'un compte-rendu est disponible ?

Pour informer les participants qu'un compte-rendu est disponible, vous avez plusieurs options :

**1. Notification instantanée par mention**
- Mentionnez chaque participant directement dans le compte-rendu avec @nom
- Ou mentionnez-les dans un commentaire du post
- Ils recevront une notification immédiate

**2. Email récapitulatif automatique**
- Sans mention, les participants recevront le CR dans leur email hebdomadaire du lendemain matin

**3. Intégration MS Teams (recommandé)**
- Connectez votre projet AirSaas à un canal MS Teams
- Le CR sera automatiquement posté sur Teams en instantané
- Tous les membres du canal seront notifiés
- Configuration : Projet > Paramètres > Connecter à MS Teams

**Note** : Les notifications de mise à jour de CR ne sont pas configurables dans "Mon profil > Gestion des notifications" car elles dépendent des mentions.

**Ressources utiles :**
- [AirSaas et MS Teams, une affaire de 💙](https://club.airsaas.io/c/debuter-sur-airsaas/airsaas-et-ms-teams-une-affaire-de)
- [Comment fonctionnent les notifications sur AirSaas ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-fonctionnent-les-notifications-sur-airsaas)
- [Synchroniser votre projet AirSaas avec MS Teams 🫶](https://club.airsaas.io/c/ca-vient-de-sortir/synchroniser-votre-projet-airsaas-avec-ms-teams)


### Comment fonctionnent et se configurent les notifications dans AirSaas ?

**Principe général** :
Chaque utilisateur contrôle ses propres notifications depuis son centre de notifications. Il n'y a pas de configuration globale imposée.

**Qui reçoit quoi** :
- **Personnes taguées** : Reçoivent une notification quand elles sont mentionnées
- **Membres du projet** : Peuvent s'abonner aux mises à jour du projet
- **Responsables** : Notifiés automatiquement des éléments dont ils sont responsables
- **Participants** : Notifiés selon leur rôle (décideur, partie prenante, etc.)

**Configuration personnelle** :
1. Accédez à votre centre de notifications (icône cloche)
2. Cliquez sur les paramètres
3. Choisissez pour chaque catégorie :
   - Notification in-app uniquement
   - Email immédiat
   - Email récapitulatif
   - Aucune notification

**Catégories principales** :
- Assignations (décisions, jalons, projets)
- Mentions et réponses
- Mises à jour de projets suivis
- Rappels d'échéances
- Changements importants (météo, dates)

**Bonnes pratiques** :
- Activez les emails pour les assignations critiques
- Utilisez le récap hebdomadaire pour les projets suivis
- Désactivez les notifications des projets moins prioritaires

**Ressources utiles :**
- [Comment fonctionnent les notifications mail sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/comment-fonctionnent-les-notifications-mail-sur-airsaas)
- [Personnalisez vos notifications](https://club.airsaas.io/c/secret/personnalisez-vos-notifications)
- [Comment ne rien louper des projets qui vous intéressent](https://club.airsaas.io/c/debuter-sur-airsaas/comment-ne-rien-louper-des-projets-qui-vous-interessent)


### Comment activer les notifications pour tous les utilisateurs de mon organisation ?

**Activation individuelle uniquement**
Actuellement, chaque utilisateur doit activer ses propres notifications. Il n'est pas possible pour un administrateur d'activer des notifications pour toute l'organisation.

**Solution recommandée**
1. Le support peut vous fournir un template d'email
2. Envoyez ce template à vos collaborateurs
3. Chaque utilisateur active ses notifications depuis ses paramètres personnels

**Pour activer le bilan hebdomadaire**
- Aller dans Paramètres > Notifications
- Cocher "Bilan de santé hebdo de vos projets (lundi 8h)"

**Ressources utiles :**
- [Une gestion fine de ses notifications](https://club.airsaas.io/c/ca-vient-de-sortir/une-gestion-fine-de-ses-notifications)
- [Passez à l'échelle la mise à jour des météos projets dans l'orga](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Les modifications de décisions génèrent-elles des notifications ?

**Non, les modifications du contenu (description) d'une décision ne génèrent pas de notification automatique.**

Cependant, toutes les modifications sont bien tracées :
- Les changements sont enregistrés dans l'**historique de la décision**
- Accessible via le menu "..." en haut à droite de la décision
- Vous y trouverez qui a modifié quoi et quand

**Important :** L'absence de notification n'est pas une "faille" - c'est un comportement voulu pour éviter de surcharger les utilisateurs de notifications sur chaque modification mineure.

**Ressources utiles :**
- [Panel des décisions du projet 🎯](https://club.airsaas.io/c/ca-vient-de-sortir/panel-des-decisions-du-projet)


### Comment activer les notifications email récapitulatives ?

Pour activer les notifications email récapitulatives (bilan de santé) pour les utilisateurs peu actifs :

1. Accédez aux paramètres de votre espace de travail
2. Rendez-vous dans la section **Centre de notifications**
3. Activez l'option correspondante aux emails récapitulatifs

Lien direct : `https://app.airsaas.io/space/[votre-espace]/settings/notification-center`

Cette fonctionnalité est particulièrement utile pour garder informés les utilisateurs qui n'ont pas le temps de se connecter régulièrement à AirSaas.

**Ressources utiles :**
- [Un email pour les directeurs qui n'ont pas l'temps ✉️ ✨](https://club.airsaas.io/c/ca-vient-de-sortir/un-email-pour-les-directeurs-qui-n-ont-pas-l-temps)


### Dans quelle langue sont envoyés les emails AirSaas ?

AirSaas envoie les emails automatiques dans la langue configurée dans les paramètres de chaque utilisateur.

**État actuel** (mars 2026) :
- La plupart des emails respectent déjà la langue de l'utilisateur
- Certains emails legacy peuvent encore arriver dans la langue par défaut
- Migration complète prévue pour fin janvier 2026

**Pour vérifier/modifier votre langue** :
1. Allez dans vos paramètres utilisateur
2. Sélectionnez votre langue préférée
3. Les futurs emails seront envoyés dans cette langue

**Emails concernés** :
- Weekly project health summary (bilan hebdomadaire)
- Notifications de mise à jour
- Rappels automatiques
- Invitations et alertes

**Ressources utiles :**
- [Gérer un portfolio projet en contexte multi langue 🇫🇷 🇬🇧 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/gerer-un-portfolio-projet-en-contexte-multi-langue)


---

## Comptes rendus et reporting

### Comment partager un rapport flash avec un utilisateur en lecture seule ?

Actuellement, les rapports flash **n'ont pas de lien direct partageable**. Le lien que vous voyez correspond à votre vue privée qui a généré le rapport.

**Solutions disponibles** :

1. **Export PowerPoint** (recommandé)
   - Cliquez sur le bouton d'export en haut à droite du portfolio
   - Choisissez "Exporter en PPT"
   - Partagez le fichier PowerPoint généré

2. **Partage de vue** (si l'utilisateur a accès)
   - Créez une vue publique avec les mêmes filtres
   - Partagez le lien de cette vue publique

**À venir** : L'équipe AirSaas travaille sur des liens dédiés pour les rapports flash qui permettront un partage direct.

**Ressources utiles :**
- [Créer des liens de partage sur AirSaas](https://club.airsaas.io/c/ca-vient-de-sortir/creer-des-liens-de-partage-sur-airsaas)


### Pourquoi mon export PowerPoint du rapport flash est-il tronqué ou illisible ?

L'export PowerPoint des rapports flash présente des **limitations techniques** :

**Problèmes courants** :
- Textes tronqués ou qui se chevauchent
- Informations masquées ou coupées
- Mise en page non optimale

**Raison** : Le format PowerPoint ne permet pas le défilement (scrolling), contrairement à l'interface web d'AirSaas. Tout le contenu doit tenir sur des slides fixes.

**Solutions temporaires** :
1. **Réduire le contenu** avant l'export
   - Filtrez pour afficher moins de projets
   - Masquez certains attributs non essentiels

2. **Captures d'écran**
   - Faites des captures de l'interface AirSaas
   - Plus fidèle à l'affichage original

3. **Attendre la nouvelle fonctionnalité**
   - L'équipe travaille sur un système de partage natif des rapports
   - Permettra l'accès direct sans export


### Comment créer un bilan des projets terminés sur une année ?

Pour créer un bilan des projets terminés sur une année spécifique :

**Méthode 1 : Via les vues filtrées**
1. Créez une nouvelle vue dans le portfolio projets
2. Appliquez les filtres suivants :
   - Statut = "Terminé"
   - Date de fin = année souhaitée (ex: "entre 01/01/2025 et 31/12/2025")
   - Programme = sélectionnez le programme concerné (si applicable)

**Points d'attention :**
- Vérifiez d'abord que tous vos projets terminés ont bien une date de fin renseignée
- Identifiez les projets sans programme associé qui pourraient être exclus

**Méthode 2 : Export depuis le back office**
Si vous avez besoin de la date exacte de passage au statut "Terminé" (et non la date de fin planifiée), contactez le support qui peut vous fournir un export détaillé depuis le back office.

**Astuce :** Une fois votre vue créée, vous pouvez l'exporter en CSV pour une analyse plus poussée ou la partager avec vos équipes.

**Ressources utiles :**
- [Afficher les dates de création](https://club.airsaas.io/c/ca-vient-de-sortir/afficher-les-dates-de-creation)


### Comment modifier et sauvegarder le titre d'un rapport ?

**Procédure pour modifier un titre de rapport**
1. Passez en mode édition du rapport
2. Modifiez le nom du rapport
3. **Important** : Cliquez ailleurs dans la page (pas sur le bouton sauvegarder)
4. Attendez que le symbole de sauvegarde en haut passe :
   - 🟠 Orange (sauvegarde en cours)
   - 🟢 Vert (sauvegarde effectuée)
5. Cliquez ensuite sur le bouton "Sauvegarder"

**Pourquoi cette procédure ?**
Le système effectue une sauvegarde automatique avant la sauvegarde manuelle. Cliquer directement sur sauvegarder peut parfois court-circuiter ce processus.


### Comment coller du texte dans les comptes rendus sans qu'il se transforme en image ?

**Comportement par défaut**
AirSaas conserve le formatage lors du copier-coller pour préserver la mise en forme depuis les pages web, emails et la plupart des applications.

**Cas particulier : OneNote**
Lorsque vous copiez depuis OneNote, le contenu est transformé en image. Pour coller en texte brut :
1. Copiez votre texte depuis OneNote
2. Dans le compte rendu AirSaas, faites **clic droit**
3. Sélectionnez **"Coller en texte brut"**

**Autres sources**
Depuis Word, Google Docs, ou d'autres applications, le copier-coller fonctionne normalement sans transformation en image.


### Peut-on créer et modifier des tableaux dans les comptes rendus ?

**Situation actuelle**
La création et modification de tableaux directement dans les comptes rendus n'est pas encore disponible.

**Solution temporaire**
1. Créez votre tableau dans Excel ou OneNote
2. Copiez-collez le tableau dans le compte rendu
3. Le tableau sera collé comme image (non modifiable)

**Limitations**
- Les tableaux collés ne peuvent pas être modifiés après insertion
- Pour modifier, il faut retourner dans l'outil source et recoller

**Statut de la fonctionnalité**
Cette fonctionnalité a été étudiée mais n'est pas encore dans la roadmap de développement. L'équipe produit est consciente du besoin.


### Comment partager un compte-rendu pour validation avec des utilisateurs en lecture seule ?

Actuellement, il n'est pas possible d'exporter les comptes-rendus dans un format éditable (Word, etc.).

**Solutions alternatives recommandées** :

1. **Validation en fin de réunion** : Gardez 5 minutes en fin de meeting pour relire ensemble le CR et l'amender/valider avant envoi. Cela libère la charge mentale du rédacteur.

2. **Utiliser les commentaires** : Les utilisateurs en lecture seule peuvent commenter le post du compte-rendu pour suggérer des modifications.

3. **Partage avec mention** : Ajoutez un commentaire type "Si amendement/correction, je suis à votre disposition" et mentionnez les participants.

**Ressources utiles :**
- [Édition collaborative des Comptes Rendus](https://club.airsaas.io/c/ca-vient-de-sortir/edition-collaborative-des-comptes-rendus)


### Comment optimiser l'affichage des comptes rendus ?

**Espacement entre les lignes**
Actuellement, l'espacement entre les bullet points dans les comptes rendus n'est pas modifiable. Cette fonctionnalité a été identifiée comme une amélioration future.

**Autres options de formatage disponibles**
- Utilisation de sous-tâches avec indentation
- Formatage du texte (gras, italique)
- Insertion de cases à cocher

**Astuce** : Pour une meilleure lisibilité, vous pouvez structurer votre contenu avec des sous-titres en gras et utiliser l'indentation pour créer une hiérarchie visuelle.


### Peut-on ajouter un lien direct vers les comptes rendus dans la vue portfolio ?

**Actuellement non disponible**. Il n'est pas possible d'ajouter un lien direct vers un compte rendu spécifique depuis la vue portfolio des projets.

**Workflow actuel** :
1. Ouvrir le projet depuis le portfolio
2. Accéder à l'onglet des comptes rendus
3. Sélectionner le compte rendu souhaité

**Pourquoi cette limitation** : Les projets peuvent avoir plusieurs comptes rendus, il faudrait un mécanisme pour identifier lequel afficher en priorité dans le portfolio.

**Astuce** : En attendant cette fonctionnalité, vous pouvez ouvrir les projets dans des onglets séparés (clic droit → "Ouvrir dans un nouvel onglet") pour naviguer plus rapidement entre les comptes rendus pendant vos réunions.


---

## Météo et statuts projet

### Comment ajouter un commentaire à la météo sans changer sa valeur ?

Pour ajouter un commentaire à votre météo projet :

1. Cliquez sur l'icône météo de votre projet
2. Dans la modal qui s'ouvre, vous pouvez :
   - Garder la valeur météo actuelle sans la modifier
   - Ajouter votre commentaire dans le champ texte
3. Cliquez sur le bouton bleu **"Changer la météo"** pour valider

**Note** : Le bouton apparaît même si vous ne changez pas la valeur météo, il sert aussi à valider le commentaire seul.


### Comment fonctionnent les périodes d'acceptation pour les mises à jour météo ?

Les mises à jour météo dans AirSaas suivent un système de **périodes d'acceptation** qui détermine si votre mise à jour valide l'occurrence courante :

**Périodes d'acceptation selon la fréquence :**
- Fréquence d'1 semaine → période d'acceptation de 1 jour
- Fréquence de 2 semaines → période d'acceptation de 2 jours
- Fréquence de 3 semaines → période d'acceptation de 3 jours
- Fréquence de 4 semaines → période d'acceptation de 4 jours

**Comment ça fonctionne :**
- Si vous mettez à jour la météo **dans** la période d'acceptation (ex: 3 derniers jours pour une fréquence de 3 semaines), l'occurrence est validée et la prochaine échéance est calculée
- Si vous mettez à jour **avant** la période d'acceptation (ex: 4 jours avant pour une fréquence de 3 semaines), il faudra quand même la mettre à jour à nouveau dans la période prévue

**Philosophie du système :**
L'idée est de créer un engagement entre le sponsor et le chef de projet sur un jour régulier de mise à jour (ex: tous les mardis). Cela permet d'anticiper les réunions de suivi et de créer un rythme prévisible.

**Conseil pratique :**
Pour éviter les alertes intempestives avec plusieurs projets, planifiez vos mises à jour le même jour de la semaine pour tous vos projets.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Comment contourner le commentaire obligatoire lors du changement de statut ?

AirSaas considère qu'un changement de statut est un moment fort dans la vie du projet qui nécessite d'être expliqué pour une meilleure communication. Cependant, nous comprenons que pour les organisations gérant un volume important de projets, cela peut représenter une charge administrative.

**Solution temporaire :**
- Vous pouvez simplement taper un espace dans le champ commentaire pour valider le changement de statut
- Cette astuce permet de maintenir la fiabilité et la fréquence des actualisations sans lourdeur excessive

**À noter :**
- Cette demande de rendre le commentaire optionnel est enregistrée dans notre roadmap
- L'équipe produit étudie la meilleure façon de concilier traçabilité et efficacité

💡 **Conseil :** Pour les statuts critiques comme "Terminé", nous recommandons tout de même d'ajouter du contexte pour l'historique du projet.


### Comment supprimer une météo déjà saisie sur un projet ?

Actuellement, il n'est pas possible de supprimer directement une météo depuis l'interface AirSaas. Une fois qu'une météo a été saisie sur un projet, elle ne peut pas être retirée par l'utilisateur.

**Cas d'usage typique :**
- Projets en phase "idée à valider" qui ne doivent pas encore avoir de météo selon votre processus
- Météo saisie par erreur sur un projet
- Changement de statut d'un projet nécessitant de retirer temporairement la météo

**Solution actuelle :**
Contactez le support AirSaas via le chat en précisant :
- Le nom exact du projet concerné
- La raison de la suppression (erreur de saisie, processus interne, etc.)

L'équipe support pourra alors supprimer manuellement la météo pour vous.

**Note :** Cette limitation est identifiée et une évolution permettant de gérer directement les météos depuis l'interface est envisagée.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Peut-on supprimer une mise à jour météo en doublon ?

**Actuellement, il n'est pas possible de supprimer une mise à jour météo directement depuis l'interface.**

Cette limitation existe car les mises à jour météo sont connectées à plusieurs fonctionnalités :
- Les rappels automatiques de mise à jour
- L'historique du projet
- Les notifications

**Solutions disponibles :**
- **Modifier le texte** : Le chef de projet peut éditer le contenu de la mise à jour météo pour corriger l'erreur
- **Contacter le support** : En cas de doublon important, le support peut supprimer manuellement la mise à jour

**À venir** : L'équipe AirSaas travaille sur cette fonctionnalité pour permettre la suppression directe des mises à jour météo.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Comment mettre un projet en pause/suspend ?

Pour mettre un projet en pause :

1. **Créer un statut "En pause"** (nécessite les droits admin) :
   - Allez dans les paramètres de votre workspace
   - Section "Statuts de projet"
   - Ajoutez un nouveau statut "En pause" ou "Suspendu"

2. **Appliquer ce statut** à vos projets en pause

3. **Exclure ces projets** de vos vues portfolio :
   - Dans vos vues, ajoutez un filtre pour exclure le statut "En pause"
   - Cela permet de garder les projets accessibles sans encombrer vos vues actives

**Note** : Seuls les administrateurs de votre organisation peuvent ajouter de nouveaux statuts.


### Pourquoi je ne peux pas réorganiser certains statuts projet ?

**Limitation système**
Les statuts projet sont organisés en catégories fixes :
- **Statuts d'exécution** : projets en cours
- **Statuts terminés** : projets finis ou abandonnés

Il est impossible de déplacer un statut d'une catégorie à l'autre.

**Solution**
1. Créez un nouveau statut "En pause" dans la catégorie souhaitée
2. Migrez manuellement vos projets vers ce nouveau statut
3. Supprimez l'ancien statut une fois la migration terminée

**Pour les projets existants**
Si vous avez beaucoup de projets avec l'ancien statut :
- Utilisez une vue filtrée pour les identifier
- Demandez au support une migration en masse si nécessaire
- Planifiez cette réorganisation lors d'une période calme

**Conseil**
Réfléchissez bien à la catégorie de vos statuts lors de leur création. Un projet "En pause" est-il toujours en exécution ou considéré comme terminé dans votre organisation ?

**Ressources utiles :**
- [[Admin] Customiser les statuts projets](https://club.airsaas.io/c/debuter-sur-airsaas/customiser-les-statuts-projets)


### Comment personnaliser les termes de la météo projet ?

**Actuellement, les noms des statuts météo ne sont pas personnalisables** (Ensoleillé, Nuageux, Bloqué).

**Distinction importante :**
- **Météo bloqué** = Alerte du responsable que le projet nécessite une attention managériale ou une décision
- **Statut projet (ex: Gelé)** = État officiel du projet dans son cycle de vie

**Solutions de contournement :**

1. **Ajouter un item dans votre template de météo**
   - Accédez aux paramètres : Settings > Projets > Templates
   - Ajoutez un item "Décision requise" dans votre template
   - Lien : https://app.airsaas.io/space/[votre-espace]/settings/project/templates

2. **Créer un modèle dédié pour les météos bloquées**
   - Créez un template spécifique quand une décision est requise
   - Exemple disponible : https://app.airsaas.io/space/gamma-corp/settings/project/templates

**Note :** Le besoin de personnaliser les noms des statuts météo a été remonté à l'équipe produit.


---

## Présentations

### Comment contrôler quelles décisions apparaissent dans les présentations ?

Les présentations et rapports digitalisés n'affichent que les éléments **épinglés** des projets et programmes.

**Pour masquer une décision ancienne :**
1. Ouvrez le projet concerné
2. Allez dans l'onglet "Épinglé" du fil d'actualité
3. Trouvez la décision à masquer
4. Cliquez sur l'icône épingle pour la dés-épingler
5. Elle disparaîtra automatiquement de vos présentations

**Principe général :** Vous contrôlez exactement ce qui apparaît en présentation via les items épinglés. Cela fonctionne pour :
- Les décisions
- Les points d'attention
- Les jalons (livrables intermédiaires à produire dans un trimestre maximum)
- Les notes importantes

**Conseil :** Faites régulièrement le ménage dans vos éléments épinglés pour garder des présentations pertinentes.


### Pourquoi mes jalons n'apparaissent pas en mode présentation ?

Si vos jalons n'apparaissent pas dans le planning lors du mode présentation, c'est qu'ils ne sont pas épinglés.

**Pour épingler vos jalons :**
1. Allez dans votre projet
2. Ouvrez le panneau des jalons
3. Vérifiez l'onglet "Jalons épinglés" - s'il est vide, c'est normal que rien n'apparaisse en présentation
4. Survolez chaque jalon que vous souhaitez voir en présentation
5. Cliquez sur le bouton d'épinglage qui apparaît au survol

Les jalons épinglés apparaîtront automatiquement dans la vue planning de votre présentation.

**Ressources utiles :**
- [Choisir les jalons affichés dans la présentation 📌](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-les-jalons-affiches-dans-la-presentation)


### Que peut-on personnaliser dans la vue présentation ?

Dans la vue présentation, vous pouvez choisir **quels éléments afficher** :
- Projets
- Jalons (livrables intermédiaires à produire dans un trimestre maximum)
- Décisions
- Éléments épinglés

**Limitations actuelles** :
- Les colonnes de la vue (comme les champs de données) seront toujours affichées et ne peuvent pas être masquées
- Vous ne pouvez pas modifier les données directement dans la présentation

**Pour masquer des projets spécifiques** :
Utilisez les filtres de la vue portefeuille d'origine pour exclure certains projets (par exemple avec une condition "ET projet n'est pas XXX")

**Ressources utiles :**
- [Choisir les jalons affichés dans la présentation 📌](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-les-jalons-affiches-dans-la-presentation)


### Les modèles de présentation peuvent-ils être partagés avec mon équipe ?

Non, les modèles de présentation sont **personnels** et attachés à chaque utilisateur.

Chaque membre de votre équipe doit créer ses propres modèles de présentation. Cette approche permet à chacun de personnaliser ses présentations selon ses besoins spécifiques.

**Alternative pour harmoniser vos présentations :**
- Créez un guide de bonnes pratiques pour votre équipe
- Partagez des captures d'écran de modèles types
- Utilisez les vues partagées du portfolio comme base commune

**Ressources utiles :**
- [Comment personnaliser vos présentations ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-personnaliser-vos-presentations)


### Comment gérer l'affichage des points d'attention épinglés et leurs réponses en mode présentation ?

**Problème connu** : Lorsqu'un point d'attention épinglé reçoit une réponse ou un commentaire, il peut arriver que seule la réponse s'affiche en mode présentation, masquant le point d'attention original.

**Solution temporaire** :
- Vous pouvez contourner le problème manuellement en réépinglant le point d'attention
- Vérifiez régulièrement vos épingles avant une présentation importante

**Bonnes pratiques** :
- Épinglez les éléments clés juste avant votre présentation
- Testez l'affichage en mode présentation avant la réunion
- Gardez une liste des éléments à épingler pour pouvoir les restaurer rapidement si nécessaire

**Note** : Notre équipe travaille sur une correction permanente de ce comportement.

**Ressources utiles :**
- [Choisir les jalons affichés dans la présentation 📌](https://club.airsaas.io/c/ca-vient-de-sortir/choisir-les-jalons-affiches-dans-la-presentation)


### Comment modifier et sauvegarder les modèles de présentation ?

Les modèles de présentation permettent de créer des vues personnalisées pour vos réunions et reportings.

**Pour modifier un modèle de présentation :**
1. Accédez à vos modèles de présentation
2. Sélectionnez le modèle à modifier
3. Ajoutez ou supprimez des projets
4. Modifiez l'ordre de présentation des projets si nécessaire
5. Sauvegardez vos modifications

**Alternative temporaire :**
En attendant, vous pouvez contourner le problème en créant une vue privée avec les projets souhaités.

**Note :** Si vos modifications ne sont pas prises en compte après sauvegarde, contactez le support car cela peut indiquer un problème technique.


### Que faire si j'ai une erreur 404 dans le mode présentation ?

Si vous rencontrez une erreur 404 dans l'onglet "exécution" du mode présentation :

1. **Contactez immédiatement le support** via le chat en indiquant :
   - Le nom ou l'URL du projet concerné
   - Ce que vous aviez épinglé avant l'erreur

2. **Solution temporaire** : Le support peut généralement restaurer l'accès rapidement, mais vous devrez :
   - Réépingler manuellement vos éléments
   - Vérifier que tous vos épingles sont bien visibles

**Note importante** : Ce type d'erreur est généralement lié à un problème technique ponctuel qui sera corrigé par notre équipe.


---

## Gestion documentaire

### Comment supprimer ou déplacer un document dans un projet ?

Pour supprimer un document :
1. Allez sur la page principale du projet
2. Survolez le document dans la section Documents
3. Cliquez sur l'icône de suppression qui apparaît

**Limitation actuelle** : La suppression au survol n'est disponible que dans la vue principale (4 documents visibles), pas dans la vue complète 'Voir tous les documents'.

**Recommandations** :
- Pour les documents : privilégiez les liens vers vos espaces de stockage (Google Drive, etc.) pour conserver une gestion fine des droits
- Pour les livrables : utilisez plutôt les jalons qui peuvent porter des documents et permettent un meilleur suivi de l'avancement du projet


### Comment ajouter des documents (PPT, PDF, etc.) à mon projet ?

Pour ajouter des documents à votre projet AirSaas :

**Méthode principale : Espace Documents**
- Accédez à votre projet
- Naviguez vers l'espace "Documents" du projet
- Utilisez la fonction d'upload pour téléverser vos fichiers (PPT, PDF, etc.)

**Méthode alternative : Flux d'activité**
- Dans votre projet, accédez au flux d'activité
- Créez un nouveau post
- Attachez votre document au post

**Note** : Le bouton "Présentation" en haut à droite sert à générer une présentation PowerPoint à partir des données de votre projet AirSaas, et non à uploader un PPT existant.


### Comment ajouter un document dans un compte-rendu ?

Le glisser-déposer direct dans le corps du compte-rendu n'est pas supporté, mais vous pouvez facilement ajouter vos documents de cette façon :

1. Dans le compte-rendu, tapez **"/"**
2. Sélectionnez **"Document"** dans le menu qui apparaît
3. Une fenêtre popup s'ouvre pour l'ajout de document
4. **Dans cette popup**, vous pouvez :
   - Glisser-déposer votre fichier
   - Ou cliquer pour parcourir et sélectionner votre document

**Astuce** : Une fois la popup ouverte, le glisser-déposer fonctionne parfaitement !

**Ressources utiles :**
- [Écrire des comptes rendu complets 📝](https://club.airsaas.io/c/ca-vient-de-sortir/ecrire-des-comptes-rendu-sur-airsaas)


### Comment supprimer une information du flux d'actualité ?

Pour supprimer une information du flux d'actualité d'un projet :

1. Identifiez l'élément source (jalon, décision, point d'attention, etc.)
2. Supprimez cet élément
3. Rafraîchissez la page
4. Le post correspondant disparaîtra automatiquement du flux

**Note :** Cette méthode fonctionne pour les posts automatiques générés par le système (création de jalons, changements de statut, etc.). Les posts manuels (notes, comptes-rendus) peuvent être supprimés directement via leur menu contextuel.


### Peut-on attacher des documents aux décisions ?

Actuellement, il n'est pas possible d'attacher directement des documents aux décisions dans AirSaas.

**Alternatives disponibles :**
- Ajouter un lien vers le document dans le corps de la décision
- Utiliser les comptes rendus pour documenter les décisions avec pièces jointes
- Créer un post dans le flux du projet avec les documents nécessaires et référencer ce post dans la décision

Cette fonctionnalité est régulièrement demandée et pourrait être ajoutée dans une future version du produit.


---

## Attributs personnalisés

### Pourquoi l'attribut météo disparaît-il de mes projets ?

L'attribut météo est lié aux statuts de vos projets. Voici comment cela fonctionne :

**Configuration globale** :
- Allez dans Paramètres > Projets > Attributs Natifs > Météo
- Ouvrez la section météo pour voir la liste des statuts
- Cochez les statuts pour lesquels vous souhaitez afficher la météo

**Comportement** :
- La météo s'affiche uniquement sur les projets ayant un statut où elle est activée
- Lorsqu'un projet change de statut, la météo disparaît si le nouveau statut ne l'a pas activée
- Vous pouvez surcharger cette configuration au niveau de chaque projet individuel

**Exemple** : Si la météo n'est activée que pour les statuts "En cours" et "En validation", elle disparaîtra automatiquement quand le projet passera en statut "Terminé".

**Solution** : Modifiez la configuration globale pour activer la météo sur tous les statuts souhaités.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Puis-je créer mes propres indicateurs de performance personnalisés ?

Pour le moment, les indicateurs de mesure ne sont pas personnalisables dans AirSaas. Cependant, l'équipe produit est très intéressée par vos besoins spécifiques.

**Ce que vous pouvez faire :**
- Partager vos besoins d'indicateurs avec le support (nombre de livrables, incidents traités, etc.)
- L'équipe évalue si le besoin est générique et peut être priorisé dans la roadmap
- Votre feedback aide à faire évoluer le produit

**Exemples d'indicateurs demandés :**
- Nombre de livrables produits
- Nombre d'incidents traités
- Métriques métier spécifiques

N'hésitez pas à détailler vos cas d'usage pour que l'équipe puisse mieux comprendre vos besoins.


### Pourquoi mes attributs personnalisés n'apparaissent pas sur mes décisions ?

Les attributs personnalisés des décisions suivent deux règles importantes :

**1. L'attribut doit être complet**
- Assurez-vous d'avoir ajouté au moins une valeur dans la partie "Ajouter une valeur"
- Sans valeur définie, l'attribut ne sera pas visible

**2. Les attributs apparaissent après la création**
- Les attributs ne s'affichent pas dans la modale de création de la décision
- Ils apparaissent directement sur la page de la décision une fois celle-ci créée

**Conseil** : Si vous avez créé un attribut de type "Liste de choix", pensez à bien définir toutes les options possibles avant de créer vos décisions.


### Comment supprimer des attributs personnalisés devenus obsolètes ?

Lorsque des attributs personnalisés deviennent obsolètes (par exemple, s'ils ont été intégrés dans le standard AirSaas), vous pouvez les supprimer en suivant ces étapes :

**Prérequis :** Vous devez être administrateur de l'espace.

**Étapes :**
1. Accédez aux paramètres : https://app.airsaas.io/space/[votre-espace]/settings/project/attributes
2. Tentez de supprimer l'attribut concerné

**Cas particuliers :**
- **Si vous ne pouvez pas supprimer :** L'attribut est utilisé dans des projets (publics ou privés) avec des valeurs renseignées
- **Solution :** Contactez le support AirSaas qui pourra forcer la suppression côté backend, sans que vous ayez à modifier manuellement tous les projets concernés

**Note :** Cette situation est courante lorsque votre organisation a créé des attributs personnalisés qui sont ensuite devenus des fonctionnalités standard d'AirSaas.


### Comment identifier les contributeurs spécifiques d'une équipe sur un projet ?

AirSaas ne permet pas de créer des relations dynamiques entre attributs (un attribut qui en déclenche un autre).

**Solution recommandée** :

1. Utilisez le champ **"Personnes impliquées"** dans la section cadrage du projet
2. Ajoutez spécifiquement les personnes de l'équipe SSI qui contribuent
3. Ces personnes seront automatiquement **abonnées** aux évolutions du projet

**Avantages de cette approche** :
- Les contributeurs sont clairement identifiés
- Ils reçoivent les notifications du projet
- Vous pouvez filtrer vos vues par "personnes impliquées"
- Distinction claire entre l'équipe en général et les contributeurs individuels


---

## Partage et collaboration

### Comment partager une vue avec d'autres utilisateurs ?

Pour partager une vue avec d'autres utilisateurs, vous avez plusieurs options selon vos besoins :

**Partage ciblé (recommandé) :**
1. Ouvrez la vue que vous souhaitez partager
2. Cliquez sur le **petit bouton de partage** situé en **haut à droite** de l'écran
3. Sélectionnez la personne avec qui vous souhaitez partager cette vue

**Partage public (administrateurs uniquement) :**
1. Ouvrez la vue que vous souhaitez partager
2. Cliquez sur les paramètres de la vue
3. Passez la vue de "Privée" à "Publique"
4. La vue sera alors accessible à tous les utilisateurs de votre workspace

**Droits de création :**
- **Vues privées** : Tous les utilisateurs peuvent en créer
- **Vues publiques** : Seuls les administrateurs peuvent en créer

**Ressources utiles :**
- [Partagez vos vues privées du portfolio](https://club.airsaas.io/c/ca-vient-de-sortir/partagez-vues-privees-du-portfolio)


### Où trouver le lien de brief projet à partager ?

Vous pouvez accéder au lien de brief projet à partager à **deux endroits** :

**1. Depuis le portfolio projets :**
- Ouvrez votre portfolio projets
- Le lien de partage est disponible directement dans l'interface

**2. Depuis les Settings :**
- Accédez aux paramètres de votre espace
- Recherchez la section dédiée aux briefs projets
- Copiez le lien de partage

**Utilisation du lien :**
- Ce lien peut être envoyé à n'importe qui, même sans licence AirSaas
- Les destinataires pourront remplir un formulaire de brief structuré
- Les briefs soumis apparaîtront dans votre espace pour validation

**Astuce :** Gardez ce lien dans vos favoris ou dans votre signature email pour le partager facilement avec vos collègues lors de demandes de nouveaux projets.

**Ressources utiles :**
- [Créer des liens de partage sur AirSaas](https://club.airsaas.io/c/ca-vient-de-sortir/creer-des-liens-de-partage-sur-airsaas)


### Comment partager un reporting projet avec une personne externe à mon organisation ?

Pour envoyer un reporting récurrent à une personne externe, vous devez lui créer un compte avec une **licence observateur** sur AirSaas.

**Étapes à suivre :**
1. Créez un compte observateur pour la personne externe
2. Ajoutez cette personne dans les personnes impliquées du projet concerné
3. La personne pourra alors configurer elle-même ses préférences de notifications pour recevoir :
   - L'email bilan de santé hebdomadaire (tous les lundis)
   - Les notifications liées au projet

**Important :** Il n'est pas possible d'envoyer des reportings à des personnes sans compte AirSaas. La licence observateur est la solution minimale pour partager des informations projet de façon récurrente.

**Bon à savoir :** C'est l'utilisateur lui-même qui définit dans ses paramètres de notification quelles informations il souhaite recevoir et à quelle fréquence.

**Ressources utiles :**
- [Inviter un sponsor sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/inviter-un-sponsor-sur-airsaas)


---

## Programmes et projets

### Comment créer un programme ?

Pour créer un programme dans AirSaas :

1. Cliquez sur le bouton **Créer** (généralement en bas à gauche de l'écran)
2. Sélectionnez **Programme** dans les options
3. Remplissez les informations du programme :
   - Nom du programme
   - Description et objectifs
   - Dates de début et fin
   - Sponsor(s)
4. Validez la création

**Ensuite, vous pourrez :**
- Associer des projets existants au programme
- Suivre l'avancement global
- Visualiser les budgets consolidés

**Ressources utiles :**
- [Suivre les programmes, niveau pro](https://club.airsaas.io/c/ca-vient-de-sortir/grosse-amelioration-des-programmes)
- [Connaître les projets du programme simplement](https://club.airsaas.io/c/ca-vient-de-sortir/connaitre-les-projets-du-programme-simplement)


### Comment changer un projet de programme ?

Pour changer un projet de programme :

1. Allez sur la page du projet concerné
2. Dans la colonne de gauche, trouvez le champ "Programme"
3. Cliquez et sélectionnez le nouveau programme
4. Le changement est automatiquement sauvegardé

**Important** : Cette action conserve :
- Tout l'historique du projet
- Le fil d'activité
- Les alertes et notifications
- Toutes les données du projet

Le changement de programme sera tracé dans l'historique du projet (consultable depuis le menu en haut à droite du projet).


### Comment modifier le nom d'un programme existant ?

Pour renommer un programme qui contient déjà des projets :

1. Accédez à la liste des programmes
2. Passez votre souris sur le titre du programme à modifier
3. Un icône de modification apparaît - cliquez dessus
4. Modifiez le nom et validez

**Note importante** : La modification est bien reportée partout dans l'application.

**Différence avec les projets** : Contrairement aux projets où vous pouvez modifier directement le nom en cliquant dessus, les programmes nécessitent de passer par l'icône de modification.


### Comment archiver plusieurs projets en masse ?

Il n'existe pas de fonction d'archivage en masse en un clic, mais voici la solution disponible :

**Méthode avec assistance du support :**
1. Créez une **smartview dédiée** contenant uniquement les projets à archiver
2. Utilisez les filtres pour sélectionner précisément les projets concernés
3. Envoyez le lien de cette smartview au support
4. Le support exécutera un script d'archivage en masse sous 72h

**Alternative manuelle :**
- Créez un attribut temporaire "À archiver" (oui/non)
- Modifiez cet attribut ligne par ligne dans une vue tableau
- Archivez manuellement projet par projet

**Note :** Une fonctionnalité d'archivage en masse depuis le mode bulk est prévue mais pas encore développée.

**Ressources utiles :**
- [Archiver les vieux trucs pour y voir plus clair](https://club.airsaas.io/c/ca-vient-de-sortir/archiver-les-vieux-trucs-pour-y-voir-plus-clair)


### Que faire si un projet reste visible après suppression du programme parent ?

Lorsque vous supprimez un programme, les projets qui y étaient liés peuvent parfois rester visibles dans votre espace de travail. Il s'agit de projets "orphelins".

**Si vous rencontrez ce cas :**

1. Vérifiez d'abord que vous avez bien accès au projet via la barre de recherche principale
2. Tentez de supprimer le projet directement depuis sa page
3. Si le bouton "Supprimer" ne fonctionne pas, contactez le support en indiquant l'identifiant du projet

**Note :** Cette situation peut se produire dans certains cas spécifiques. L'équipe support peut supprimer manuellement ces projets orphelins pour vous.


---

## Priorisation et demandes

### À quoi sert l'onglet Priorisation dans AirSaas ?

L'onglet **Priorisation** permet aux responsables d'équipes de classer par ordre d'importance les projets dont leur équipe est à l'origine de la demande.

**Objectif** : Faciliter l'arbitrage et la gestion du portfolio en rendant visible les priorités de chaque équipe demandeuse.

**Comment ça fonctionne** :
- Les responsables d'équipes accèdent à cet onglet
- Ils voient la liste des projets où leur équipe est "équipe en demande"
- Ils peuvent réordonner ces projets selon leurs priorités business

**Ressources utiles :**
- [Priorisation des projets par équipe en demande](https://club.airsaas.io/c/ca-vient-de-sortir/priorisation-des-projets-par-equipe-en-demande)
- [On améliore le process de priorisation des projets](https://club.airsaas.io/c/ca-vient-de-sortir/on-ameliore-le-process-de-priorisation-des-projets)


### Où modifier la priorisation des projets ?

La priorisation des projets se fait depuis le menu principal :

1. Dans le menu principal en haut, cliquez sur **Priorisation**
2. Sélectionnez **Priorisation par équipes**
3. Chaque équipe peut alors prioriser les projets dont elle a besoin

**Note** : Le champ "Priorisation" visible dans la colonne de gauche d'un projet affiche la priorisation actuelle mais n'est pas modifiable directement depuis cette vue.

**Principe** : Chaque équipe priorise les projets pour lesquels elle est en demande, permettant ainsi une vision consolidée des priorités de l'organisation.

**Ressources utiles :**
- [On améliore le process de priorisation des projets](https://club.airsaas.io/c/ca-vient-de-sortir/on-ameliore-le-process-de-priorisation-des-projets)


### Comment mettre en place la gestion des demandes dans AirSaas ?

La gestion des demandes dans AirSaas vous permet de structurer le processus d'**identification, cadrage, estimation et priorisation** des nouvelles demandes projets.

**Ce que permet AirSaas :**
- Créer des vues dédiées "gestion de la demande" pour rendre le process transparent
- Suivre l'avancée des demandes à travers différents statuts
- Outiller votre workflow personnalisé

**Important à savoir :**
- C'est à vous de définir le workflow/process adapté à votre organisation
- AirSaas fournit les outils, mais la méthodologie reste à votre charge
- La fonctionnalité doit être activée par le support

**Pour démarrer :**
1. Contactez le support pour activer la gestion des demandes
2. Définissez votre process (identifier → cadrer/recadrer → estimer → prioriser)
3. Configurez vos vues et statuts selon votre workflow

💡 **Conseil** : Planifiez un workshop avec vos équipes pour définir le process avant de le configurer dans AirSaas.

**Ressources utiles :**
- [Améliorer le process de gestion de la demande](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande)
- [Améliorer la gestion des demandes](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-la-gestion-des-demandes)


### Comment utiliser le menu Priorisation et Gestion de la demande ?

**Deux modules complémentaires**

**1. Gestion de la demande**
- Créez des vues publiques de portefeuille labellisées "gestion de la demande"
- Visualisez tous les projets entrants au même endroit
- Configurez le contenu selon vos besoins spécifiques
- Permet de centraliser et suivre toutes les demandes projet

**2. Priorisation par équipes**
- Naviguez parmi toutes les équipes "en demande" de projets
- Chaque responsable d'équipe classe ses projets par ordre de priorité
- Les priorités s'affichent sur :
  - Les fiches projet individuelles
  - Les vues portefeuille
- Facilite l'alignement sur ce qui est vraiment prioritaire

**Bénéfices**
- Vision consolidée de toutes les demandes entrantes
- Alignement des priorités entre équipes
- Transparence sur les arbitrages
- Aide à la décision pour l'allocation des ressources

**Ressources utiles :**
- [Améliorer le process de gestion de la demande](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande)
- [On améliore le process de priorisation des projets](https://club.airsaas.io/c/ca-vient-de-sortir/on-ameliore-le-process-de-priorisation-des-projets)
- [Priorisation des projets par équipe en demande](https://club.airsaas.io/c/ca-vient-de-sortir/priorisation-des-projets-par-equipe-en-demande)


### Comment accéder aux fonctionnalités de priorisation et créer une roadmap de projets ?

Si vous voyez le message "Il n'y a pas encore de page de gestion des demandes créée dans le workspace", voici comment accéder aux fonctionnalités de priorisation :

**1. Créer une Smart View de gestion de la demande**
- Créez d'abord une smartview "gestion de la demande" pour avoir un premier exemple
- Guide complet : https://club.airsaas.io/c/debuter-sur-airsaas/comment-utiliser-les-vues-intelligentes

**2. Pour une roadmap avec planification sur 2 ans**
Si vous cherchez à :
- Visualiser vos projets à planifier dans le futur (vision sur 2 ans)
- Pouvoir les planifier par drag & drop (dates de début-fin)

**Solutions disponibles :**
- Les Smart Views permettent de créer des vues personnalisées de type roadmap
- La vue timeline permet de visualiser et ajuster les projets dans le temps
- Les fonctionnalités de gestion de la demande sont décrites ici : https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande

**Note :** Si vous avez besoin d'un accompagnement personnalisé pour configurer votre roadmap, n'hésitez pas à contacter le support pour une session de formation dédiée.

**Ressources utiles :**
- [Comment utiliser les vues intelligentes](https://club.airsaas.io/c/debuter-sur-airsaas/comment-utiliser-les-vues-intelligentes)
- [On améliore le process de priorisation des projets](https://club.airsaas.io/c/ca-vient-de-sortir/on-ameliore-le-process-de-priorisation-des-projets)
- [Améliorer le process de gestion de la demande](https://club.airsaas.io/c/ca-vient-de-sortir/ameliorer-le-process-de-gestion-de-la-demande)


---

## Historique et suivi

### Quand apparaît le flag 'Edited' sur un jalon ?

**Le flag 'Edited' s'affiche lorsqu'un jalon présent lors du cadrage du projet change de date pendant l'exécution du projet.**

Ce flag vous permet d'identifier rapidement :
- Les jalons dont les dates ont été modifiées après le cadrage initial
- Les écarts par rapport au planning d'origine
- Les jalons nécessitant potentiellement une justification du décalage

**Note importante :** Le flag n'apparaît que pour les jalons qui existaient au moment du cadrage. Les jalons ajoutés après le début de l'exécution n'auront pas ce flag même si leurs dates changent.

**Ressources utiles :**
- [Garder en tête les valeurs initiales 🕰](https://club.airsaas.io/c/debuter-sur-airsaas/garder-en-tete-les-valeurs-initiales-avril)


### Comment suivre l'évolution de mon portfolio dans le temps ?

AirSaas ne conserve pas automatiquement l'historique des états du portfolio. Pour suivre les évolutions :

**Méthode actuelle :**
- Effectuez des **exports réguliers** (CSV ou capture d'écran) de vos vues
- Conservez ces exports pour comparaison ultérieure
- Planifiez ces exports avant chaque COPIL

**Sans export préalable :**
- Vous ne pourrez pas récupérer l'état passé du portfolio
- Concentrez-vous sur l'état actuel et les actions à venir

**Bonnes pratiques pour vos COPIL :**
- Segmentez la lecture du portefeuille par niveaux d'importance
- Prenez une décision pour tous les statuts "c'est compliqué"
- Identifiez les passages de jalons bloqués ou compliqués
- Commencez dès maintenant vos exports mensuels pour les prochains COPIL


### Peut-on supprimer les commentaires obligatoires dans l'historique du projet ?

**Non, les commentaires obligatoires ne peuvent pas être supprimés**, mais vous pouvez les éditer.

**Pourquoi ces commentaires sont-ils obligatoires ?**
- Ils documentent des changements importants du projet (dates, statut, etc.)
- Ils assurent la traçabilité et la transparence des décisions
- Ils permettent de comprendre pourquoi certaines modifications ont été faites

**Comment gérer ces commentaires ?**
1. **Éditez-les** pour les rendre plus pertinents
2. **Simplifiez le texte** si le commentaire initial n'est plus d'actualité
3. **Utilisez un format court**, par exemple : "-" ou "Mise à jour"

**Exemple concret**
- Au lieu de : "Changement de date suite à retard fournisseur externe"
- Vous pouvez éditer en : "-" ou "MAJ"

**Astuce** : Cette approche permet de garder l'historique obligatoire tout en réduisant l'encombrement visuel dans le flux d'actualité.


### Comment suivre l'historique des modifications d'un attribut sur tous les projets ?

Cette fonctionnalité de suivi historique des modifications d'attributs est actuellement en backlog produit.

**Solutions de contournement disponibles :**

1. **Ajouter un attribut date de modification**
   - Créez un attribut personnalisé "Date dernière modif [nom attribut]"
   - Mettez-le à jour manuellement lors des changements
   - Filtrez vos vues par cette date pour identifier les modifications récentes

2. **Utiliser un jalon de contrôle**
   - Créez un jalon récurrent "Revue attribut Cyber" dans vos projets
   - Documentez l'état de l'attribut à chaque revue
   - L'historique des jalons conserve la trace des valeurs

3. **Créer une décision historisée**
   - Pour les changements importants, créez une décision
   - Documentez l'ancienne et la nouvelle valeur
   - Les décisions sont horodatées et traçables

**Note :** Le support peut vous tenir informé de l'avancement de cette fonctionnalité si vous le souhaitez.


### Pourquoi l'historique des activités ne s'affiche plus sur certains projets ?

Si l'historique des activités semble avoir disparu sur certains projets anciens, voici ce qu'il faut vérifier :

**Solution de contournement** :
- Utilisez les **autres onglets du fil d'actualité** (Décisions, Points d'attention, Jalons, etc.)
- Les informations y sont toujours présentes et accessibles

**Ce qui se passe** :
- Le fil principal peut avoir des difficultés à charger sur des projets avec beaucoup d'historique
- Les données ne sont pas perdues, c'est un problème d'affichage

**Si le problème persiste** :
- Rafraîchissez la page (Ctrl+F5 ou Cmd+R)
- Contactez le support avec le nom du projet concerné

**Note** : L'équipe technique travaille sur une résolution permanente de ce problème d'affichage.


---

## Formation et support

### Comment former mes équipes à l'utilisation d'AirSaas ?

Pour accompagner vos équipes dans l'adoption d'AirSaas, plusieurs ressources sont à votre disposition :

- **Documentation en ligne** : Accédez à notre base de connaissances complète
- **Accompagnement personnalisé** : Même sans souscription à l'accompagnement setup, notre équipe support peut vous partager les bonnes pratiques d'onboarding qui ont fait leurs preuves
- **Sessions de formation** : Organisez un call de 15-30 minutes avec notre équipe pour un partage d'expérience sur les onboardings réussis

**Conseil** : Commencez par créer un "book" interne avec les ressources partielles disponibles, puis enrichissez-le au fur et à mesure de votre montée en compétence.

**Ressources utiles :**
- [Débuter sur AirSaas](https://club.airsaas.io/c/debuter-sur-airsaas/)


### Que faire des jalons non terminés en fin de quarter ?

La bonne pratique dépend de l'état d'avancement du jalon :

**Jalon commencé mais non terminé**
→ **Étendre le jalon** sur le quarter suivant
- Cela permet de conserver l'historique du travail déjà réalisé
- La progression et les efforts consommés restent visibles
- L'extension matérialise le glissement dans le temps

**Jalon non commencé**
→ **Modifier les dates** pour les décaler au quarter suivant
- Le jalon est simplement replanifié
- Pas de notion d'extension car aucun travail n'a été entamé
- Cela reste une replanification classique

**Conseil** : Documentez la raison du décalage dans un commentaire pour garder la traçabilité de la décision.

**Ressources utiles :**
- [Que faire des jalons non terminés en fin de quarter ?](https://club.airsaas.io/c/debuter-sur-airsaas/que-faire-des-jalons-non-termines-en-fin-de-quarter)
- [Que faire des jalons non-terminés en fin de quarter ? 🤔](https://club.airsaas.io/c/ca-vient-de-sortir/que-faire-des-jalons-non-termines-en-fin-de-quarter)


### Comment créer un projet sur AirSaas ?

Pour créer un projet sur AirSaas :

1. Cliquez sur le bouton **Créer** en bas à gauche de votre écran
2. Sélectionnez **Projet**
3. Suivez les 4 étapes guidées :
   - Informations générales (nom, description, dates)
   - Équipes impliquées
   - Budget et jalons
   - Paramètres de visibilité

La création se fait comme pour remplir une fiche de cadrage. Vous pourrez modifier toutes ces informations à tout moment par la suite.

**Astuce** : Si vous créez souvent des projets similaires, vous pouvez dupliquer un projet existant pour gagner du temps.

**Ressources utiles :**
- [Comment créer un projet ?](https://club.airsaas.io/c/debuter-sur-airsaas/comment-creer-un-projet)
- [Dupliquer les projets 👯‍♀️](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-projets)


### Pourquoi le bouton de création de compte est-il grisé lors de mon inscription ?

Lors de la création de votre compte suite à une invitation, le bouton de validation reste grisé tant que vous n'avez pas rempli **tous les champs obligatoires**, notamment :

- Votre adresse email (pré-remplie)
- **Votre mot de passe** (à définir)
- La confirmation du mot de passe

**Solution :** Assurez-vous d'avoir bien saisi un mot de passe dans le champ prévu à cet effet. Le bouton s'activera automatiquement une fois tous les champs remplis.

**Note :** Ce problème n'est pas lié au nombre de licences disponibles dans votre organisation.

**Ressources utiles :**
- [Authentification et SSO](https://club.airsaas.io/c/debuter-sur-airsaas/authentification-et-sso)


### Comment accéder aux replays des webinaires AirSaas ?

**Pour recevoir le replay d'un webinaire**

1. Inscrivez-vous au webinaire via le lien d'inscription
2. Vous recevrez automatiquement le replay par email après le webinaire
3. Cela fonctionne même si vous ne pouvez pas assister en direct

**Bon à savoir**
- Plusieurs sessions du même webinaire peuvent être proposées à différents horaires
- L'inscription est nécessaire pour recevoir le replay
- Les replays sont généralement envoyés dans les 24-48h suivant le webinaire


---

## Automatisations

### Comment activer l'automatisation de la météo des projets ?

**Automatisation de la météo des projets**

Cette fonctionnalité permet de passer à l'échelle le processus de mise à jour des météos dans toute l'organisation.

**Pour l'activer :**
1. Contactez le support
2. Listez les workspaces concernés
3. L'activation est immédiate

**Accès après activation :**
Header → Automatisation → Météo des projets

**Bénéfices :**
- Rappels automatiques aux chefs de projet
- Visibilité sur les projets non mis à jour
- Amélioration de la régularité du suivi
- Pilotage efficace du portfolio

**Important**
La mise à jour régulière de la météo est le minimum syndical pour piloter efficacement un portfolio projet.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Peut-on automatiser la mise à jour des champs en fonction de règles métier ?

**Limitation actuelle**
AirSaas ne propose pas encore d'automatisations pour mettre à jour automatiquement les champs en fonction de règles métier (ex: passer l'urgence à "court terme" quand la date est < 7 jours).

**Alternatives possibles**
- Utiliser les rappels de mise à jour météo pour inciter les chefs de projet à vérifier régulièrement leurs projets
- Créer des vues filtrées qui mettent en évidence les éléments nécessitant une mise à jour
- Former les équipes à mettre à jour l'urgence lors de leurs rituels hebdomadaires

**Note** : Les automatisations métier sont un sujet d'amélioration identifié mais pas encore planifié dans la roadmap.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


### Peut-on afficher la santé des projets dans la vue Compte rendu ?

**Actuellement non disponible**

Nous n'avons pas encore de vue tableau pour le portfolio de comptes rendus, ni d'attribut permettant d'afficher la santé du projet parent.

**Pourquoi ce besoin ?**
- Présenter une vue globale du portefeuille
- Mettre à jour les CR projets sans naviguer dans chaque projet
- Réduire le nombre de clics nécessaires

**Statut** : Besoin identifié et noté par l'équipe produit pour une future évolution.


### Comment ajuster le jour de départ des rappels de mise à jour météo ?

Les rappels de mise à jour météo se planifient automatiquement sur le prochain mardi, mais vous ne pouvez pas choisir précisément quel mardi.

**Pour décaler vos rappels**
1. Désactivez temporairement le rappel de mise à jour
2. Attendez quelques jours avant le mardi souhaité
3. Réactivez le rappel (idéalement entre le mercredi et le lundi)
4. Le système planifiera automatiquement le prochain mardi

**Exemple**
Pour des rappels les mardis 24/03, 07/04, etc. :
- Désactivez le rappel maintenant
- Réactivez-le à partir du mercredi 18/03
- Les rappels se caleront sur le cycle 24/03, 07/04...

**Note** : Cette manipulation est nécessaire car AirSaas ne permet pas de choisir manuellement la date de départ du cycle de rappels.

**Ressources utiles :**
- [Passez à l'échelle la mise à jour des météos projets dans l'orga ⛈ 🌩️ 🌤️ ☀️](https://club.airsaas.io/c/ca-vient-de-sortir/passer-a-l-echelle-le-process-de-mise-a-jour-des-projets-dans-l-organisation)


---

## Structure et organisation

### Comment gérer des sous-projets ou des composantes d'un projet complexe ?

AirSaas ne propose pas de fonctionnalité de sous-projets, par choix de simplicité. Voici les deux approches recommandées :

**Option 1 : Transformer en programme (recommandée)**
- Créez un programme pour le projet global
- Créez un projet distinct pour chaque composante (ex: un par DSP)
- Créez un projet pour les éléments transverses
- Utilisez la duplication de projets pour gagner du temps

**Option 2 : Utiliser les jalons**
- Gardez un seul projet
- Créez des jalons pour chaque composante à suivre
- Les jalons permettent : description détaillée, attributs personnalisés, météo dédiée
- Depuis février 2026, les jalons peuvent être multi-équipes

**Recommandation :** Pour un suivi par entité distincte (DSP, équipes...), privilégiez l'option 1 avec un programme.

**Ressources utiles :**
- [Les jalons multi-équipes 🤩 🫨 🍾](https://club.airsaas.io/c/ca-vient-de-sortir/les-jalons-multi-equipes)
- [Dupliquer les jalons, et les projets](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-jalons-et-les-projets)


### Un projet peut-il être rattaché à plusieurs programmes ?

Non, un projet ne peut être rattaché qu'à un seul programme dans AirSaas. Cette limitation est volontaire pour garantir la cohérence de la consolidation des données au niveau programme (budgets, efforts, jalons).

**Solutions alternatives pour les projets transverses :**

- **Utiliser une vue filtrée** : Créez une vue dans le portfolio qui regroupe les projets concernés par vos deux programmes. Cela permet un suivi transverse sans impacter la structure de consolidation

- **Utiliser les Objectifs de l'organisation** : Si le besoin est de montrer qu'un projet contribue à plusieurs initiatives stratégiques, les Objectifs permettent un rattachement multiple sans impacter la consolidation

- **Créer un programme chapeau** : Pour des cas complexes comme les décommissionnements, créez un programme parent qui englobe les sous-programmes concernés

**Important** : Avant de choisir une solution, identifiez bien ce que vous souhaitez suivre à l'échelle du programme (consolidation financière, avancement, ressources) pour choisir l'approche la plus adaptée.


### Comment organiser mes projets par versions ou releases ?

Pour organiser vos projets selon une structure personnalisée (ex: par versions de produit), utilisez les **Smart Views**.

**Exemple : Organiser par versions**
1. Créez une Smart View dans votre portfolio
2. Utilisez les filtres et regroupements pour afficher :
   - Programme : Votre produit principal
   - Groupement par : Attribut personnalisé "Version" ou par trimestre/année
   - Projets : Les fonctionnalités de chaque version

**Avantages des Smart Views :**
- Créez autant de vues que nécessaire
- Partagez-les avec votre sponsor ou équipe
- Filtrez par version, équipe, ou tout autre critère
- Affichez en timeline pour voir l'enchaînement des versions

**Conseil :** Discutez avec votre responsable AirSaas pour optimiser l'utilisation des Smart Views selon vos besoins spécifiques.


### La page Teams dans le Manifeste est-elle disponible ?

**Non, la page Teams dans le Manifeste n'est pas encore fonctionnelle.**

Cette page était prévue pour afficher une vue arborescente de l'organisation des équipes avec :
- Les différents niveaux hiérarchiques (niveau 1 à x)
- Les rôles (muscle/doer au niveau 1, requester au niveau 2 ou autres)
- Une vue accessible à tous les membres de l'organisation

Le développement de cette fonctionnalité a été mis en pause. Si vous avez ce besoin, n'hésitez pas à contacter le support pour manifester votre intérêt.

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet 🌾](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)


---

## Multilinguisme

### Comment fonctionne le système de langues dans AirSaas ?

AirSaas gère les langues selon deux principes :

**Éléments automatiques**
Tout ce qui n'est pas paramétrable dans AirSaas s'adapte automatiquement à la langue de l'utilisateur (menus, boutons, messages système).

**Éléments paramétrables**
Tout ce qui est configurable s'affiche tel que vous l'avez renseigné dans les settings, quelle que soit la langue de l'utilisateur.

**Pour modifier un texte paramétrable**
1. Allez dans Settings > Projets > Attributs natifs
2. Trouvez l'attribut concerné (ex: Importance)
3. Modifiez le texte dans la langue souhaitée

⚠️ **Important** : Cette modification impactera TOUS les utilisateurs de votre workspace, qu'ils soient en français ou en anglais. Si vous avez des utilisateurs multilingues, vous devrez choisir une langue unique pour ces éléments ou utiliser des termes compris dans les deux langues.

**Ressources utiles :**
- [Gérer un portfolio projet en contexte multi langue 🇫🇷 🇬🇧 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/gerer-un-portfolio-projet-en-contexte-multi-langue)
- [¿Hola como estas? 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/hola-como-estas)


### Comment configurer la langue des notifications email AirSaas ?

Les emails et notifications AirSaas sont automatiquement envoyés dans la langue configurée dans vos préférences utilisateur.

**Pour vérifier ou modifier votre langue :**
1. Cliquez sur votre avatar en haut à droite
2. Accédez à vos paramètres utilisateur
3. Sélectionnez votre langue préférée (Français, Anglais, Espagnol)
4. Sauvegardez vos modifications

Tous les emails système (notifications de mise à jour projet, rappels, alertes) seront alors envoyés dans la langue choisie.

**Note :** Si vous recevez des emails dans une langue différente de celle configurée, contactez le support car il peut s'agir d'un problème technique temporaire.

**Langues disponibles :** Français 🇫🇷, English 🇬🇧, Español 🇪🇸

**Ressources utiles :**
- [¿Hola como estas? 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/hola-como-estas)
- [Gérer un portfolio projet en contexte multi langue 🇫🇷 🇬🇧 🇪🇸](https://club.airsaas.io/c/ca-vient-de-sortir/gerer-un-portfolio-projet-en-contexte-multi-langue)


### La traduction automatique est-elle disponible dans Manifest ?

Oui, la traduction automatique est maintenant disponible dans le module Manifest, comme elle l'est déjà pour les projets.

**Comment ça fonctionne :**
- Les contenus du Manifest peuvent être traduits automatiquement
- Chaque utilisateur voit le contenu dans sa langue préférée
- Facilite l'alignement des équipes multilingues sur la culture projet

**Pour activer la traduction :**
- La fonctionnalité est automatiquement disponible si votre workspace est configuré en multilingue
- Les utilisateurs peuvent changer de langue depuis leurs préférences

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)
- [Gérer un portfolio projet en contexte multi langue](https://club.airsaas.io/c/ca-vient-de-sortir/gerer-un-portfolio-projet-en-contexte-multi-langue)


---

## Communication projet

### Qui reçoit les notifications quand je publie un post dans un projet ?

Lorsque vous publiez un post dans un projet, **toutes les personnes impliquées dans le projet** reçoivent une notification.

**Points importants :**
- Les notifications sont envoyées uniquement aux personnes ajoutées comme "impliquées" dans le projet
- Le nombre d'équipes n'influence pas directement les notifications - c'est le nombre de personnes impliquées qui compte
- Vous pouvez vérifier qui recevra les notifications en consultant la liste des personnes impliquées dans l'onglet équipe du projet

**Astuce :** Pour communiquer à un groupe plus large (comme tous les utilisateurs AirSaas de votre organisation), créez un projet dédié "Pilotage du portfolio" et ajoutez-y tous les utilisateurs concernés.

**Ressources utiles :**
- [Communiquer les avancées du projet sans effort](https://club.airsaas.io/c/debuter-sur-airsaas/communiquer-les-avancees-du-projet-sans-effort)


### Comment communiquer avec tous les utilisateurs AirSaas de mon organisation ?

AirSaas ne dispose pas d'un canal de communication global pour s'adresser directement à tous les utilisateurs. Voici les alternatives recommandées :

**1. Pour les bonnes pratiques et process permanents : Le Manifest**
- Permet d'afficher les bonnes pratiques et process à tous les utilisateurs
- Idéal pour la documentation permanente
- Limitation : ne permet pas de communiquer des updates ponctuelles

**2. Pour les communications régulières : Créer un projet dédié**
- Créez un projet "Pilotage du portfolio" ou "Bonnes pratiques AirSaas"
- Ajoutez tous les utilisateurs AirSaas comme personnes impliquées
- Chaque post sera notifié à tous les membres du projet
- Permet une communication bidirectionnelle

**Ressources utiles :**
- [Manifest : Alignez vos équipes et homogénéisez votre culture projet](https://club.airsaas.io/c/ca-vient-de-sortir/manifest-alignez-vos-equipes-et-homogeneisez-votre-culture-projet)
- [Chat dans AirSaas - Discussion similaire](https://club.airsaas.io/c/utilisateurs-d-airsaas/chat-dans-airsaas)


### Peut-on ajouter des captures d'écran lors de la mise à jour de la météo projet ?

Cette fonctionnalité n'est **pas disponible actuellement** dans la mise à jour de la météo.

**Solution de contournement** :
- Mettez à jour la météo du projet normalement
- Publiez immédiatement après votre capture d'écran dans un **commentaire sur le mur du projet**
- Ajoutez un contexte expliquant que cette capture illustre la météo actuelle

**Avantages de cette approche** :
- La capture reste visible dans l'historique du projet
- Tous les participants peuvent la voir et réagir
- Vous pouvez ajouter plusieurs captures si nécessaire

**Astuce** : Mentionnez dans votre commentaire "Capture liée à la météo du [date]" pour faciliter le suivi.


---

## Risques et points d'attention

### Comment gérer efficacement les risques dans AirSaas ?

AirSaas offre plusieurs outils pour une gestion complète des risques, adaptable à votre culture d'entreprise.

**Configuration recommandée**

1. **Paramétrez les points d'attention**
   - Allez dans Settings > Points d'attention > Général
   - Définissez vos catégories de risques selon vos besoins
   - Créez des standards pour vos plans de mitigation

2. **Personnalisez les statuts**
   - Créez des statuts spécifiques pour le suivi des risques
   - Définissez un workflow de validation/mitigation

3. **Ajoutez des attributs personnalisés**
   - Qualifiez vos typologies de risques (cyber, financier, planning...)
   - Segmentez par niveau de criticité ou probabilité
   - Différenciez les points d'attention "Warning" (informationnels) des véritables risques à "Mitiger"

4. **Créez des Smart Views dédiées**
   - Vue "Tous les risques ouverts"
   - Vue par typologie ou par criticité
   - Vue pour les revues de risques périodiques

**Bonnes pratiques**
- Autonomisez les experts métiers (cyber, DPO, contrôle de gestion...) en leur donnant accès aux projets concernés
- Laissez-les émettre leurs points d'attention directement
- Accompagnez-les dans la création de leurs rituels de revue des risques

**Suivi par le chef de projet**
Les risques apparaissent dans l'onglet "Points d'attention" de chaque projet, permettant au PM de voir tous les risques ouverts en un coup d'œil.

**Ressources utiles :**
- [Mieux gérer les risques avec les points d'attention 🚨](https://club.airsaas.io/c/debuter-sur-airsaas/mieux-gerer-les-risques-avec-les-points-d-attention-juin)
- [Le panel des points d'attention 🚨](https://club.airsaas.io/c/ca-vient-de-sortir/le-panel-des-points-d-attention)


### Puis-je assigner un utilisateur fantôme comme responsable d'un point d'attention ?

Actuellement, vous ne pouvez assigner que des **utilisateurs actifs** d'AirSaas comme responsables de points d'attention ou décisions.

**Limitation actuelle** :
- Les utilisateurs fantômes (personnes non inscrites) ne peuvent pas être sélectionnés
- Seules les personnes avec un compte AirSaas apparaissent dans la liste

**Solution temporaire** :
1. Invitez la personne sur AirSaas (même en lecture seule)
2. Ou documentez le responsable externe dans le texte du point d'attention

**Note** : L'équipe AirSaas travaille sur cette fonctionnalité pour permettre l'ajout d'utilisateurs fantômes comme responsables.


---

## Dates et calendrier

### Pourquoi mes jalons Q2/Q3 2025 affichent des dates en 2026 ?

**Comprendre l'impact de l'année fiscale sur les trimestres**

Si votre organisation a configuré une année fiscale différente de l'année calendaire, les trimestres (Q1, Q2, Q3, Q4) sont automatiquement décalés pour s'aligner sur votre exercice fiscal.

**Exemple concret :**
Si votre année fiscale commence le 1er octobre :
- Q1 2025 = 1er octobre 2025 → 31 décembre 2025
- Q2 2025 = 1er janvier 2026 → 31 mars 2026
- Q3 2025 = 1er avril 2026 → 30 juin 2026
- Q4 2025 = 1er juillet 2026 → 30 septembre 2026

**Points importants :**
- Les trimestres suivent toujours votre année fiscale, pas l'année calendaire
- C'est un comportement normal et attendu du système
- Cela permet d'aligner vos jalons sur vos cycles budgétaires réels

**Pour vérifier votre configuration :**
Contactez votre administrateur AirSaas ou le support pour connaître la date de début de votre année fiscale.

**Ressources utiles :**
- [Découper les budgets par année fiscale 💰 🗓️](https://club.airsaas.io/c/ca-vient-de-sortir/decouper-les-budgets-par-annee-fiscale)


### Comment afficher les jalons groupés par quarter fiscal plutôt que calendaire ?

Lorsque votre organisation utilise une année fiscale décalée (par exemple démarrant au 1er octobre), vous pouvez constater des différences d'affichage des quarters :

**Où les quarters fiscaux sont correctement affichés :**
- Dans le Quarter Plan
- Dans la planification des jalons du Quarter Plan

**Où les quarters restent calendaires :**
- Dans la liste des jalons tous projets (vue portfolio)
- Dans les options de groupement des vues

**Solution actuelle :**
Pour l'instant, le groupement par quarter fiscal n'est pas disponible dans toutes les vues. L'équipe produit travaille sur l'ajout d'une option "grouper par quarter fiscal" dans les vues portfolio.

**En attendant :**
- Utilisez les dates pour identifier vos quarters fiscaux
- Référez-vous au Quarter Plan pour la vue correcte de vos périodes fiscales


---

## Performance et stabilité

### Pourquoi ai-je des erreurs récurrentes lors de la navigation dans AirSaas ?

Si vous rencontrez des pages d'erreur fréquentes lors de votre navigation dans AirSaas, notamment en faisant défiler le fil d'actualité d'un projet, cela peut être causé par une extension de traduction automatique de votre navigateur.

**Solution immédiate :**
- Désactivez l'extension de traduction automatique de votre navigateur
- Ou désactivez le mode de traduction automatique de Chrome si vous l'utilisez

**Comment vérifier si c'est bien le problème :**
1. Regardez si vous avez un pop-up systématique pour la traduction
2. Testez la navigation avec l'extension désactivée
3. Si le problème disparaît, c'était bien la cause

**Note :** Ce problème apparaît de manière aléatoire mais fréquente quand la traduction est active. Une fois désactivée, la navigation redevient fluide.


### Comment résoudre les erreurs de navigation sur Chrome ?

Si vous rencontrez des erreurs de navigation ou des blocages sur AirSaas avec Chrome, cela peut être lié à la traduction automatique du navigateur.

**Solution :**
1. Désactivez la traduction automatique dans Chrome
2. Redémarrez complètement Chrome pour que le changement prenne effet
3. Reconnectez-vous à AirSaas

**Note :** Ce problème peut également affecter d'autres fonctionnalités de l'application. La désactivation de la traduction automatique améliore généralement la stabilité globale d'AirSaas sur Chrome.



---

## Templates et modèles

### Comment créer automatiquement des livrables types lors de la création d'un projet ?

**Avec les templates projet (disponibles) :**

Depuis les paramètres de votre espace, vous pouvez créer des templates de projet qui incluent :
- Les jalons types (qui peuvent représenter vos livrables)
- Les dates relatives entre jalons
- Les équipes impliquées par défaut
- Les attributs préremplis

**Pour créer un template avec vos livrables standards :**
1. Allez dans Paramètres > Templates projet
2. Créez un nouveau template
3. Ajoutez vos jalons types : Expression de besoin, DICT, BIA, PAS, etc.
4. Configurez les dates relatives et dépendances
5. Lors de la création d'un nouveau projet, sélectionnez ce template

**Alternative actuelle :**
- Dupliquez un projet existant qui contient déjà tous vos livrables types
- Utilisez la fonction de duplication en sélectionnant les jalons à copier

**Ressources utiles :**
- [Les templates projet (enfin) 😅](https://club.airsaas.io/c/ca-vient-de-sortir/les-templates-projet-enfin)
- [Dupliquer les projets 👯‍♀️](https://club.airsaas.io/c/ca-vient-de-sortir/dupliquer-les-projets)



---

## Roadmap produit

### Comment consulter la roadmap produit et proposer des évolutions ?

**Consulter la roadmap**
Nous partageons une partie de notre roadmap publiquement ici : https://club.airsaas.io/c/ca-sort-bientot/
Cette roadmap contient les fonctionnalités que nous sommes quasi certains de développer dans les prochains mois. Elle n'est pas exhaustive et est mise à jour régulièrement.

**Proposer vos idées**
Pour partager vos idées d'amélioration, vous avez deux options :
- Continuer à les poster dans le chat support
- Les proposer dans le club communautaire : https://club.airsaas.io/c/proposez-vos-features/ pour les challenger avec d'autres utilisateurs

Dans tous les cas, nous prenons note de vos suggestions. Si le besoin est partagé par plusieurs clients, nous le priorisons. Nous vous tenons informé quand la fonctionnalité sort.



---

