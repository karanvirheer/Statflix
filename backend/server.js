const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const csv = require("csv-parser");
const {
  searchTVShow,
  searchMovie,
  getTVDetails,
  getMovieDetails,
} = require("./tmdb");
require("dotenv").config();

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
const watchTimeByTitle = {};

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
  top_genres: [],

  // TMDb ID or Title String?
  most_binged_show: "",

  // int
  unique_titles_watched: new Set(),

  // int
  total_watch_time: 0,

  // dict
  // { "Sherlock": 200, "Gossip Girl": 450, ...}
  watchTimeByTitle: {},

  // TMDb ID or Title String?
  most_watched_tv_show: "",

  // TMDb ID or Title String?
  oldest_watched_show: "",

  // int
  num_shows_completed: 0,
};

titleToDateFreq = {};
normalizedToOriginal = {};

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

/*
 * ==============================
 *        HELPER FUNCTIONS
 * ==============================
 */

/**
 * Helper Function
 *
 * Formatted print of an item.
 *
 * @param {<String>} item - Item to be printed
 */
function print(item) {
  console.log("================================");
  console.log(item);
  console.log("================================");
}

/**
 * Helper Function
 *
 * Gets the episode run time for a TV Show
 *
 * @param {string} detailsData - Output from getTVDetails() API Call
 * @returns {int} Runtime of the episode
 */
function getEpisodeRunTime(detailsData) {
  if (detailsData.episode_run_time.length == 0) {
    return detailsData.last_episode_to_air.runtime;
  } else {
    return detailsData.episode_run_time[0];
  }
}

/**
 * Helper Function
 *
 * Verifies if the title is a Movie or a TV Show
 *
 * @param {dict} data - Output from searchTVShow() API Call
 * @returns {bool} True - Movie | False - TV Show
 */
function verifyMovieOrShow(data) {
  return data?.first_air_date === "";
}

/**
 * Helper Function
 *
 * Normalizes a title string to use as a consistent key.
 * Strips special characters, lowercases, and trims.
 *
 * @param {string} title - The raw or parsed title
 * @returns {string} Normalized title string
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/gi, "");
}

/**
 * Helper Function
 *
 * Returns the title before it was normalized.
 * This is also known as the Original Title
 *
 * @param {string} normalizedTitle - The normalized title
 * @returns {string} Original title string
 */
function getOriginalTitle(normalizedTitle) {
  return normalizedToOriginal[normalizedTitle];
}

/**
 * Helper Function
 *
 * Returns how many times the user has watched the title
 *
 * @param {string} normalizedTitle - The normalized title
 * @returns {int} Watch frequency of the title
 */
function getTitleWatchFrequency(normalizedTitle) {
  return titleToDateFreq[normalizedTitle].titleFrequency;
}

/*
 * ==============================
 *        PARSING FUNCTIONS
 * ==============================
 */

/**
 * Parses the CSV Title and gets the TMDb Searchable Title
 *
 * @param {string} rawTitle - Title from CSV
 * @returns {string} Formatted and searchable TMDb Title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
function getTitle(rawTitle) {
  let parsedTitle = "";
  switch (true) {
    case rawTitle.includes("Season"):
      parsedTitle = rawTitle.split(/(?=\s*Season)/i);
      break;
    case rawTitle.includes("Limited Series"):
      parsedTitle = rawTitle.split(/(?=\s*Limited Series)/i);
      break;
    case rawTitle.includes("Volume"):
      parsedTitle = rawTitle.split(/(?=\s*Volume)/i);
      break;
    case rawTitle.includes("Part"):
      parsedTitle = rawTitle.split(/(?=\s*Part)/i);
      break;
    case rawTitle.includes("Chapter"):
      parsedTitle = rawTitle.split(/(?=\s*Chapter)/i);
      break;
    case rawTitle.includes("Episode"):
      parsedTitle = rawTitle.split(/(?=\s*Episode)/i);
      break;
    case rawTitle.includes(":"):
      parsedTitle = rawTitle.split(/(?=\s*:)/i);
      break;
    default:
      // If no case matches, just keep the raw title as parsedTitle
      // This ensures it's an array with the raw title
      parsedTitle = [rawTitle];
      break;
  }

  return rawTitle.split(":")[0].trim();
}

/**
 * Parses the CSV Date and gets the DateTime Object
 *
 * @param {string} rawDate - Date from CSV
 * @returns {Date|null} Date the title was watched
 */
