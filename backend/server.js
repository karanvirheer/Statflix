import multer from "multer";
const upload = multer({ dest: "uploads/" });
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import * as api from "./tmdb.js";
import * as helper from "./helpers.js";
import * as db from "./db.js";
import * as stats from "./logging.js";

dotenv.config();

/*
 * ==============================
 *           GLOBALS
 * ==============================
 */

// CSV should be in same folder
// const filePath = "./ViewingActivity.csv";
const filePath = "./big.csv";

// const filePath = "./tests/Test01_Empty.csv";
// const filePath = "./tests/Test02_WrongTitles.csv";
// const filePath = "./tests/Test03_ScoringTitles.csv";
// const filePath = "./tests/Test04_1000_Titles_TVShowsOnly.csv";
// const filePath = "./tests/Test05_MultipleUnique.csv";

// User Statistics Cache
const userStats = {
  // dict
  // EVERY Genre the user has watched tallied up
  // { "Mystery": 30, "Horror": 20, ...}
  genres: {},

  // array
  // Top 3 Genres of User
  // [ [ 'Drama', 175 ], [ 'Comedy', 129 ], [ 'Romance', 64 ] ]
  topGenres: [],

  // int
  numUniqueTitlesWatched: {
    total: 0,
    tvShows: 0,
    movies: 0,
  },

  // int
  totalWatchTime: 0,

  // dict
  // {
  //  title: {
  //    mediaType: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  watchTimeByTitle: {},

  // dict
  // {
  //  title: {
  //    mediaType: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  topWatchedTitles: {},

  // dict
  mostBingedShow: {
    title: "",
    eps_binged: 0,
    dates_binged: [],
  },

  // dict
  mostWatchedTitle: {
    title: "",
    minutes: 0,
  },

  // dict
  oldestWatchedShow: {
    title: "",
    dateObject: null,
    date: "",
  },

  // dict
  oldestWatchedMovie: {
    title: "",
    dateObject: null,
    date: "",
  },

  // dict
  // { int, ... string (title) }
  showsCompleted: [0],

  missedTitles: {
    count: 0,
    titlesArr: [],
  },
};

let titleToDateFreq = {};
let titletoMediaType = {};

const manualOverrides = {
  fullhouse: { id: 4313, media_type: "tv", type: 0 }, // U.S. sitcom
  richinlove: { id: 656563, media_type: "movie", type: 1 }, // Ricos de Amor (2020)
  weddingseason: { id: 818612, media_type: "movie", type: 1 },
  theempress: { id: 131488, media_type: "tv", type: 0 },
  bananasplit: { id: 493058, media_type: "movie", type: 1 },
  heist: { id: 108139, media_type: "tv", type: 0 }, // Netflix docu-series
  you: { id: 78191, media_type: "tv", type: 0 },
  elite: { id: 76669, media_type: "tv", type: 0 },
  love: { id: 65988, media_type: "tv", type: 0 }, // Netflix's "Love" (Judd Apatow)
  dark: { id: 70523, media_type: "tv", type: 0 },
  bruised: { id: 654974, media_type: "movie", type: 1 }, // Halle Berry Netflix original
  curve: { id: 356094, media_type: "movie", type: 1 }, // horror with many name conflicts
  ratched: { id: 87108, media_type: "tv", type: 0 },
  arcane: { id: 94605, media_type: "tv", type: 0 },
  fate: { id: 117303, media_type: "tv", type: 0 }, // Fate: The Winx Saga
  candy: { id: 156002, media_type: "tv", type: 0 }, // often misrouted to 2006 horror
  bloodredsky: { id: 567189, media_type: "movie", type: 1 },
  bodies: { id: 205715, media_type: "tv", type: 0 }, // 2023 Netflix crime show
  atypical: { id: 71738, media_type: "tv", type: 0 },
  outerbanks: { id: 93484, media_type: "tv", type: 0 },
  lupin: { id: 96677, media_type: "tv", type: 0 },
  mindhunter: { id: 67744, media_type: "tv", type: 0 },
  afterlife: { id: 86374, media_type: "tv", type: 0 }, // Ricky Gervais
  theplatform: { id: 619592, media_type: "movie", type: 1 },
};

