# BoxLog

App type SugarWOD : le coach (ou un adhérent) poste le WOD du jour, chaque adhérent note son propre score, et tout le monde a un journal perso pour ses PR. Multi-box dès le départ (chaque coach a sa box, chaque adhérent peut rejoindre une box via un code).

## Démarrage

1. Crée un projet Supabase (gratuit) sur supabase.com
2. Dans **SQL Editor**, colle et exécute `supabase_schema.sql`
3. Copie `.env.local.example` en `.env.local` et renseigne :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Project Settings → API, dans ton projet Supabase)
4. Dans Supabase → Authentication → Providers, active Email (activé par défaut). Tu peux désactiver la confirmation par email pour tester plus vite (Authentication → Settings → "Confirm email").
5. `npm install`
6. `npm run dev` → http://localhost:3000

## Premier lancement

- Crée un compte → tu arrives sur `/onboarding`
- "Je suis coach" → crée ta box (tu deviens coach automatiquement)
- Va dans **Ma box** → génère un code d'invitation → donne-le à tes adhérents
- Un adhérent crée son compte, choisit "J'ai un code", rentre le code → il rejoint ta box en tant que membre

## Ce qui est fait

- Multi-box (un user peut appartenir à plusieurs box, switch dans "Ma box")
- Rôles coach / membre par box (`box_members.role`)
- WOD du jour : le coach publie directement, un adhérent propose (statut `pending`) → le coach valide/refuse dans "Propositions"
- 5 formats de WOD (For Time, AMRAP, EMOM, Force, Autre) et 5 types de scoring (temps, rounds+reps, charge, reps, sans score)
- Un score par adhérent par WOD (RX/Scaled), classement automatique
- Journal PR perso : ajout de records par mouvement (charge / temps / reps), historique, dernier record par mouvement
- RLS Supabase complet (aucune donnée d'une box visible par une autre box)
- Headers de sécurité + validation zod sur tous les formulaires

## Pistes d'évolution (non incluses, à prioriser ensuite)

- Upload photo/vidéo de la séance
- Commentaires / réactions sur les scores (effet communauté)
- Notifications (nouveau WOD publié, PR battu)
- Vue coach : stats de présence / participation par adhérent
- Calendrier hebdo des WOD (planning à l'avance vs jour J)
- Rapprochement avec les 11 agents AutoFlow existants (ex: relance auto si score non posté)