function getDate(rawDate) {
  const date = new Date(rawDate);

  if (isNaN(date)) {
    console.warn(`⚠️ Invalid date format: ${rawDate}`);
    return null;
  }
  return date;
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {Promise<dict>} Information related to the title
 *
 * Example return:
 * 
{
  type: 0,
  title: 'ONE PIECE',
  id: 37854,
  genres: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 35, name: 'Comedy' },
    { id: 16, name: 'Animation' }
  ],
  episode_run_time: 24,
  first_air_date: '1999-10-20',
  number_of_episodes: 1128
}

{
  type: 1,
  title: 'Glass Onion',
  id: 661374,
  genres: [
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 9648, name: 'Mystery' }
  ]
}
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

  // 0 - TV Show [ Default ]
  // 1 - Movie
  let type = 0;
  let detailsData = {};
  let result = {};
  const originalTitle = getOriginalTitle(normalizedTitle);

  // Not in cache
  // Search TV/Movie using API
  let data = await searchTVShow(originalTitle);

  // Check if it is truly a TV Show
  if (verifyMovieOrShow(data?.results?.[0]) || !data?.results?.length) {
    data = await searchMovie(originalTitle);
    type = 1;
  }

  // ====================
  // SECTION BEGIN
  //
  // Replace match.[stuff] with detailsData.[stuff] -> details API gives the same shit
  // DB Call: Update the POSTGRESQL TABLE with new information at the end
  //
  // Change result = {} based on POSTGRESQL TABLE
  // ====================

  const match = data?.results?.[0];
  if (match) {
    // =============================
    // TODO
    // No fallbacks on if the API data is empty for some params or not
    // Ex. match.first_air_date == ""
    // =============================

    const titleFrequency = getTitleWatchFrequency(normalizedTitle);

    // TV Show
    if (type == 0) {
      detailsData = await getTVDetails(match.id);
      result = {
        normalized_title: normalizedTitle || null,
        original_title: originalTitle || null,
        tmdb_id: detailsData.id || null,
        type: type || null,
        genres: detailsData.genres || null,
        runtime: null,
        number_of_episodes: detailsData.number_of_episodes || null,
        episode_run_time: await getEpisodeRunTime(detailsData),
        release_date: null,
        first_air_date: detailsData.first_air_date || null,
        poster_path: detailsData.poster_path || null,
      };

      const timeWatched = result.episode_run_time * titleFrequency;
      logWatchTime(normalizedTitle, timeWatched);

      // Movie
    } else {
      detailsData = await getMovieDetails(match.id);
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
      const timeWatched = runtime * titleFrequency;
      logWatchTime(normalizedTitle, timeWatched);
    }

    // ====================
    // SECTION END
    // ====================

    // =========================
    // STATISTICS FUNCTION CALLS
    // =========================
    logTopGenres(result.genres);

    cache[normalizedTitle] = result; // Save result to cache
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
 * Parses a user's Netflix ViewingActivity CSV file and extracts searchable TMDb titles.
 *
 * Reads the "Title" column from the CSV file and uses `getTitle()` to normalize titles.
 * Then calls `getID()` for each parsed title to retrieve the corresponding TMDb ID
 * (via TV or Movie search), while caching results to minimize API calls.
 *
 * @async
 * @function
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects,
 * each containing a parsed title and its corresponding TMDb ID, or `null` if no match was found.
 *
 * Example return:
 * [
 *   { title: "Breaking Bad", tmdbId: 1396 },
 *   { title: "Stranger Things", tmdbId: 66732 },
 *   ...
 * ]
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
          const originalTitle = getTitle(row.Title);
          const normalizedTitle = normalizeTitle(originalTitle);
          const date = getDate(row.Date);

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
          // ====================
          // SECTION BEGIN
          // Loop over titleDict for normalizedTitles
          // Remove watchedCount
          // Make it getData(normalizedTitle)
          // Remove the rest (ex. dateList shit)
          // ====================
          for (const normalizedTitle of Object.keys(titleToDateFreq)) {
            const data = await getData(normalizedTitle);
          }
          // ====================
          // SECTION END
          // ====================

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

function getMostBingedShow(titleDateMap) {
  let mostBinged = "";
  let longestStreak = 0;

  for (const [title, dateList] of Object.entries(titleDateMap)) {
    // Sort dates for this title
    const sortedDates = dateList
      .filter(Boolean)
      .map((d) => new Date(d)) // <- No point doing this here when getDate() exists
      .sort((a, b) => a - b);

    let currentStreak = 1;
    let maxStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 3600 * 24);
      if (diff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    if (maxStreak > longestStreak) {
      longestStreak = maxStreak;
      mostBinged = title;
    }
  }

  userStats.most_binged_show = mostBinged;
  userStats.longest_binge_streak = longestStreak;
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
  print(titleToDateFreq);

  if (Object.keys(userStats.genres).length > 0) {
    console.log("=======================");
    console.log("      TOP GENRES     ");
    console.log("=======================");
    getTopGenres();
  }

  if (userStats.unique_titles_watched.size > 0) {
    console.log("=======================");
    console.log(" UNIQUE TITLES WATCHED ");
    console.log("=======================");
    getUniqueTitlesWatched();
  }

  if (userStats.total_watch_time > 0) {
    console.log("=======================");
    console.log(" TOTAL WATCH TIME ");
    console.log("=======================");
    getTotalWatchTime();

    console.log("=======================");
    console.log("TOP 5 TITLES BY WATCH TIME");
    console.log("=======================");
    getTopWatchedTitles();

    console.log("=======================");
    console.log("YOU SPENT THE MOST TIME WATCHING");
    console.log("=======================");
    getMostWatchedTitle();
  }

  // const bingeKey = userStats.most_binged_show;
  // if (bingeKey) {
  //   const originalTitle = watchTimeByTitle[bingeKey]?.original || bingeKey;
  //   const streak = userStats.longest_binge_streak;
  //
  //   console.log("=======================");
  //   console.log(
  //     `MOST BINGED SHOW: ${originalTitle} (Longest streak: ${streak} days)`,
  //   );
  //   console.log("=======================");
  // }
}

/**
 * Updates userStats["genres"] dict to keep track of the occurrences of each genre.
 *
 * @param {string} genreArray - Genres of current title
 */
function logTopGenres(genreArray) {
  for (const genre of genreArray) {
    if (genre.name in userStats["genres"]) {
      userStats["genres"][genre.name] += 1;
    } else {
      userStats["genres"][genre.name] = 1;
    }
  }
}

/**
 * Prints the Top 5 Genres based on the userStats
 */
function getTopGenres() {
  userStats["top_genres"] = Object.entries(userStats["genres"])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [key, value] of userStats.top_genres) {
    console.log(`${key}: ${value}`);
  }
}

