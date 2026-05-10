#!/bin/sh

# Default to the existing env var or a default value if not set
BACKEND_URL=${BACKEND_URL:-"http://localhost:8080"}
AUTH_DISABLED=${AUTH_DISABLED:-"false"}
OAUTH_PROVIDERS=${OAUTH_PROVIDERS:-""}

# OAUTH_PROVIDERS is a JSON string that the app will JSON.parse. Escape \ and "
# so it embeds safely as a JS string literal inside the heredoc below.
OAUTH_PROVIDERS_ESCAPED=$(printf '%s' "$OAUTH_PROVIDERS" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

echo "Generating config.js"

cat <<EOF > /usr/share/nginx/html/config.js
window._env_ = {
  REACT_APP_API_URL: "${BACKEND_URL}",
  REACT_APP_OAUTH_PROVIDERS: "${OAUTH_PROVIDERS_ESCAPED}",
  REACT_APP_AUTH_DISABLED: "${AUTH_DISABLED}"
};
window.INFRAWEAVE_BACKEND_URL = "${BACKEND_URL}"; // Keep for backward compatibility if used elsewhere
EOF

# Inject config.js script tag into index.html if not already present
if ! grep -q "config.js" /usr/share/nginx/html/index.html; then
    echo "Injecting config.js into index.html"
    # Insert before </head>
    sed -i 's/<\/head>/<script src="\/config.js"><\/script><\/head>/' /usr/share/nginx/html/index.html
fi

# Execute the passed command (nginx)
exec "$@"
