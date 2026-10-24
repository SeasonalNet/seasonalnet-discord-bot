import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const script = fileURLToPath(new URL('./version.sh', import.meta.url));
const version = process.env.APP_VERSION || execFileSync('sh', [script], { encoding: 'utf8' }).trim();
const revision = process.env.APP_REVISION || execFileSync('sh', [script, '--revision'], { encoding: 'utf8' }).trim();
execFileSync('sh', [script, '--image-tag', `v${version}`]);
if (!process.argv[2]) throw new Error('Expected the compiled version module directory');
const target = resolve(process.argv[2]);
mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, 'build-info.json'), `${JSON.stringify({ version, revision })}\n`);
