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
export function verifyMovieOrShow(data) {
  return data?.first_air_date === "";
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
export function getOriginalTitle(normalizedToOriginal, normalizedTitle) {
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
 * Normalizes a title string to use as a consistent key.
 * Strips special characters, lowercases, and trims.
 *
 * @param {string} title - The raw or parsed title
 * @returns {string} Normalized title string
 */
export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/gi, "");
}

/**
 * Parses the CSV Title and gets the TMDb Searchable Title
 *
 * @param {string} rawTitle - Title from CSV
 * @returns {string} Formatted and searchable TMDb Title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
export function getTitle(rawTitle) {
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
export function getDate(rawDate) {
  const date = new Date(rawDate);

  if (isNaN(date)) {
    console.warn(`⚠️ Invalid date format: ${rawDate}`);
    return null;
  }
  return date;
}
