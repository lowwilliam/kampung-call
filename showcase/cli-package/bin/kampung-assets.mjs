#!/usr/bin/env node

import { AssetClient, AssetClientError, DEFAULT_SITE_URL } from "../lib/asset-client.mjs";

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "-h") flags.help = true;
    else if (item === "-o") flags.output = argv[++index];
    else if (item.startsWith("--")) {
      const [key, inlineValue] = item.slice(2).split("=", 2);
      flags[key] = ["help", "json"].includes(key) ? inlineValue === undefined || inlineValue !== "false" : inlineValue ?? argv[++index];
    } else positionals.push(item);
  }
  return { flags, positionals };
}

function help() {
  return `Kampung 3D Collection CLI

Usage:
  kampung-assets [--json] <command>

Commands:
  list [--query TEXT] [--collection all|game] [--category NAME]
  get <asset-id>
  download <asset-id> [-o FILE]

The default collection is ${DEFAULT_SITE_URL}.
Downloads require a cleared Download Grant.`;
}

function output(value, asJson) {
  if (asJson) return process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  if (value?.assets) {
    console.table(value.assets.map((asset) => ({ id: asset.id, name: asset.name, category: asset.category, download: asset.downloadAllowed ? "yes" : "view only" })));
    return process.stdout.write(`Showing ${value.assets.length} of ${value.pagination.total} assets\n`);
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function need(value, message) {
  if (!value) throw new AssetClientError(message, { code: "usage_error" });
  return value;
}

async function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  if (flags.help || !positionals.length) return process.stdout.write(`${help()}\n`);
  const [command, ...args] = positionals;
  const client = new AssetClient({ baseUrl: flags["base-url"], token: flags.token });
  let result;
  if (command === "list") result = await client.listAssets({ query: flags.query, collection: flags.collection, category: flags.category, limit: Number(flags.limit) || 50, offset: Number(flags.offset) || 0 });
  else if (command === "get") result = await client.getAsset(need(args[0], "get requires an asset ID"));
  else if (command === "download") result = await client.downloadAsset(need(args[0], "download requires an asset ID"), flags.output || "");
  else throw new AssetClientError(`Unknown command: ${command}`, { code: "usage_error" });
  output(result, flags.json === true);
}

main().catch((error) => {
  process.stderr.write(`kampung-assets: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof AssetClientError && error.code === "usage_error" ? 2 : 1;
});
