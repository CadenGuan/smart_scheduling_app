import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const envFiles = [
  path.resolve(rootDir, '.env'),
  path.resolve(rootDir, 'server/.env'),
  path.resolve(rootDir, 'agent_service/.env'),
];

for (const file of envFiles) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/AGENT_MODE=/i.test(content)) {
    content = content.replace(/AGENT_MODE=.*(\r?\n?)/gi, 'AGENT_MODE=mock$1');
  } else {
    content = 'AGENT_MODE=mock\n' + content;
  }
  if (/USE_MOCK_AGENT=/i.test(content)) {
    content = content.replace(/USE_MOCK_AGENT=.*(\r?\n?)/gi, 'USE_MOCK_AGENT=true$1');
  } else {
    content = 'USE_MOCK_AGENT=true\n' + content;
  }
  fs.writeFileSync(file, content, 'utf8');
}

console.log('\n>>> Starting in STRICT MOCK MODE (Offline Catalog Greedy Preview, No Live Gemini API)\n');

process.env.AGENT_MODE = 'mock';
process.env.USE_MOCK_AGENT = 'true';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev:all'], {
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
