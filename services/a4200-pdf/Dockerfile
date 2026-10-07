# ANAF DUKIntegrator jars are downloaded at build time; not committed to git.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS duk
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY scripts/download-duk.mjs ./scripts/
RUN node scripts/download-duk.mjs /duk/dist

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY --from=duk /duk/dist /duk/dist

ENV PORT=8787
ENV DUK_JAR=/duk/dist/DUKIntegrator.jar
ENV DUK_HOME=/duk/dist
EXPOSE 8787
USER nobody
CMD ["node", "src/server.mjs"]
