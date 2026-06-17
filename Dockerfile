# Socket.IO server image (Northflank / Fly.io / any container host).
# IMPORTANT: build context MUST be the repo root (where this Dockerfile lives).
# .dockerignore keeps the image lean (web app, node_modules, tests, etc. excluded).
FROM node:22-slim

WORKDIR /app

# Copy the whole (filtered) repo, then install + build the server.
COPY . .

# Dev deps included so tsc can build; the types `prepare` script builds
# @wordspy/types, and build:server compiles types + server.
RUN npm install --include=dev
RUN npm run build:server

# Server reads PORT from env. Northflank: expose this same port (8080).
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start:server"]
