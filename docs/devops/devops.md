# Industrialisation

Le cycle de vie du Backend est automatisé du commit jusqu'à la production.

| Étape | Outil | Où |
|---|---|---|
| Intégration continue | Jenkins, Jest, SonarQube, Trivy, Syft | `integration-continue/` |
| Publication | Docker Hub, signature cosign | `integration-continue/Jenkinsfile` |
| Provisionnement | Terraform (VMware Workstation, cloud-init) | `deploiement/terraform/` |
| Configuration | Ansible (Docker Engine, Compose), Ansible Vault | `deploiement/ansible/` |
| Déploiement | GitLab CI/CD + Ansible + Docker Compose | `deploiement/.gitlab-ci.yml` |

Le rapport `integration-continue/reports/Rapport_TP_CICD.docx` contient les preuves d'exécution de chaque étape.

## Procédures d'exploitation

Les commandes Ansible se lancent depuis `deploiement/ansible/` avec `./run-ansible.sh` (Ansible dans un conteneur).

| Besoin | Commande |
|---|---|
| Démarrer les VM après un redémarrage du poste | `deploiement/terraform/scripts/vm-start.sh` |
| Déployer une version | Pipeline GitLab (`IMAGE_TAG`), ou `ansible-playbook -i inventories/<env> deploy.yml -e image_tag=<tag>` |
| Revenir à la version précédente | Job GitLab `rollback-<env>`, ou `ansible-playbook -i inventories/<env> rollback.yml` |
| Revenir à une version précise | `ansible-playbook -i inventories/<env> rollback.yml -e image_tag=<tag>` |
| Lister / restaurer les sauvegardes de la base | `ansible-playbook -i inventories/<env> restore-db.yml [-e backup=<fichier.dump>]` |
| Consulter l'historique | `ssh deploy@<ip> cat /opt/souverainrecrut/deployments.log` |

## Documents historiques

[jenkins-dockerhub-cicd.md](jenkins-dockerhub-cicd.md) décrit une première version de la chaîne (déploiement local
par Jenkins, images frontend). Elle a été remplacée par la chaîne ci-dessus.