/*
 * ==============================
 *          MAIN FUNCTION
 * ==============================
 */

main();

async function main() {
  console.log("!!!!!!!!!! STARTING !!!!!!!!!!!!!");
  // await db.createTmdbTable().catch(console.error);
  // await parseKaggleShowDataset();
  // await parseKaggleMovieDataset();
  await parseCSV();
  // console.log("!!!!!!!!!! ENDING !!!!!!!!!!!!!");
}

function basicTitleSimilarity(titleA, titleB) {
  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, " ")
      .split(/\s+/)
      .filter(Boolean);
  const setA = new Set(normalize(titleA));
  const setB = new Set(normalize(titleB));
  const intersection = [...setA].filter((word) => setB.has(word));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

async function findBestMatchedTitle(normalizedTitle) {
  let bestCandidate = null;
  let bestScore = -Infinity;

  if (manualOverrides[normalizedTitle]) {
    const override = manualOverrides[normalizedTitle];
    titletoMediaType[normalizedTitle] = override.type;
    return override.media_type === "tv"
      ? await api.getTVDetails(override.id)
      : await api.getMovieDetails(override.id);
  }

  const titleChunks = normalizedTitle.split(" ");
  let topCandidates = [];

  // 1. Get Top Results from TMDb
  while (titleChunks.length > 0) {
    const searchTerm = titleChunks.join(" ");
    const results = (await api.searchTVAndMovie(searchTerm))?.results || [];

    topCandidates = results
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 10); // Grab top 10 to give Netflix priority

    if (topCandidates.length > 0) break;
    normalizedTitle;
    titleChunks.pop(); // Trim title and retry
  }

  // 2. Score Candidates
  for (const result of topCandidates) {
    const candidateTitle = result.title || result.name || "";
    const mediaType = result.media_type;
    const similarity = basicTitleSimilarity(candidateTitle, normalizedTitle);
    const exactMatch =
      candidateTitle.toLowerCase() === normalizedTitle.toLowerCase();
    const releaseYear =
      parseInt(
        (result.release_date || result.first_air_date || "")?.slice(0, 4),
      ) || 0;

    const wp =
      mediaType === "tv"
        ? await api.searchTVWatchProvider(result.id)
        : await api.searchMovieWatchProvider(result.id);

    const netflixAvailable = helper.isAvailableOnNetflix(wp);
    const isOnMajor = helper.isOnMajorPlatform(wp);
    const isEnglish = result.original_language === "en";
    const isFromUS = result.origin_country?.includes("US");
    const isFromUK = result.origin_country?.includes("GB");

    // Filters
    if (!isEnglish && !netflixAvailable) continue;
    if ((result.vote_count ?? 0) === 0 && !netflixAvailable) continue;
    if (releaseYear < 1990 && !netflixAvailable) continue;
    if (similarity < 0.1 && !exactMatch) continue;

    // Scoring
    const score =
      (exactMatch ? 300 : 0) +
      similarity * 100 +
      (netflixAvailable ? 500 : 0) +
      (isOnMajor ? 200 : 0) +
      (isEnglish ? 200 : -400) +
      (isFromUS ? 150 : isFromUK ? 75 : 0) +
      (releaseYear >= 2020 ? 100 : releaseYear >= 2010 ? 50 : 0) +
      (result.vote_average ?? 0) * 7 +
      Math.min(result.vote_count ?? 0, 50) +
      (result.popularity ?? 0) * 2;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = result;
      let titleType = mediaType === "movie" ? 1 : 0;
    }
  }

  // 3. Fallback (TV or Movie Only)
  if (!bestCandidate) {
    const [tvOut, movieOut] = await Promise.all([
      api.searchTVShow(normalizedTitle),
      api.searchMovie(normalizedTitle),
    ]);

    const fallbackResults = [
      ...(tvOut?.results?.slice(0, 1) || []).map((r) => ({
        ...r,
        media_type: "tv",
      })),
      ...(movieOut?.results?.slice(0, 1) || []).map((r) => ({
        ...r,
        media_type: "movie",
      })),
    ];

    for (const result of fallbackResults) {
      const candidateTitle = result.title || result.name || "";
      const similarity = basicTitleSimilarity(candidateTitle, normalizedTitle);
      const exactMatch =
        candidateTitle.toLowerCase() === normalizedTitle.toLowerCase();
      const releaseYear =
        parseInt(
          (result.release_date || result.first_air_date || "")?.slice(0, 4),
        ) || 0;

      const wp =
        result.media_type === "tv"
          ? await api.searchTVWatchProvider(result.id)
          : await api.searchMovieWatchProvider(result.id);

      const netflixAvailable = helper.isAvailableOnNetflix(wp);
      const isOnMajor = helper.isOnMajorPlatform(wp);
      const isEnglish = result.original_language === "en";
      const isFromUS = result.origin_country?.includes("US");
      const isFromUK = result.origin_country?.includes("GB");

      if (!isEnglish && !netflixAvailable) continue;
      if (releaseYear < 1990 && !netflixAvailable) continue;
      if (similarity < 0.1 && !exactMatch) continue;

      const score =
        (exactMatch ? 300 : 0) +
        similarity * 100 +
        (netflixAvailable ? 500 : 0) +
        (isOnMajor ? 200 : 0) +
        title(isEnglish ? 200 : -400) +
        (isFromUS ? 150 : isFromUK ? 75 : 0) +
        (releaseYear >= 2020 ? 100 : releaseYear >= 2010 ? 50 : 0) +
        (result.vote_average ?? 0) * 7 +
        Math.min(result.vote_count ?? 0, 50) +
        (result.popularity ?? 0) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = result;
        titleType = result.media_type === "movie" ? 1 : 0;
      }
    }
  }

  // titletoMediaType[normalizedTitle] = titleType;
  if (bestCandidate) {
    if (bestCandidate.media_type === "movie") {
      return await api.getMovieDetails(bestCandidate.id);
    } else {
      return await api.getTVDetails(bestCandidate.id);
    }
  } else {
    return null;
  }
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {Promise<dict>} Information related to the title
 */
