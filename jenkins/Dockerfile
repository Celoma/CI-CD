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
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

USER jenkins

# --- Plugins Jenkins ---
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# --- Configuration as Code ---
COPY --chown=jenkins:jenkins casc.yaml /usr/share/jenkins/ref/casc.yaml
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc.yaml

# Désactive l'assistant d'installation : tout est configuré par JCasC
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
