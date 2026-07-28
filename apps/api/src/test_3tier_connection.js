const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

async function testConnection() {
  console.log('=== 3-TIER ARCHITECTURE CONNECTIVITY AUDIT ===\n');

  // 1. Database Tier (PostgreSQL via Prisma)
  console.log('1. DATABASE TIER (PostgreSQL 18 at localhost:5432):');
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    const projectCount = await prisma.project.count();
    const pipelineCount = await prisma.pipeline.count();
    const runCount = await prisma.pipelineRun.count();
    const assetCount = await prisma.contentAsset.count();

    console.log('  ✅ Database connection: CONNECTED');
    console.log(`  📊 Users: ${userCount} | Orgs: ${orgCount} | Projects: ${projectCount}`);
    console.log(`  📊 Pipelines: ${pipelineCount} | Runs: ${runCount} | Assets: ${assetCount}`);
  } catch (err) {
    console.error('  ❌ Database connection error:', err.message);
  } finally {
    await prisma.$disconnect();
  }

  // 2. Cache & Queue Tier (Redis 7)
  console.log('\n2. CACHE & QUEUE TIER (Redis 7 at 127.0.0.1:6379):');
  try {
    const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
    const ping = await redis.ping();
    console.log(`  ✅ Redis connection: CONNECTED (PING -> ${ping})`);
    redis.disconnect();
  } catch (err) {
    console.error('  ❌ Redis connection error:', err.message);
  }

  // 3. API & Web Gateway Tier
  console.log('\n3. API GATEWAY TIER (NestJS API at http://localhost:4000/api/v1):');
  try {
    const healthRes = await fetch('http://localhost:4000/api/v1/health');
    const healthData = await healthRes.json();
    console.log(`  ✅ HTTP API Health check: HTTP ${healthRes.status}`, healthData);
  } catch (err) {
    console.error('  ❌ API Gateway error:', err.message);
  }

  console.log('\n=== CONNECTIVITY AUDIT VERIFICATION COMPLETE ===');
}

testConnection();
