FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL and certificates required by Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma Client (build-time code generation)
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"

# Install OpenSSL in the runner image so Prisma query engine binary can link against it
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

# Execute database sync at runtime startup when environment variables are mounted
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
