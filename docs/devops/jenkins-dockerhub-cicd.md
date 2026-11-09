<div align="center">

<br><br><br>

# SouverainRecrut

## Mise en place d'une chaîne CI/CD<br>Jenkins + Docker Hub

<br>

**Documentation technique des manipulations et commandes**

<br><br>

| | |
|---|---|
| **Projet** | SouverainRecrut — plateforme de gestion des recrutements |
| **Dépôt** | `https://github.com/Celoma/CI-CD` |
| **Branche** | `feature/jenkins-dockerhub-cicd` |
| **Outils** | Git · Docker · Docker Compose · Jenkins (LTS) · Docker Hub |
| **Auteur** | Celoma |
| **Date** | 9 novembre 2026 |
| **Version** | 1.0 |

<br><br><br>

</div>

<div style="page-break-after: always;"></div>

## Sommaire

1. [Introduction et objectifs](#1-introduction-et-objectifs)
2. [Vue d'ensemble de la chaîne CI/CD](#2-vue-densemble-de-la-chaîne-cicd)
3. [Prérequis](#3-prérequis)
4. [Étape 1 — Création de la branche de travail](#4-étape-1--création-de-la-branche-de-travail)
5. [Étape 2 — Vérification du build et correction du lockfile frontend](#5-étape-2--vérification-du-build-et-correction-du-lockfile-frontend)
6. [Étape 3 — Conteneurisation de l'application](#6-étape-3--conteneurisation-de-lapplication)
7. [Étape 4 — Image Jenkins personnalisée](#7-étape-4--image-jenkins-personnalisée)
8. [Étape 5 — Configuration de Jenkins « as Code » (JCasC)](#8-étape-5--configuration-de-jenkins--as-code--jcasc)
9. [Étape 6 — Création du token Docker Hub](#9-étape-6--création-du-token-docker-hub)
10. [Étape 7 — Démarrage de Jenkins](#10-étape-7--démarrage-de-jenkins)
11. [Étape 8 — Le pipeline (Jenkinsfile)](#11-étape-8--le-pipeline-jenkinsfile)
12. [Étape 9 — Déploiement continu (Docker Compose)](#12-étape-9--déploiement-continu-docker-compose)
13. [Étape 10 — Déclenchement automatique sur chaque commit](#13-étape-10--déclenchement-automatique-sur-chaque-commit)
14. [Étape 11 — Vérifications effectuées](#14-étape-11--vérifications-effectuées)
15. [Récapitulatif des commandes](#15-récapitulatif-des-commandes)
16. [Dépannage](#16-dépannage)
17. [Sécurité et bonnes pratiques](#17-sécurité-et-bonnes-pratiques)
18. [Annexe — Fichiers ajoutés ou modifiés](#18-annexe--fichiers-ajoutés-ou-modifiés)

<div style="page-break-after: always;"></div>

## 1. Introduction et objectifs

Ce document décrit, pas à pas, la mise en place d'une chaîne **d'intégration et de livraison continues (CI/CD)** pour le projet SouverainRecrut, à l'aide de **Jenkins** et de **Docker Hub**.

Objectifs :

- **Intégration continue (CI)** : à chaque commit poussé sur le dépôt, le code backend et frontend est installé, compilé, testé et analysé automatiquement.
- **Livraison continue** : si la CI réussit, les images Docker du backend et du frontend sont construites puis **publiées sur Docker Hub**, avec un tag unique par commit.
- **Déploiement continu** : sur la branche `main`, l'application (base PostgreSQL + API + frontend) est redéployée automatiquement à partir des images publiées, puis vérifiée par un *smoke test*.
- **Reproductibilité** : Jenkins lui-même est conteneurisé et entièrement configuré par du code (plugins, compte admin, identifiants, job). Aucune configuration manuelle via l'interface n'est nécessaire.

## 2. Vue d'ensemble de la chaîne CI/CD

```
 Développeur
     │  git commit && git push
     ▼
 GitHub (Celoma/CI-CD)
     │  scan toutes les 2 min (ou webhook GitHub)
     ▼
 Jenkins (conteneur Docker, job multibranche "souverainrecrut")
     │
     ├─ 1. Checkout ............ récupération du commit, calcul du tag <branche>-<sha>
     ├─ 2. CI (parallèle)
     │     ├─ Backend ......... npm ci → prisma generate → tsc → npm test
     │     └─ Frontend ........ npm ci → eslint (non bloquant) → tsc + vite build
     ├─ 3. Docker Build ........ images backend et frontend
     ├─ 4. Push Docker Hub ..... <user>/souverainrecrut-{backend,frontend}:<tag>
     │                           + :latest si branche main
     └─ 5. Deploy (main) ....... docker compose pull / up -d + smoke test /v1/health
                                     │
                                     ▼
                        PostgreSQL ── API :4000 ── Frontend :3000
```

Jenkins tourne dans un conteneur mais pilote le **démon Docker de l'hôte** grâce au montage du socket `/var/run/docker.sock`. Les images construites et les conteneurs déployés sont donc visibles directement sur la machine hôte (*Docker-outside-of-Docker*).

## 3. Prérequis

| Élément | Version utilisée | Rôle |
|---|---|---|
| Git | 2.x | Gestion des sources, création de la branche |
| Docker Desktop (ou Docker Engine) | 29.x | Exécution de Jenkins et des applications |
| Docker Compose | v2+ | Orchestration des conteneurs |
| Compte Docker Hub | — | Registre public des images |
| Node.js (optionnel en local) | 22.x | Vérification du build hors Jenkins |

Vérification de l'environnement :

```bash
git --version
docker --version
docker compose version
docker info          # le démon doit répondre (Docker Desktop démarré)
```

> **Utilité :** s'assurer que les outils sont installés et que le démon Docker est lancé avant de commencer. Si `docker info` renvoie « failed to connect to the docker API », il faut démarrer Docker Desktop.

<div style="page-break-after: always;"></div>

## 4. Étape 1 — Création de la branche de travail

```bash
cd souverainrecrut
git checkout main
git pull
git checkout -b feature/jenkins-dockerhub-cicd
```

> **Utilité :** isoler tout le travail d'industrialisation sur une branche dédiée. La branche `main` reste intacte tant que la fonctionnalité n'est pas validée et fusionnée (merge request / pull request). Le job Jenkins multibranche construira aussi cette branche, ce qui permet de tester la chaîne avant la fusion.

## 5. Étape 2 — Vérification du build et correction du lockfile frontend

Avant d'automatiser, on vérifie que chaque application se construit « à la main », exactement comme le fera Jenkins.

**Backend :**

```bash
cd backend
npm ci                 # installation stricte, basée sur package-lock.json
npx prisma generate    # génération du client Prisma
npm run build          # compilation TypeScript (tsc) vers dist/
```

Résultat : build OK.

**Frontend :**

```bash
cd frontend
npm ci
```

Résultat : **échec** — `npm ci can only install packages when your package.json and package-lock.json are in sync` (paquets `@emnapi/*` manquants dans le lockfile).

Correction :

```bash
npm install            # régénère package-lock.json en cohérence avec package.json
npm ci                 # vérifie que l'installation stricte fonctionne désormais
npm run lint           # ESLint
npm run build          # tsc -b && vite build
```

Résultat : `npm ci` et `npm run build` OK. `npm run lint` remonte **1 erreur existante** dans `src/contexts/AuthContext.tsx` (règle `react-refresh/only-export-components`).

> **Utilité :** `npm ci` est la commande à utiliser en CI car elle installe *exactement* les versions du lockfile (builds reproductibles) et échoue si le lockfile est incohérent. Sans cette correction, le pipeline aurait échoué dès l'installation. L'erreur de lint, qui relève du code applicatif et non de l'infrastructure, n'a pas été corrigée : le pipeline la signale en passant le build à l'état **UNSTABLE** (orange) sans bloquer la livraison.

<div style="page-break-after: always;"></div>

## 6. Étape 3 — Conteneurisation de l'application

### 6.1 Backend — `backend/Dockerfile` (modifié)

Le Dockerfile existant a été conservé dans son principe (build *multi-stage*) avec trois corrections :

| Modification | Raison |
|---|---|
| `node:20-alpine` → `node:22-alpine` | `package.json` exige `"engines": { "node": ">=22.0.0" }` |
| `npm ci --only=production` → `npm ci --omit=dev` | `--only` est obsolète dans npm 10 |
| Ajout du CLI `prisma` + copie de `prisma.config.ts` dans l'image finale | Permet d'exécuter `npx prisma migrate deploy` au démarrage du conteneur (création des tables) |

Extrait :

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev \
    && npm install --no-save "prisma@$(node -p "require('./package.json').devDependencies.prisma")" \
    && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

> **Utilité du multi-stage :** l'étape `builder` contient TypeScript et toutes les dépendances de développement ; l'image finale `runner` ne contient que le JavaScript compilé et les dépendances de production → image plus légère et surface d'attaque réduite.

### 6.2 Frontend — `frontend/Dockerfile` (créé)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000/v1
ENV VITE_API_URL=${VITE_API_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

> **Utilité :** Vite produit des fichiers statiques (HTML/JS/CSS) ; ils sont servis par **Nginx**, beaucoup plus léger et performant qu'un serveur Node. L'URL de l'API est une variable *de build* (`VITE_API_URL`) car Vite l'inscrit en dur dans le JavaScript généré : Jenkins la passe avec `--build-arg`.

### 6.3 Frontend — `frontend/nginx.conf` (créé)

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

> **Utilité :** l'application utilise React Router (routage côté navigateur). Sans `try_files ... /index.html`, un rafraîchissement sur `/candidates` renverrait une erreur 404. Les assets générés par Vite ont un nom contenant un hash, ils peuvent donc être mis en cache longtemps.

### 6.4 `.dockerignore` (créés dans `backend/` et `frontend/`)

```
node_modules
dist
.env
*.log
Dockerfile
.dockerignore
```

> **Utilité :** exclure du *contexte de build* les dépendances locales (réinstallées dans l'image), les artefacts et surtout les fichiers `.env` contenant des secrets. Le build est plus rapide et aucun secret ne se retrouve dans une image publiée.

### 6.5 Test local des images

```bash
docker build -t souverainrecrut-backend:local backend
docker build -t souverainrecrut-frontend:local frontend
docker images | grep souverainrecrut
```

> **Utilité :** valider les Dockerfiles avant de les confier à Jenkins.

<div style="page-break-after: always;"></div>

## 7. Étape 4 — Image Jenkins personnalisée

Tous les fichiers Jenkins sont regroupés dans le dossier `jenkins/`.

### 7.1 `jenkins/Dockerfile`

```dockerfile
FROM jenkins/jenkins:lts-jdk21
USER root
# Docker CLI + plugins buildx et compose (dépôt officiel Docker)
RUN apt-get update && apt-get install -y ca-certificates curl gnupg \
 && ... && apt-get install -y docker-ce-cli docker-buildx-plugin docker-compose-plugin
# Node.js 22 (NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
USER jenkins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY casc.yaml /usr/share/jenkins/ref/casc.yaml
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc.yaml
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
```

> **Utilité :**
> - **Docker CLI + Compose** : Jenkins doit pouvoir lancer `docker build`, `docker push` et `docker compose`. Seul le *client* est installé ; il parle au démon de l'hôte via le socket monté.
> - **Node.js 22** : exécuter `npm ci`, le lint et le build directement dans Jenkins.
> - **`jenkins-plugin-cli`** : installe les plugins au moment de la construction de l'image (pas de clic dans l'interface, versions résolues automatiquement avec leurs dépendances).
> - **`runSetupWizard=false`** : supprime l'assistant de première installation, inutile puisque JCasC configure tout.

### 7.2 `jenkins/plugins.txt`

| Plugin | Rôle |
|---|---|
| `configuration-as-code` | Configure Jenkins à partir d'un fichier YAML (JCasC) |
| `job-dsl` | Crée le job multibranche depuis le YAML |
| `cloudbees-folder` | Dossiers / job multibranche et scan périodique |
| `workflow-aggregator` | Pipelines déclaratifs (`Jenkinsfile`) |
| `workflow-multibranch` | Un pipeline par branche Git |
| `git`, `github` | Récupération du code, réception des webhooks GitHub |
| `credentials-binding` | Injection sécurisée des identifiants (`withCredentials`) |
| `pipeline-stage-view` | Visualisation graphique des étapes |
| `timestamper` | Horodatage des logs |
| `ws-cleanup` | Nettoyage du workspace (`cleanWs()`) |

## 8. Étape 5 — Configuration de Jenkins « as Code » (JCasC)

Fichier `jenkins/casc.yaml`, lu au démarrage de Jenkins. Les valeurs `${VARIABLE}` proviennent des variables d'environnement du conteneur (fichier `jenkins/.env`).

```yaml
jenkins:
  securityRealm:
    local:
      allowsSignup: false
      users:
        - id: "${JENKINS_ADMIN_ID}"
          password: "${JENKINS_ADMIN_PASSWORD}"
  authorizationStrategy:
    loggedInUsersCanDoAnything:
      allowAnonymousRead: false

credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              id: "dockerhub-credentials"
              username: "${DOCKERHUB_USERNAME}"
              password: "${DOCKERHUB_TOKEN}"
              usernameSecret: false

jobs:
  - script: >
      multibranchPipelineJob('souverainrecrut') {
        branchSources { git { id('souverainrecrut-git'); remote('${GIT_REPO_URL}') } }
        factory { workflowBranchProjectFactory { scriptPath('Jenkinsfile') } }
        triggers { periodicFolderTrigger { interval('2m') } }
        orphanedItemStrategy { discardOldItems { numToKeep(10) } }
      }
```

> **Utilité de chaque bloc :**
> - **securityRealm / authorizationStrategy** : crée le compte administrateur et interdit l'accès anonyme.
> - **credentials** : enregistre l'identifiant `dockerhub-credentials` utilisé par le `Jenkinsfile`. Le token n'apparaît jamais dans le code : il est lu dans `.env`, et Jenkins le masque (`****`) dans les logs. `usernameSecret: false` permet d'utiliser le nom d'utilisateur dans le nom des images sans qu'il soit masqué.
> - **jobs** : crée automatiquement le job **multibranche** `souverainrecrut`. Il découvre toutes les branches du dépôt contenant un `Jenkinsfile` et crée un pipeline par branche. Le **scan périodique de 2 minutes** détecte les nouveaux commits et déclenche les builds correspondants.

<div style="page-break-after: always;"></div>

## 9. Étape 6 — Création du token Docker Hub

1. Se connecter sur <https://hub.docker.com>.
2. **Account settings → Personal access tokens → Generate new token**.
3. Description : `jenkins-souverainrecrut` ; permissions : **Read & Write**.
4. Copier le token (`dckr_pat_...`) — il n'est affiché qu'une seule fois.

Les dépôts `souverainrecrut-backend` et `souverainrecrut-frontend` sont créés automatiquement sur Docker Hub au premier `docker push` (publics par défaut).

> **Utilité :** un *access token* remplace le mot de passe du compte. Il peut être limité en droits et révoqué à tout moment sans changer le mot de passe, ce qui est indispensable pour un outil automatisé comme Jenkins.

## 10. Étape 7 — Démarrage de Jenkins

### 10.1 Fichier d'environnement

```bash
cd jenkins
cp .env.example .env
```

Puis éditer `jenkins/.env` :

```dotenv
JENKINS_ADMIN_ID=admin
JENKINS_ADMIN_PASSWORD=<mot de passe fort>
JENKINS_URL=http://localhost:8080/
DOCKERHUB_USERNAME=<utilisateur Docker Hub>
DOCKERHUB_TOKEN=<token dckr_pat_...>
GIT_REPO_URL=https://github.com/Celoma/CI-CD.git
DOCKER_GID=0
```

> **Utilité :** centraliser les secrets et paramètres hors du code. Le fichier `.env` est ignoré par Git (règle `**/.env` du `.gitignore`), seul `.env.example` est versionné comme modèle.
>
> `DOCKER_GID` : groupe propriétaire de `/var/run/docker.sock`. Il vaut `0` sous Docker Desktop (Windows/macOS). Sous Linux, utiliser le GID du groupe `docker` : `getent group docker | cut -d: -f3`.

### 10.2 Lancement

```bash
docker compose up -d --build
docker compose logs -f jenkins     # attendre "Jenkins is fully up and running"
```

Fichier `jenkins/docker-compose.yml` :

```yaml
services:
  jenkins:
    build: .
    image: souverainrecrut-jenkins:latest
    container_name: jenkins
    restart: unless-stopped
    env_file: .env
    ports:
      - "8080:8080"
      - "50000:50000"
    group_add:
      - "${DOCKER_GID:-0}"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
volumes:
  jenkins_home:
```

> **Utilité :**
> - `build: .` construit l'image personnalisée de l'étape 4.
> - Le volume **`jenkins_home`** conserve l'historique des builds et la configuration lors des redémarrages.
> - Le montage **`/var/run/docker.sock`** donne à Jenkins l'accès au démon Docker de l'hôte, et **`group_add`** l'autorise à l'utiliser sans tourner en `root`.
> - `restart: unless-stopped` relance Jenkins automatiquement après un redémarrage de la machine.

### 10.3 Accès

Ouvrir <http://localhost:8080> et se connecter avec `JENKINS_ADMIN_ID` / `JENKINS_ADMIN_PASSWORD`. Le job **SouverainRecrut CI/CD** est déjà présent et lance immédiatement un premier scan des branches.

Vérifications rapides :

```bash
docker exec jenkins docker version    # le client Docker joint bien le démon de l'hôte
docker exec jenkins node -v           # v22.x
```

<div style="page-break-after: always;"></div>

## 11. Étape 8 — Le pipeline (`Jenkinsfile`)

Le fichier `Jenkinsfile` à la racine du dépôt décrit le pipeline. Il est versionné avec le code : toute évolution de la chaîne CI/CD passe elle aussi par un commit.

### 11.1 Options et variables

```groovy
options {
    timestamps()                                     // logs horodatés
    disableConcurrentBuilds()                        // un seul build à la fois par branche
    buildDiscarder(logRotator(numToKeepStr: '10'))   // garde les 10 derniers builds
    timeout(time: 30, unit: 'MINUTES')               // coupe un build bloqué
}
environment {
    DOCKERHUB_CREDENTIALS = 'dockerhub-credentials'
    BACKEND_IMAGE_NAME    = 'souverainrecrut-backend'
    FRONTEND_IMAGE_NAME   = 'souverainrecrut-frontend'
    VITE_API_URL          = 'http://localhost:4000/v1'
    DOCKER_CONFIG         = "${WORKSPACE}/.docker"   // login Docker isolé par build
}
```

### 11.2 Les étapes

| # | Étape | Commandes principales | Utilité |
|---|---|---|---|
| 1 | **Checkout** | `checkout scm`, `git rev-parse --short HEAD` | Récupère le commit et calcule le tag `<branche>-<sha>` (ex. `main-84a427e`) qui relie chaque image à un commit précis |
| 2a | **CI / Backend** | `npm ci`, `npx prisma generate`, `npm run build`, `npm test` | Vérifie que l'API compile et que les tests passent |
| 2b | **CI / Frontend** | `npm ci`, `npm run lint` (non bloquant), `npm run build` | Vérifie la qualité du code et que le frontend compile ; exécuté **en parallèle** du backend pour gagner du temps |
| 3 | **Docker Build** | `docker build -t <user>/souverainrecrut-backend:<tag> backend` (idem frontend avec `--build-arg VITE_API_URL`) | Produit les images livrables |
| 4 | **Push Docker Hub** | `docker login --password-stdin`, `docker push`, puis `docker tag ... :latest` + push sur `main` | Publie les images ; `latest` désigne toujours la dernière version validée de `main` |
| 5 | **Deploy** *(main)* | `docker compose pull`, `docker compose up -d`, smoke test `wget /v1/health` | Met à jour l'environnement déployé et vérifie que l'API répond |
| — | **post** | `docker rmi`, `docker image prune -f`, `cleanWs()`, `docker logout` | Libère le disque et supprime le login Docker |

### 11.3 Points importants

- **Le token n'est jamais affiché** : il est injecté par `withCredentials` et transmis via `--password-stdin` (et non en argument de commande, qui apparaîtrait dans la liste des processus).
- **Lint non bloquant** : `catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE')` → le build passe en orange mais les images sont livrées. Une fois l'erreur de lint corrigée dans le code, il suffit de supprimer ce `catchError` pour rendre le lint bloquant.
- **Stratégie de tags** :

| Branche | Tags publiés |
|---|---|
| `main` | `main-<sha>` et `latest` |
| autre branche (ex. `feature/x`) | `feature-x-<sha>` |

<div style="page-break-after: always;"></div>

## 12. Étape 9 — Déploiement continu (Docker Compose)

Fichier `deploy/docker-compose.yml`, utilisé par l'étape **Deploy** :

| Service | Image | Port hôte | Rôle |
|---|---|---|---|
| `db` | `postgres:16-alpine` | — (réseau interne) | Base de données, volume persistant `db_data`, *healthcheck* `pg_isready` |
| `backend` | `<user>/souverainrecrut-backend:<tag>` | 4000 | Exécute `npx prisma migrate deploy` puis démarre l'API |
| `frontend` | `<user>/souverainrecrut-frontend:<tag>` | 3000 | Nginx servant l'application React |

Commandes exécutées par Jenkins :

```bash
docker compose -p souverainrecrut -f deploy/docker-compose.yml pull
docker compose -p souverainrecrut -f deploy/docker-compose.yml up -d --remove-orphans
docker compose -p souverainrecrut -f deploy/docker-compose.yml exec -T backend \
    wget -qO- http://localhost:4000/v1/health
```

> **Utilité :**
> - `pull` télécharge depuis Docker Hub les images du commit qui vient d'être construit (variables `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `IMAGE_TAG` transmises par Jenkins).
> - `up -d` ne recrée que les conteneurs dont l'image a changé ; la base et ses données sont conservées.
> - `depends_on: condition: service_healthy` garantit que l'API ne démarre qu'une fois PostgreSQL prêt.
> - Le **smoke test** interroge `/v1/health` jusqu'à 20 fois (toutes les 3 s) : si l'API ne répond pas, le build échoue et les logs du backend sont affichés.

Après déploiement : frontend sur <http://localhost:3000>, API sur <http://localhost:4000>, documentation Swagger sur <http://localhost:4000/api-docs>.

Déploiement manuel d'une version précise (par exemple pour un retour arrière) :

```bash
BACKEND_IMAGE=<user>/souverainrecrut-backend \
FRONTEND_IMAGE=<user>/souverainrecrut-frontend \
IMAGE_TAG=main-84a427e \
docker compose -p souverainrecrut -f deploy/docker-compose.yml up -d
```

## 13. Étape 10 — Déclenchement automatique sur chaque commit

Deux mécanismes sont disponibles.

### 13.1 Scan périodique (actif par défaut)

Le job multibranche interroge le dépôt Git **toutes les 2 minutes** (`periodicFolderTrigger`). Pour chaque branche dont le dernier commit a changé, un build est lancé automatiquement. Une nouvelle branche poussée est elle aussi détectée et obtient son propre pipeline.

> **Utilité :** fonctionne même si Jenkins n'est pas joignable depuis Internet (cas d'un Jenkins local), sans aucune configuration côté GitHub.

### 13.2 Webhook GitHub (déclenchement instantané, optionnel)

Si Jenkins est accessible publiquement (serveur ou tunnel), GitHub peut le prévenir immédiatement à chaque `push` :

```bash
# Exemple avec un tunnel ngrok depuis le poste local
ngrok http 8080
```

Sur GitHub : **Settings → Webhooks → Add webhook**

- *Payload URL* : `https://<url-publique>/git/notifyCommit?url=https://github.com/Celoma/CI-CD.git`
- *Content type* : `application/json`
- *Events* : **Just the push event**

> **Utilité :** le build démarre en quelques secondes au lieu d'attendre le prochain scan. Le scan périodique reste actif en filet de sécurité.

### 13.3 Mise en route

```bash
git add .
git commit -m "ci: pipeline Jenkins + Docker Hub"
git push -u origin feature/jenkins-dockerhub-cicd
```

Au prochain scan, Jenkins détecte la branche et lance le pipeline (étapes 1 à 4). Après fusion dans `main`, l'étape 5 (Deploy) s'exécute également.

<div style="page-break-after: always;"></div>

## 14. Étape 11 — Vérifications effectuées

Les tests suivants ont été réalisés sur le poste de développement (Windows 11, Docker Desktop 29.9.2) le 9 novembre 2026.

### 14.1 Images applicatives et déploiement

```bash
docker build -t souverainrecrut-backend:local backend
docker build -t souverainrecrut-frontend:local frontend

BACKEND_IMAGE=souverainrecrut-backend FRONTEND_IMAGE=souverainrecrut-frontend IMAGE_TAG=local \
  docker compose -p srtest -f deploy/docker-compose.yml up -d

docker compose -p srtest -f deploy/docker-compose.yml exec -T backend wget -qO- http://localhost:4000/v1/health
docker compose -p srtest -f deploy/docker-compose.yml exec -T backend wget -qO- http://localhost:4000/v1/ready
curl -I http://localhost:3000/candidates

docker compose -p srtest -f deploy/docker-compose.yml down -v     # nettoyage
```

| Vérification | Résultat |
|---|---|
| Build image backend | OK (≈ 740 Mo, dont le CLI et les moteurs Prisma) |
| Build image frontend | OK (≈ 74 Mo) |
| Migrations Prisma au démarrage | `All migrations have been successfully applied.` |
| `GET /v1/health` | `{"status":"UP", ...}` |
| `GET /v1/ready` | `{"status":"READY","database":"CONNECTED"}` |
| Frontend `/` et `/candidates` (routage SPA) | HTTP 200 |
| Swagger `/api-docs` | HTTP 200 |

### 14.2 Jenkins et pipeline

Jenkins a été démarré avec l'image de l'étape 4, des identifiants Docker Hub **factices** et le dépôt local à la place de GitHub (fichier de surcharge Compose de test, non versionné).

```bash
docker exec jenkins sh -c 'id; docker version --format "{{.Server.Version}}"; node -v; docker compose version'
```

| Vérification | Résultat |
|---|---|
| Démarrage Jenkins sans assistant | `Jenkins is fully up and running` |
| Utilisateur `jenkins` dans le groupe du socket | `groups=1000(jenkins),0(root)` → `docker version` répond (29.9.2) |
| Node.js / Docker Compose dans Jenkins | v22 / v5.7 |
| Job créé par JCasC | `SouverainRecrut CI/CD` (multibranche) |
| Scan des branches | branche `feature/jenkins-dockerhub-cicd` détectée, build #1 lancé **automatiquement** |
| Checkout + tag | `feature-jenkins-dockerhub-cicd-3d4359a` |
| CI Backend (npm ci, prisma generate, tsc, npm test) | OK |
| CI Frontend (npm ci, lint, build) | build OK, lint : 1 erreur → étape **UNSTABLE** comme prévu |
| Docker Build | 2 images construites par Jenkins |
| Masquage du token | affiché `****` dans les logs |
| Push Docker Hub | refusé (`unauthorized`) — **attendu** avec un token factice |
| Deploy | ignoré (branche ≠ `main`, et échec précédent) |
| Post-actions | `docker logout`, suppression des images, `cleanWs()` OK |

Un second commit (ajout de cette documentation) a ensuite été détecté par le scan périodique et a déclenché le build #2 sans aucune action manuelle, ce qui valide le **déclenchement sur commit**.

> **Reste à faire avec les vrais identifiants :** renseigner `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` dans `jenkins/.env`, `GIT_REPO_URL` vers GitHub, pousser la branche : les étapes Push et (sur `main`) Deploy s'exécuteront alors entièrement.

## 15. Récapitulatif des commandes

| Commande | Utilité |
|---|---|
| `git checkout -b feature/jenkins-dockerhub-cicd` | Créer la branche de travail |
| `npm install` (frontend) | Resynchroniser `package-lock.json` |
| `npm ci` | Installation stricte et reproductible des dépendances |
| `npx prisma generate` | Générer le client Prisma |
| `npm run build` / `npm run lint` | Compiler / analyser le code |
| `docker build -t <image>:<tag> <dossier>` | Construire une image |
| `cp jenkins/.env.example jenkins/.env` | Préparer les variables de Jenkins |
| `docker compose up -d --build` (dans `jenkins/`) | Construire et démarrer Jenkins |
| `docker compose logs -f jenkins` | Suivre le démarrage de Jenkins |
| `docker exec jenkins docker version` | Vérifier l'accès de Jenkins au démon Docker |
| `echo "$TOKEN" \| docker login -u <user> --password-stdin` | Authentification Docker Hub (fait par Jenkins) |
| `docker push <user>/<image>:<tag>` | Publier une image (fait par Jenkins) |
| `docker compose -p souverainrecrut -f deploy/docker-compose.yml up -d` | Déployer l'application |
| `docker compose -p souverainrecrut -f deploy/docker-compose.yml logs -f backend` | Consulter les logs de l'API déployée |
| `docker compose down` (dans `jenkins/`) | Arrêter Jenkins (le volume est conservé) |
| `git push` | Déclencher le pipeline |

## 16. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `failed to connect to the docker API` | Docker Desktop arrêté | Démarrer Docker Desktop, attendre que `docker info` réponde |
| `permission denied ... /var/run/docker.sock` dans un build | Mauvais `DOCKER_GID` | Sous Linux : `getent group docker` puis mettre ce GID dans `jenkins/.env` et `docker compose up -d` |
| `npm ci` échoue (« not in sync ») | `package-lock.json` désynchronisé | `npm install` en local puis commiter le lockfile |
| `unauthorized: incorrect username or password` à l'étape Push | Token Docker Hub invalide / expiré ou sans droit d'écriture | Régénérer le token (Read & Write), mettre à jour `.env`, `docker compose up -d` |
| Aucun build après un `git push` | Scan pas encore passé | Attendre 2 min ou cliquer **Scan Multibranch Pipeline Now** dans le job |
| Le job n'existe pas | Erreur JCasC | `docker compose logs jenkins \| grep -i casc` |
| Build orange (UNSTABLE) | Erreur de lint frontend | Corriger l'erreur ESLint signalée dans les logs de l'étape Frontend |
| Smoke test KO | API ou base non démarrée | Logs affichés dans le build ; `docker compose -p souverainrecrut -f deploy/docker-compose.yml logs` |

## 17. Sécurité et bonnes pratiques

- **Aucun secret dans Git** : token Docker Hub et mot de passe admin uniquement dans `jenkins/.env` (ignoré par Git) ; `.dockerignore` empêche l'inclusion des `.env` dans les images.
- **Token plutôt que mot de passe** pour Docker Hub, révocable et limité en droits.
- **Login Docker éphémère** : `DOCKER_CONFIG` pointe vers le workspace, `docker logout` et `cleanWs()` en fin de build.
- **Accès au socket Docker = accès root à l'hôte** : réserver ce Jenkins à un usage de formation/développement ; en production, préférer des agents Jenkins dédiés ou un builder sans démon (Kaniko, BuildKit rootless).
- **Secrets de déploiement** : `POSTGRES_PASSWORD` et `JWT_SECRET` ont des valeurs par défaut de démonstration dans `deploy/docker-compose.yml` ; en production, les fournir via des credentials Jenkins (`withCredentials`) ou un gestionnaire de secrets.
- **Traçabilité** : chaque image est taguée avec le SHA du commit, ce qui permet de savoir exactement quel code tourne et de revenir à une version précédente.

## 18. Annexe — Fichiers ajoutés ou modifiés

```
souverainrecrut/
├── Jenkinsfile                         (créé)    pipeline CI/CD
├── backend/
│   ├── Dockerfile                      (modifié) Node 22, --omit=dev, CLI Prisma
│   └── .dockerignore                   (créé)
├── frontend/
│   ├── Dockerfile                      (créé)    build Vite + Nginx
│   ├── nginx.conf                      (créé)    configuration SPA
│   ├── .dockerignore                   (créé)
│   └── package-lock.json               (modifié) resynchronisé avec package.json
├── jenkins/
│   ├── Dockerfile                      (créé)    image Jenkins + Docker CLI + Node 22
│   ├── plugins.txt                     (créé)    liste des plugins
│   ├── casc.yaml                       (créé)    configuration as code
│   ├── docker-compose.yml              (créé)    lancement de Jenkins
│   └── .env.example                    (créé)    modèle des variables/secrets
├── deploy/
│   └── docker-compose.yml              (créé)    déploiement db + backend + frontend
└── docs/devops/
    └── jenkins-dockerhub-cicd.md       (créé)    ce document
```
