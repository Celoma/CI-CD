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
    && npm install --no-save "prisma@$(node -p "require('./package.json').devDependencies.prisma")" \
    && npm cache clean --force

# Copie des fichiers nécessaires depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
CMD ["node", "dist/server.js"]
