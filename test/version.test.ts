import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { softwareVersion } from '../src/core/version.js';

const originalVersion = process.env.APP_VERSION;
const originalPath = process.env.PATH;
afterEach(() => {
  if (originalVersion === undefined) delete process.env.APP_VERSION;
  else process.env.APP_VERSION = originalVersion;
  process.env.PATH = originalPath;
});
test('build metadata works without Git or a shell', () => {
  process.env.APP_VERSION = '2.3.4-rc.1+build.7';
  process.env.PATH = '/nonexistent';
  assert.equal(softwareVersion(), '2.3.4-rc.1+build.7');
});
test('native checkouts resolve their Git version', () => {
  delete process.env.APP_VERSION;
  const expected = execFileSync('sh', ['tools/version.sh'], { encoding: 'utf8' }).trim();
  assert.notEqual(expected, '0.0.0+unknown');
  assert.equal(softwareVersion(new URL('file:///nonexistent/build-info.json')), expected);
});
test('missing metadata is explicitly unknown', () => {
  delete process.env.APP_VERSION;
  process.env.PATH = '/nonexistent';
  assert.equal(softwareVersion(new URL('file:///nonexistent/build-info.json')), '0.0.0+unknown');
});
