import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import multer from "multer";
import * as api from "./api/tmdb.js";
import * as helper from "./utils/helpers.js";
import * as db from "./db/sqlite.js";
import * as stats from "./utils/logging.js";
import {
  updateProgress,
  progressState,
  resetProgress,
} from "./state/progress.js";
import { sessionCache } from "./state/sessionCache.js";

import express from "express";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 3001;

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";
const posterUrlFromPath = (posterPath) =>
  posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;

// Ensure uploads directory exists (absolute, stable path)
const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

let controller = null;

/*
 * ==============================
 *          TMDB MATCHING
 * ==============================
 */

async function getTitleFromTMDB(normalizedTitle) {
  let topCandidates = [];
  let result = null;

  // Find MAX 10 Results for the Title on TMDB
  let titleChunks = normalizedTitle.trim().split(":");
  while (titleChunks.length > 0) {
    const searchTerm = helper.removeNonAlphaNumeric(titleChunks.join(""));
    const results = (await api.searchTVAndMovie(searchTerm))?.results || [];

    topCandidates = results
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 10);

    if (topCandidates.length > 0) break;
    titleChunks.pop();
  }

  let sortedByPopularity = topCandidates.sort(
    (a, b) => b.popularity - a.popularity
  );

  let highestScore = 0;
  let highestTitle = {};
  for (let title of sortedByPopularity) {
    let wp =
      title.media_type === "tv"
        ? await api.searchTVWatchProvider(title.id)
        : await api.searchMovieWatchProvider(title.id);

    let isAvailableOnNetflix = await helper.isAvailableOnNetflix(wp);
    let score =
      (title?.popularity * 100 || 0) +
      (title?.vote_count * 2 || 0) +
      (isAvailableOnNetflix * 100 || 0);

    if (score > highestScore) {
      highestScore = score;
      highestTitle = title;
    }
  }

  let topChoice = highestTitle;

  if (topChoice) {
    result =
      topChoice.media_type === "movie"
        ? await api.getMovieDetails(topChoice.id)
        : await api.getTVDetails(topChoice.id);

    // Handle error from API
    if (!result) {
      return false;
    }

    result.media_type = topChoice?.media_type;
  }

  return result;
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} normalizedTitle - TMDb Searchable Title
 * @returns {Promise<object>} Information related to the title
 */
async function getData(normalizedTitle, userStats) {
  let result = {};

  // 1) SQLite cache
  result = db.getCachedResult(normalizedTitle);
  if (result) return result;

  // 1b) in-memory session cache
  if (sessionCache.has(normalizedTitle)) {
    return sessionCache.get(normalizedTitle);
  }

  // 2) edge cases: & -> and, strip (...) etc
  let searchTerm = normalizedTitle.replaceAll("&", "and");
  const index = searchTerm.indexOf("(");
  if (index !== -1) searchTerm = searchTerm.substring(0, index).trim();

  result = db.getCachedResult(searchTerm);
  if (result) return result;

  if (sessionCache.has(searchTerm)) {
    return sessionCache.get(searchTerm);
  }

  // 3) progressively remove ":" chunks and try fuzzy match in DB
  if (normalizedTitle.indexOf(":") > -1) {
    let titleChunks = normalizedTitle.trim().split(":");
    titleChunks.pop();
    while (titleChunks.length > 0) {
      const chunkTerm = titleChunks.join("");
      result = await db.getBestTitleMatch(chunkTerm);
      if (result) return result;

      if (sessionCache.has(chunkTerm)) return sessionCache.get(chunkTerm);
      titleChunks.pop();
    }
  }

  // 4) live TMDb search
  let match = await getTitleFromTMDB(normalizedTitle);
  if (match) {
    if (match.media_type == "tv") {
      result = {
        normalized_title: match.name || null,
        original_title: match.original_name || null,
        tmdb_id: match.id || null,
        media_type: 0,
        genres: match.genres || null,
        runtime: null,
        number_of_episodes: match.number_of_episodes || null,
        episode_run_time: await helper.getEpisodeRunTime(match),
        release_date: null,
        first_air_date: match.first_air_date || null,
        poster_path: match.poster_path || null,
      };
    } else {
      result = {
        normalized_title: match.title || null,
        original_title: match.original_title || null,
        tmdb_id: match.id || null,
        media_type: 1,
        genres: match.genres || null,
        runtime: match.runtime || null,
        number_of_episodes: null,
        episode_run_time: null,
        release_date: match.release_date || null,
        first_air_date: null,
        poster_path: match.poster_path || null,
      };
    }

    // Save to in-memory session cache for this run
    sessionCache.set(normalizedTitle, result);

    // tiny delay to be nice to TMDb
    await new Promise((r) => setTimeout(r, 300));
    return result;
  } else {
    stats.logMissedTitles(userStats, normalizedTitle);
  }

  return result;
}

