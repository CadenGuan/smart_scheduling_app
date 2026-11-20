import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { ContextService } from '../src/services/context.service.js';

const ALL_GE_CODES = ['CC', 'ER', 'IM', 'MF', 'SI', 'SR', 'TA', 'PE', 'PR', 'C', 'DC'];
const sorted = (xs: string[]) => [...xs].sort();

async function registerUser(label: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `gt22-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ucsc.edu`,
      password: 'Password123!',
      name: 'GT22 Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    });
  return { token: res.body.data.token as string, userId: res.body.data.user.userId as string };
}

async function saveStep3(
  user: { token: string; userId: string },
  draftAnswers: Record<string, unknown>,
  skippedSteps: number[] = []
) {
  return request(app)
    .put(`/api/users/${user.userId}/progress`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ lastStep: 4, skippedSteps, draftAnswers, completed: false });
}

async function getGeStatus(user: { token: string; userId: string }) {
  const res = await request(app)
    .get(`/api/users/${user.userId}`)
    .set('Authorization', `Bearer ${user.token}`);
  expect(res.status).toBe(200);
  return res.body.data.geStatus;
}

describe('GT22 [Server API] saving satisfied GE requirements', () => {
  let user: { token: string; userId: string };

  beforeAll(async () => {
    user = await registerUser('completed');
  });

  it('GT22: stores completed GEs and derives remaining from them', async () => {
    const res = await saveStep3(user, {
      geSource: 'UCSC',
      geCategoriesCompleted: ['CC', 'TA'],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const geStatus = await getGeStatus(user);
    expect(geStatus.source).toBe('UCSC');
    expect(sorted(geStatus.completed)).toEqual(['CC', 'TA']);
    expect(geStatus.remaining).not.toContain('CC');
    expect(geStatus.remaining).not.toContain('TA');
    expect(sorted(geStatus.remaining)).toEqual(
      sorted(ALL_GE_CODES.filter((c) => c !== 'CC' && c !== 'TA'))
    );
  });

  it('GT22: draft answers keep geCategoriesCompleted so the questionnaire can resume', async () => {
    await saveStep3(user, { geSource: 'Hybrid', geCategoriesCompleted: ['MF', 'SI'] });

    const res = await request(app)
      .get(`/api/users/${user.userId}/progress`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.draftAnswers.geCategoriesCompleted).toEqual(['MF', 'SI']);

    const geStatus = await getGeStatus(user);
    expect(geStatus.source).toBe('Hybrid');
    expect(sorted(geStatus.completed)).toEqual(['MF', 'SI']);
  });

  it('GT22: unchecking a GE moves it back to remaining', async () => {
    await saveStep3(user, { geSource: 'UCSC', geCategoriesCompleted: ['CC', 'ER'] });
    await saveStep3(user, { geSource: 'UCSC', geCategoriesCompleted: ['CC'] });

    const geStatus = await getGeStatus(user);
    expect(geStatus.completed).toEqual(['CC']);
    expect(geStatus.remaining).toContain('ER');
  });

  it('GT22: every GE checked off leaves nothing remaining', async () => {
    await saveStep3(user, { geSource: 'UCSC', geCategoriesCompleted: ALL_GE_CODES });

    const geStatus = await getGeStatus(user);
    expect(geStatus.remaining).toEqual([]);
    expect(sorted(geStatus.completed)).toEqual(sorted(ALL_GE_CODES));
  });

  it('GT22: rejects unknown GE codes with 400 and does not overwrite saved status', async () => {
    await saveStep3(user, { geSource: 'UCSC', geCategoriesCompleted: ['SR'] });

    const res = await saveStep3(user, {
      geSource: 'UCSC',
      geCategoriesCompleted: ['SR', 'NOT-A-GE'],
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const geStatus = await getGeStatus(user);
    expect(geStatus.completed).toEqual(['SR']);
  });

  it('GT22: requires authentication', async () => {
    const res = await request(app)
      .put(`/api/users/${user.userId}/progress`)
      .send({ lastStep: 4, draftAnswers: { geCategoriesCompleted: ['CC'] } });
    expect(res.status).toBe(401);
  });
});

describe('GT22 [Server API] skipping the GE step', () => {
  it('GT22: a skipped Step 3 stores completed = [] and every GE as remaining', async () => {
    const user = await registerUser('skipped');
    const res = await saveStep3(user, { geSource: 'UCSC' }, [3]);
    expect(res.status).toBe(200);
    expect(res.body.data.skippedSteps).toContain(3);

    const geStatus = await getGeStatus(user);
    expect(geStatus.completed).toEqual([]);
    expect(sorted(geStatus.remaining)).toEqual(sorted(ALL_GE_CODES));
  });

  it('GT22: no GE answers are assumed for a brand-new user', async () => {
    const user = await registerUser('fresh');
    const context = ContextService.assembleContext(user.userId);
    const completed = context.preferences.geStatus?.completed ?? [];
    expect(completed).toEqual([]);
  });
});

describe('GT22 [Server API] legacy users who saved remaining GEs', () => {
  it('GT22: a legacy geStatus with only remaining still loads with completed derived', async () => {
    const user = await registerUser('legacy');
    const importRes = await request(app)
      .post(`/api/users/${user.userId}/import`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        profile: {},
        preferences: {},
        geStatus: { source: 'UCSC', remaining: ['CC', 'ER'] },
      });
    expect(importRes.status).toBe(200);

    const geStatus = await getGeStatus(user);
    expect(sorted(geStatus.remaining)).toEqual(['CC', 'ER']);
    expect(sorted(geStatus.completed)).toEqual(
      sorted(ALL_GE_CODES.filter((c) => c !== 'CC' && c !== 'ER'))
    );
  });
});

describe('GT22 [Server Context] GE status handed to the agent', () => {
  it('GT22: agent context includes both completed and remaining GEs', async () => {
    const user = await registerUser('context');
    await saveStep3(user, { geSource: 'UCSC', geCategoriesCompleted: ['CC', 'ER', 'PR'] });

    const context = ContextService.assembleContext(user.userId);
    const geStatus = context.preferences.geStatus;
    expect(sorted(geStatus.completed)).toEqual(['CC', 'ER', 'PR']);
    for (const done of ['CC', 'ER', 'PR']) {
      expect(geStatus.remaining).not.toContain(done);
    }
    expect(geStatus.remaining).toContain('MF');
  });

  it('GT22: agent context normalizes a legacy remaining-only status', async () => {
    const user = await registerUser('context-legacy');
    await request(app)
      .post(`/api/users/${user.userId}/import`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ profile: {}, preferences: {}, geStatus: { source: 'UCSC', remaining: ['TA'] } });

    const geStatus = ContextService.assembleContext(user.userId).preferences.geStatus;
    expect(geStatus.remaining).toEqual(['TA']);
    expect(geStatus.completed).not.toContain('TA');
    expect(geStatus.completed).toContain('CC');
  });
});
