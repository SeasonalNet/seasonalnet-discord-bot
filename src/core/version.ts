import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJsonLike {
  version?: unknown;
}

function loadPackageVersion(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const packageJsonPath = path.resolve(path.dirname(currentFile), '../../../package.json');
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as PackageJsonLike;
    return typeof parsed.version === 'string' && parsed.version.trim()
      ? parsed.version.trim()
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

export const BOT_VERSION = loadPackageVersion();
