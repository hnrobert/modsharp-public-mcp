FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

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
COPY --from=build /app/dist/ dist/
COPY --from=build /app/data/generated/ data/generated/
COPY --from=build /app/node_modules/ node_modules/
COPY package.json ./

ENTRYPOINT ["node", "dist/index.js"]
