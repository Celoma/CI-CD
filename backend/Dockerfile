# ======================================================
# SouverainRecrut - Backend (API Express + Prisma)
# Image multi-stage : build TypeScript puis image d'exécution légère
# ======================================================

# Étape 1 : Construction
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Étape 2 : Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Dépendances de production + CLI Prisma (nécessaire pour "prisma migrate deploy" au démarrage)
RUN npm ci --omit=dev \
    && npm install --no-save "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && npm cache clean --force \
    # npm/npx ne sont pas utiles à l'exécution : on les retire (surface d'attaque réduite, CVE en moins)
    # Les migrations se lancent avec : ./node_modules/.bin/prisma migrate deploy
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm

# Copie des fichiers nécessaires depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Exécution sans privilèges root (utilisateur "node" fourni par l'image officielle)
USER node

EXPOSE 4000
CMD ["node", "dist/server.js"]
