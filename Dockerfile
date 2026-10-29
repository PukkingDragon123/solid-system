# LARPED ONE OUT — production image: one Node process serves the client and the WebSocket game server.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
VOLUME /app/data
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/main.mjs"]
