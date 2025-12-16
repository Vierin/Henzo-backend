FROM node:20-alpine AS builder
WORKDIR /app

# Обновляем npm до последней версии
RUN npm install -g npm@latest

COPY package*.json ./
# Очищаем npm кэш и устанавливаем зависимости
RUN npm cache clean --force && npm install

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache openssl

# Обновляем npm до последней версии
RUN npm install -g npm@latest

COPY package.json ./
# Удаляем package-lock.json если он поврежден и устанавливаем только production зависимости
RUN rm -f package-lock.json && npm cache clean --force && npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
