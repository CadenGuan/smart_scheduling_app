import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const pythonBin = isWin
  ? path.resolve(__dirname, '../agent_service/.venv/Scripts/python.exe')
  : path.resolve(__dirname, '../agent_service/.venv/bin/python');

const managePy = path.resolve(__dirname, '../agent_service/manage.py');

const child = spawn(pythonBin, [managePy, 'runserver', '8000'], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code || 0));
