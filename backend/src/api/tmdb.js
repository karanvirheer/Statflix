import axios from "axios";

const tmdb = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.API_KEY}`,
  },
});

/*
 * ==============================
 *        TV & MOVIE API
 * ==============================
 */

/**
 * Searches for a TV show
 *
 * @param {string} query - Title of TV show
 * @returns {dict} All matching TV shows with that title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
const searchTVAndMovie = async (query) => {
  try {
    const res = await tmdb.get("/search/multi", {
      params: { query, page: 1 },
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching TV show:", err.response?.data || err.message);
    return false;
  }
};

/*
 * ==============================
 *        TV SHOW API
 * ==============================
 */

/**
 * Searches for a TV show
 *
 * @param {string} query - Title of TV show
 * @returns {dict} All matching TV shows with that title
 * Reference: https://developer.themoviedb.org/reference/search-tv
 */
const searchTVShow = async (query) => {
  try {
    const res = await tmdb.get("/search/tv", {
      params: { query, page: 1 },
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching TV show:", err.response?.data || err.message);
    return false;
  }
};

/**
 * Gets the TV details for a TV show
 *
 * @param {string} series_id - TMDb ID for a TV  show
 * @returns {dict} Details about the TV show
 * Reference: https://developer.themoviedb.org/reference/tv-series-details
 */
const getTVDetails = async (series_id) => {
  try {
    const res = await tmdb.get("/tv/" + String(series_id));
    return res.data;
  } catch (err) {
    console.error("Error fetching TV show:", err.response?.data || err.message);
    return false;
  }
};

/**
 * Searches for the platforms that stream this title
 *
 * @param {string} series_id - Id of the series
 * @returns {dict} All watch provides for that title
 * Reference: https://api.themoviedb.org/3/tv/{series_id}/watch/providers
 */
const searchTVWatchProvider = async (series_id) => {
  try {
    const res = await tmdb.get("/tv/" + String(series_id) + "/watch/providers");
    return res.data;
  } catch (err) {
    console.error(
      "Error fetching watch providers:",
      err.response?.data || err.message,
    );
    return false;
  }
};

/*
 * ==============================
 *        MOVIE API
 * ==============================
 */

/**
 * Searches for a movie
 *
 * @param {string} query - Title of movie
 * @returns {dict} All matching movies with that title
 * Reference: https://developer.themoviedb.org/reference/search-movie
 */
const searchMovie = async (query) => {
  try {
    const res = await tmdb.get("/search/movie", {
      params: { query, page: 1 },
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching Movie:", err.response?.data || err.message);
    return false;
  }
};

/**
 * Gets the movie details for a movie
 *
 * @param {string} series_id - TMDb ID for a movie
 * @returns {dict} Details about the movie
 * Reference: https://developer.themoviedb.org/reference/movie-details
 */
const getMovieDetails = async (movie_id) => {
  try {
    const res = await tmdb.get("/movie/" + String(movie_id));
    return res.data;
  } catch (err) {
    console.error("Error fetching movie:", err.response?.data || err.message);
    return false;
  }
};

/**
 * Searches for the platforms that have this movie
 *
 * @param {string} series_id - Id of the movie
 * @returns {dict} All watch provides for that movie
 * Reference: https://api.themoviedb.org/3/movie/{movie_id}/watch/providers
 */
const searchMovieWatchProvider = async (movie_id) => {
  try {
    const res = await tmdb.get(
      "/movie/" + String(movie_id) + "/watch/providers",
    );
    return res.data;
  } catch (err) {
    console.error(
      "Error fetching watch providers:",
      err.response?.data || err.message,
    );
    return false;
  }
};

export {
  searchTVShow,
  searchMovie,
  getTVDetails,
  getMovieDetails,
  searchTVWatchProvider,
  searchMovieWatchProvider,
  searchTVAndMovie,
};
