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

  // TMDb ID or Title String?
  most_watched_tv_show: "",

  // TMDb ID or Title String?
  oldest_watched_show: "",

  // int
  num_shows_completed: 0,
};

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
  return title.toLowerCase().trim().replace(/[^a-z0-9]/gi, "");
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
async function getData(parsedTitle, watchedCount = 1) {
  // 0 - TV Show [ Default ]
  // 1 - Movie
  let type = 0;

  // Check cache first
  if (cache[parsedTitle]) {
    // console.log(`✅ Cache hit: ${parsedTitle}`);
    return cache[parsedTitle]; // Return cached result
  }

  // Not in cache
  // Search TV/Movie using API
  let data = await searchTVShow(parsedTitle);
  // Check if it is truly a TV Show
  if (verifyMovieOrShow(data?.results?.[0]) || !data?.results?.length) {
    data = await searchMovie(parsedTitle);
    // Set flag that this title is a Movie
    type = 1;
  }

  const match = data?.results?.[0];
  if (match) {
    let detailsData = {};
    let result = {};

    // TV Show
    if (type == 0) {
      detailsData = await getTVDetails(match.id);
      result = {
        type: type,
        title: parsedTitle,
        id: match.id,
        genres: detailsData.genres,
        episode_run_time: await getEpisodeRunTime(detailsData),
        first_air_date: match.first_air_date,
        number_of_episodes: detailsData.number_of_episodes,
      };
      // Get the total time watched
      const timeWatched = result.episode_run_time * watchedCount;
      userStats.total_watch_time += timeWatched;

       // Track by title for "most time spent watching"
       const key = normalizeTitle(parsedTitle);
       if (watchTimeByTitle[key]) {
         watchTimeByTitle[key] += timeWatched;
       } else {
        watchTimeByTitle[key] = { minutes: timeWatched, original: parsedTitle };
       }
       

      // Movie
    } else {
      detailsData = await getMovieDetails(match.id);
      result = {
        type: type,
        title: parsedTitle,
        id: match.id,
        genres: detailsData.genres,
      };
      const timeWatched = result.runtime || 0;
      userStats.total_watch_time += timeWatched;

      const key = normalizeTitle(parsedTitle);
      if (watchTimeByTitle[key]) {
        watchTimeByTitle[key] += timeWatched;
      } else {
        watchTimeByTitle[key] = { minutes: timeWatched, original: parsedTitle };
      }

    }

    // =========================
    // STATISTICS FUNCTION CALLS
    // =========================
    logTopGenres(detailsData.genres);
    logUniqueTitlesWatched(match.id);

    cache[parsedTitle] = result; // Save result to cache
    return result;
  }

  // Optional delay to avoid hammering the API in case of no result
  // Pause execution until the Promise is resolved
  // (r) => (r, 300) Means pause for 300ms everytime then resolve the Promise
  await new Promise((r) => setTimeout(r, 300));

  // Still cache null to avoid repeated failed lookups
  cache[parsedTitle] = null;
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
  const showFrequency = {};


  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (row.Title) {
          const title = getTitle(row.Title);
          const normalized = normalizeTitle(title);
          titleList.push(title);

          // Count how many times this title appears
          if (showFrequency[normalized]) {
            showFrequency[normalized] += 1;
          } else {
            showFrequency[normalized] = 1;
          }
        }
        if (row.Date) {
          const date = getDate(row.Date);
          dateList.push(date);
        }
      })
      .on("end", async () => {
        try {
          const titleResults = [];
          const dateResults = [];

          for (const title of titleList) {
            const normalized = normalizeTitle(title);
            const watchedCount = showFrequency[normalized];
          
            const data = await getData(title, watchedCount); 
            titleResults.push(data);
          }
          

          for (const date of dateList) {
            // change below to be for dates or something
            // const id = await getID(title);
            dateResults.push(date);
          }

          console.log("✅ CSV processing done.");

          // =========================
          // STATISTICS FUNCTION CALLS
          // =========================
          printUserStats();

          resolve({ titleResults, dateResults });

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
  if (userStats.top_genres.length > 0) {
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

  console.log("=======================");
  console.log(`TOTAL WATCH TIME: ${userStats.total_watch_time} minutes`);
  console.log(`That’s about ${(userStats.total_watch_time / 60).toFixed(2)} hours`);
  console.log("=======================");


  console.log("=======================");
  console.log("TOP 5 TITLES BY WATCH TIME");
  Object.entries(watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5)
    .forEach(([key, data]) => {
      console.log(`${data.original}: ${data.minutes} minutes`);
  });
  console.log("=======================");


  console.log("=======================");
  const [_, mostWatched] = Object.entries(watchTimeByTitle)
  .sort((a, b) => b[1].minutes - a[1].minutes)[0];
  console.log(`YOU SPENT THE MOST TIME WATCHING: ${mostWatched.original} (${mostWatched.minutes} minutes)`);
  console.log("=======================");



}

/**
 * Updates userStats["top_genres"] to keep track of the occurrences of each genre.
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

  userStats["top_genres"] = Object.entries(userStats["genres"])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

/**
 * Calculates the Top 5 Genres based on the userStats
 */
function getTopGenres() {
  for (const [key, value] of userStats.top_genres) {
    console.log(`${key}: ${value}`);
    console.log("=======================");
  }
}

/**
 * Updates Total Unique Titles Watched in UserStats
 */
function getUniqueTitlesWatched() {
  console.log(userStats["unique_titles_watched"].size);
}

/**
 * Updates userStats["unique_titles_watched"] to keep track of the unique titles watched.
 *
 * @param {string} id - ID of the title.
 */
function logUniqueTitlesWatched(id) {
  userStats["unique_titles_watched"].add(id);
}
