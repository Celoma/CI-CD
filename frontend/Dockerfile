# ======================================================
# SouverainRecrut - Frontend (React + Vite)
# Build statique avec Node puis service par Nginx
# ======================================================

# Étape 1 : Construction
FROM node:22-alpine AS builder
WORKDIR /app

# URL de l'API injectée au moment du build (Vite remplace import.meta.env.VITE_API_URL)
ARG VITE_API_URL=http://localhost:4000/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : Service des fichiers statiques
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
