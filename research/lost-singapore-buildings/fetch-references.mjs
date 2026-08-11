import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const collection = JSON.parse(await fs.readFile(path.join(root, 'collection.json'), 'utf8'));
const failures = [];

for (const building of collection.buildings) {
  for (const reference of building.references) {
    const destination = path.join(root, 'references', reference.filename);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    try {
      const response = await fetch(reference.imageUrl, {
        headers: {
          'User-Agent': 'KampungCallHeritageResearch/1.0 (reference acquisition; source attribution preserved)',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) throw new Error(`unexpected content type ${contentType || '(missing)'}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 4096) throw new Error(`image too small (${bytes.length} bytes)`);
      await fs.writeFile(destination, bytes);
      process.stdout.write(`saved ${path.relative(root, destination)} (${bytes.length} bytes)\n`);
    } catch (error) {
      failures.push({ building: building.id, reference: reference.id, url: reference.imageUrl, error: String(error) });
      process.stderr.write(`failed ${building.id}/${reference.id}: ${error}\n`);
    }
  }
}

await fs.writeFile(path.join(root, 'reference-fetch-report.json'), `${JSON.stringify({ fetchedOn: new Date().toISOString(), failures }, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
