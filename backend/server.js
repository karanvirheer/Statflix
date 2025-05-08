import multer from "multer";
const upload = multer({ dest: "uploads/" });
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import * as api from "./tmdb.js";
import * as helper from "./helpers.js";
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

// Titles Cache
const cache = {};

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
  numUniqueTitlesWatched: 0,

  // int
  totalWatchTime: 0,

  // dict
  // {
  //  title: {
  //    type: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  watchTimeByTitle: {},

  // dict
  // {
  //  title: {
  //    type: "",
  //    minutes: 0,
  //  },
  //  ...
  // }
  topWatchedTitles: {},

  // TMDb ID or Title String?
  mostBingedShow: {
    title: "",
    eps_binged: 0,
    dates_binged: [],
  },

  // TMDb ID or Title String?
  mostWatchedTitle: {
    title: "",
    minutes: 0,
  },

  // TMDb ID or Title String?
  oldestWatchedTitle: {
    title: "",
    date: "",
  },

  // int
  numShowsCompleted: 0,
};

let titleToDateFreq = {};
let normalizedToOriginal = {};

/*
 * ==============================
 *          MAIN FUNCTION
 * ==============================
 */

main();

async function main() {
  console.log("!!!!!!!!!! STARTING !!!!!!!!!!!!!");
  await parseCSV();
  // console.log("!!!!!!!!!! ENDING !!!!!!!!!!!!!");
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {Promise<dict>} Information related to the title
 */
async function getData(normalizedTitle) {
  // ====================
  // SECTION BEGIN
  //
  // POSTGRESQL FUNCTION CALL HERE
  // Check if normalizedTitle is in the DB
  //    Return
  // Otherwise proceed ahead
  //
  // TEMPORARY CACHE UNTIL DB IS SETUP
  // ====================

  // Check cache first
  if (cache[normalizedTitle]) {
    // console.log(`✅ Cache hit: ${normalizedTitle}`);
    return cache[normalizedTitle]; // Return cached result
  }

  // ====================
  // SECTION END
  // ====================

  const originalTitle = helper.getOriginalTitle(
    normalizedToOriginal,
    normalizedTitle,
  );

  // 0 - TV Show [ Default ]
  // 1 - Movie
  let type = 0;
  let detailsData = {};
  let result = {};

  // Not in cache
  // Search TV/Movie using API
  let data = await api.searchTVShow(originalTitle);

  // Check if it is truly a TV Show
  if (helper.verifyMovieOrShow(data?.results?.[0]) || !data?.results?.length) {
    data = await api.searchMovie(originalTitle);
    type = 1;
  }

  // ====================
  // SECTION BEGIN
  //
  // DB Call: Update the POSTGRESQL TABLE with new information at the end
  // Change result = {} based on POSTGRESQL TABLE
  // ====================

  let timeWatched = 0;
  const titleFrequency = helper.getTitleWatchFrequency(
    titleToDateFreq,
    normalizedTitle,
  );

  const match = data?.results?.[0];
  if (match) {
    // TV Show
    if (type == 0) {
      detailsData = await api.getTVDetails(match.id);
      result = {
        normalized_title: normalizedTitle || null,
        original_title: originalTitle || null,
        tmdb_id: detailsData.id || null,
        type: type || null,
        genres: detailsData.genres || null,
        runtime: null,
        number_of_episodes: detailsData.number_of_episodes || null,
        episode_run_time: await helper.getEpisodeRunTime(detailsData),
        release_date: null,
        first_air_date: detailsData.first_air_date || null,
        poster_path: detailsData.poster_path || null,
      };

      timeWatched = result.episode_run_time * titleFrequency;

      // Movie
    } else {
      detailsData = await api.getMovieDetails(match.id);
      result = {
        normalized_title: normalizedTitle || null,
        original_title: originalTitle || null,
        tmdb_id: detailsData.id || null,
        type: type || null,
        genres: detailsData.genres || null,
        runtime: detailsData.runtime || null,
        number_of_episodes: null,
        episode_run_time: null,
        release_date: detailsData.release_date || null,
        first_air_date: null,
        poster_path: detailsData.poster_path || null,
      };

      const runtime = result.runtime || 0;
      timeWatched = runtime * titleFrequency;
    }

    // =========================
    // POSTGRESQL CALL HERE
    // =========================

    // Save result to cache
    cache[normalizedTitle] = result;

    // =========================
    // POSTGRESQL CALL HERE
    // =========================

    // =========================
    // STATISTICS FUNCTION CALLS
    // =========================
    logWatchTime(normalizedTitle, type, timeWatched);
    logTopGenres(result.genres);
    logMostBingedShow();
    logUniqueTitlesWatched();
    logTopWatchedTitles();
    logMostWatchedTitle();

    return result;
  }

  // Optional delay to avoid hammering the API in case of no result
  // Pause execution until the Promise is resolved
  // (r) => (r, 300) Means pause for 300ms everytime then resolve the Promise
  await new Promise((r) => setTimeout(r, 300));

  // Still cache null to avoid repeated failed lookups
  cache[normalizedTitle] = null;
  return null;
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
      .on("data", (row) => {
        if (row.Title && row.Date) {
          const originalTitle = helper.getTitle(row.Title);
          const normalizedTitle = helper.normalizeTitle(originalTitle);
          const date = helper.getDate(row.Date);

          normalizedToOriginal[normalizedTitle] = originalTitle;

          if (!titleToDateFreq[normalizedTitle]) {
            titleToDateFreq[normalizedTitle] = {
              datesWatched: [],
              titleFrequency: 0,
            };
          }
          titleToDateFreq[normalizedTitle].titleFrequency += 1;
          titleToDateFreq[normalizedTitle].datesWatched.push(date);

          titleList.push(originalTitle);
          dateList.push(date);
        }
      })
      .on("end", async () => {
        try {
          for (const normalizedTitle of Object.keys(titleToDateFreq)) {
            await getData(normalizedTitle);
          }
          console.log("✅ CSV processing done.");

          // =========================
          // STATISTICS FUNCTION CALLS
          // =========================

          // getMostBingedShow(titleDateMap);
          printUserStats();

          resolve({ titleList, dateList });
        } catch (error) {
          reject(error);
        }
      });
  });
}

