import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import assert from "node:assert/strict";

const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
const url = "https://admin.boardgamers.space/api/admin/gameinfo/vanuatu/meta";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const beforeResponse = await fetch(url, { headers });
assert(beforeResponse.ok, `Metadata read: ${beforeResponse.status}`);
const before = await beforeResponse.json();
const tags = [...new Set([...(before.tags ?? []), "role-selection"])];
const response = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ tags }) });
assert(response.ok, `Tags update: ${response.status}`);
const afterResponse = await fetch(url, { headers });
assert(afterResponse.ok, `Metadata verification: ${afterResponse.status}`);
const after = await afterResponse.json();
assert.deepEqual(after.tags, tags);
for (const [key, value] of Object.entries(before)) {
  if (!["tags", "updatedAt"].includes(key)) assert.deepEqual(after[key], value, key);
}
console.log(JSON.stringify({ game: "vanuatu", tags }));
