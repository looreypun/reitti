# --- Build the static site ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve with nginx ---
FROM nginx:1.27-alpine

# Ollama settings, read when the container starts (set these in Coolify).
#   OLLAMA_URL      where nginx reaches Ollama, e.g. http://ollama:11434 (no trailing slash needed)
#   OLLAMA_MODEL    default chat model, e.g. granite4.2:3b (empty = first installed chat model)
#   OLLAMA_API_KEY  optional; sent as "Authorization: Bearer <key>" if Ollama sits behind an auth proxy
ENV OLLAMA_URL=http://ollama:11434 \
    OLLAMA_MODEL=

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/15-reitti-config.envsh /docker-entrypoint.d/15-reitti-config.envsh
RUN chmod +x /docker-entrypoint.d/15-reitti-config.envsh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
