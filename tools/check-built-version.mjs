import process from 'node:process';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Expected the compiled version module directory');
const target = resolve(process.argv[2]);
const expected = JSON.parse(readFileSync(resolve(target, 'build-info.json'), 'utf8')).version;
const moduleUrl = pathToFileURL(resolve(target, 'version.js')).href;
const actual = execFileSync(process.execPath, ['--input-type=module', '-e',
  `const identity = await import(${JSON.stringify(moduleUrl)}); console.log(identity.APP_VERSION || identity.BOT_VERSION);`,
], { encoding: 'utf8', env: { ...process.env, APP_VERSION: '', PATH: '/nonexistent' } }).trim();
assert.equal(actual, expected, 'compiled software version must work without Git or supplied build metadata');
process.stdout.write(`Compiled software identity verified: ${actual}\n`);
