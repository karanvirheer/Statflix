const fs = require("fs");
const csv = require("csv-parser");
const {
  searchTVShow,
  searchMovie,
  getTVDetails,
  getMovieDetails,
} = require("./tmdb");
require("dotenv").config();

// CSV should be in same folder
const filePath = "./ViewingActivity.csv";
// Titles Cache
const cache = {};
// User Statistics Cache
const userStats = {
  // TMDb ID or Title String?
  most_binged_show: "",

  // int
  total_unique_titles_watched: 0,

  // dict
  // { "Mystery": 30, "Horror": 20, ...}
  top_genres: {},

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
 *        HELPER FUNCTIONS
 * ==============================
 */

/**
 * Helper Function
 *
 * Gets the episode run time for a TV Show
 *
 * @param {string} detailsData - Output from getTVDetails() API Call
 * @returns {int} Runtime of the episode
 */
async function getEpisodeRunTime(detailsData) {
  if (detailsData.episode_run_time.length == 0) {
    return detailsData.last_episode_to_air.runtime;
  } else {
    return detailsData.episode_run_time[0];
  }
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
async function getTitle(rawTitle) {
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
      parsedTitle = [rawTitle]; // This ensures it's an array with the raw title
      break;
  }
  return parsedTitle[0].trim().replace(":", "");
}

/**
 * Parses the CSV Date and gets the DateTime Object
 *
 * @param {string} rawDate - Date from CSV
 * @returns {DateTime Object} Date the title was watched
 */
async function getDate(rawDate) {
  return rawDate;
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {dict}
 * Reference: https://developer.themoviedb.org/reference/search-tv
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
async function getData(parsedTitle) {
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
  if (!data?.results?.length) {
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

      // Movie
    } else {
      detailsData = await getMovieDetails(match.id);
      result = {
        type: type,
        title: parsedTitle,
        id: match.id,
        genres: detailsData.genres,
      };
    }

    // =========================
    // STATISTICS FUNCTION CALLS
    // =========================
    logTopGenres(detailsData.genres);

    // console.log(result);
    // console.log(userStats["top_genres"]);
    cache[parsedTitle] = result; // Save result to cache
    return result;
  }

  // Optional delay to avoid hammering the API in case of no result
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
async function parseCSV() {
  const titlePromises = [];
  const datePromises = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (row.Title) {
          const titlePromise = getTitle(row.Title);
          titlePromises.push(titlePromise);
        }
        if (row.Date) {
          const datePromise = getDate(row.Date);
          datePromises.push(datePromise);
        }
      })
      .on("end", async () => {
        try {
          const titles = await Promise.all(titlePromises);
          const dates = await Promise.all(datePromises);
          const titleResults = [];
          const dateResults = [];

          for (const title of titles) {
            const data = await getData(title);
            titleResults.push(data);
          }

          for (const date of dates) {
            // const id = await getID(title);
            dateResults.push(date);
          }

          console.log("✅ CSV processing done.");

          getTopGenres();
          getTotalUniqueTitlesWatched(titlePromises.length);

          // console.log(dateResults);
          // console.log(titleResults);
          resolve(titleResults);
          resolve(dateResults);
        } catch (error) {
          reject(error);
        }
      });
  });
}

parseCSV();

/*
 * ==============================
 *        STATISTICS FUNCTIONS
 * ==============================
 */

/**
 * Updates userStats["top_genres"] to keep track of the occurrences of each genre.
 *
 * @param {string} genreArray - Genres of current title
 * @returns {string} Formatted and searchable TMDb Title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
function logTopGenres(genreArray) {
  for (const genre of genreArray) {
    if (genre.name in userStats["top_genres"]) {
      userStats["top_genres"][genre.name] += 1;
    } else {
      userStats["top_genres"][genre.name] = 1;
    }
  }
}

/**
 * Calculates the Top 5 Genres based on the userStats
 */
function getTopGenres() {
  let topGenres = [];
  for (const [key, value] of Object.entries(userStats["top_genres"])) {
    console.log(`${key}: ${value}`);
    console.log("=================");
  }
}

/**
 * Updates Total Unique Titles Watched in UserStats
 * @param {uniqueTitles} - Total unique titles watched
 */
function getTotalUniqueTitlesWatched(uniqueTitles) {
  userStats["total_unique_titles_watched"] = uniqueTitles;
}
