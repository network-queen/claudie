#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = portFlag !== -1 ? parseInt(args[portFlag + 1], 10) : 3434;
const noOpen = args.includes('--no-open');

// Signal to server/index.ts that we are launching via CLI (skip auto-start)
process.env.CLAWDIE_CLI = '1';
process.env.PORT = String(port);
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const distPath = join(root, 'dist');
if (!existsSync(distPath)) {
  console.error('\x1b[31m[claudie] Frontend not built. Run: npm run build\x1b[0m');
  process.exit(1);
}

console.log(`
\x1b[35m   _____ _                 _ _
  / ____| |               | (_)
 | |    | | __ _ _   _  __| |_  ___
 | |    | |/ _\` | | | |/ _\` | |/ _ \\
 | |____| | (_| | |_| | (_| | |  __/
  \\_____|_|\\__,_|\\__,_|\\__,_|_|\\___|
\x1b[0m`);
console.log(`\x1b[36m  Claudie — IDE Companion for Claude Code\x1b[0m`);
console.log(`\x1b[90m  ─────────────────────────────────────────\x1b[0m\n`);

const { startServer } = await import('../server/index.ts');
const server = await startServer(port);

if (!noOpen) {
  const open = (await import('open')).default;
  await open(`http://localhost:${port}`);
}

process.on('SIGINT', () => {
  console.log('\n\x1b[90m[claudie] Shutting down...\x1b[0m');
  server.close();
  process.exit(0);
});
