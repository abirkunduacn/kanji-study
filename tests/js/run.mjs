// Runs the JS tests and saves a copy of the results under tests/logs.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const logDir = join(here, '..', 'logs');
mkdirSync(logDir, { recursive: true });
const files = readdirSync(here).filter((name) => name.endsWith('.test.mjs')).map((name) => join(here, name));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = join(logDir, `js-tests-${stamp}.log`);

let output = '';
let failed = false;
const stream = run({ files });
stream.on('test:fail', () => { failed = true; });
for await (const chunk of stream.compose(spec)) {
  process.stdout.write(chunk);
  output += chunk;
}
writeFileSync(logPath, output.replace(/\x1b\[[0-9;]*m/g, ''));
console.log(`Log saved to ${logPath}`);
process.exitCode = failed ? 1 : 0;
