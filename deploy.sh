#!/usr/bin/env bash
# Build and deploy the Austin Speedrun Tracker SPA to S3 static website hosting.
#
# Usage:
#   ./deploy.sh
#   BUCKET=my-bucket REGION=us-east-1 ./deploy.sh
#
# Requires: awscli v2, Node, and a local .env with VITE_* keys.
# Vite bakes env at build time — set VITE_PUBLIC_SITE_URL to the live marketing URL.
set -euo pipefail

BUCKET="${BUCKET:-austin-speedrun-tracker-site}"
REGION="${REGION:-us-east-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"

cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.example and fill VITE_SUPABASE_* (+ VITE_PUBLIC_SITE_URL)." >&2
  exit 1
fi

echo "==> Building"
npm run build

echo "==> Syncing $DIST → s3://$BUCKET"
aws s3 sync "$DIST" "s3://$BUCKET" \
  --region "$REGION" \
  --delete \
  --cache-control "no-cache"

# SPA fallback: website error doc should be index.html (set once on the bucket).
aws s3 website "s3://$BUCKET/" --index-document index.html --error-document index.html

if [ "$REGION" = "us-east-1" ]; then
  URL="http://$BUCKET.s3-website-us-east-1.amazonaws.com"
else
  URL="http://$BUCKET.s3-website.$REGION.amazonaws.com"
fi

echo ""
echo "==> Deployed: $URL"
