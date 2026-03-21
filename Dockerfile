FROM node:22-slim

# curl needed for Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Match macOS host user UID (501) so volume mounts work correctly
ARG HOST_UID=501
RUN usermod -u ${HOST_UID} node

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

USER node
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --production
COPY --chown=node:node src/ ./src/

CMD ["node", "src/index.js"]
