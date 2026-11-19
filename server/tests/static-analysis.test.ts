import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

describe('static-analysis', () => {
  it('static-analysis: AC1 - verifies ESLint and Ruff linting configurations are active across full stack', () => {
    // Arrange: Locate ESLint and Python Ruff configurations
    const eslintConfigPath = path.resolve(rootDir, 'eslint.config.js');
    const pyprojectPath = path.resolve(rootDir, 'agent_service/pyproject.toml');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    // Act: Read configurations
    const eslintConfig = fs.readFileSync(eslintConfigPath, 'utf8');
    const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Assert: ESLint includes react-hooks and package.json provides lint:all
    expect(eslintConfig).toContain('react-hooks');
    expect(eslintConfig).toContain('rules-of-hooks');
    expect(pyproject).toContain('[tool.ruff]');
    expect(pyproject).toContain('target-version = "py311"');
    expect(packageJson.scripts['lint:all']).toBeDefined();
    expect(packageJson.scripts['lint:agent']).toBeDefined();
  });

  it('static-analysis: AC2 - verifies Prettier formatting configuration and check script', () => {
    // Arrange: Locate prettier configuration and scripts
    const packageJsonPath = path.resolve(rootDir, 'package.json');
    const prettierrcPath = path.resolve(rootDir, '.prettierrc');

    // Act
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const prettierrc = fs.existsSync(prettierrcPath)
      ? fs.readFileSync(prettierrcPath, 'utf8')
      : '{}';

    // Assert
    expect(packageJson.scripts['format:check']).toBeDefined();
    expect(packageJson.scripts['format']).toBeDefined();
    expect(prettierrc).toBeDefined();
  });

  it('static-analysis: AC3 - verifies full-stack static typechecking via tsc and mypy', () => {
    // Arrange: Locate TypeScript config, mypy config, and unified scripts
    const tsconfigBasePath = path.resolve(rootDir, 'tsconfig.base.json');
    const pyprojectPath = path.resolve(rootDir, 'agent_service/pyproject.toml');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    // Act
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigBasePath, 'utf8'));
    const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Assert
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(pyproject).toContain('[tool.mypy]');
    expect(packageJson.scripts['typecheck:all']).toContain(
      'npm run typecheck && npm run typecheck:agent'
    );
  });

  it('static-analysis: AC4 - verifies Knip dead code and unused dependency analyzer configuration', () => {
    // Arrange: Locate knip.json
    const knipJsonPath = path.resolve(rootDir, 'knip.json');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    // Act
    const knipJson = JSON.parse(fs.readFileSync(knipJsonPath, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Assert
    expect(knipJson.workspaces).toBeDefined();
    expect(knipJson.workspaces.client).toBeDefined();
    expect(knipJson.workspaces.server).toBeDefined();
    expect(knipJson.workspaces.shared).toBeDefined();
    expect(packageJson.scripts['check:deadcode']).toBe('knip');
  });

  it('static-analysis: AC5 - verifies jscpd code duplication scanner configuration and threshold limit', () => {
    // Arrange: Locate .jscpd.json
    const jscpdJsonPath = path.resolve(rootDir, '.jscpd.json');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    // Act
    const jscpdJson = JSON.parse(fs.readFileSync(jscpdJsonPath, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Assert
    expect(jscpdJson.threshold).toBeLessThanOrEqual(10);
    expect(jscpdJson.ignore).toContain('**/node_modules/**');
    expect(jscpdJson.ignore).toContain('**/tests/**');
    expect(packageJson.scripts['check:duplicates']).toContain('jscpd');
  });

  it('static-analysis: AC6 - verifies Vitest coverage thresholds (>= 70%) across client, server, and shared', () => {
    // Arrange: Check all vitest.config.ts files
    const clientVitest = fs.readFileSync(path.resolve(rootDir, 'client/vitest.config.ts'), 'utf8');
    const serverVitest = fs.readFileSync(path.resolve(rootDir, 'server/vitest.config.ts'), 'utf8');
    const sharedVitest = fs.readFileSync(path.resolve(rootDir, 'shared/vitest.config.ts'), 'utf8');

    // Assert: Thresholds are set to 70 across lines, functions, branches, statements
    for (const config of [clientVitest, serverVitest, sharedVitest]) {
      expect(config).toContain('thresholds:');
      expect(config).toContain('lines: 70');
      expect(config).toContain('functions: 70');
      expect(config).toContain('branches: 70');
      expect(config).toContain('statements: 70');
    }
  });

  it('static-analysis: AC7 - verifies Pytest coverage configuration and >= 70% threshold in pyproject.toml', () => {
    // Arrange: Locate agent pyproject.toml
    const pyprojectPath = path.resolve(rootDir, 'agent_service/pyproject.toml');

    // Act
    const pyproject = fs.readFileSync(pyprojectPath, 'utf8');

    // Assert
    expect(pyproject).toContain('[tool.coverage.report]');
    expect(pyproject).toContain('fail_under = 70');
  });

  it('static-analysis: AC8 - verifies Husky pre-commit hook and lint-staged configuration', () => {
    // Arrange: Locate .husky/pre-commit and package.json
    const preCommitPath = path.resolve(rootDir, '.husky/pre-commit');
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    // Act
    const preCommit = fs.readFileSync(preCommitPath, 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Assert: Hook triggers lint-staged, knip, and jscpd
    expect(preCommit).toContain('lint-staged');
    expect(preCommit).toContain('check:deadcode');
    expect(preCommit).toContain('check:duplicates');
    expect(packageJson['lint-staged']).toBeDefined();
    expect(packageJson['lint-staged']['*.{ts,tsx,json}']).toBeDefined();
    expect(packageJson['lint-staged']['agent_service/**/*.py']).toBeDefined();
  });

  it('static-analysis: AC9 - verifies GitHub Actions CI pipeline enforces all static analysis and coverage suites', () => {
    // Arrange: Locate .github/workflows/ci.yml
    const ciPath = path.resolve(rootDir, '.github/workflows/ci.yml');

    // Act
    const ciYml = fs.readFileSync(ciPath, 'utf8');

    // Assert: CI executes all full-stack gates
    expect(ciYml).toContain('npm run lint:all');
    expect(ciYml).toContain('npm run format:check');
    expect(ciYml).toContain('npm run typecheck:all');
    expect(ciYml).toContain('npm run check:deadcode');
    expect(ciYml).toContain('npm run check:duplicates');
    expect(ciYml).toContain('npm run test:coverage');
    expect(ciYml).toContain('npm run test:coverage:agent');
  });
});
