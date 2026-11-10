# ======================================================
# Terraform - VM staging et production sur VMware Workstation
#
# VMware Workstation n'a pas de provider officiel exploitable sans
# ESXi/vCenter : les VM sont pilotées avec l'outil vmrun (fourni avec
# Workstation) depuis des ressources terraform_data. Terraform garde
# l'état, calcule le plan et sait détruire/recréer chaque VM.
# ======================================================
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }
}
