import { test, expect, Page } from '@playwright/test';

async function signUpAndReachDashboard(page: Page, emailPrefix: string): Promise<void> {
  const uniqueEmail = `${emailPrefix}-${Date.now()}@ucsc.edu`;

  await page.goto('/login');
  await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();
  await page.getByPlaceholder('Sammy Slug').fill('Sammy Slug');
  await page.getByPlaceholder('student@ucsc.edu').fill(uniqueEmail);
  await page.getByPlaceholder('••••••••').fill('TestPass123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

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

test('ortools-scheduler: AC4 - optimize my schedule populates the FullCalendar UI', async ({
  page,
}) => {
  await signUpAndReachDashboard(page, 'ortools-e2e');

  const chatInput = page.getByRole('textbox', { name: /Ask Sammy about courses, GEs/i });
  await chatInput.click();
  await chatInput.fill('optimize my schedule');
  await page.getByRole('button', { name: /Send/i }).click();

  await expect(page.getByText(/OR-Tools CP-SAT/i)).toBeVisible({ timeout: 15000 });
  const calendarEvents = page
    .locator('[data-tour="calendar-preview"]')
    .getByRole('button', { name: /CSE \d+/i });
  await expect(calendarEvents.first()).toBeVisible({ timeout: 15000 });
  expect(await calendarEvents.count()).toBeGreaterThan(0);
});

test('ortools-scheduler: AC4 - editing preferences to 20 credits and optimizing updates FullCalendar', async ({
  page,
}) => {
  await signUpAndReachDashboard(page, 'ortools-prefs');

  await page.getByRole('button', { name: /Edit Preferences/i }).click();
  await page.getByRole('slider').fill('20');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('20 Credits')).toBeVisible({ timeout: 10000 });

  const chatInput = page.getByRole('textbox', { name: /Ask Sammy about courses, GEs/i });
  await chatInput.click();
  await chatInput.fill('optimize my schedule');
  await page.getByRole('button', { name: /Send/i }).click();

  await expect(page.getByText(/OR-Tools CP-SAT/i)).toBeVisible({ timeout: 15000 });
  const calendarEvents = page
    .locator('[data-tour="calendar-preview"]')
    .getByRole('button', { name: /CSE \d+/i });
  await expect(calendarEvents.first()).toBeVisible({ timeout: 15000 });
  expect(await calendarEvents.count()).toBeGreaterThan(0);
});
