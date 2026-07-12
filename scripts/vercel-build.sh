#!/usr/bin/env bash
# ============================================
# Smart Vercel Build Script
# ============================================
# Auto-detects the database provider from DATABASE_URL and updates
# the Prisma schema accordingly before building.
#
# - If DATABASE_URL starts with "postgresql://" or "postgres://",
#   the schema is set to PostgreSQL provider (for Vercel/Supabase).
# - If DATABASE_URL starts with "file:", the schema is set to
#   SQLite provider (for local development).
#
# This allows the same codebase to build successfully in both
# local (SQLite) and Vercel (PostgreSQL) environments.

set -euo pipefail

SCHEMA_FILE="prisma/schema.prisma"
DB_URL="${DATABASE_URL:-}"

echo "🔍 Detecting database provider from DATABASE_URL..."

if [[ "$DB_URL" == postgresql://* ]] || [[ "$DB_URL" == postgres://* ]]; then
  echo "📦 PostgreSQL database detected (production/Vercel)"
  
  # Update schema for PostgreSQL
  if grep -q 'provider = "sqlite"' "$SCHEMA_FILE"; then
    echo "🔄 Switching Prisma schema from SQLite to PostgreSQL..."
    
    # Replace SQLite provider with PostgreSQL
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"
    
    # Add directUrl and relationMode if not present (needed for Supabase)
    if ! grep -q 'directUrl' "$SCHEMA_FILE"; then
      sed -i '/url\s*= env("DATABASE_URL")/a\\  directUrl   = env("DIRECT_URL")' "$SCHEMA_FILE"
    fi
    
    if ! grep -q 'relationMode' "$SCHEMA_FILE"; then
      # Add relationMode after directUrl
      sed -i '/directUrl/a\\  relationMode = "prisma"' "$SCHEMA_FILE"
    fi
    
    echo "✅ Schema updated for PostgreSQL"
  else
    echo "✅ Schema already configured for PostgreSQL"
  fi
  
elif [[ "$DB_URL" == file:* ]]; then
  echo "📦 SQLite database detected (local development)"
  
  if grep -q 'provider = "postgresql"' "$SCHEMA_FILE"; then
    echo "🔄 Switching Prisma schema from PostgreSQL to SQLite..."
    
    # Replace PostgreSQL provider with SQLite
    sed -i 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA_FILE"
    
    # Remove directUrl and relationMode lines (not needed for SQLite)
    sed -i '/directUrl/d' "$SCHEMA_FILE"
    sed -i '/relationMode/d' "$SCHEMA_FILE"
    
    echo "✅ Schema updated for SQLite"
  else
    echo "✅ Schema already configured for SQLite"
  fi
else
  echo "⚠️  Could not detect database type from DATABASE_URL (empty or unrecognized format)"
  echo "   Leaving schema as-is and attempting build..."
fi

echo ""
echo "📋 Current datasource config:"
sed -n '/^datasource/,/^}/p' "$SCHEMA_FILE"
echo ""

echo "🏗️  Running Prisma generate..."
npx prisma generate

echo ""
echo "🗄️  Running Prisma db push..."
npx prisma db push --accept-data-loss

echo ""
echo "🚀 Building Next.js..."
# --webpack: @serwist/next injects the service-worker precache manifest via a
# webpack plugin, which Next 16's default Turbopack builds don't support
npx next build --webpack

echo ""
echo "✅ Build complete!"
