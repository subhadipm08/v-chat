# Stage 1: Builder
# Use Alpine Linux for a minimal image footprint, securely reducing attack surface.
FROM node:20-alpine AS builder

# Set working directory for predictable path execution
WORKDIR /app

# Copy package files first to leverage Docker's layer caching mechanism
COPY package*.json ./

# Install only production dependencies.
# 'npm ci' ensures reproducible builds via package-lock.json strictness.
RUN npm ci --omit=dev

# Copy application source code (.dockerignore will filter out .env and heavy caches)
COPY . .


# Stage 2: Production Runtime
FROM node:20-alpine

WORKDIR /app

# Explicitly copy only the necessary files over from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src

# Strict Environment Variable configurations
ENV NODE_ENV=production
ENV PORT=5000

# Security Hardening: Switch from root to an unprivileged user
# The 'node' user is pre-baked into the node alpine image
RUN chown -R node:node /app
USER node

# Expose the correct port for internal routing constraints
EXPOSE 5000

CMD ["node", "server.js"]
