FROM node:20-alpine AS base
WORKDIR /app
COPY apps/web/package*.json ./apps/web/
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/web ci --omit=dev=false || npm --prefix apps/web install
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