/*
 * ==============================
 *          STATS LOGGING
 * ==============================
 */

function logUserStats(userStats, result, title, titleToDateFreq, titleToData) {
  const titleFrequency = helper.getTitleWatchFrequency(titleToDateFreq, title);
  const runtime = result?.runtime || result?.episode_run_time || 45;
  const timeWatched = runtime * titleFrequency;
  const mediaType = result.media_type;

  if (result.genres !== null || result.genres?.length > 0) {
    stats.logTopGenres(userStats, result.genres);
  }

  stats.logUniqueTitlesWatched(userStats);
  stats.logUniqueShowsAndMovies(userStats, mediaType);
  stats.logWatchTime(userStats, title, mediaType, timeWatched, titleToData);
  stats.logTopWatchedTitles(userStats);
  stats.logMostWatchedTitle(userStats, titleToData);
  stats.logMostBingedShow(userStats, titleToDateFreq, titleToData);

  if (mediaType == 0) {
    stats.logNumShowsCompleted(
      titleToDateFreq,
      userStats,
      result.number_of_episodes,
      title
    );
  }

  stats.logOldestWatchedShowAndMovie(
    userStats,
    mediaType,
    result.release_date || result.first_air_date,
    title,
    titleToData
  );
}

function printProgress(currRow, title, total) {
  updateProgress(currRow, total, title);
  console.log(`${currRow} / ${total}`);
}

/*
 * ==============================
 *          CSV PARSER
 * ==============================
 */

function parseCSV(filePath, titleToDateFreq, titleToData, userStats, signal) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

        const isValid =
          normalizedHeaders.length === 2 &&
          normalizedHeaders.includes("title") &&
          normalizedHeaders.includes("date");

        if (!isValid) {
          console.error(
            "CSV is invalid. It must contain only 'Title' and 'Date' columns."
          );
          return reject(
            new Error("Invalid CSV headers (expected: Title, Date).")
          );
        } else {
          console.log("CSV is valid.");
        }
      })
      .on("data", (row) => {
        // NOTE: Netflix export headers are usually "Title" and "Date"
        if (helper.isValidString(row.Title) && helper.isValidString(row.Date)) {
          const title = helper.removeEpisodicKeywords(row.Title);
          const date = helper.getDate(row.Date);

          if (!isNaN(date) && helper.isValidString(title)) {
            if (!titleToDateFreq[title]) {
              titleToDateFreq[title] = {
                datesWatched: [],
                titleFrequency: 0,
              };
            }
            titleToDateFreq[title].titleFrequency += 1;
            titleToDateFreq[title].datesWatched.push(date);
          }
        }
      })
      .on("end", async () => {
        let currRow = 0;
        let tempTitleToDateFreq = {};
        let tempTitleToData = {};

        try {
          for (const title of Object.keys(titleToDateFreq)) {
            if (signal?.aborted) {
              console.warn("Aborted inside parseCSV loop");
              return reject(new Error("Aborted"));
            }

            let result = await getData(title, userStats);
            if (!result) continue;

            const newTitle = result.normalized_title;

            tempTitleToDateFreq = helper.updateTitleToDateFreq(
              title,
              newTitle,
              titleToDateFreq,
              tempTitleToDateFreq
            );

            tempTitleToData[newTitle] = result;
            currRow += 1;
            printProgress(currRow, title, Object.keys(titleToDateFreq).length);
          }

          // Replace outer refs
          Object.keys(titleToDateFreq).forEach(
            (key) => delete titleToDateFreq[key]
          );
          Object.assign(titleToDateFreq, tempTitleToDateFreq);

          Object.assign(titleToData, tempTitleToData);

          console.log("✅ CSV processing done.");
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (err) => reject(err));
  });
}

export async function main(filePath, signal) {
  if (signal?.aborted) throw new Error("Aborted before start");

  const userStats = helper.createEmptyUserStats();
  let titleToDateFreq = {};
  let titleToData = {};

  await parseCSV(filePath, titleToDateFreq, titleToData, userStats, signal);

  for (const title of Object.keys(titleToDateFreq)) {
    if (signal?.aborted) throw new Error("Aborted by user");
    const result = titleToData[title];
    logUserStats(userStats, result, title, titleToDateFreq, titleToData);
  }

  helper.enablePrintCapture();
  stats.printUserStats(userStats);
  helper.disablePrintCapture();
  const captured = helper.getCapturedOutput();

  return { userStats, captured };
}

