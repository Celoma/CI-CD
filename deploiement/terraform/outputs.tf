output "vm_ips" {
  description = "Adresse IP de chaque VM"
  value       = { for name, _ in var.vms : name => data.external.ip[name].result.ip }
}

output "ssh" {
  description = "Commande de connexion SSH à chaque VM"
  value       = { for name, _ in var.vms : name => "ssh -i ~/.ssh/souverainrecrut_deploy ${var.admin_user}@${data.external.ip[name].result.ip}" }
}

output "api_urls" {
  description = "URL de l'API une fois déployée (endpoint de santé)"
  value       = { for name, _ in var.vms : name => "http://${data.external.ip[name].result.ip}:4000/v1/health" }
}

output "ansible_inventory" {
  description = "Inventaires Ansible générés (un par environnement)"
  value       = { for name, f in local_file.inventory : name => f.filename }
}
