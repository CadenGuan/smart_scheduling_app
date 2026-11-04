import readline from 'node:readline';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function updateEnvFiles(isMock) {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const val = isMock ? 'mock' : 'live';
  const boolVal = isMock ? 'true' : 'false';

  const envFiles = [
    path.resolve(rootDir, '.env'),
    path.resolve(rootDir, 'server/.env'),
    path.resolve(rootDir, 'agent_service/.env'),
  ];

  for (const file of envFiles) {
    let content = '';
    if (fs.existsSync(file)) {
      content = fs.readFileSync(file, 'utf8');
    }

    if (/AGENT_MODE=/i.test(content)) {
      content = content.replace(/AGENT_MODE=.*(\r?\n?)/gi, `AGENT_MODE=${val}$1`);
    } else {
      content = `AGENT_MODE=${val}\n` + content;
    }

    if (/USE_MOCK_AGENT=/i.test(content)) {
      content = content.replace(/USE_MOCK_AGENT=.*(\r?\n?)/gi, `USE_MOCK_AGENT=${boolVal}$1`);
    } else {
      content = `USE_MOCK_AGENT=${boolVal}\n` + content;
    }

    fs.writeFileSync(file, content, 'utf8');
  }
}

console.log('\n========================================');
console.log('   SLUG SCHEDULER: SELECT AGENT MODE   ');
console.log('========================================');
console.log(' [1] Mock Agent (Offline greedy catalog testing - No live Gemini calls) [DEFAULT]');
console.log(' [2] Live Agent (Gemini API with tools)');

rl.question('\nSelect mode (1 or 2, default is 1): ', (answer) => {
  rl.close();
  const choice = (answer || '').trim();
  const isMock = choice !== '2';

  updateEnvFiles(isMock);

  console.log(`\n>>> Mode selected: ${isMock ? 'MOCK AGENT (Offline Catalog Mode)' : 'LIVE AGENT (Gemini Mode)'}\n`);

  process.env.AGENT_MODE = isMock ? 'mock' : 'live';
  process.env.USE_MOCK_AGENT = isMock ? 'true' : 'false';

  const devArgs = ['run', 'dev:all'];
  const child = spawn('npm', devArgs, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
});

