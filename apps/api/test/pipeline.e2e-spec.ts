/**
 * Full-stack e2e: signs a user up, runs the 13-agent pipeline through HTTP,
 * and asserts that content, schedules, versions and credits were persisted.
 *
 * Requires a reachable Postgres and Redis (see docs/DEVELOPMENT.md).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ContentFlow AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let projectId: string;
  let pipelineId: string;
  let runId: string;

  const email = `e2e-${Date.now()}@contentflow.test`;
  const password = 'e2e-test-passphrase-2026';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Remove only what this run created; cascades clear the rest.
    await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    await app?.close();
  });

  it('registers a user with an organization and starting credits', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'E2E Runner' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.organization.credits).toBeGreaterThan(0);
    accessToken = res.body.accessToken;
  });

  it('rejects unauthenticated requests', () =>
    request(app.getHttpServer()).get('/projects').expect(401));

  it('rejects a duplicate registration', () =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Duplicate' })
      .expect(409));

  it('rejects an invalid login', () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401));

  it('exposes all 13 agents in the builder catalogue', async () => {
    const res = await request(app.getHttpServer())
      .get('/pipelines/agents')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(13);
    expect(res.body.map((a: { kind: string }) => a.kind)).toContain('FINAL_REVIEW');
  });

  it('creates a project with a default pipeline', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name: 'E2E Project',
        topic: 'A privacy-first habit tracker for shift workers',
        audience: 'nurses and paramedics on rotating shifts',
        targetPlatforms: ['LINKEDIN', 'INSTAGRAM', 'X'],
      })
      .expect(201);

    expect(res.body.pipelines).toHaveLength(1);
    projectId = res.body.id;
    pipelineId = res.body.pipelines[0].id;
  });

  it('rejects an invalid project payload', () =>
    request(app.getHttpServer())
      .post('/projects')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ name: 'no topic' })
      .expect(400));

  it('runs the full pipeline and completes every agent', async () => {
    const res = await request(app.getHttpServer())
      .post(`/pipelines/${pipelineId}/run`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ sync: true })
      .expect(201);

    runId = res.body.runId;
    expect(res.body.agents).toHaveLength(13);

    const run = await request(app.getHttpServer())
      .get(`/runs/${runId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(run.body.status).toBe('COMPLETED');
    expect(run.body.progress).toBe(100);

    const completed = run.body.executions.filter(
      (e: { status: string }) => e.status === 'COMPLETED',
    );
    expect(completed).toHaveLength(13);
  });

  it('stores each agent output against its execution', async () => {
    const res = await request(app.getHttpServer())
      .get(`/runs/${runId}/executions/RESEARCH`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.output).toBeDefined();
    expect(res.body.output.painPoints.length).toBeGreaterThan(0);
  });

  it('materializes content assets from the run', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assets?runId=${runId}&take=100`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThan(0);
    for (const asset of res.body.items) {
      expect(asset.body.length).toBeGreaterThan(0);
      expect(asset.slug).toMatch(/\S/);
    }
  });

  it('versions an asset on edit and can restore the original', async () => {
    const list = await request(app.getHttpServer())
      .get(`/assets?runId=${runId}&take=1`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const asset = list.body.items[0];
    const originalBody = asset.body;

    await request(app.getHttpServer())
      .patch(`/assets/${asset.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ body: 'Edited during the e2e run.', changeNote: 'e2e edit' })
      .expect(200);

    const edited = await request(app.getHttpServer())
      .get(`/assets/${asset.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(edited.body.body).toBe('Edited during the e2e run.');
    expect(edited.body.version).toBe(2);

    await request(app.getHttpServer())
      .post(`/assets/${asset.id}/versions/1/restore`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const restored = await request(app.getHttpServer())
      .get(`/assets/${asset.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(restored.body.body).toBe(originalBody);
    expect(restored.body.version).toBe(3);
  });

  it('charges credits for the run and records the ledger entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/credits')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.balance).toBeLessThan(1000);
    expect(res.body.transactions[0].reason).toBe('PIPELINE_RUN');
    expect(res.body.transactions[0].amount).toBeLessThan(0);
  });

  it('reports the run on the dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.counts.projects).toBeGreaterThanOrEqual(1);
    expect(res.body.runsByStatus.COMPLETED).toBeGreaterThanOrEqual(1);
  });

  it('re-runs a single agent against stored upstream outputs', async () => {
    const res = await request(app.getHttpServer())
      .post(`/runs/${runId}/agents/seo/rerun`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.agent).toBe('SEO');
    expect(res.body.output.primaryKeyword).toBeTruthy();
  });

  it('rejects an unknown agent name', () =>
    request(app.getHttpServer())
      .post(`/runs/${runId}/agents/not-an-agent/rerun`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(400));

  it('does not leak another organization\'s project', async () => {
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `other-${Date.now()}@contentflow.test`,
        password,
        name: 'Other Org',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('authorization', `Bearer ${other.body.accessToken}`)
      .expect(404);

    await prisma.user
      .deleteMany({ where: { email: other.body.user.email } })
      .catch(() => undefined);
  });
});
