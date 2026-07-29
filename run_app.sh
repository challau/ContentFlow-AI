#!/usr/bin/env bash

# ContentFlow AI — Host OS Auto-Deploy & Launch Script
# This script sets up dependencies, ensures database/Redis are active on the host, 
# configures the environment, and runs both backend & frontend developer servers.

set -e

# ANSI escape codes for beautiful styling
BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
NC="\033[0m" # No Color

echo -e "${BOLD}${CYAN}==================================================${NC}"
echo -e "${BOLD}${CYAN}      ContentFlow AI — SRE Local Launch Script    ${NC}"
echo -e "${BOLD}${CYAN}==================================================${NC}"

# --- Step 1: Verify Node.js ---
echo -e "\n${BOLD}${YELLOW}[1/6] Verifying Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js is not installed. Please install Node.js >= 20.0.0${NC}"
  exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✔ Node.js detected: ${NODE_VERSION}${NC}"

# --- Step 2: Check PostgreSQL ---
echo -e "\n${BOLD}${YELLOW}[2/6] Verifying PostgreSQL...${NC}"
# Check if Postgres is active on default port 5432 or default macOS unix socket
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null || [ -S "/tmp/.s.PGSQL.5432" ]; then
  echo -e "${GREEN}✔ PostgreSQL is running and listening for connections.${NC}"
else
  echo -e "${YELLOW}⚠ PostgreSQL is not running. Attempting to start PostgreSQL via pg_ctl...${NC}"
  if command -v pg_ctl &> /dev/null; then
    # Common Homebrew directories
    if [ -d "/opt/homebrew/var/postgres" ]; then
      pg_ctl -D /opt/homebrew/var/postgres start || true
    elif [ -d "/usr/local/var/postgres" ]; then
      pg_ctl -D /usr/local/var/postgres start || true
    else
      echo -e "${RED}Could not find default Postgres data folder. Please start Postgres manually.${NC}"
      exit 1
    fi
    sleep 2
  else
    echo -e "${RED}Postgres is not running and pg_ctl was not found in PATH. Please start PostgreSQL manually.${NC}"
    exit 1
  fi
fi

# --- Step 3: Check Redis ---
echo -e "\n${BOLD}${YELLOW}[3/6] Verifying Redis...${NC}"
if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null; then
  echo -e "${GREEN}✔ Redis is running on port 6379.${NC}"
else
  echo -e "${YELLOW}⚠ Redis is not running. Attempting to start redis-server in background...${NC}"
  if command -v redis-server &> /dev/null; then
    redis-server --daemonize yes || true
    sleep 2
    echo -e "${GREEN}✔ Started Redis server.${NC}"
  else
    echo -e "${RED}redis-server not found. Please install Redis and start it on port 6379.${NC}"
    exit 1
  fi
fi

# --- Step 4: Configure environment ---
echo -e "\n${BOLD}${YELLOW}[4/6] Configuring Environment Variables...${NC}"
if [ ! -f "apps/api/.env" ]; then
  echo -e "${YELLOW}.env file not found. Generating default apps/api/.env...${NC}"
  cp apps/api/.env.example apps/api/.env
  
  # Generate random cryptographic secrets for JWT security
  ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  
  sed -i '' "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=${ACCESS_SECRET}/" apps/api/.env || sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=${ACCESS_SECRET}/" apps/api/.env
  sed -i '' "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${REFRESH_SECRET}/" apps/api/.env || sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${REFRESH_SECRET}/" apps/api/.env
  
  echo -e "${GREEN}✔ Generated apps/api/.env with secure secrets.${NC}"
else
  echo -e "${GREEN}✔ Existing apps/api/.env file detected.${NC}"
fi

# Load environment variables so that subsequent prisma commands run with DATABASE_URL
if [ -f "apps/api/.env" ]; then
  export $(grep -v '^#' apps/api/.env | xargs)
fi


# --- Step 5: Install & Sync DB ---
echo -e "\n${BOLD}${YELLOW}[5/6] Syncing Dependencies and Database Schema...${NC}"
echo "Installing monorepo dependencies..."
npm install --no-audit

echo "Building shared package dependencies..."
npm run build --workspace @contentflow/shared

echo "Generating Prisma client..."
npx prisma generate --schema apps/api/prisma/schema.prisma

echo "Pushing database schema to PostgreSQL..."
npx prisma db push --schema apps/api/prisma/schema.prisma --accept-data-loss

echo "Seeding default data (projects, pipelines, and users)..."
npx prisma db seed --schema apps/api/prisma/schema.prisma

echo -e "${GREEN}✔ Database sync and seed complete.${NC}"

# --- Step 6: Start Web Server & API ---
echo -e "\n${BOLD}${YELLOW}[6/6] Launching ContentFlow AI Stack...${NC}"

# Free up ports 4000 and 5173 if they are currently occupied
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null; then
  echo -e "${YELLOW}⚠ Port 4000 (Backend API) is already in use. Releasing port...${NC}"
  lsof -ti :4000 | xargs kill -9 || true
  sleep 1
fi
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null; then
  echo -e "${YELLOW}⚠ Port 5173 (Vite Frontend) is already in use. Releasing port...${NC}"
  lsof -ti :5173 | xargs kill -9 || true
  sleep 1
fi

echo -e "${GREEN}✔ Backend server starting on: ${CYAN}http://localhost:4000${NC}"
echo -e "${GREEN}✔ Web Frontend starting on:   ${CYAN}http://localhost:5173${NC}"
echo -e "${BOLD}${YELLOW}--------------------------------------------------${NC}"
echo -e "${BOLD}Use these credentials to sign in:${NC}"
echo -e "  ${BOLD}Email:${NC}    demo@contentflow.ai"
echo -e "  ${BOLD}Password:${NC} contentflow-demo-2026"
echo -e "${BOLD}${YELLOW}--------------------------------------------------${NC}"
echo -e "${CYAN}Press Ctrl+C to terminate the application stack.${NC}"
echo -e "${BOLD}${YELLOW}--------------------------------------------------${NC}"

# Open the browser automatically to the login page after a 3s delay
(sleep 3 && open http://localhost:5173) &

# Run backend + frontend concurrently
npm run dev:all
