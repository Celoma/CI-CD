# Image d'exécution des déploiements (poste local et jobs GitLab CI) :
# Ansible + client SSH + curl + cosign (vérification de la signature des images)
FROM python:3.12-slim-bookworm

ARG ANSIBLE_CORE_VERSION=2.17.7
ARG COSIGN_VERSION=2.4.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-client curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "ansible-core==${ANSIBLE_CORE_VERSION}"

# cosign : binaire officiel, somme SHA256 vérifiée
RUN curl -fsSLo /usr/local/bin/cosign \
      "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64" \
    && curl -fsSL "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign_checksums.txt" \
       | grep ' cosign-linux-amd64$' | sed 's#cosign-linux-amd64#/usr/local/bin/cosign#' | sha256sum -c - \
    && chmod +x /usr/local/bin/cosign

WORKDIR /ansible
