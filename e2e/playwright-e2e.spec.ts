import { test, expect } from '@playwright/test';

test.describe('Playwright E2E Smoke Tests', () => {
  test('playwright-e2e: AC1 - should load application root and redirect to login page', async ({
    page,
  }) => {
    await page.goto('/');

    // Verifies redirection to /login when unauthenticated
    await expect(page).toHaveURL(/\/login/);

    // Verifies application header and branding text
    await expect(page.getByRole('heading', { name: 'Smart Scheduling App' })).toBeVisible();
    await expect(page.getByText('UCSC Degree & Calendar Planner')).toBeVisible();
  });

  test('playwright-e2e: AC2 - should display authentication options and input controls', async ({
    page,
  }) => {
    await page.goto('/login');

    // Google Sign-In button
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();

    // Email and password inputs
    const emailInput = page.getByPlaceholder('student@ucsc.edu');
    const passwordInput = page.getByPlaceholder('••••••••');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Submit button in initial login mode
    const submitButton = page.getByRole('button', { name: 'Log In' });
    await expect(submitButton).toBeVisible();
  });

  test('playwright-e2e: AC3 - should toggle between Login and Sign-Up form views', async ({
    page,
  }) => {
    await page.goto('/login');

    // Verify initial login mode
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
    await expect(page.getByPlaceholder('Sammy Slug')).not.toBeVisible();

    // Toggle to Sign-Up
    const toggleButton = page.getByRole('button', { name: /Don't have an account\? Sign Up/i });
    await toggleButton.click();

    // Form elements for sign-up should now be visible
    await expect(page.getByPlaceholder('Sammy Slug')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    // Toggle back to Sign-In
    const backToSignIn = page.getByRole('button', { name: /Already have an account\? Log in/i });
    await backToSignIn.click();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });
});
