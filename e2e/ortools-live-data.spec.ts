import { test, expect, Page } from '@playwright/test';

async function signInAsFreshman(page: Page, major = 'Computer Science B.S.'): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();

  await page.waitForURL(/\/(onboarding|dashboard)/);
  if (page.url().includes('/onboarding')) {
    for (let step = 1; step <= 4; step++) {
      await page.getByRole('button', { name: 'Next →' }).click();
    }
    await page.getByRole('button', { name: 'Finish Onboarding' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  const skipTourBtn = page.getByRole('button', { name: /Skip Tour/i });
  try {
    await skipTourBtn.waitFor({ state: 'visible', timeout: 3000 });
    await skipTourBtn.click();
  } catch {
    // Tour not shown
  }

  await page.getByRole('button', { name: /Edit Preferences/i }).click();
  await page.getByRole('combobox').first().selectOption('Freshman');
  await page.getByRole('textbox').nth(1).fill(major);
  await page.getByRole('button', { name: 'Save Changes' }).click();
}

async function sendPrompt(page: Page, prompt: string): Promise<void> {
  const chatInput = page.getByRole('textbox', { name: /Ask Sammy about courses, GEs/i });
  await chatInput.click();
  await chatInput.fill(prompt);
  await page.getByRole('button', { name: /Send/i }).click();
}

test.describe.serial('ortools-constraints: Live Data & Solver Adaptation', () => {
  test('ortools-constraints: Live Data - Freshman standing excludes grad courses and balances 2 major + 1 out-of-dept GE', async ({
    page,
  }) => {
    await signInAsFreshman(page, 'Computer Science B.S.');

    await sendPrompt(page, 'optimize my schedule');
    const reply = page
      .getByText(/Selected Courses/i)
      .last()
      .locator('..');
    await expect(reply).toBeVisible({ timeout: 15000 });

    const text = (await reply.textContent()) || '';
    expect(text).toContain('CSE 20');
    expect(text).toMatch(/(ART|MATH|STAT)\s+\d+[A-Z]?\s+\(\+\s*Discussion\)\s+\[GE:/);
    expect(text).not.toMatch(/CSE 2\d\d/);
  });

  test('ortools-constraints: Live Data - switching major to Art B.A. schedules ART 10E async lecture with timed discussion', async ({
    page,
  }) => {
    await signInAsFreshman(page, 'Art B.A.');

    await sendPrompt(page, 'optimize my schedule');
    const reply = page.getByText(/OR-Tools CP-SAT solver for Art B\.A\./i).locator('..');
    await expect(reply).toContainText('ART 10E', { timeout: 15000 });
    await expect(reply).not.toContainText('ART 10E (+ Discussion) [GE:');

    const artCalEvent = page
      .locator('[data-tour="calendar-preview"]')
      .getByRole('button', { name: /ART 10E/i });
    await expect(artCalEvent.first()).toBeVisible({ timeout: 15000 });
  });

  test('ortools-constraints: Live Data - major courses are not labeled as GEs and explicit same-dept GE override works', async ({
    page,
  }) => {
    await signInAsFreshman(page, 'Computer Science B.S.');

    // Default CS Freshman: CSE 20 is a major course (must not have [GE: MF])
    await sendPrompt(page, 'optimize my schedule');
    const csReply = page
      .getByText(/Selected Courses/i)
      .last()
      .locator('..');
    await expect(csReply).toContainText('CSE 20', { timeout: 15000 });
    await expect(csReply).not.toContainText('CSE 20 (+ Discussion) [GE:');

    // Explicit same-department GE request (CSE 80N) is respected when asked outright
    await sendPrompt(page, 'optimize my schedule with elective CSE 80N');
    await expect(
      page
        .getByText(/Selected Courses/i)
        .last()
        .locator('..')
    ).toContainText('CSE 80N', { timeout: 15000 });
  });
});
