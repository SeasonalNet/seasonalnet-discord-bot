import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function softwareVersion(embedded: URL = new URL('./build-info.json', import.meta.url)): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    if (existsSync(embedded)) {
      const info = JSON.parse(readFileSync(embedded, 'utf8')) as { version?: unknown };
      return typeof info.version === 'string' && info.version ? info.version : '0.0.0+unknown';
    }
    let root = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(root, 'package.json'))) {
      const parent = dirname(root);
      if (parent === root) return '0.0.0+unknown';
      root = parent;
    }
    return execFileSync('sh', [join(root, 'tools/version.sh')], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '0.0.0+unknown';
  }
}

export const BOT_VERSION = softwareVersion();
