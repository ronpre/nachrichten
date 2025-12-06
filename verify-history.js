#!/usr/bin/env node
import fs from "fs";

const data = JSON.parse(fs.readFileSync(new URL("./news.json", import.meta.url), "utf8"));
const history = data.categories?.history || [];
const modernEntries = history.filter((item) => item.year >= 1800);
const pre1800Entries = history.filter((item) => item.year < 1800);

console.log(
  `History entries: ${history.length} (modern >=1800: ${modernEntries.length}, vor 1800: ${pre1800Entries.length})`
);

if (modernEntries.length !== 4 || pre1800Entries.length !== 1) {
  console.error("Verteilung fehlerhaft: erwartet 4 moderne + 1 vor 1800.");
  process.exit(1);
}
