import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: npm run words:validate -- path/to/pool.json");
const resolved = path.resolve(input);
const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
if (!Array.isArray(parsed)) throw new Error("Pool file must contain a JSON array.");
const words = parsed.map((entry) => typeof entry === "string" ? entry : (entry as { word?: unknown }).word);
const invalid = words.filter((word) => typeof word !== "string" || !/^[A-Z]{5}$/.test(word));
const unique = new Set(words);
if (parsed.length !== 2048) throw new Error(`A publishable active pool must contain exactly 2,048 entries; received ${parsed.length}.`);
if (invalid.length) throw new Error(`Pool contains ${invalid.length} malformed entries.`);
if (unique.size !== parsed.length) throw new Error(`Pool contains ${parsed.length - unique.size} duplicate entries.`);
console.log(JSON.stringify({ valid: true, entries: parsed.length, file: resolved }, null, 2));
