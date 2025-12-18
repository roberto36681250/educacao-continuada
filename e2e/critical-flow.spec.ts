import { test, expect } from '@playwright/test';
import {
  apiLogin,
  apiCreateInvite,
  apiAcceptInvite,
  setAuthToken,
  waitForApi,
  uniqueEmail,
  uniqueCpf,
} from './helpers';

// Test data
const ADMIN_EMAIL = 'admin@educacaocontinuada.com.br';
const ADMIN_PASSWORD = 'admin123';
const INSTITUTE_ID = 'institute-main';
const HOSPITAL_ID = 'hospital-1';
const UNIT_ID = 'unit-uti-adulto-a';

test.describe('Critical User Flow', () => {
  let adminToken: string;
  let studentToken: string;
  let studentEmail: string;

  test.beforeAll(async () => {
    // Wait for API to be ready
    await waitForApi();

    // Login as admin
    const adminLogin = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = adminLogin.accessToken;
    expect(adminToken).toBeTruthy();
  });

  test('1. Admin can login', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to home or dashboard
    await expect(page).toHaveURL(/\/(home|gestor|cursos)/);
  });

  test('2. Admin can create invite', async ({ page }) => {
    // Create invite via API
    studentEmail = uniqueEmail('aluno');
    const invite = await apiCreateInvite(adminToken, {
      instituteId: INSTITUTE_ID,
      hospitalId: HOSPITAL_ID,
      unitId: UNIT_ID,
      systemRole: 'USER',
      profession: 'Enfermeiro',
      invitedEmail: studentEmail,
    });

    expect(invite.token).toBeTruthy();
    expect(invite.inviteUrl).toContain('/invite/');

    // Store for next test
    (global as any).__inviteToken = invite.token;
  });

  test('3. Student can accept invite', async ({ page }) => {
    const inviteToken = (global as any).__inviteToken;
    expect(inviteToken).toBeTruthy();

    // Accept via API (faster than UI)
    const cpf = uniqueCpf();
    const result = await apiAcceptInvite(inviteToken, {
      email: studentEmail,
      password: 'student123',
      name: 'Aluno E2E Test',
      cpf,
      phone: '11999999999',
      professionalRegister: 'COREN-SP E2E001',
    });

    studentToken = result.accessToken;
    expect(studentToken).toBeTruthy();
    expect(result.user.email).toBe(studentEmail);
  });

  test('4. Student can see courses', async ({ page }) => {
    await page.goto('/');
    await setAuthToken(page, studentToken);
    await page.reload();

    // Navigate to courses
    await page.goto('/cursos');
    await expect(page).toHaveURL('/cursos');

    // Should see at least one course (from seed)
    const courseCard = page.locator('[data-testid="course-card"]').first();
    // If no test-id, look for any link to a course
    const courseLink = page.locator('a[href^="/curso/"]').first();

    // Either should exist
    await expect(courseCard.or(courseLink)).toBeVisible({ timeout: 10000 });
  });

  test('5. Student can open a course', async ({ page }) => {
    await page.goto('/');
    await setAuthToken(page, studentToken);
    await page.reload();

    // Navigate to a specific course (from seed data)
    await page.goto('/cursos');

    // Click first available course
    const courseLink = page.locator('a[href^="/curso/"]').first();
    await courseLink.click();

    // Should be on course page
    await expect(page).toHaveURL(/\/curso\/.+/);
  });

  test('6. Health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
  });

  test('7. Rate limiting works', async ({ request }) => {
    // Make 15 rapid login attempts (limit is 10/min)
    const attempts = [];
    for (let i = 0; i < 15; i++) {
      attempts.push(
        request.post('http://localhost:3001/auth/login', {
          data: { email: 'nonexistent@test.com', password: 'wrong' },
        }),
      );
    }

    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status());

    // Some should be 429 (rate limited)
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

test.describe('Certificate Flow', () => {
  // This test assumes there's a completed course available
  // In a real scenario, you'd set up the data first

  test.skip('Student can issue certificate after completing course', async ({
    page,
    request,
  }) => {
    // This would require:
    // 1. Complete all lessons (video progress)
    // 2. Pass all quizzes
    // 3. Then issue certificate

    // For now, just verify the endpoint exists
    const response = await request.post(
      'http://localhost:3001/courses/test-course/certificates',
      {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      },
    );

    // Should get 401 (unauthorized), not 404
    expect(response.status()).toBe(401);
  });
});

test.describe('Verify Endpoint', () => {
  test('Certificate verification endpoint works', async ({ request }) => {
    // Try to verify a non-existent certificate
    const response = await request.get(
      'http://localhost:3001/public/certificates/INVALID-CODE',
    );

    // Should return 404 or similar, not crash
    expect([404, 400]).toContain(response.status());
  });
});
