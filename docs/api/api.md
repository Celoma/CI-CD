# Documentation API

L'API REST est servie sous le préfixe `/v1` (variable `API_VERSION`), sur le port 4000.
La documentation Swagger interactive est disponible sur `/api-docs`.

| Environnement | URL |
|---|---|
| Local | http://localhost:4000 |
| Staging | http://192.168.235.129:4000 |
| Production | http://192.168.235.130:4000 |

## Routes publiques (supervision)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/v1/health` | L'API répond (utilisée par le healthcheck Docker et les smoke tests) |
| GET | `/v1/ready` | L'API est prête : connexion à PostgreSQL vérifiée (`database: CONNECTED`) |
| GET | `/v1/info` | Nom, version, environnement, liens utiles |
| POST | `/v1/auth/login` | Authentification, renvoie un jeton JWT |

## Routes protégées (jeton JWT requis)

Sans jeton valide, ces routes renvoient **401** (vérifié par les smoke tests du pipeline).

| Ressource | Routes | Rôles |
|---|---|---|
| Utilisateurs | `GET/POST /v1/users`, `GET/PUT/DELETE /v1/users/:id` | ADMIN |
| Candidats | `GET/POST /v1/candidates`, `GET/PUT /v1/candidates/:id` | ADMIN, RECRUITER |
| | `DELETE /v1/candidates/:id` | ADMIN |
| Offres d'emploi | `GET/POST /v1/jobs`, `GET/PUT/DELETE /v1/jobs/:id` | voir Swagger |
| Candidatures | `GET/POST /v1/applications`, `GET/PUT/DELETE /v1/applications/:id` | voir Swagger |
| Tableau de bord | `GET /v1/dashboard/stats` | ADMIN, RECRUITER |

Le détail des corps de requête (validés côté serveur) et des réponses se trouve dans Swagger (`/api-docs`).
