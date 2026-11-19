import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';

const [tool, ...toolArgs] = process.argv.slice(2);

if (!tool) {
  console.error('Usage: node scripts/run-agent-tool.js <tool-name> [args...]');
  process.exit(1);
}

const venvBinDir = isWin
  ? path.resolve(__dirname, '../agent_service/.venv/Scripts')
  : path.resolve(__dirname, '../agent_service/.venv/bin');

const binExt = isWin ? '.exe' : '';
const executable = path.join(venvBinDir, `${tool}${binExt}`);

const agentServiceDir = path.resolve(__dirname, '../agent_service');

const env = {
  ...process.env,
  PYTHONPATH: agentServiceDir,
  DJANGO_SETTINGS_MODULE: 'agent_service.settings',
  USE_MOCK_AGENT: 'true',
};

const child = spawn(executable, toolArgs, {
  stdio: 'inherit',
  env,
  cwd: agentServiceDir,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
