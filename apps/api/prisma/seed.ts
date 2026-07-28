/**
 * Seeds a demo organization with a user, brand kit, project and pipeline.
 * Idempotent: safe to run repeatedly.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Platform } from '@prisma/client';
import * as argon2 from 'argon2';
import { AGENT_KINDS, DEFAULT_AGENT_GRAPH } from '@contentflow/shared';

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@contentflow.ai';

/**
 * The default is a well-known development credential and is published in this
 * repository, so it must never reach a real deployment. Override it with
 * SEED_DEMO_PASSWORD, and see the production guard in main().
 */
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'contentflow-demo-2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_DEMO_PASSWORD) {
    throw new Error(
      'Refusing to seed in production with the public default password. ' +
        'Set SEED_DEMO_PASSWORD, or do not run the seed against production.',
    );
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Operator',
      passwordHash,
      emailVerified: true,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'contentflow-demo' },
    update: {},
    create: {
      name: 'ContentFlow Demo',
      slug: 'contentflow-demo',
      plan: 'PRO',
      credits: 10_000,
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, organizationId: organization.id, role: 'OWNER' },
  });

  const brandKit =
    (await prisma.brandKit.findFirst({
      where: { organizationId: organization.id, isDefault: true },
    })) ??
    (await prisma.brandKit.create({
      data: {
        organizationId: organization.id,
        name: 'ContentFlow Brand',
        isDefault: true,
        primaryColor: '#4F46E5',
        secondaryColor: '#0EA5E9',
        accentColor: '#F59E0B',
        headingFont: 'Satoshi',
        bodyFont: 'Inter',
        toneOfVoice: 'Confident, specific, allergic to marketing filler.',
        writingGuidelines:
          'Lead with the outcome. Use concrete numbers. Never open with a rhetorical question.',
        bannedWords: ['revolutionary', 'game-changer', 'synergy', 'unlock the power'],
      },
    }));

  const existingProject = await prisma.project.findFirst({
    where: { organizationId: organization.id, name: 'ContentFlow Launch' },
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        organizationId: organization.id,
        createdById: user.id,
        brandKitId: brandKit.id,
        name: 'ContentFlow Launch',
        description: 'Launch campaign for the ContentFlow AI platform',
        topic: 'ContentFlow AI — a multi-agent platform that turns one topic into publish-ready content for every platform',
        audience: 'Marketing teams of 2–20 people who publish across five or more channels',
        goal: 'Drive qualified trial signups in the first four weeks',
        tone: 'confident, specific, jargon-free',
        targetPlatforms: ['LINKEDIN', 'X', 'INSTAGRAM', 'YOUTUBE', 'BLOG'] as Platform[],
      },
    }));

  const existingPipeline = await prisma.pipeline.findFirst({
    where: { projectId: project.id },
  });

  if (!existingPipeline) {
    await prisma.pipeline.create({
      data: {
        projectId: project.id,
        createdById: user.id,
        name: 'Full Campaign Pipeline',
        description: 'All 13 agents in the default dependency order',
        graph: {
          nodes: AGENT_KINDS.map((kind, i) => ({
            id: kind,
            agentKind: kind,
            position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 180 },
          })),
          edges: AGENT_KINDS.flatMap((kind) =>
            (DEFAULT_AGENT_GRAPH[kind] ?? []).map((dep) => ({
              id: `${dep}->${kind}`,
              source: dep,
              target: kind,
            })),
          ),
        },
      },
    });
  }

  console.log(
    [
      '',
      'Seed complete.',
      `  Organization : ${organization.name} (${organization.slug})`,
      `  Login        : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
      `  Project      : ${project.name}`,
      `  Credits      : ${organization.credits}`,
      '',
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
