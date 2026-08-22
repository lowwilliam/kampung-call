#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { AssetClient, AssetClientError } from "../tooling/asset-client.mjs";

const booleanFlags = new Set(["json", "help"]);

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "-h") {
      flags.help = true;
    } else if (item === "-o") {
      flags.output = argv[++index];
    } else if (item.startsWith("--")) {
      const [rawKey, inlineValue] = item.slice(2).split("=", 2);
      if (booleanFlags.has(rawKey)) flags[rawKey] = inlineValue === undefined ? true : inlineValue !== "false";
      else flags[rawKey] = inlineValue ?? argv[++index];
    } else {
      positionals.push(item);
    }
  }
  return { flags, positionals };
}

function help() {
  return `Kampung Call Asset CLI

Usage:
  kampung-assets [--base-url URL] [--json] <command>

Commands:
  list [--query TEXT] [--collection all|game] [--category NAME]
  get <asset-id>
  download <asset-id> [-o FILE]

Environment:
  KAMPUNG_ASSET_API_URL    Override the ChatGPT-hosted collection origin
  KAMPUNG_ASSET_API_TOKEN  Optional bearer token for protected deployments

Asset IDs are namespaced, for example game:peranakan-house.
The catalogue is read-only; download succeeds only for an asset with a cleared Download Grant.`;
}

function output(value, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (value?.assets) {
    const rows = value.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      collection: asset.collection,
      category: asset.category,
      download: asset.downloadAllowed ? "yes" : "view only",
    }));
    console.table(rows);
    const { total, offset, nextOffset } = value.pagination;
    process.stdout.write(`Showing ${rows.length} of ${total} assets from offset ${offset}${nextOffset === null ? "" : `; next offset ${nextOffset}`}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function need(value, message) {
  if (!value) throw new AssetClientError(message, { code: "usage_error" });
  return value;
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { flags, positionals } = parseArgs(argv);
  if (flags.help || !positionals.length) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  const [command, ...args] = positionals;
  const client = dependencies.client ?? new AssetClient({ baseUrl: flags["base-url"], token: flags.token });
  let result;

  switch (command) {
    case "list":
      result = await client.listAssets({
        query: flags.query ?? "",
        collection: flags.collection ?? "all",
        category: flags.category ?? "",
        limit: Number(flags.limit) || 50,
        offset: Number(flags.offset) || 0,
      });
      break;
    case "get":
      result = await client.getAsset(need(args[0], "get requires an asset ID"));
      break;
    case "download":
      result = await client.downloadAsset(need(args[0], "download requires an asset ID"), flags.output ?? "");
      break;
    default:
      throw new AssetClientError(`Unknown command: ${command}`, { code: "usage_error" });
  }

  output(result, flags.json === true);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`kampung-assets: ${message}\n`);
    if (error instanceof AssetClientError && error.details && process.env.DEBUG) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
    process.exitCode = error instanceof AssetClientError && error.code === "usage_error" ? 2 : 1;
  });
}
