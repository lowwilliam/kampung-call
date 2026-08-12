import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function nearestExisting(input) {
  let current = path.resolve(input);
  for (;;) {
    if (await lstat(current).then(() => true, () => false)) return realpath(current);
    const parent = path.dirname(current);
    if (parent === current) return realpath(parent);
    current = parent;
  }
}

export async function createPathPolicy({ roots = process.env.KAMPUNG_ASSET_ROOTS } = {}) {
  const configured = roots ? roots.split(path.delimiter).filter(Boolean) : [process.cwd()];
  const allowedRoots = await Promise.all(configured.map((root) => realpath(path.resolve(root))));

  function assertAllowed(target, label) {
    if (!allowedRoots.some((root) => inside(root, target))) {
      throw new Error(`${label} is outside the configured MCP file roots: ${target}`);
    }
  }

  return {
    roots: allowedRoots,
    async readable(input) {
      const target = await realpath(path.resolve(input));
      assertAllowed(target, "Upload path");
      const info = await lstat(target);
      if (!info.isFile()) throw new Error(`Upload path is not a file: ${target}`);
      return target;
    },
    async writable(input) {
      const target = path.resolve(input);
      const ancestor = await nearestExisting(path.dirname(target));
      assertAllowed(ancestor, "Download path");
      return target;
    },
  };
}
