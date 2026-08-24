FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install native compilation dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install node dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci || npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
