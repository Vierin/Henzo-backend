FROM node:20-alpine AS builder
WORKDIR /app

# Обновляем npm до последней версии
RUN npm install -g npm@latest

# Skip Puppeteer browser download to save disk space during build
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
# Устанавливаем зависимости
# Если есть package-lock.json - используем npm ci, иначе npm install
# Очищаем кеш после установки для уменьшения размера образа
RUN if [ -f package-lock.json ]; then \
      npm ci --prefer-offline --no-audit; \
    else \
      npm install --prefer-offline --no-audit; \
    fi && \
    npm cache clean --force && \
    rm -rf /root/.npm

COPY . .

RUN npx prisma generate
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache openssl chromium

# Skip Puppeteer browser download - we'll use system Chromium instead
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
# Устанавливаем только production зависимости
# Если есть package-lock.json - используем npm ci, иначе npm install
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --prefer-offline --no-audit; \
    else \
      npm install --omit=dev --prefer-offline --no-audit; \
    fi && \
    npm cache clean --force && \
    rm -rf /root/.npm

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Удаляем временные файлы для уменьшения размера образа
RUN rm -rf /tmp/* /var/tmp/*

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