/*
 * ==============================
 *        STATISTICS FUNCTIONS
 * ==============================
 */

/**
 * Prints out all the User Statistics to the console.
 */
function printUserStats() {
  if (Object.keys(userStats.genres).length > 0) {
    helper.print("TOP GENRES");
    getTopGenres();
  }

  if (userStats.numUniqueTitlesWatched > 0) {
    helper.print("UNIQUE TITLES WATCHED");
    getUniqueTitlesWatched();
  }

  if (userStats.totalWatchTime > 0) {
    helper.print("TOTAL WATCH TIME");
    getTotalWatchTime();

    helper.print("TOP 5 TITLES BY WATCH TIME");
    getTopWatchedTitles();

    helper.print("YOU SPENT THE MOST TIME WATCHING");
    getMostWatchedTitle();
  }

  if (userStats.mostBingedShow.eps_binged > 0) {
    helper.print("MOST BINGED SHOW");
    getMostBingedShow();
  }
}

/*
 * ------------------------------
 *         TOP GENRES
 * ------------------------------
 */

/**
 * Updates userStats["genres"] dict to keep track of the occurrences of each genre.
 *
 * @param {string} genreArray - Genres of current title
 */
function logTopGenres(genreArray) {
  for (const genre of genreArray) {
    if (genre.name in userStats.genres) {
      userStats.genres[genre.name] += 1;
    } else {
      userStats.genres[genre.name] = 1;
    }
  }
}

/**
 * Prints the Top 5 Genres based on the userStats
 */
function getTopGenres() {
  userStats.topGenres = Object.entries(userStats.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [key, value] of userStats.topGenres) {
    console.log(`${key}: ${value}`);
  }
}

/*
 * ------------------------------
 *    UNIQUE TITLES WATCHED
 * ------------------------------
 */

function logUniqueTitlesWatched() {
  userStats.numUniqueTitlesWatched = Object.keys(titleToDateFreq).length;
}

/**
 * Prints Total Unique Titles Watched of the user
 */
function getUniqueTitlesWatched() {
  console.log(userStats.numUniqueTitlesWatched);
}

/*
 * ------------------------------
 *    TOTAL WATCH TIME
 * ------------------------------
 */

/**
 * Updates userStats.totalWatchTime] and userStats[watch_time_by_title] for each title
 *
 * @function
 * @param {string} normalizedTitle - Normalized title used as the key
 * @param {int} type - TV Show (1) or Movie (0)
 * @param {int} timeWatched - Number of minutes watched
 */
function logWatchTime(normalizedTitle, type, timeWatched) {
  userStats.totalWatchTime += timeWatched;

  if (userStats.watchTimeByTitle[normalizedTitle]) {
    userStats.watchTimeByTitle[normalizedTitle].minutes += timeWatched;
  } else {
    userStats.watchTimeByTitle[normalizedTitle] = {
      type: type,
      minutes: timeWatched,
    };
  }
}

