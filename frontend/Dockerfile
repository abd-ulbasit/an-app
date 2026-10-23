# Stage 1: build the React app from the lockfile. --ignore-scripts keeps
# dependency install hooks from running in the build.
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# Stage 2: serve the static build with the unprivileged nginx image
# (runs as uid 101 and listens on 8080, so no root and no NET_BIND_SERVICE).
FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
# Same uid the base image already uses; stated so scanners and readers see it.
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
