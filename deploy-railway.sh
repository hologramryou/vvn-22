#!/bin/bash
# Railway CLI deployment helper
# Prerequisites: npm install -g @railway/cli && railway login

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Deploying Vovinam Fighting to Railway ==="

# Deploy backend
echo ""
echo "--- Deploying API (backend) ---"
cd backend
railway up --service api --detach
cd ..

echo ""
echo "--- Deploying Web (frontend) ---"
railway up --service web --detach

echo ""
echo "=== Done! Check https://railway.app for status ==="
echo ""
echo "REMINDER: Set these env vars in Railway dashboard for the 'api' service:"
echo "  SECRET_KEY=<random 32-char string>"
echo "  ALLOWED_ORIGINS=https://<your-web-service>.up.railway.app"
echo ""
echo "Set this for the 'web' service:"
echo "  VITE_API_URL=https://<your-api-service>.up.railway.app"
