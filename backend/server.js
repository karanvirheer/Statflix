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
const filePath = "./ViewingActivity.csv";
// const filePath = "./big.csv";

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

async function getMostPopular(normalizedTitle) {
  const titleChunks = normalizedTitle.split(" ");
  let topCandidates = [];

  // Get Top Results from TMDb
  while (titleChunks.length > 0) {
    const searchTerm = titleChunks.join(" ");
    const results = (await api.searchTVAndMovie(searchTerm))?.results || [];

    topCandidates = results
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 10);

    if (topCandidates.length > 0) break;
    titleChunks.pop();
  }
  let topChoice = topCandidates.sort((a, b) => b.popularity - a.popularity)[0];

  let result =
    topChoice.media_type === "movie"
      ? await api.getMovieDetails(topChoice.id)
      : await api.getTVDetails(topChoice.id);
  result.media_type = topChoice.media_type;
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
    return result;
  }

  // 2
  // Search by progressively removing ":" keyword
  let titleChunks = normalizedTitle.trim().split(":");
  while (titleChunks.length > 0) {
    const searchTerm = titleChunks.join("");
    result = await db.getBestTitleMatch(searchTerm);
    if (result) {
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

  let match = await getMostPopular(normalizedTitle);
  if (match) {
    helper.print(`${normalizedTitle}`);
    if (match.media_type == "tv") {
      result = {
        normalized_title: normalizedTitle || null,
        original_title: normalizedTitle || null,
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
        normalized_title: normalizedTitle || null,
        original_title: normalizedTitle || null,
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
    return result;
  } else {
    userStats.numUniqueTitlesWatched.total -= 1;
    stats.logMissedTitles(userStats, normalizedTitle);
  }

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
    normalizedTitle,
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
          if (!isNaN(date) && helper.isValidString(title)) {
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
        let currRow = 0;
        try {
          for (const title of Object.keys(titleToDateFreq)) {
            let result = await getData(title);

            if (result) {
              logUserStats(result, title);
            }

            currRow += 1;
            console.log(
              `${currRow} / ${userStats.numUniqueTitlesWatched.total}`,
            );
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
