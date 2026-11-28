import { test, expect, Page } from '@playwright/test';

async function signUpAndReachDashboard(page: Page): Promise<void> {
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
}

async function sendPrompt(page: Page, prompt: string): Promise<void> {
  const chatInput = page.getByRole('textbox', { name: /Ask Sammy about courses, GEs/i });
  await chatInput.click();
  await chatInput.fill(prompt);
  await page.getByRole('button', { name: /Send/i }).click();
}

test.describe('ortools-constraints: Acceptance Criteria', () => {
  test('ortools-constraints: AC1 - requested elective and extraneous course preferences', async ({
    page,
  }) => {
    await signUpAndReachDashboard(page);

    // Explicit requested elective (STAT 80A)
    await sendPrompt(page, 'optimize my schedule with elective STAT 80A');
    await expect(
      page
        .getByText(/Selected Courses/i)
        .last()
        .locator('..')
    ).toContainText('STAT 80A', { timeout: 15000 });

    // Extraneous course with shallow prereqs (STAT 80A) preferred over deep-prereq CSE 130
    await sendPrompt(page, 'optimize my schedule with extra STAT 80A and CSE 130');
    const lastReply = page
      .getByText(/Selected Courses/i)
      .last()
      .locator('..');
    await expect(lastReply).toContainText('STAT 80A', { timeout: 15000 });
    await expect(lastReply).not.toContainText('CSE 130');
  });

  test('ortools-constraints: AC2 - GE category limit, soft 12-unit floor, and infeasibility diagnostics', async ({
    page,
  }) => {
    await signUpAndReachDashboard(page);

    // Soft 12-unit floor: requesting 10 credits still returns a valid schedule <= 10 credits
    await sendPrompt(page, 'optimize my schedule for 10 credits');
    await expect(page.getByText(/Selected Courses \(/i).last()).toBeVisible({ timeout: 15000 });

    // GE limit <= 1 per category at 20 credits
    await sendPrompt(page, 'optimize my schedule for 20 credits');
    await expect(page.getByText(/Selected Courses \(/i)).toHaveCount(2, { timeout: 15000 });
    const geReply = page
      .getByText(/Selected Courses \(/i)
      .last()
      .locator('..');
    const geText = (await geReply.textContent()) || '';
    const geMatches = [...geText.matchAll(/\[GE:\s*([^\]]+)\]/g)].map((m) => m[1].trim());
    expect(geMatches.length).toBeGreaterThan(0);
    expect(new Set(geMatches).size).toBe(geMatches.length);

    // Impossible required courses + credit cap returns INFEASIBLE diagnostic reason
    await sendPrompt(page, 'optimize my schedule requiring CSE 20 and ART 10E for 5 credits');
    await expect(page.getByText(/No valid schedule satisfies all constraints/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('ortools-constraints: AC3 - optimizing with a preferred gap and orientation goal populates FullCalendar', async ({
    page,
  }) => {
    await signUpAndReachDashboard(page);

    await sendPrompt(page, 'optimize my schedule with a 30 min gap and machine learning interest');

    await expect(page.getByText(/OR-Tools CP-SAT/i)).toBeVisible({ timeout: 15000 });
    const calendarEvents = page
      .locator('[data-tour="calendar-preview"]')
      .getByRole('button', { name: /(CSE|ART|MATH|STAT) \d+/i });
    await expect(calendarEvents.first()).toBeVisible({ timeout: 15000 });
    expect(await calendarEvents.count()).toBeGreaterThan(0);
  });

  test('ortools-constraints: Spec C1 & C2 - zero conflicts, discussion pairing, and prereq DAG eligibility', async ({
    page,
  }) => {
    await signUpAndReachDashboard(page);

    // Core degree priority + 0 overlaps + paired discussion on FullCalendar
    await sendPrompt(page, 'optimize my schedule');
    const okReply = page
      .getByText(/Selected Courses \(/i)
      .last()
      .locator('../..');
    await expect(okReply).toContainText('Conflicts: 0 overlaps', { timeout: 15000 });
    await expect(okReply).toContainText('(+ Discussion)');

    // Prereq DAG blocks CSE 101 when prerequisites are not completed
    await sendPrompt(page, 'optimize my schedule requiring CSE 101 for 15 credits');
    await expect(
      page.getByText(/Required course CSE 101 has no eligible schedulable sections/i)
    ).toBeVisible({ timeout: 15000 });
  });
});
