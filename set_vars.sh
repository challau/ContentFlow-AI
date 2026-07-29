#!/bin/bash
railway variable set NODE_ENV=production --skip-deploys
railway variable set DATABASE_URL='postgresql://neondb_owner:npg_fwVIAk30WHXQ@ep-orange-resonance-axj7vjwy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require' --skip-deploys
railway variable set JWT_ACCESS_SECRET=fe1c19fc2570a6368033168c80d264dd721e6847b139ca7027753639bdb89b0c --skip-deploys
railway variable set JWT_REFRESH_SECRET=018cb232d8ab4d8af20809d57bd677fcbf013c88dd48591f906ef92d2cd1a9c8 --skip-deploys
railway variable set JWT_ACCESS_TTL=15m --skip-deploys
railway variable set JWT_REFRESH_TTL_DAYS=30 --skip-deploys
railway variable set LLM_PROVIDER=local --skip-deploys
railway variable set LLM_MODEL=claude-opus-5 --skip-deploys
railway variable set LLM_MAX_TOKENS=16384 --skip-deploys
railway variable set LLM_TEMPERATURE=0.7 --skip-deploys
railway variable set LLM_MAX_RETRIES=3 --skip-deploys
railway variable set LLM_TIMEOUT_MS=180000 --skip-deploys
railway variable set PIPELINE_CONCURRENCY=4 --skip-deploys
railway variable set AGENT_CONCURRENCY=4 --skip-deploys
railway variable set RUN_COST_CREDITS=50 --skip-deploys
railway variable set STORAGE_DRIVER=local --skip-deploys
railway variable set LOCAL_STORAGE_DIR=./storage --skip-deploys
railway variable set THROTTLE_TTL=60 --skip-deploys
railway variable set THROTTLE_LIMIT=120
