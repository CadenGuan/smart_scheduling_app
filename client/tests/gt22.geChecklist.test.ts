import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OnboardingPageComponent } from '../src/pages/OnboardingPage';
import { GE_REQUIREMENTS } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

function makePage() {
  const page = new OnboardingPageComponent({
    navigate: vi.fn(),
    location: { pathname: '/onboarding' } as any,
    params: {},
  });
  // Unmounted instance: safeSetState writes straight to this.state
  (page as any).state = { ...page.state, currentStep: 3, isLoading: false };
  return page;
}

function renderStep3(page: InstanceType<typeof OnboardingPageComponent>) {
  return cleanHtml(
    renderToString(React.createElement(React.Fragment, null, page.renderStepContent()))
  );
}

/** Number of GE toggles rendered as selected (aria-pressed="true" or a checked checkbox). */
function selectedCount(html: string) {
  const pressed = html.match(/aria-pressed="true"/g)?.length ?? 0;
  const checked = html.match(/<input[^>]*type="checkbox"[^>]*checked=""[^>]*>/g)?.length ?? 0;
  return pressed + checked;
}

describe('GT22 [Client UI] Step 3 GE checklist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GT22: no GE requirement is pre-selected for a new student', () => {
    const page = makePage();
    expect(page.state.formData.geCategoriesCompleted).toEqual([]);
    expect(selectedCount(renderStep3(page))).toBe(0);
  });

  it('GT22: asks which GE requirements the student has already satisfied', () => {
    const html = renderStep3(makePage());
    expect(html).toMatch(/which ge requirements have you (already )?(satisfied|completed)/i);
    expect(html).not.toMatch(/remaining ge requirements/i);
  });

  it('GT22: renders one toggle per GE requirement with code and full name', () => {
    const html = renderStep3(makePage());
    for (const ge of GE_REQUIREMENTS) {
      expect(html).toContain(ge.code);
      expect(html).toContain(ge.name.replace(/&/g, '&amp;'));
    }
  });

  it('GT22: every GE toggle exposes an accessible checked state', () => {
    const html = renderStep3(makePage());
    const ariaToggles = html.match(/aria-pressed="(true|false)"/g)?.length ?? 0;
    const checkboxes = html.match(/<input[^>]*type="checkbox"/g)?.length ?? 0;
    expect(ariaToggles + checkboxes).toBeGreaterThanOrEqual(GE_REQUIREMENTS.length);
  });

  it('GT22: shows the MyUCSC lookup steps in order without any extra click', () => {
    const html = renderStep3(makePage());
    const steps = [/MyUCSC/i, /My Academics/i, /Degree Progress Report/i, /General Education/i];
    let cursor = 0;
    for (const step of steps) {
      const idx = html.slice(cursor).search(step);
      expect(idx, `missing or out-of-order step: ${step}`).toBeGreaterThanOrEqual(0);
      cursor += idx + 1;
    }
    expect(html).toMatch(/expand/i);
  });

  it('GT22: links to MyUCSC in a new tab', () => {
    const html = renderStep3(makePage());
    const link = html.match(/<a[^>]*href="https:\/\/my\.ucsc\.edu[^"]*"[^>]*>/i)?.[0];
    expect(link).toBeDefined();
    expect(link).toMatch(/target="_blank"/);
    expect(link).toMatch(/rel="[^"]*noopener[^"]*"/);
  });

  it('GT22: keeps the GE Fulfillment Source selector', () => {
    const html = renderStep3(makePage());
    expect(html).toMatch(/GE Fulfillment Source/i);
    for (const src of ['UCSC', 'Community College / IGETC', 'Hybrid']) {
      expect(html).toContain(src);
    }
  });
});

describe('GT22 [Client UI] toggling satisfied GEs', () => {
  it('GT22: toggling a GE adds it to geCategoriesCompleted', () => {
    const page = makePage();
    page.handleToggleGE('CC');
    expect(page.state.formData.geCategoriesCompleted).toEqual(['CC']);
  });

  it('GT22: toggling the same GE twice removes it again', () => {
    const page = makePage();
    page.handleToggleGE('CC');
    page.handleToggleGE('CC');
    expect(page.state.formData.geCategoriesCompleted).toEqual([]);
  });

  it('GT22: multiple GEs can be checked off and the UI reflects each one', () => {
    const page = makePage();
    page.handleToggleGE('CC');
    page.handleToggleGE('TA');
    page.handleToggleGE('MF');
    expect(page.state.formData.geCategoriesCompleted).toEqual(['CC', 'TA', 'MF']);
    expect(selectedCount(renderStep3(page))).toBe(3);
  });

  it('GT22: toggling never writes to the legacy geCategoriesRemaining field', () => {
    const page = makePage();
    page.handleToggleGE('SI');
    expect((page.state.formData as any).geCategoriesRemaining ?? []).toEqual([]);
  });
});
