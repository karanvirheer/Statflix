const express = require("express");
const multer = require("multer");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3001;

// Replace with your own TMDb API key
const apiKey = process.env.API_KEY;
const tmdbUrl = "https://api.themoviedb.org/3";

const options = {
  method: "GET",
  url: "https://api.themoviedb.org/3/authentication",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
};

axios
  .request(options)
  .then((res) => console.log(res.data))
  .catch((err) => console.error(err));