/*
 * ==============================
 *     ENHANCE JSON FOR UI
 * ==============================
 */

function enhanceUserStatsForFrontend(userStats) {
  if (!userStats || typeof userStats !== "object") return userStats;

  // watchTimeByTitle: { [title]: { minutes, mediaType, posterPath } }
  if (
    userStats.watchTimeByTitle &&
    typeof userStats.watchTimeByTitle === "object"
  ) {
    for (const t of Object.keys(userStats.watchTimeByTitle)) {
      const v = userStats.watchTimeByTitle[t];
      if (v && typeof v === "object" && "posterPath" in v) {
        v.posterUrl = posterUrlFromPath(v.posterPath);
      }
    }
  }

  // topWatchedTitles: [ [title, {minutes, posterPath, ...}], ... ]
  if (Array.isArray(userStats.topWatchedTitles)) {
    userStats.topWatchedTitles.forEach((pair) => {
      const data = pair?.[1];
      if (data && typeof data === "object" && "posterPath" in data) {
        data.posterUrl = posterUrlFromPath(data.posterPath);
      }
    });
  }

  // mostWatchedTitle: { title, minutes, posterPath }
  if (
    userStats.mostWatchedTitle &&
    typeof userStats.mostWatchedTitle === "object"
  ) {
    userStats.mostWatchedTitle.posterUrl = posterUrlFromPath(
      userStats.mostWatchedTitle.posterPath
    );
  }

  // oldestShow / oldestMovie: { title, date, data: { posterPath, ... } }
  if (userStats.oldestShow?.data?.posterPath) {
    userStats.oldestShow.data.posterUrl = posterUrlFromPath(
      userStats.oldestShow.data.posterPath
    );
  }
  if (userStats.oldestMovie?.data?.posterPath) {
    userStats.oldestMovie.data.posterUrl = posterUrlFromPath(
      userStats.oldestMovie.data.posterPath
    );
  }

  // Give frontend the base too (optional)
  userStats.tmdbImageBase = TMDB_IMAGE_BASE;

  return userStats;
}

function resolveSampleCsvPath() {
  const candidates = [
    path.resolve(process.cwd(), "data", "sample.csv"),
    path.resolve(process.cwd(), "backend", "data", "sample.csv"),
    path.resolve(process.cwd(), "data", "sample-backup.csv"),
    path.resolve(process.cwd(), "backend", "data", "sample-backup.csv"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/*
 * ==============================
 *            API
 * ==============================
 */

const app = express();

const allowedOrigins = [
  "https://statflix-lake.vercel.app",
  "http://localhost:3000",
  "https://statflix-mmqcz2iwv-karanvir-heers-projects.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/api/sample", async (req, res) => {
  controller = new AbortController();
  const signal = controller.signal;

  resetProgress();
  updateProgress(0, 1);

  try {
    const filePath = resolveSampleCsvPath();
    if (!filePath) {
      return res.status(500).json({
        error: "Sample CSV not found. Expected data/sample.csv",
      });
    }

    const { userStats, captured } = await main(filePath, signal);

    // Store for later /api/stats + /api/stats-json calls
    app.locals.statsOutput = captured;
    app.locals.userStats = enhanceUserStatsForFrontend(userStats);

    return res.json({ message: "Sample processed." });
  } catch (err) {
    console.error("❌ Sample handler error:", err);
    if (res.headersSent) return;
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/progress", (req, res) => {
  res.json(progressState);
});

app.get("/api/stats", (req, res) => {
  const output = app.locals.statsOutput || "No output generated yet.";

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return res.type("text/plain").send(output);
});

app.get("/api/stats-json", (req, res) => {
  const s = app.locals.userStats || null;
  if (!s) return res.status(404).json({ error: "No stats generated yet." });

  res.setHeader("Cache-Control", "no-store");
  return res.json(s);
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  controller = new AbortController();
  const signal = controller.signal;

  resetProgress();
  updateProgress(0, 1);

  if (!req.file?.path) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;

  try {
    const { userStats, captured } = await main(filePath, signal);

    app.locals.statsOutput = captured;
    app.locals.userStats = enhanceUserStatsForFrontend(userStats);

    // cleanup
    try {
      fs.unlinkSync(filePath);
    } catch {}

    return res.json({ message: "Parsed successfully" });
  } catch (err) {
    console.error("❌ Upload handler error:", err);

    // cleanup if possible
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    if (res.headersSent) return;
    return res.status(500).json({ error: "Error parsing CSV file." });
  }
});

app.post("/api/reset", (req, res) => {
  if (controller) {
    controller.abort();
    controller = null;
  }
  resetProgress();
  app.locals.statsOutput = null;
  app.locals.userStats = null;
  return res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
