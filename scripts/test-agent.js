import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const pytestBin = isWin
  ? path.resolve(__dirname, '../agent_service/.venv/Scripts/pytest.exe')
  : path.resolve(__dirname, '../agent_service/.venv/bin/pytest');

const agentServiceDir = path.resolve(__dirname, '../agent_service');
const testsDir = path.resolve(__dirname, '../agent_service/tests');

const env = {
  ...process.env,
  PYTHONPATH: agentServiceDir,
  DJANGO_SETTINGS_MODULE: 'agent_service.settings',
  USE_MOCK_AGENT: 'true',
};

const child = spawn(pytestBin, [testsDir], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code || 0));
