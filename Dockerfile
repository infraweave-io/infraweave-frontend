# Stage 1: Build the application
FROM node:24-alpine AS builder

WORKDIR /app

# Copy manifest, lock file and pnpm settings (overrides, allowBuilds); a frozen
# install fails without pnpm-workspace.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install the pnpm version from "packageManager" with npm.
# Not corepack: Node 25 and later do not include it.
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

RUN pnpm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy custom entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
