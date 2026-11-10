# ======================================================
# Image Jenkins personnalisée pour SouverainRecrut
#  - Jenkins LTS (JDK 21)
#  - Docker CLI + plugin Compose (pilote le démon Docker de l'hôte via le socket)
#  - Node.js 22 (build / lint des applications)
#  - Plugins pré-installés + configuration as code (JCasC)
# ======================================================
FROM jenkins/jenkins:lts-jdk21

USER root

# --- Docker CLI + Docker Compose (dépôt officiel Docker) ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 22 (dépôt NodeSource) ---
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs unzip \
    && rm -rf /var/lib/apt/lists/*

# --- SonarScanner CLI (utilise le JDK 21 de l'image Jenkins) ---
ARG SONAR_SCANNER_VERSION=8.2.0.6438
RUN curl -fsSL -o /tmp/sonar-scanner.zip \
       "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}.zip" \
    && unzip -q /tmp/sonar-scanner.zip -d /opt \
    && ln -s "/opt/sonar-scanner-${SONAR_SCANNER_VERSION}/bin/sonar-scanner" /usr/local/bin/sonar-scanner \
    && rm /tmp/sonar-scanner.zip

# --- Trivy (scanner de vulnérabilités des images Docker) ---
ARG TRIVY_VERSION=0.76.1
RUN curl -fsSL -o /tmp/trivy.tgz \
       "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
    && tar -xzf /tmp/trivy.tgz -C /usr/local/bin trivy \
    && rm /tmp/trivy.tgz

# --- Syft (SBOM CycloneDX de l'image) ---
ARG SYFT_VERSION=1.18.1
RUN cd /tmp \
    && curl -fsSLO "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_amd64.tar.gz" \
    && curl -fsSL "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_checksums.txt" \
       | grep " syft_${SYFT_VERSION}_linux_amd64.tar.gz$" | sha256sum -c - \
    && tar -xzf "syft_${SYFT_VERSION}_linux_amd64.tar.gz" -C /usr/local/bin syft \
    && rm "syft_${SYFT_VERSION}_linux_amd64.tar.gz"

# --- cosign (signature des images publiées) ---
ARG COSIGN_VERSION=2.4.1
RUN curl -fsSLo /usr/local/bin/cosign \
       "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64" \
    && curl -fsSL "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign_checksums.txt" \
       | grep ' cosign-linux-amd64$' | sed 's#cosign-linux-amd64#/usr/local/bin/cosign#' | sha256sum -c - \
    && chmod +x /usr/local/bin/cosign

USER jenkins

# --- Plugins Jenkins ---
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# --- Configuration as Code ---
COPY --chown=jenkins:jenkins casc.yaml /usr/share/jenkins/ref/casc.yaml
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc.yaml

# Désactive l'assistant d'installation : tout est configuré par JCasC
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
