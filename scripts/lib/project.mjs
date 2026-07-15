import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const htmlPath = path.join(root, 'kampung-post.html');

export function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

export function extractBalancedLiteral(source, declaration) {
  const marker = `const ${declaration}=`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  const literalStart = source.indexOf('{', start + marker.length);
  if (literalStart < 0) throw new Error(`Missing object literal for ${declaration}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = literalStart; i < source.length; i += 1) {
    const character = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return source.slice(literalStart, i + 1);
  }
  throw new Error(`Unterminated object literal for ${declaration}`);
}

export function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / (bytes >= 1024 ** 2 ? 1024 : 1)).toFixed(1)} ${bytes >= 1024 ** 2 ? 'MB' : 'KB'}`;
}
