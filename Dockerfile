FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies (all, for build) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Fetch & Build data ----
FROM deps AS data
COPY scripts/ scripts/
COPY src/types.ts src/types.ts
RUN pnpm build:data

# ---- Build server ----
FROM deps AS build
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
COPY --from=data /app/data/generated/ data/generated/
RUN pnpm build

# ---- Production ----
FROM node:20-slim AS release
WORKDIR /app

# Layer 1: production deps (changes only when package.json changes)
COPY --from=prod-deps /app/node_modules/ node_modules/

# Layer 2: generated data (changes only when data updates)
COPY --from=data /app/data/generated/ data/generated/

# Layer 3: server bundle (changes on every code update, ~100KB)
COPY --from=build /app/dist/ dist/

COPY package.json ./

ENTRYPOINT ["node", "dist/index.js"]
