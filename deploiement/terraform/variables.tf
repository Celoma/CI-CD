variable "vm_dir" {
  description = "Dossier où VMware Workstation range les VM (chemin Windows avec des /)"
  type        = string
}

variable "template_vmx" {
  description = "VM modèle Ubuntu 24.04 créée par scripts/creer-template.sh"
  type        = string
}

variable "vmrun_path" {
  description = "Chemin de vmrun.exe"
  type        = string
  default     = "C:/Program Files (x86)/VMware/VMware Workstation/vmrun.exe"
}

variable "ssh_public_key_path" {
  description = "Clé publique autorisée pour l'utilisateur d'administration des VM"
  type        = string
}

variable "admin_user" {
  description = "Utilisateur créé par cloud-init sur chaque VM (sudo sans mot de passe, accès par clé SSH uniquement)"
  type        = string
  default     = "deploy"
}

variable "vms" {
  description = "Une VM par environnement"
  type = map(object({
    cpus   = number
    memory = number # Mo
  }))
  default = {
    staging    = { cpus = 2, memory = 2048 }
    production = { cpus = 2, memory = 2048 }
  }
}

variable "bash_path" {
  description = "Git Bash (les scripts utilisent cygpath et vmrun.exe) : appelé explicitement pour ne pas tomber sur le bash de WSL depuis PowerShell"
  type        = string
  default     = "C:/Program Files/Git/bin/bash.exe"
}

variable "vm_display" {
  description = "Démarrage des VM : gui (fenêtre VMware Workstation, console accessible) ou nogui (arrière-plan)"
  type        = string
  default     = "gui"
  validation {
    condition     = contains(["gui", "nogui"], var.vm_display)
    error_message = "vm_display doit valoir gui ou nogui."
  }
}
