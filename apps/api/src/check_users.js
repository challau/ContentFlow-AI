const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, createdAt: true } });
  console.log('All users in DB:');
  console.table(users);
}

check().catch(console.error).finally(() => prisma.$disconnect());
