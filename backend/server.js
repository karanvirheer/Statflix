const axios = require("axios");
const { searchTVShow, searchMovie } = require("./tmdb.js");
require("dotenv").config();

// Replace with your own TMDb API key
const apiKey = process.env.API_KEY;
const tmdbUrl = "https://api.themoviedb.org/3";
const title = "Temptation Island";

// (async () => {
//   const query = title;
//   try {
//     const data = await searchTVShow(query);
//     console.log(JSON.stringify(data, null, 2));
//   } catch (err) {
//     console.error("Failed to fetch TV show data");
//   }
// })();

// (async () => {
//   const query = "Interstellar";
//   try {
//     const data = await searchMovie(query);
//     console.log(JSON.stringify(data, null, 2));
//   } catch (err) {
//     console.error("Failed to fetch Movie data");
//   }
// })();
