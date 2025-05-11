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
// const filePath = "./ViewingActivity.csv";
const filePath = "./big.csv";

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

async function getDataFromTMDB(title) {
  let output = await api.searchTVAndMovie(title);
  output = output?.results;

  let titleData = output.sort((a, b) => b.vote_count - a.vote_count)[0];

  // let titleData = output?.results?.[0];
  let titleType = 0;

  // Fallback to TVShow or Movie Search APIs
  // Use the one with the highest vote_count
  if (titleData.media_type === "person") {
    const showOutput = await api.searchTVShow(title);
    const showData = showOutput?.results?.[0];

    const movieOutput = await api.searchMovie(title);
    const movieData = movieOutput?.results?.[0];

    if (showData?.vote_average >= movieData?.vote_average) {
      titleData = showData;
      titleType = 1;
    } else {
      titleData = movieData;
      titleType = 1;
    }
  } else if (titleData.media_type === "movie") {
    titleType = 1;
  }

  return [titleData, titleType];
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

  const titleFrequency = helper.getTitleWatchFrequency(
    titleToDateFreq,
    normalizedTitle,
  );

  // 0 - TV Show [ Default ]
  // 1 - Movie
  let detailsData = {};
  let watchProvidersData = {};

  // // Not in cache
  // // Search TV/Movie using API
  // let data = await api.searchTVShow(originalTitle);
  //
  // // Check if it is truly a TV Show
  // if (helper.verifyMovieOrShow(data?.results?.[0]) || !data?.results?.length) {
  //   data = await api.searchMovie(originalTitle);
  //   type = 1;
  // }

  console.log(normalizedTitle);
  let [match, type] = await getDataFromTMDB(originalTitle);

  // ====================
  // SECTION BEGIN
  //
  // DB Call: Update the POSTGRESQL TABLE with new information at the end
  // Change result = {} based on POSTGRESQL TABLE
  // ====================

  let timeWatched = 0;
  let result = {};
  // const match = data?.results?.[0];
  if (match) {
    // if (type == 0) {
    //   watchProvidersData = await api.searchTVWatchProvider(match.id);
    // } else {
    //   watchProvidersData = await api.searchMovieWatchProvider(match.id);
    // }
    //
    // if (helper.isAvailableOnNetflix(watchProvidersData)) {
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
    logUniqueShowsAndMovies(type);
    logTopGenres(result.genres);
    logMostBingedShow();
    logTopWatchedTitles();
    logMostWatchedTitle();
    logOldestWatchedShowAndMovie(
      type,
      result.release_date || result.first_air_date,
      result.normalized_title,
    );

    if (type == 0) {
      logNumShowsCompleted(result.number_of_episodes, result.normalized_title);
    }

    return result;
  } else {
    // logMissedTitles(match, type);
    // }
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
        if (helper.validString(row.Title) && helper.validString(row.Date)) {
          const originalTitle = helper.getTitle(row.Title);
          const normalizedTitle = helper.normalizeTitle(originalTitle);

          // In case there is an empty normalizedTitle
          if (helper.validString(normalizedTitle)) {
            const date = helper.getDate(row.Date);

            normalizedToOriginal[normalizedTitle] = originalTitle;

            if (!titleToDateFreq[normalizedTitle]) {
              titleToDateFreq[normalizedTitle] = {
                datesWatched: [],
                titleFrequency: 0,
              };
              logUniqueTitlesWatched();
            }
            titleToDateFreq[normalizedTitle].titleFrequency += 1;
            titleToDateFreq[normalizedTitle].datesWatched.push(date);

            titleList.push(originalTitle);
            dateList.push(date);
          }
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

  if (userStats.numUniqueTitlesWatched.total > 0) {
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

  if (userStats.showsCompleted.length > 1) {
    helper.print("NUMBER OF SHOWS COMPLETED");
    getNumShowsCompleted();
  }

  if (userStats.oldestWatchedShow.title != "") {
    helper.print("OLDEST WATCHED SHOW");
    getOldestWatchedShow();
  }

  if (userStats.oldestWatchedMovie.title != "") {
    helper.print("OLDEST WATCHED MOVIE");
    getOldestWatchedMovie();
  }

  if (userStats.missedTitles.count > 0) {
    helper.print("MISSED TITLES");
    getMissedTitles();
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

function logUniqueShowsAndMovies(type) {
  if (type == 0) {
    userStats.numUniqueTitlesWatched.tvShows += 1;
  } else {
    userStats.numUniqueTitlesWatched.movies += 1;
  }
}

function logUniqueTitlesWatched() {
  userStats.numUniqueTitlesWatched.total += 1;
}

/**
 * Prints Total Unique Titles Watched of the user
 */
function getUniqueTitlesWatched() {
  console.log(`Total Titles: ${userStats.numUniqueTitlesWatched.total}`);
  console.log(`Total TV Shows: ${userStats.numUniqueTitlesWatched.tvShows}`);
  console.log(`Total Movies: ${userStats.numUniqueTitlesWatched.movies}`);
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

/*
 * ------------------------------
 *     NUMBER OF SHOWS COMPLETED
 * ------------------------------
 */

function logNumShowsCompleted(numEps, showName) {
  let titleFrequency = helper.getTitleWatchFrequency(titleToDateFreq, showName);

  // helper.print(`${showName} || API: ${numEps} || USER: ${titleFrequency}`);

  if (titleFrequency >= numEps) {
    userStats.showsCompleted[0] += 1;
    userStats.showsCompleted.push(showName);
  }
}

function getNumShowsCompleted() {
  console.log(`Amount Completed: ${userStats.showsCompleted[0]}`);
  for (let i = 1; i < userStats.showsCompleted.length; i++) {
    console.log(userStats.showsCompleted[i]);
  }
}

/*
 * ------------------------------
 *     OLDEST WATCHED SHOW
 * ------------------------------
 */

function logOldestWatchedShowAndMovie(type, release_date, title) {
  let date = new Date(release_date);
  // TV Show
  if (type == 0) {
    if (userStats.oldestWatchedShow.title == "") {
      userStats.oldestWatchedShow = {
        title: title,
        dateObject: date,
        date: date.toDateString(),
      };
    } else if (date < userStats.oldestWatchedShow.dateObject) {
      userStats.oldestWatchedShow = {
        title: title,
        dateObject: date,
        date: date.toDateString(),
      };
    }
    // Movie
  } else {
    if (userStats.oldestWatchedMovie.title == "") {
      userStats.oldestWatchedMovie = {
        title: title,
        dateObject: date,
        date: date.toDateString(),
      };
    } else if (date < userStats.oldestWatchedMovie.dateObject) {
      userStats.oldestWatchedMovie = {
        title: title,
        dateObject: date,
        date: date.toDateString(),
      };
    }
  }
}

function getOldestWatchedShow() {
  console.log(
    `${userStats.oldestWatchedShow.title}: ${userStats.oldestWatchedShow.date}`,
  );
}

function getOldestWatchedMovie() {
  console.log(
    `${userStats.oldestWatchedMovie.title}: ${userStats.oldestWatchedMovie.date}`,
  );
}

/*
 * ------------------------------
 *     MISSING TITLES
 * ------------------------------
 */
function logMissedTitles(match, type) {
  userStats.missedTitles.count += 1;

  if (type == 0) {
    userStats.missedTitles.titlesArr.push(match.original_name);
  } else {
    userStats.missedTitles.titlesArr.push(match.original_title);
  }
}

function getMissedTitles() {
  console.log(`Missed: ${userStats.missedTitles.count}`);
  console.log(userStats.missedTitles.titlesArr);
  // for (const title in userStats.missedTitles.titlesArr) {
  //   console.log(title);
  // }
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
