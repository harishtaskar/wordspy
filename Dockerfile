# Socket.IO server image (for Fly.io / any container host).
# Build context = repo root. Only the server + shared types are included.
FROM node:22-slim

WORKDIR /app

# Manifests + shared config + the two workspaces the server needs.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server

# Install (dev deps included so tsc can build) — the types `prepare` script
# builds @wordspy/types here; build:server then compiles types + server.
RUN npm install --include=dev
RUN npm run build:server

# Fly maps the public port to this internal port.
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start:server"]
