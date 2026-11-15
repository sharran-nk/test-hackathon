# Stage 1: build the React client (needs dev dependencies such as Vite).
FROM node:22.12.0-alpine AS client-build
WORKDIR /build
COPY app/client/package.json app/client/package-lock.json ./
RUN npm ci
COPY app/client/ ./
RUN npm run build

# Stage 2: install production dependencies only (no Jest, no Supertest).
FROM node:22.12.0-alpine AS server-deps
WORKDIR /srv
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: small runtime image. No secrets here: ACCESS_KEY etc. arrive at run time.
FROM node:22.12.0-alpine
ENV NODE_ENV=production
WORKDIR /srv
COPY --from=server-deps /srv/node_modules ./node_modules
COPY app/package.json ./
COPY app/server ./server
COPY --from=client-build /build/dist ./client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "server/server.js"]
