# Node.js 24 LTS (Maintenance LTS since 2026-10-20, security fixes until
# 2028-04-30; Node 18 and 20 are end-of-life). Node 26 becomes Active LTS
# on 2026-10-28; Dependabot will propose that major as a normal PR.
# The digest pins the exact image; Dependabot (.github/dependabot.yml)
# proposes updates.

# Stage 1: production dependencies only, from the lockfile, no install scripts.
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Stage 2: runtime
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json index.js ./
# The node user (uid 1000) ships with the base image; app files stay
# root-owned and read-only to it.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:4000/healthz || exit 1
CMD ["node", "index.js"]
