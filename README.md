# SouverainRecrut

## Présentation

SouverainRecrut est une plateforme web de gestion des recrutements destinée aux entreprises.

Elle permet de :

- gérer les candidats ;
- publier des offres d'emploi ;
- suivre les candidatures ;
- centraliser le processus de recrutement.

Ce projet est utilisé comme **projet fil rouge** des cours DevOps. Le Backend est industrialisé de bout en bout :
intégration continue, image signée, provisionnement des serveurs et déploiement avec approbation.

---

## Architecture

```
Frontend (React)
        │
        ▼
Backend (Express API)
        │
        ▼
PostgreSQL
```

## Chaîne CI/CD

```
GitHub (Dev / main)
   │  scan multibranche toutes les 2 min
   ▼
Jenkins : tests Jest → SonarQube + Quality Gate → build Docker → Trivy → SBOM Syft → push Docker Hub → signature cosign
   │  branche main : déclenchement du pipeline GitLab (tag, digest, commit)
   ▼
GitLab CI/CD : vérification de la signature → staging (auto) → smoke tests → approbation manuelle → production → smoke tests
   │  runner local, Ansible dans un conteneur
   ▼
VM Ubuntu 24.04 (VMware Workstation, créées par Terraform) : Docker Compose (API + PostgreSQL)
```

La même image, identifiée par son digest, est déployée en staging puis en production. En cas d'échec, la version
précédente est redéployée automatiquement ; la base est sauvegardée (`pg_dump`) avant chaque migration.

---

## Stack technique

### Frontend

- React, TypeScript, Vite, Axios, Material UI

### Backend

- Node.js, Express, TypeScript, Prisma, PostgreSQL
- Swagger (`/api-docs`), Jest (tests unitaires et d'intégration)

### DevOps

| Outil | Rôle |
|---|---|
| Jenkins (Docker, JCasC) | Intégration continue, build et publication de l'image |
| SonarQube | Qualité du code et Quality Gate |
| Trivy, Syft, cosign | Scan de vulnérabilités, SBOM CycloneDX, signature de l'image |
| Docker Hub | Registre des images versionnées (`<version>-<sha>`) |
| Terraform | Création des VM staging et production sur VMware Workstation |
| Ansible (+ Vault) | Configuration des serveurs, déploiement, rollback, sauvegarde et restauration de la base |
| GitLab CI/CD | Pipeline de déploiement avec approbation manuelle |
| Docker Compose | Exécution de l'API et de PostgreSQL sur les serveurs |

---

## Arborescence

```
souverainrecrut/
├── backend/                 API Express + Prisma, Dockerfile, tests Jest
├── frontend/                Application React (non déployée par la chaîne actuelle)
├── integration-continue/    Jenkinsfile, serveur Jenkins + SonarQube, configuration Sonar, rapports Word
├── deploiement/             Terraform, Ansible, Docker Compose, pipeline GitLab (voir deploiement/README.md)
├── docs/                    Documentation : API, base de données, architecture, DevOps
└── README.md
```

## Documentation

| Document | Contenu |
|---|---|
| [deploiement/README.md](deploiement/README.md) | Mise en place, déploiement, rollback, sauvegarde et restauration |
| [docs/devops/devops.md](docs/devops/devops.md) | Vue d'ensemble de l'industrialisation et procédures d'exploitation |
| [docs/api/api.md](docs/api/api.md) | Routes de l'API |
| [docs/database/database.md](docs/database/database.md) | Modèle de données et migrations |
| `integration-continue/reports/Rapport_TP_CICD.docx` | Rapport d'exécution des parties 3 à 5, avec les preuves |

---

## Auteurs

- Projet initial : ALIMOU DIALLO (support du cours DevOps)
- Industrialisation CI/CD (parties 3 à 5) : Clément Salouet
