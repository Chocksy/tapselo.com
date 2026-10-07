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

# Node base + JRE (temurin runtime image has no Node; Coolify needs both).
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY --from=duk /duk/dist /duk/dist
RUN chmod -R a+rX /app /duk/dist

ENV PORT=8787
ENV DUK_JAR=/duk/dist/DUKIntegrator.jar
ENV DUK_HOME=/duk/dist
EXPOSE 8787
USER nobody

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
