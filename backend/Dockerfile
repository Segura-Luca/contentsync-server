# Imagen de Docker del backend, en dos etapas para que la final sea más liviana.
# Etapa 1: instala dependencias, genera el cliente de Prisma y compila TypeScript.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Etapa 2: copia solo lo necesario para ejecutar la aplicación.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
EXPOSE 3000
# Al arrancar: aplica las migraciones pendientes y luego inicia el servidor.
CMD ["sh", "-c", "node prisma/deploy.js && node dist/main.js"]
