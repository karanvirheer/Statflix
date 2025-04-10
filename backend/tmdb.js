const axios = require("axios");

const tmdb = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.API_KEY}`,
  },
});

const searchTVShow = async (query) => {
  try {
    const res = await tmdb.get("/search/tv", {
      params: { query },
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching TV show:", err.response?.data || err.message);
    throw err;
  }
};

const searchMovie = async (query) => {
  try {
    const res = await tmdb.get("/search/movie", {
      params: { query },
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching Movie:", err.response?.data || err.message);
    throw err;
  }
};

// https://developer.themoviedb.org/reference/tv-series-details
const tvDetails = async (series_id) => {
  try {
    const res = await tmdb.get("/tv/" + String(series_id));
    return res.data;
  } catch (err) {
    console.error("Error fetching TV show:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = {
  searchTVShow,
  searchMovie,
  tvDetails,
};
