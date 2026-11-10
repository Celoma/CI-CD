# Base de données

Le projet utilise PostgreSQL 16, piloté par Prisma ORM (`backend/prisma/schema.prisma`).

## Modèle

| Table | Modèle Prisma | Contenu |
|---|---|---|
| `users` | User | Comptes (prénom, nom, email unique, mot de passe haché, rôle `ADMIN` ou `RECRUITER`) |
| `candidates` | Candidate | Candidats (nom complet, email unique, téléphone) |
| `jobs` | Job | Offres d'emploi (titre, description, lieu, entreprise), rattachées à un recruteur |
| `applications` | Application | Candidature d'un candidat à une offre, statut `PENDING`, `REVIEWED`, `ACCEPTED` ou `REJECTED` |

Les suppressions sont en cascade : supprimer une offre supprime ses candidatures.

## Migrations

Les migrations sont dans `backend/prisma/migrations/`. En déploiement, elles sont appliquées par un conteneur
ponctuel (`docker compose run --rm migrate`, soit `prisma migrate deploy`) avant le démarrage de l'API,
avec la même image que l'API.

Le rollback ne revient que sur l'image : les migrations doivent rester **rétrocompatibles** (ajouter des colonnes
ou des tables plutôt qu'en supprimer), pour que la version précédente fonctionne avec le schéma le plus récent.

## Données et sauvegardes sur les serveurs

- Les données sont dans le volume Docker `postgres_data`, conservé lors des déploiements et des rollbacks.
- Avant chaque migration, `deploy.yml` fait une sauvegarde `pg_dump` dans `/opt/souverainrecrut/backups/`
  (droits 600, 10 dernières conservées, nom indiqué dans le journal d'audit).
- Restauration : `ansible-playbook -i inventories/<env> restore-db.yml -e backup=<fichier.dump>`
  (sans `-e backup`, le playbook liste les sauvegardes). Voir `deploiement/README.md`.
