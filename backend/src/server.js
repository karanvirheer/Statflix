import multer from "multer";
const upload = multer({ dest: "uploads/" });
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import * as api from "./api/tmdb.js";
import * as helper from "./utils/helpers.js";
import * as db from "./db/db.js";
import * as stats from "./utils/logging.js";

dotenv.config();

/*
 * ==============================
 *           GLOBALS
 * ==============================
 */

// CSV should be in same folder
// const filePath = "./data/ViewingActivity.csv";
const filePath = "./data/big.csv";

// const filePath = "./data/tests/Test01_Empty.csv";
// const filePath = "./data/tests/Test02_WrongTitles.csv";
// const filePath = "./data/tests/Test03_ScoringTitles.csv";
// const filePath = "./data/tests/Test04_1000_Titles_TVShowsOnly.csv";
// const filePath = "./data/tests/Test05_MultipleUnique.csv";
// const filePath = "./data/tests/Test06_SavingHope_Only.csv";
// const filePath = "./data/tests/Test07_SavingHope_FullHouse.csv";
// const filePath = "./data/tests/Test08_WatchTime_Test.csv";

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
  //    posterPath: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  watchTimeByTitle: {},

  // dict
  // {
  //  title: {
  //    mediaType: "",
  //    posterPath: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  topWatchedTitles: {},

  // dict
  mostBingedShow: {
    title: "",
    posterPath: "",
    eps_binged: 0,
    dates_binged: [],
  },

  // dict
  mostWatchedTitle: {
    title: "",
    posterPath: "",
    minutes: 0,
  },

  // dict
  oldestWatchedShow: {
    title: "",
    posterPath: "",
    dateObject: null,
    date: "",
  },

  // dict
  oldestWatchedMovie: {
    title: "",
    posterPath: "",
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
let titleToData = {};

/*
 * ==============================
 *          MAIN FUNCTION
 * ==============================
 */

await main();

async function main() {
  console.log("!!!!!!!!!! STARTING !!!!!!!!!!!!!");
  // let result = await getTitleFromTMDB("Dark");
  // console.log(result);
  await parseCSV();
}

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
    (a, b) => b.popularity - a.popularity,
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
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {Promise<dict>} Information related to the title
 */
async function getData(normalizedTitle) {
  let result = {};

  // 1
  result = await db.getCachedResult(normalizedTitle);
  if (result) {
    // console.log("Method 1: EXIST");
    return result;
  }

  // 2
  // Pride & Prejudice edge case
  // The Office (U.S) edge case
  let searchTerm = normalizedTitle.replaceAll("&", "and");
  const index = searchTerm.indexOf("(");
  searchTerm = searchTerm.substring(0, index).trim();
  result = await db.getCachedResult(searchTerm);
  if (result) {
    // console.log("Method 2: AND SWAP");
    return result;
  }

  // 3
  // Search by progressively removing ":" keyword
  if (normalizedTitle.indexOf(":") > -1) {
    let titleChunks = normalizedTitle.trim().split(":");
    titleChunks.pop();
    while (titleChunks.length > 0) {
      const searchTerm = titleChunks.join("");
      result = await db.getBestTitleMatch(searchTerm);
      if (result) {
        // console.log("Method 3: TITLE SIMILARITY");
        return result;
      }
      titleChunks.pop();
    }
  }

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

      // Movie
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
    // await db.cacheResult(result);
    await new Promise((r) => setTimeout(r, 300));
    // console.log("Method 4: API CALL");

    return result;
  } else {
    stats.logMissedTitles(userStats, normalizedTitle);
  }

  return result;
}

function logUserStats(result, title) {
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
      title,
    );
  }

  stats.logOldestWatchedShowAndMovie(
    userStats,
    mediaType,
    result.release_date || result.first_air_date,
    title,
    titleToData,
  );
}

function printProgress(currRow) {
  console.log(`${currRow} / ${Object.keys(titleToDateFreq).length}`);
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
          if (!isNaN(date) && helper.isValidString(title)) {
            if (!titleToDateFreq[title]) {
              titleToDateFreq[title] = {
                datesWatched: [],
                titleFrequency: 0,
              };
              // stats.logUniqueTitlesWatched(userStats);
            }
            titleToDateFreq[title].titleFrequency += 1;
            titleToDateFreq[title].datesWatched.push(date);

            titleList.push(title);
            dateList.push(date);
          }
        }
      })
      .on("end", async () => {
        let currRow = 0;
        let tempTitleToDateFreq = {};
        try {
          for (const title of Object.keys(titleToDateFreq)) {
            let result = await getData(title);

            // Handle error from API
            if (!result) {
              continue;
            }

            const newTitle = result.normalized_title;

            // Combine same title data
            tempTitleToDateFreq = helper.updateTitleToDateFreq(
              title,
              newTitle,
              titleToDateFreq,
              tempTitleToDateFreq,
            );

            titleToData[newTitle] = result;

            currRow += 1;
            printProgress(currRow);
          }

          titleToDateFreq = tempTitleToDateFreq;

          for (const title of Object.keys(titleToDateFreq)) {
            const result = titleToData[title];

            await helper.logToFile(title, result);
            logUserStats(result, title);
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

// ========================================
import express from "express";
import cors from "cors";
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/stats", (req, res) => {
  res.json({
    topGenres: userStats.topGenres,
    numTotalUniqueTitlesWatched: userStats.numUniqueTitlesWatched.total,
    numUniqueTVShowsWatched: userStats.numUniqueTitlesWatched.tvShows,
    numUniqueMoviesWatched: userStats.numUniqueTitlesWatched.movies,
    totalWatchTimeMinutes: userStats.totalWatchTime,
    totalWatchTimeHours: userStats.totalWatchTime / 60,
    topWatchedTitles: userStats.topWatchedTitles,
    mostBingedShow: userStats.mostBingedShow,
    mostWatchedTitle: userStats.mostWatchedTitle,
    oldestWatchedShow: userStats.oldestWatchedShow,
    oldestWatchedMovie: userStats.oldestWatchedMovie,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