async function getData(normalizedTitle) {
  let result = {};

  // 1
  // Search with episodic keywords removed
  result = await db.getCachedResult(normalizedTitle);
  if (result) {
    // helper.print(`CACHE HIT: ${normalizedTitle}`);
    return result;
  }

  // result = await db.getBestTitleMatch(normalizedTitle);
  // if (result) {
  //   helper.print(`${normalizedTitle}`);
  //   return result;
  // }

  // 2
  // Search by progressively removing ":" keyword
  let titleChunks = normalizedTitle.trim().split(":");
  while (titleChunks.length > 0) {
    const searchTerm = titleChunks.join("");
    result = await db.getBestTitleMatch(searchTerm);
    if (result) {
      // helper.print(`${normalizedTitle}`);
      return result;
    }
    titleChunks.pop();
  }

  // 3
  // Pride & Prejudice edge case
  // The Office (U.S) edge case
  let searchTerm = normalizedTitle.replaceAll("&", "and");
  const index = searchTerm.indexOf("(");
  searchTerm = searchTerm.substring(0, index).trim();
  result = await db.getCachedResult(searchTerm);
  if (result) {
    return result;
  }

  result = await findBestMatchedTitle(normalizedTitle);
  if (result) {
    helper.print(`${normalizedTitle}`);
    return result;
  } else {
    userStats.numUniqueTitlesWatched.total -= 1;
    stats.logMissedTitles(userStats, normalizedTitle);
  }

  // let detailsData = {};
  // helper.print(`${normalizedTitle}`);
  // let match = await findBestMatchedTitle(normalizedTitle, originalTitle);
  // if (match) {
  //   if (match.media_type == "tv") {
  //     detailsData = await api.getTVDetails(match.id);
  //     result = {
  //       normalized_title: normalizedTitle || null,
  //       original_title: originalTitle || null,
  //       tmdb_id: detailsData.id || null,
  //       mediaType: 0,
  //       genres: detailsData.genres || null,
  //       runtime: null,
  //       number_of_episodes: detailsData.number_of_episodes || null,
  //       episode_run_time: await helper.getEpisodeRunTime(detailsData),
  //       release_date: null,
  //       first_air_date: detailsData.first_air_date || null,
  //       poster_path: detailsData.poster_path || null,
  //     };
  //
  //     // Movie
  //   } else {
  //     detailsData = await api.getMovieDetails(match.id);
  //     result = {
  //       normalized_title: normalizedTitle || null,
  //       original_title: originalTitle || null,
  //       tmdb_id: detailsData.id || null,
  //       mediaType: 1,
  //       genres: detailsData.genres || null,
  //       runtime: detailsData.runtime || null,
  //       number_of_episodes: null,
  //       episode_run_time: null,
  //       release_date: detailsData.release_date || null,
  //       first_air_date: null,
  //       poster_path: detailsData.poster_path || null,
  //     };
  //   }
  //   await db.cacheResult(result);
  // }
  // await new Promise((r) => setTimeout(r, 300));
  // Optional delay to avoid hammering the API in case of no result
  // Pause execution until the Promise is resolved
  // (r) => (r, 300) Means pause for 300ms everytime then resolve the Promise

  return result;
}

