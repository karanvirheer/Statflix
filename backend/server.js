import multer from "multer";
const upload = multer({ dest: "uploads/" });
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import * as api from "./tmdb.js";
import * as helper from "./helpers.js";
import * as db from "./db.js";
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
let normalizedToOriginal = {};
let normalizedToFull = {};
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
  await db.createTmdbTable().catch(console.error);
  await parseKaggleDatasets();
  // await parseCSV();
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

async function findBestMatchedTitle(normalizedTitle, originalTitle) {
  const fullTitle = normalizedToFull[normalizedTitle];
  const originalType = titletoMediaType[normalizedTitle];
  let titleType = originalType;
  let bestCandidate = null;
  let bestScore = -Infinity;

  if (manualOverrides[normalizedTitle]) {
    const override = manualOverrides[normalizedTitle];
    titletoMediaType[normalizedTitle] = override.type;
    return override.media_type === "tv"
      ? await api.getTVDetails(override.id)
      : await api.getMovieDetails(override.id);
  }

  const titleChunks = fullTitle.split(" ");
  let topCandidates = [];

  // 1. Get Top Results from TMDb
  while (titleChunks.length > 0) {
    const searchTerm = titleChunks.join(" ");
    const results = (await api.searchTVAndMovie(searchTerm))?.results || [];

    topCandidates = results
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 10); // Grab top 10 to give Netflix priority

    if (topCandidates.length > 0) break;
    titleChunks.pop(); // Trim title and retry
  }

  // 2. Score Candidates
  for (const result of topCandidates) {
    const candidateTitle = result.title || result.name || "";
    const mediaType = result.media_type;
    const similarity = basicTitleSimilarity(candidateTitle, fullTitle);
    const exactMatch = candidateTitle.toLowerCase() === fullTitle.toLowerCase();
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
      titleType = mediaType === "movie" ? 1 : 0;
    }
  }

  // 3. Fallback (TV or Movie Only)
  if (!bestCandidate) {
    const [tvOut, movieOut] = await Promise.all([
      api.searchTVShow(originalTitle),
      api.searchMovie(originalTitle),
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
      const similarity = basicTitleSimilarity(candidateTitle, fullTitle);
      const exactMatch =
        candidateTitle.toLowerCase() === fullTitle.toLowerCase();
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
        (isEnglish ? 200 : -400) +
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

  titletoMediaType[normalizedTitle] = titleType;
  return bestCandidate;
}

/**
 * Gets the TMDb data for a title.
 *
 * @param {string} parsedTitle - TMDb Searchable Title
 * @returns {Promise<dict>} Information related to the title
 */
async function getData(normalizedTitle) {
  let result = {};

  const originalTitle = helper.getOriginalTitle(
    normalizedToOriginal,
    normalizedTitle,
  );

  const titleFrequency = helper.getTitleWatchFrequency(
    titleToDateFreq,
    normalizedTitle,
  );

  result = await db.getCachedResult(normalizedTitle);
  if (result) {
    helper.print(`CACHE HIT: ${normalizedTitle}`);
  } else {
    let detailsData = {};
    helper.print(`${normalizedTitle}`);
    let match = await findBestMatchedTitle(normalizedTitle, originalTitle);
    if (match) {
      if (match.media_type == "tv") {
        detailsData = await api.getTVDetails(match.id);
        result = {
          normalized_title: normalizedTitle || null,
          original_title: originalTitle || null,
          tmdb_id: detailsData.id || null,
          mediaType: 0,
          genres: detailsData.genres || null,
          runtime: null,
          number_of_episodes: detailsData.number_of_episodes || null,
          episode_run_time: await helper.getEpisodeRunTime(detailsData),
          release_date: null,
          first_air_date: detailsData.first_air_date || null,
          poster_path: detailsData.poster_path || null,
        };

        // Movie
      } else {
        detailsData = await api.getMovieDetails(match.id);
        result = {
          normalized_title: normalizedTitle || null,
          original_title: originalTitle || null,
          tmdb_id: detailsData.id || null,
          mediaType: 1,
          genres: detailsData.genres || null,
          runtime: detailsData.runtime || null,
          number_of_episodes: null,
          episode_run_time: null,
          release_date: detailsData.release_date || null,
          first_air_date: null,
          poster_path: detailsData.poster_path || null,
        };
      }
      await db.cacheResult(result);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (result) {
    const runtime = result?.runtime || result?.episode_run_time || 0;
    let timeWatched = runtime * titleFrequency;
    let mediaType = titletoMediaType[normalizedTitle];

    // =========================
    // STATISTICS FUNCTION CALLS
    // =========================
    logWatchTime(normalizedTitle, mediaType, timeWatched);
    logUniqueShowsAndMovies(mediaType);

    if (result.genres !== null || result.genres?.length > 0) {
      logTopGenres(result.genres);
    }
    logMostBingedShow();
    logTopWatchedTitles();
    logMostWatchedTitle();
    logOldestWatchedShowAndMovie(
      mediaType,
      result.release_date || result.first_air_date,
      result.normalized_title,
    );

    if (mediaType == 0) {
      logNumShowsCompleted(result.number_of_episodes, result.normalized_title);
    }
  }

  // console.log(normalizedTitle);
  // logMissedTitles(match, mediaType);
  // }

  // Optional delay to avoid hammering the API in case of no result
  // Pause execution until the Promise is resolved
  // (r) => (r, 300) Means pause for 300ms everytime then resolve the Promise

  return result;
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
        // ERROR CHECK
        // Check if it even has the Title and Date rows ONLY
        // Basically ensure that you are being given the correct CSV at all

        if (helper.isValidString(row.Title) && helper.isValidString(row.Date)) {
          const [originalTitle, fullTitle, mediaType] = helper.getTitle(
            row.Title,
          );
          const normalizedTitle = helper.normalizeTitle(originalTitle);
          const date = helper.getDate(row.Date);

          // Check empty normalziedTitle and invalid Date Object
          if (helper.isValidString(normalizedTitle) && !isNaN(date)) {
            normalizedToOriginal[normalizedTitle] = originalTitle;
            normalizedToFull[normalizedTitle] = fullTitle;
            titletoMediaType[normalizedTitle] = mediaType;

            // helper.print(
            //   `${fullTitle} || ${originalTitle} || ${normalizedTitle}`,
            // );

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

async function parseKaggleDatasets() {
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
            normalizedTitle: helper.normalizeTitle(title),
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
              mediaType: 1,
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

          console.log("✅ Kaggle Move Dataset processing done.");

          resolve({ idList, titleList });
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

function logUniqueShowsAndMovies(mediaType) {
  if (mediaType == 0) {
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
 * @param {int} mediaType - TV Show (1) or Movie (0)
 * @param {int} timeWatched - Number of minutes watched
 */
function logWatchTime(normalizedTitle, mediaType, timeWatched) {
  userStats.totalWatchTime += timeWatched;

  if (userStats.watchTimeByTitle[normalizedTitle]) {
    userStats.watchTimeByTitle[normalizedTitle].minutes += timeWatched;
  } else {
    userStats.watchTimeByTitle[normalizedTitle] = {
      mediaType: mediaType,
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

  // helper.print(`${userStats.mostBingedShow}: ${dates}`);

  if (dates) {
    const startBinge = dates[0].toDateString();
    const endBinge = dates[dates.length - 1].toDateString();

    console.log(
      `${title}: ${userStats.mostBingedShow.eps_binged} episodes watched back-to-back!`,
    );

    console.log(`You binged from ${startBinge} to ${endBinge}!`);
  } else {
    console.log("No dates available");
  }
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

function logOldestWatchedShowAndMovie(mediaType, release_date, title) {
  let date = new Date(release_date);
  // TV Show
  if (mediaType == 0) {
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
function logMissedTitles(match, mediaType) {
  userStats.missedTitles.count += 1;

  if (mediaType == 0) {
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
