#!/usr/bin/env node
import fs from "fs";

const MAX_YEAR = 2020;
const MIN_YEAR = -100; // 100 v. Chr.

const data = JSON.parse(fs.readFileSync(new URL("./geschichte.json", import.meta.url), "utf8"));
const history = data.articles || [];
const outOfRange = history.filter((item) => item.year < MIN_YEAR || item.year > MAX_YEAR);

console.log(
  `History entries: ${history.length} (gültig: ${history.length - outOfRange.length}, ausserhalb: ${outOfRange.length})`
);

if (history.length !== 5) {
  console.error("Verteilung fehlerhaft: erwartet genau 5 Artikel in geschichte.json.");
  process.exit(1);
}

if (outOfRange.length > 0) {
  console.error(
    `Folgende IDs liegen ausserhalb des Bereichs ${MAX_YEAR} bis ${Math.abs(MIN_YEAR)} v. Chr.: ${outOfRange
      .map((item) => item.id)
      .join(", ")}`
  );
  process.exit(1);
}
