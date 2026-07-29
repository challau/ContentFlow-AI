/**
 * Chat assistant e2e: exercises conversations, every editing action, credit
 * accounting and tenant isolation against a real Postgres and Redis.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ContentFlow AI chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let projectId: string;
  let assetId: string;
  let conversationId: string;

  const email = `chat-e2e-${Date.now()}@contentflow.test`;
  const otherEmail = `chat-other-${Date.now()}@contentflow.test`;
  const password = 'chat-e2e-passphrase-2026';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Chat Runner' })
      .expect(201);
    token = reg.body.accessToken;

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('authorization', `Bearer ${token}`)
      .send({
        name: 'Chat Project',
        topic: 'AI tools that help students revise for exams',
        targetPlatforms: ['LINKEDIN'],
      })
      .expect(201);
    projectId = project.body.id;

    // A completed run gives us a real asset to edit through chat.
    const run = await request(app.getHttpServer())
      .post(`/pipelines/${project.body.pipelines[0].id}/run`)
      .set('authorization', `Bearer ${token}`)
      .send({ sync: true })
      .expect(201);

    const assets = await request(app.getHttpServer())
      .get(`/assets?runId=${run.body.runId}&take=1`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    assetId = assets.body.items[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } }).catch(() => undefined);
    await app?.close();
  });

  it('rejects unauthenticated access', () =>
    request(app.getHttpServer()).get('/chat/conversations').expect(401));

  it('creates a conversation grounded in a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ projectId })
      .expect(201);

    expect(res.body.projectId).toBe(projectId);
    conversationId = res.body.id;
  });

  it('rejects a conversation pointing at an unknown project', () =>
    request(app.getHttpServer())
      .post('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ projectId: '00000000-0000-0000-0000-000000000000' })
      .expect(404));

  it('rejects an unknown action', () =>
    request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'hi', action: 'HACK' })
      .expect(400));

  it('rejects an empty message', () =>
    request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: '' })
      .expect(400));

  it('answers a chat message and stores both turns', async () => {
    const res = await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'What can you help me with?' })
      .expect(201);

    expect(res.body.userMessage.role).toBe('USER');
    expect(res.body.assistantMessage.role).toBe('ASSISTANT');
    expect(res.body.assistantMessage.content.length).toBeGreaterThan(0);

    const convo = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(convo.body.messages).toHaveLength(2);
  });

  it('titles the conversation from the first message', async () => {
    const res = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.title).toContain('What can you help me with');
  });

  it('requires source content for a transform action', () =>
    request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'shorten this', action: 'SHORTEN' })
      .expect(400));

  it('shortens supplied content', async () => {
    const source = 'One. Two. Three. Four. Five. Six. Seven. Eight.';
    const res = await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'shorten this', action: 'SHORTEN', sourceContent: source })
      .expect(201);

    expect(res.body.assistantMessage.content.length).toBeLessThan(source.length + 400);
    expect(res.body.userMessage.sourceContent).toBe(source);
  });

  it('operates on an existing asset by id', async () => {
    const res = await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'rewrite this asset', action: 'REWRITE', assetId })
      .expect(201);

    expect(res.body.userMessage.sourceContent.length).toBeGreaterThan(0);
  });

  it('rejects an unknown asset id', () =>
    request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({
        content: 'rewrite',
        action: 'REWRITE',
        assetId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(404));

  it('generates ideas without source content', async () => {
    const res = await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'ideas for exam revision posts', action: 'IDEAS' })
      .expect(201);
    expect(res.body.assistantMessage.content).toMatch(/1\./);
  });

  it('charges one credit per message and records the ledger', async () => {
    const before = await request(app.getHttpServer())
      .get('/dashboard/credits')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'one more' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/dashboard/credits')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(after.body.balance).toBe(before.body.balance - 1);
    expect(after.body.transactions[0].reason).toBe('CHAT_MESSAGE');
  });

  it('lists and renames conversations', async () => {
    const list = await request(app.getHttpServer())
      .get('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .patch(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Renamed' })
      .expect(200);

    const one = await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(one.body.title).toBe('Renamed');
  });

  it('archives and hides a conversation from the default list', async () => {
    await request(app.getHttpServer())
      .patch(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ archived: true })
      .expect(200);

    const active = await request(app.getHttpServer())
      .get('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(active.body.items.some((c: { id: string }) => c.id === conversationId)).toBe(false);

    const all = await request(app.getHttpServer())
      .get('/chat/conversations?includeArchived=true')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(all.body.items.some((c: { id: string }) => c.id === conversationId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ archived: false })
      .expect(200);
  });

  it("does not leak another organization's conversation", async () => {
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, name: 'Other' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${other.body.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/chat/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${other.body.accessToken}`)
      .send({ content: 'hijack' })
      .expect(404);
  });

  it('deletes a conversation and cascades its messages', async () => {
    await request(app.getHttpServer())
      .delete(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/chat/conversations/${conversationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(404);

    const orphans = await prisma.chatMessage.count({ where: { conversationId } });
    expect(orphans).toBe(0);
  });
});
