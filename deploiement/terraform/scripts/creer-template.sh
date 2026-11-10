#!/usr/bin/env bash
# ======================================================
# Création (une seule fois) de la VM modèle Ubuntu Server 24.04
# pour VMware Workstation, à partir de l'image cloud officielle.
#
#   1. télécharge l'OVA Ubuntu 24.04 et vérifie son SHA256
#   2. la convertit en VM Workstation avec ovftool
#   3. adapte le .vmx (matériel v21, réseau NAT, journal série)
#   4. agrandit le disque (cloud-init étend la partition au 1er démarrage)
#
# La VM modèle n'est jamais démarrée : Terraform la clone pour
# créer les VM staging et production (cloud-init s'exécute sur chaque clone).
#
# Usage (Git Bash) : ./creer-template.sh [dossier_des_vm]
# ======================================================
set -euo pipefail

VM_DIR="${1:-$HOME/Documents/Virtual Machines}"
WS="/c/Program Files (x86)/VMware/VMware Workstation"
OVFTOOL="$WS/OVFTool/ovftool.exe"
VDISK="$WS/vmware-vdiskmanager.exe"
NAME="ubuntu-2404-template"
IMG_DIR="$VM_DIR/souverainrecrut-images"
OVA="ubuntu-24.04-server-cloudimg-amd64.ova"
BASE_URL="https://cloud-images.ubuntu.com/releases/noble/release"
DISK_SIZE="20GB"

mkdir -p "$IMG_DIR"
cd "$IMG_DIR"
if [ ! -f "$OVA" ]; then
  echo "> Téléchargement de $OVA"
  curl -sSfL "$BASE_URL/SHA256SUMS" | grep "$OVA" > SHA256SUMS
  curl -sSfL -o "$OVA" "$BASE_URL/$OVA"
fi
sha256sum -c SHA256SUMS

TPL="$VM_DIR/$NAME"
if [ -f "$TPL/$NAME.vmx" ]; then
  echo "> La VM modèle existe déjà : $TPL/$NAME.vmx"
  exit 0
fi

echo "> Conversion OVA -> VM Workstation"
MSYS_NO_PATHCONV=1 "$OVFTOOL" --lax --acceptAllEulas --allowExtraConfig --name="$NAME" \
  "$(cygpath -w "$IMG_DIR/$OVA")" "$(cygpath -w "$VM_DIR")\\"

VMX="$TPL/$NAME.vmx"
echo "> Adaptation du .vmx"
sed -i \
  -e 's/^virtualhw.version = .*/virtualhw.version = "21"/' \
  -e 's/^ethernet0.connectionType = .*/ethernet0.connectionType = "nat"/' \
  -e '/^serial0\./d' -e '/^floppy0\./d' -e '/^tools.syncTime/d' \
  "$VMX"
cat >> "$VMX" <<'EOF'
floppy0.present = "FALSE"
serial0.present = "TRUE"
serial0.fileType = "file"
serial0.fileName = "serial.log"
serial0.startConnected = "TRUE"
tools.syncTime = "TRUE"
EOF

echo "> Agrandissement du disque à $DISK_SIZE"
MSYS_NO_PATHCONV=1 "$VDISK" -x "$DISK_SIZE" "$(cygpath -w "$TPL/$NAME-disk1.vmdk")"

echo "> VM modèle prête : $VMX"