function logUserStats(result, normalizedTitle) {
  const titleFrequency = helper.getTitleWatchFrequency(
    titleToDateFreq,
    normalizedTitle,
  );
  const runtime = result?.runtime || result?.episode_run_time || 45;
  const timeWatched = runtime * titleFrequency;
  const mediaType = result.media_type;

  if (result.genres !== null || result.genres?.length > 0) {
    stats.logTopGenres(userStats, result.genres);
  }

  stats.logUniqueShowsAndMovies(userStats, mediaType);
  stats.logWatchTime(userStats, normalizedTitle, mediaType, timeWatched);
  stats.logTopWatchedTitles(userStats);
  stats.logMostWatchedTitle(userStats);
  stats.logMostBingedShow(userStats, titleToDateFreq);

  if (mediaType == 0) {
    stats.logNumShowsCompleted(
      titleToDateFreq,
      userStats,
      result.number_of_episodes,
      normalizedTitle,
    );
  }

  stats.logOldestWatchedShowAndMovie(
    userStats,
    mediaType,
    result.release_date || result.first_air_date,
    result.normalized_title,
  );
}

/**
 * Parses users NetflixViewingActivity CSV file.
 * Extracts searchable TMDb titles and parses dates when user watched the title.
 *
 * @async
 * @function
 * @returns null
 *
 * @throws Will reject the promise if an error occurs during CSV parsing or API calls.
 */