/**
 * Prints Total Unique Titles Watched of the user
 */
function getUniqueTitlesWatched() {
  console.log(Object.keys(titleToDateFreq).length);
}

/**
 * Helper Function
 *
 * Logs watch time for a given title
 *
 * @param {string} parsedTitle - The parsed title used as the key
 * @param {number} timeWatched - The number of minutes watched
 */
function logWatchTime(parsedTitle, timeWatched) {
  userStats.total_watch_time += timeWatched;

  const key = normalizeTitle(parsedTitle);
  if (watchTimeByTitle[key]) {
    watchTimeByTitle[key].minutes += timeWatched;
  } else {
    watchTimeByTitle[key] = { minutes: timeWatched, original: parsedTitle };
  }
}

/**
 * Prints userStats["total_watch_time"] of the user
 */
function getTotalWatchTime() {
  console.log(`${userStats.total_watch_time} minutes`);
  console.log(
    `That’s about ${(userStats.total_watch_time / 60).toFixed(2)} hours`,
  );
}

/**
 * Prints Top 5 Watched Titles by Watch Time
 */
function getTopWatchedTitles() {
  Object.entries(watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5)
    .forEach(([key, data]) => {
      console.log(`${data.original}: ${data.minutes} minutes`);
    });
}

/**
 * Prints Most Watched Title
 */
function getMostWatchedTitle() {
  const [_, mostWatched] = Object.entries(watchTimeByTitle).sort(
    (a, b) => b[1].minutes - a[1].minutes,
  )[0];
  console.log(`${mostWatched.original} (${mostWatched.minutes} minutes)`);
}

// ========================================
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/stats", (req, res) => {
  const mostWatched = Object.entries(watchTimeByTitle).sort(
    (a, b) => b[1].minutes - a[1].minutes,
  )[0];

  const top5Titles = Object.entries(watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5)
    .map(([key, val]) => [val.original, val.minutes]);

  res.json({
    topGenres: userStats.top_genres,
    uniqueTitles: userStats.unique_titles_watched.size,
    totalWatchTimeMinutes: userStats.total_watch_time,
    totalWatchTimeHours: userStats.total_watch_time / 60,
    topTitles: top5Titles,
    mostWatched: {
      title: mostWatched?.[1].original || "",
      minutes: mostWatched?.[1].minutes || 0,
    },
    mostBinged: {
      title:
        watchTimeByTitle[userStats.most_binged_show]?.original ||
        userStats.most_binged_show ||
        "N/A",
      streak: userStats.longest_binge_streak || 0,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
