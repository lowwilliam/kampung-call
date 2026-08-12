#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AssetClient, AssetClientError } from "../tooling/asset-client.mjs";

const booleanFlags = new Set(["json", "help", "display-linkedin", "allow-download", "yes-rights", "yes"]);

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
  list [--query TEXT] [--collection all|game|community] [--category NAME]
  get <asset-id>
  download <asset-id> [-o FILE]
  upload <model.glb> --metadata submission.json --yes-rights [--allow-download]
  upload <model.glb> --name NAME --contributor NAME --description TEXT \\
    --singapore-connection TEXT --source NAME --yes-rights [--allow-download]
  status <receipt-or-receipt-url>
  replace <receipt> <model.glb>
  withdraw <receipt> --yes

Environment:
  KAMPUNG_ASSET_API_URL    Default site origin (defaults to http://localhost:3000)
  KAMPUNG_ASSET_API_TOKEN  Optional bearer token for protected deployments

Asset IDs are namespaced, for example game:peranakan-house or community:<uuid>.
The recovery receipt returned by upload is required to inspect, replace or withdraw a submission.`;
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

async function uploadMetadata(flags) {
  let metadata = {};
  if (flags.metadata) {
    const metadataPath = path.resolve(flags.metadata);
    metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  }
  return {
    ...metadata,
    displayName: flags.name ?? metadata.displayName,
    contributorName: flags.contributor ?? metadata.contributorName,
    description: flags.description ?? metadata.description,
    singaporeConnection: flags["singapore-connection"] ?? metadata.singaporeConnection,
    sourceName: flags.source ?? metadata.sourceName,
    sourceUrl: flags["source-url"] ?? metadata.sourceUrl ?? "",
    category: flags.category ?? metadata.category ?? "Street Life & Nature",
    linkedinUrl: flags.linkedin ?? metadata.linkedinUrl ?? "",
    displayLinkedin: flags["display-linkedin"] ?? metadata.displayLinkedin ?? false,
    allowDownload: flags["allow-download"] ?? metadata.allowDownload ?? false,
    rightsAttested: flags["yes-rights"] === true,
  };
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
    case "upload":
      result = await client.uploadAsset(need(args[0], "upload requires a .glb file"), await uploadMetadata(flags));
      break;
    case "status":
      result = await client.getSubmission(need(args[0], "status requires a recovery receipt"));
      break;
    case "replace":
      result = await client.replaceSubmission(
        need(args[0], "replace requires a recovery receipt"),
        need(args[1], "replace requires a .glb file"),
      );
      break;
    case "withdraw":
      if (!flags.yes) throw new AssetClientError("withdraw is destructive; rerun with --yes", { code: "confirmation_required" });
      result = await client.withdrawSubmission(need(args[0], "withdraw requires a recovery receipt"));
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