function parseCSV() {
  const titleList = [];
  const dateList = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        // Normalize and check the headers
        const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

        const isValid =
          normalizedHeaders.length === 2 &&
          normalizedHeaders.includes("title") &&
          normalizedHeaders.includes("date");

        if (!isValid) {
          console.error(
            "CSV is invalid. It must contain only 'Title' and 'Date' columns.",
          );
          process.exit(1); // Stop execution if format is wrong
        } else {
          console.log("CSV is valid.");
        }
      })
      .on("data", (row) => {
        // Check for empty cells
        if (helper.isValidString(row.Title) && helper.isValidString(row.Date)) {
          const title = helper.removeEpisodicKeywords(row.Title);
          const date = helper.getDate(row.Date);

          // Check if Date was properly formatted
          if (!isNaN(date)) {
            // titletoMediaType[normalizedTitle] = mediaType;

            if (!titleToDateFreq[title]) {
              titleToDateFreq[title] = {
                datesWatched: [],
                titleFrequency: 0,
              };
              stats.logUniqueTitlesWatched(userStats);
            }
            titleToDateFreq[title].titleFrequency += 1;
            titleToDateFreq[title].datesWatched.push(date);

            titleList.push(title);
            dateList.push(date);
          }
        }
      })
      .on("end", async () => {
        try {
          for (const title of Object.keys(titleToDateFreq)) {
            let result = await getData(title);

            if (result) {
              logUserStats(result, result.normalized_title);
            }
          }

          console.log("✅ CSV processing done.");

          // =========================
          // STATISTICS FUNCTION CALLS
          // =========================
          stats.printUserStats(userStats);

          resolve({ titleList, dateList });
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function parseKaggleMovieDataset() {
  const idList = [];
  const titleList = [];

  let kaggleMovieDict = {};

  const kaggleMovieFilePath = "./kaggle/movies_dataset.csv";

  return new Promise((resolve, reject) => {
    fs.createReadStream(kaggleMovieFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const showID = row.show_id;
        const title = row.title;

        if (helper.isValidString(showID) && helper.isValidString(title)) {
          kaggleMovieDict[showID] = {
            normalizedTitle: helper.getBaseTitle(title),
            originalTitle: title,
          };

          idList.push(showID);
          titleList.push(title);
        }
      })
      .on("end", async () => {
        try {
          for (const showID of Object.keys(kaggleMovieDict)) {
            const csvData = kaggleMovieDict[showID];
            let detailsData = await api.getMovieDetails(showID);
            let result = {
              normalized_title: csvData.normalizedTitle || null,
              original_title: csvData.originalTitle || null,
              tmdb_id: showID || null,
              media_type: 1,
              genres: detailsData.genres || null,
              runtime: detailsData.runtime || null,
              number_of_episodes: null,
              episode_run_time: null,
              release_date: detailsData.release_date || null,
              first_air_date: null,
              poster_path: detailsData.poster_path || null,
            };
            await db.cacheResult(result);

            helper.print(`LOGGED: ${csvData.normalizedTitle}`);
            await new Promise((r) => setTimeout(r, 300));
          }

          console.log("✅ Kaggle Movie Dataset processing done.");

          resolve({ idList, titleList });
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function parseKaggleShowDataset() {
  const idList = [];
  const titleList = [];

  let kaggleShowDict = {};

  const kaggleShowFilePath = "./kaggle/shows_dataset.csv";

  return new Promise((resolve, reject) => {
    fs.createReadStream(kaggleShowFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const showID = row.show_id;
        const title = row.title;

        if (helper.isValidString(showID) && helper.isValidString(title)) {
          kaggleShowDict[showID] = {
            normalizedTitle: helper.getBaseTitle(title),
            originalTitle: title,
          };

          idList.push(showID);
          titleList.push(title);
        }
      })
      .on("end", async () => {
        try {
          for (const showID of Object.keys(kaggleShowDict)) {
            const csvData = kaggleShowDict[showID];
            let detailsData = await api.getTVDetails(showID);
            let result = {
              normalized_title: csvData.normalizedTitle || null,
              original_title: csvData.originalTitle || null,
              tmdb_id: showID || null,
              media_type: 0,
              genres: detailsData.genres || null,
              runtime: null,
              number_of_episodes: detailsData.number_of_episodes || null,
              episode_run_time: await helper.getEpisodeRunTime(detailsData),
              release_date: null,
              first_air_date: detailsData.first_air_date || null,
              poster_path: detailsData.poster_path || null,
            };
            await db.cacheResult(result);
            helper.print(`LOGGED: ${csvData.normalizedTitle}`);
            await new Promise((r) => setTimeout(r, 300));
          }

          console.log("✅ Kaggle TV Show Dataset processing done.");

          resolve({ idList, titleList });
        } catch (error) {
          reject(error);
        }
      });
  });
}

// ========================================
import express from "express";
import cors from "cors";
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/stats", (req, res) => {
  const mostWatched = Object.entries(userStats.watchTimeByTitle).sort(
    (a, b) => b[1].minutes - a[1].minutes,
  )[0];

  const top5Titles = Object.entries(userStats.watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5)
    .map(([key, val]) => [val.original, val.minutes]);

  res.json({
    topGenres: userStats.topGenres,
    uniqueTitles: userStats.numUniqueTitlesWatched.size,
    totalWatchTimeMinutes: userStats.totalWatchTime,
    totalWatchTimeHours: userStats.totalWatchTime / 60,
    topTitles: top5Titles,
    mostWatched: {
      title: mostWatched?.[1].original || "",
      minutes: mostWatched?.[1].minutes || 0,
    },
    mostBinged: {
      title:
        userStats.watchTimeByTitle[userStats.mostBingedShow]?.original ||
        userStats.mostBingedShow ||
        "N/A",
      streak: userStats.longest_binge_streak || 0,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
