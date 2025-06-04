import Database from "better-sqlite3";
const db = new Database("./sqlite/tmdb.sqlite", { readonly: true });
import stringSimilarity from "string-similarity";

export async function getBestTitleMatch(normalizedTitle) {
  const stmt = db.prepare(`SELECT normalized_title FROM tmdb_titles`);
  const rows = stmt.all();
  const titles = rows.map((r) => r.normalized_title);

  const { bestMatch } = stringSimilarity.findBestMatch(normalizedTitle, titles);

  if (bestMatch.rating > 0.9) {
    const resultStmt = db.prepare(
      `SELECT * FROM tmdb_titles WHERE normalized_title = ?`,
    );
    const match = resultStmt.get(bestMatch.target);
    return match;
  }

  return null;
}

export function getCachedResult(normalizedTitle) {
  const row = db
    .prepare(
      `SELECT * FROM tmdb_titles WHERE normalized_title = ? COLLATE NOCASE`,
    )
    .get(normalizedTitle);
  return row || null;
}
