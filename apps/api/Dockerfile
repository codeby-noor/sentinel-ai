FROM node:20-alpine AS base
# Prisma engines require OpenSSL on Alpine (node:20-alpine ships OpenSSL 3 libs separately).
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY apps/api/package*.json ./apps/api/
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/api ci --omit=dev=false || npm --prefix apps/api install
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