/**
 * Prints userStats["total_watch_time"] of the user
 */
function getTotalWatchTime() {
  console.log(`${userStats.totalWatchTime} minutes`);
  console.log(
    `That’s about ${(userStats.totalWatchTime / 60).toFixed(2)} hours`,
  );
}

/*
 * ------------------------------
 *    TOP WATCHED TITLES
 * ------------------------------
 */

function logTopWatchedTitles() {
  userStats.topWatchedTitles = Object.entries(userStats.watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5);
}

/**
 * Prints Top 5 Watched Titles by Watch Time
 */
function getTopWatchedTitles() {
  userStats.topWatchedTitles.forEach(([key, data]) => {
    console.log(
      `${helper.getOriginalTitle(normalizedToOriginal, key)}: ${data.minutes} minutes`,
    );
  });
}

/*
 * ------------------------------
 *  MOST WATCHED TITLE (SINGULAR)
 * ------------------------------
 */

/**
 * Prints Most Watched Title
 */
function logMostWatchedTitle() {
  const [title, mostWatched] = Object.entries(userStats.watchTimeByTitle).sort(
    (a, b) => b[1].minutes - a[1].minutes,
  )[0];

  userStats.mostWatchedTitle.title = helper.getOriginalTitle(
    normalizedToOriginal,
    title,
  );
  userStats.mostWatchedTitle.minutes = mostWatched.minutes;
}

function getMostWatchedTitle() {
  console.log(
    `${userStats.mostWatchedTitle.title} (${userStats.mostWatchedTitle.minutes} minutes)`,
  );
}

/*
 * ------------------------------
 *     MOST BINGED SHOW
 * ------------------------------
 */

/*
 * A binge is defined as a show you've watched back-to-back a minimum of once within 24 hours of the previous episode.
 */
function logMostBingedShow() {
  function getHourDiff(date2, date1) {
    return (date2 - date1) / (1000 * 60 * 60);
  }

  let mostBingedShow = "";

  // Dates the show was binged on
  let mostBingedDates = [];

  // Longest number of episodes binged of a show
  let longestBingeStreak = 1;

  // 2 hour gap allowed between eps
  const minEpisodeGap = 2;

  for (const [title, value] of Object.entries(titleToDateFreq)) {
    // Sorted Dates - Descending Fashion
    let dateList = value.datesWatched.sort((a, b) => a - b);

    // Current longest streak of episodes binged of title
    let currentBingeStreak = 1;

    let epsWatchedConsecutively = 1;

    let currBingedDates = [dateList[0]];
    // let dateStartedBinge = null;

    // Going through the dates of each Title
    for (let i = 1; i < dateList.length; i++) {
      // if (dateStartedBinge == null) {
      //   dateStartedBinge = dateList[i - 1];
      //   dates.push(dateList[i - 1]);
      // }

      const diff = getHourDiff(dateList[i], dateList[i - 1]);

      // Episodes watched within the same day
      if (diff <= minEpisodeGap) {
        epsWatchedConsecutively += 1;
        currentBingeStreak += 1;
        currBingedDates.push(dateList[i]);

        // Continue binge streak ONLY if you've watched 3 eps back-to-back already
      } else if (epsWatchedConsecutively >= 3 && diff < 30) {
        // reset consecutive count because you stopped watching back-to-back
        epsWatchedConsecutively = 1;
        currentBingeStreak += 1;
        currBingedDates.push(dateList[i]);

        // FULL RESET
        // Episodes not watched within minEpisodeGap
        // Did not meet epsWatchedConsecutively >= 3 to keep streak alive
      } else {
        epsWatchedConsecutively = 1;
        currentBingeStreak = 1;
        currBingedDates = [];
      }

      if (currentBingeStreak > longestBingeStreak) {
        mostBingedShow = title;
        longestBingeStreak = currentBingeStreak;
        mostBingedDates = currBingedDates;
      }
    }
  }
  userStats.mostBingedShow = {
    title: mostBingedShow,
    eps_binged: longestBingeStreak,
    dates_binged: mostBingedDates,
  };
}

function getMostBingedShow() {
  const title = helper.getOriginalTitle(
    normalizedToOriginal,
    userStats.mostBingedShow.title,
  );

  const dates = userStats.mostBingedShow.dates_binged;
  const startBinge = dates[0].toDateString();
  const endBinge = dates[dates.length - 1].toDateString();

  console.log(
    `${title}: ${userStats.mostBingedShow.eps_binged} episodes watched back-to-back!`,
  );
  console.log(`You binged from ${startBinge} to ${endBinge}!`);
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
