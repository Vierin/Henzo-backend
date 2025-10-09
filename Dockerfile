FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package.json ./
COPY prisma ./prisma/

# Обновляем npm
RUN npm install -g npm@latest

# Установка зависимостей
RUN npm install

# Копируем исходники
COPY . .

# Генерация Prisma Client
RUN npx prisma generate

# Сборка
RUN npm run build

# Production образ
FROM node:20-alpine AS production

# Установка OpenSSL для Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Копируем package files
COPY package.json ./
COPY prisma ./prisma/

# Обновляем npm
RUN npm install -g npm@latest

# Устанавливаем только production зависимости
RUN npm install --omit=dev && npm cache clean --force

# Копируем собранное приложение из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose порт
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Запуск
CMD ["node", "dist/main.js"]
