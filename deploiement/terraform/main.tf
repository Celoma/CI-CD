locals {
  ssh_public_key = trimspace(file(pathexpand(var.ssh_public_key_path)))

  # Configuration cloud-init de chaque VM (transmise via guestinfo, datasource VMware)
  cloud_init = {
    for name, vm in var.vms : name => {
      hostname = "souverainrecrut-${name}"
      vmx      = "${var.vm_dir}/souverainrecrut-${name}/souverainrecrut-${name}.vmx"
      metadata = templatefile("${path.module}/templates/meta-data.yaml.tftpl", { hostname = "souverainrecrut-${name}" })
      user_data = templatefile("${path.module}/templates/user-data.yaml.tftpl", {
        hostname       = "souverainrecrut-${name}"
        admin_user     = var.admin_user
        ssh_public_key = local.ssh_public_key
      })
    }
  }
}

# ------------------------------------------------------
# Une VM par environnement : clone complet de la VM modèle
# ------------------------------------------------------
resource "terraform_data" "vm" {
  for_each = var.vms

  # Toute modification de la configuration recrée la VM
  triggers_replace = {
    cpus      = each.value.cpus
    memory    = each.value.memory
    user_data = sha256(local.cloud_init[each.key].user_data)
    template  = var.template_vmx
  }

  # Valeurs disponibles au moment de la destruction (self.input)
  input = {
    vmx    = local.cloud_init[each.key].vmx
    vmrun  = var.vmrun_path
    script = abspath("${path.module}/scripts/vm-destroy.sh")
    bash   = var.bash_path
  }

  provisioner "local-exec" {
    interpreter = [var.bash_path, "-c"]
    command     = "'${abspath("${path.module}/scripts/vm-create.sh")}'"
    environment = {
      VMRUN        = var.vmrun_path
      TEMPLATE_VMX = var.template_vmx
      VMX          = local.cloud_init[each.key].vmx
      VM_NAME      = "souverainrecrut-${each.key}"
      CPUS         = each.value.cpus
      MEMORY       = each.value.memory
      METADATA     = base64encode(local.cloud_init[each.key].metadata)
      USERDATA     = base64encode(local.cloud_init[each.key].user_data)
    }
  }

  provisioner "local-exec" {
    when        = destroy
    interpreter = [self.input.bash, "-c"]
    command     = "'${self.input.script}'"
    environment = {
      VMRUN = self.input.vmrun
      VMX   = self.input.vmx
    }
  }
}

# Adresse IP attribuée par le DHCP du réseau NAT de Workstation
data "external" "ip" {
  for_each   = var.vms
  program    = [var.bash_path, "${path.module}/scripts/vm-ip.sh"]
  query      = { vmx = local.cloud_init[each.key].vmx, vmrun = var.vmrun_path }
  depends_on = [terraform_data.vm]
}

# Le pont Terraform -> Ansible : un inventaire par environnement,
# généré à partir de l'IP de chaque VM
resource "local_file" "inventory" {
  for_each        = var.vms
  filename        = "${path.module}/../ansible/inventories/${each.key}/hosts"
  file_permission = "0644"
  content = templatefile("${path.module}/templates/hosts.ini.tftpl", {
    env        = each.key
    hostname   = local.cloud_init[each.key].hostname
    ip         = data.external.ip[each.key].result.ip
    admin_user = var.admin_user
  })
}

# Clés d'hôte SSH des VM (fichier known_hosts utilisé par Ansible et GitLab CI)
data "external" "hostkeys" {
  for_each = var.vms
  program  = [var.bash_path, "${path.module}/scripts/vm-hostkeys.sh"]
  query    = { ip = data.external.ip[each.key].result.ip }
}

resource "local_file" "known_hosts" {
  filename        = "${path.module}/../ansible/known_hosts"
  file_permission = "0644"
  content         = join("", [for name, _ in var.vms : data.external.hostkeys[name].result.known_hosts])
}
