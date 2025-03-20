const express = require("express");
const multer = require("multer");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3000;

require("dotenv").config();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Set up multer for file uploads (CSV files)
const upload = multer({ dest: "uploads/" });

// Basic route for handling CSV upload and TMDb API request
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Parse the CSV file, and make API calls to TMDb to fetch data
    const csvData = req.file; // You’ll need to process this data

    // Example API call to TMDb
    const tmdbResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movie_id}?api_key=${TMDB_API_KEY}`,
    );

    // Process TMDb response here

    res.json({
      message: "File uploaded and processed!",
      data: tmdbResponse.data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
