# SouverainRecrut – Déploiement (staging et production)

Chaîne de livraison de l'API Backend :

```
Merge main (GitHub) → CI Jenkins (tests, SonarQube, Trivy, SBOM) → push + signature cosign (Docker Hub)
  → pipeline GitLab : validation → staging (auto) → smoke tests → approbation manuelle → production → smoke tests
```

La même image (même digest) est déployée en staging puis en production. Elle n'est jamais reconstruite.

## Contenu

| Dossier | Rôle |
|---|---|
| `terraform/` | Crée les VM Ubuntu 24.04 `souverainrecrut-staging` et `souverainrecrut-production` sur VMware Workstation, et génère les inventaires Ansible et `known_hosts` |
| `ansible/` | `playbook.yml` (Docker Engine + Compose), `deploy.yml` (déploiement par tag, smoke tests, rollback automatique), `rollback.yml` |
| `deployment/` | `docker-compose.yml` (API + PostgreSQL) et `.env.example` |
| `gitlab-runner/` | Runner GitLab local (les VM sont sur un réseau privé que gitlab.com ne peut pas joindre) |
| `.gitlab-ci.yml` | Pipeline de déploiement |
| `cosign.pub` | Clé publique : seules les images signées par Jenkins sont déployées |

## Mise en place (une fois)

```bash
# 1. VM modèle Ubuntu 24.04 (image cloud officielle), puis VM staging et production
./terraform/scripts/creer-template.sh
cd terraform && cp terraform.tfvars.example terraform.tfvars   # adapter les chemins
terraform init && terraform plan -out=tfplan && terraform apply tfplan
terraform output

# 2. Préparation des serveurs (Ansible tourne dans un conteneur)
cd ../ansible
./run-ansible.sh ansible -i inventories/staging app -m ping
./run-ansible.sh ansible-playbook -i inventories/staging playbook.yml
./run-ansible.sh ansible-playbook -i inventories/production playbook.yml

# 3. Runner GitLab local
cd ../gitlab-runner && docker compose up -d && RUNNER_TOKEN=glrt-... ./register.sh
```

Secrets (jamais dans Git) : clé SSH `~/.ssh/souverainrecrut_deploy`, mot de passe Vault `ansible/.vault_pass`,
secrets applicatifs dans `ansible/inventories/<env>/group_vars/app/vault.yml` (chiffrés Ansible Vault).
Variables CI/CD GitLab protégées : `SSH_PRIVATE_KEY` (type File), `ANSIBLE_VAULT_PASSWORD` (masquée).

## Déployer

- **Automatique** : un merge sur `main` (dépôt GitHub) déclenche Jenkins, qui lance ce pipeline avec `IMAGE_TAG`.
- **Manuel** : GitLab > Build > Pipelines > Run pipeline, variable `IMAGE_TAG` (ex. `1.0.0-05b02ac`).
- **En local** : `./run-ansible.sh ansible-playbook -i inventories/staging deploy.yml -e image_tag=1.0.0-05b02ac`

La production attend une approbation : bouton « Run » du job `deploy-production`. GitLab trace qui a validé et quand,
et `deploy.yml` l'écrit dans `/opt/souverainrecrut/deployments.log` sur le serveur (tag, digest, commit, auteur, pipeline).

## Rollback

- **Automatique** : si les smoke tests échouent pendant `deploy.yml`, la version précédente est redéployée et le job échoue.
- **Manuel** : jobs `rollback-staging` / `rollback-production`, ou `./run-ansible.sh ansible-playbook -i inventories/production rollback.yml`
  (`-e image_tag=<tag>` pour une version précise).

Seule l'image change : le schéma de base n'est pas restauré, les migrations Prisma doivent rester rétrocompatibles.
