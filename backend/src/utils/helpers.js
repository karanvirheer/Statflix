import fs from "fs/promises";

/*
 * ==============================
 *        HELPER FUNCTIONS
 * ==============================
 */

export async function logToFile(title, data) {
  const filePath = "output.log";
  const line = JSON.stringify({ [title]: data }) + "\n";
  fs.appendFile(filePath, line, "utf8");
}

export function updateTitleToDateFreq(currTitle, newTitle, currDict, tempDict) {
  // Add entry for the new title
  if (!tempDict[newTitle]) {
    tempDict[newTitle] = {
      datesWatched: [],
      titleFrequency: 0,
    };
  }

  // Add originalTitle data to newTitle entry
  if (currDict[currTitle]) {
    tempDict[newTitle].datesWatched = tempDict[newTitle].datesWatched.concat(
      currDict[currTitle].datesWatched,
    );
    tempDict[newTitle].titleFrequency += currDict[currTitle].titleFrequency;
  }

  return tempDict;
}

/**
 * Helper Function
 *
 * Formatted print of an item.
 *
 * @param {<String>} item - Item to be printed
 * @returns {null} Prints to the console
 */
export function print(item) {
  console.log("================================");
  console.log(`         ${item}         `);
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
export function getEpisodeRunTime(detailsData) {
  if (detailsData.episode_run_time?.length == 0) {
    return detailsData.last_episode_to_air?.runtime || 0;
  } else if (detailsData.episode_run_time?.length > 0) {
    return detailsData.episode_run_time[0];
  } else {
    return 0;
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
export function verifyMovieOrShow(data) {
  return data?.first_air_date === "";
}

/**
 * Helper Function
 *
 * Returns how many times the user has watched the title
 *
 * @param {string} normalizedTitle - The normalized title
 * @returns {int} Watch frequency of the title
 */
export function getTitleWatchFrequency(titleToDateFreq, normalizedTitle) {
  return titleToDateFreq[normalizedTitle].titleFrequency;
}

/*
 * ==============================
 *        PARSING FUNCTIONS
 * ==============================
 */

/**
 * Helper Function
 *
 * Removes all non-alphanumeric characters from a string
 *
 * @param {string} title - Title of a show or movie
 * @returns {string} Title with all alphanumeric's removed
 */
export function removeNonAlphaNumeric(title) {
  return title.replaceAll(/[^a-z0-9\s]/gi, "");
}

/**
 * Parses the CSV Title and gets the TMDb Searchable Title
 *
 * @param {string} rawTitle - Title from CSV
 * @returns {string} Formatted and searchable TMDb Title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
export function getBaseTitle(rawTitle) {
  let parsedTitle = "";

  switch (true) {
    // TV Show
    case rawTitle.includes("Season"):
      parsedTitle = rawTitle.split(/(?=\s*Season)/i);
      break;
    // TV Show
    case rawTitle.includes("Limited Series"):
      parsedTitle = rawTitle.split(/(?=\s*Limited Series)/i);
      break;
    // TV Show
    case rawTitle.includes("Episode"):
      parsedTitle = rawTitle.split(/(?=\s*Episode)/i);
      break;
    // Either
    case rawTitle.includes("Volume"):
      parsedTitle = rawTitle.split(/(?=\s*Volume)/i);
      break;
    // Either
    case rawTitle.includes("Part"):
      parsedTitle = rawTitle.split(/(?=\s*Part)/i);
      break;
    // Either
    case rawTitle.includes("Chapter"):
      parsedTitle = rawTitle.split(/(?=\s*Chapter)/i);
      break;
    // Either
    case rawTitle.includes(":"):
      parsedTitle = rawTitle.split(/(?=\s*:)/i);
      break;
    default:
      // If no case matches, just keep the raw title as parsedTitle
      // This ensures it's an array with the raw title
      parsedTitle = [rawTitle];
      break;
  }

  // let trimmedTitle = rawTitle.split(":")[0].trim();
  parsedTitle = parsedTitle[0].replaceAll(":", "");
  return parsedTitle;
}

/**
 * Parses and removed all episodic related keywords from the title.
 *
 * @param {string} title - Title from CSV
 * @returns {title} The trimmed title
 */
export function removeEpisodicKeywords(title) {
  const separators = [
    "Season",
    "Episode",
    "Part",
    "Volume",
    "Limited Series",
    "Chapter",
  ];

  for (let sep of separators) {
    const idx = title.toLowerCase().indexOf(sep.toLowerCase());
    if (idx !== -1) {
      title = title.substring(0, idx).split(":").slice(0, -1).join(":").trim();
    }
  }
  return title.trim();
}

/**
 * Parses the CSV Date and gets the DateTime Object
 *
 * @param {string} rawDate - Date from CSV
 * @returns {Date|null} Date the title was watched
 */
export function getDate(rawDate) {
  const date = new Date(rawDate);

  if (isNaN(date)) {
    console.warn(`⚠️ Invalid date format: ${rawDate}`);
    return null;
  }
  return date;
}

/**
 * Helper Function
 *
 * Parses the Watch Providers API to verify if the title is on Netflix.
 *
 * @param {dict} watchProvidersData - Output from the Watch Providers TMDb API
 * @returns {bool} True if the title is on Netflix, otherwise returns false.
 */
export function isAvailableOnNetflix(watchProvidersData) {
  if (!watchProvidersData) {
    return false;
  }
  const PRIORITY_COUNTRIES = ["US", "GB", "CA", "AU", "IN"];
  const data = watchProvidersData?.results;
  for (const country in PRIORITY_COUNTRIES) {
    const flatrate = data?.[country]?.flatrate || [];
    if (flatrate.some((p) => p.provider_name === "Netflix")) {
      return true;
    }
  }

  for (const country in data) {
    if (PRIORITY_COUNTRIES.includes(country)) continue;
    const flatrate = data?.[country]?.flatrate || [];
    if (flatrate.some((p) => p.provider_name === "Netflix")) {
      return true;
    }
  }

  return false;
}

export function isOnMajorPlatform(watchProviders) {
  const majorPlatforms = ["Netflix", "Hulu", "Max", "Disney Plus"];
  const regions = ["US", "CA", "GB"];

  for (const country of regions) {
    const flatrate = watchProviders?.results?.[country]?.flatrate || [];
    if (flatrate.some((p) => majorPlatforms.includes(p.provider_name))) {
      return true;
    }
  }

  return false;
}

export function isValidString(str) {
  if (typeof str === "string" && str.trim().length > 0) {
    return true;
  }
  return false;
}
