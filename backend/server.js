const fs = require("fs");
const csv = require("csv-parser");
const { searchTVShow, searchMovie, tvDetails } = require("./tmdb");
require("dotenv").config();

const filePath = "./ViewingActivity.csv"; // CSV should be in same folder
const cache = {};

// Extracts the valid title from the string title
// Returns the
async function getTitle(rawTitle) {
  // title =  "Formula 1: Drive to Survive: Season 1";
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

// Parses the NetflixViewingActivity.csv
// Returns an array of [ { tmdbId: $(tmdbId) }, ... ]
async function parseCSV() {
  const results = [];
  const promises = []; // Collect all promises

  fs.createReadStream(filePath) // Read file
    .pipe(csv()) // Parse CSV file
    .on("data", (row) => {
      // Triggered on every row
      if (row.Title) {
        const promise = getTitle(row.Title)
          .then((title) => {
            return getID(title);
          })
          .then((id) => {
            results.push(id);
          });
        promises.push(promise); // Add the promise to the promises array
      }
    })
    .on("end", async () => {
      // When parsing ends
      await Promise.all(promises); // Wait for all async operations to finish
      console.log("CSV file successfully processed!");
      console.log(results); // Log the results after everything is finished
    });
}

parseCSV();

// Calls the TMDb API to get the JSON for the show based on the parsedTitle
// Returns the TMDb ID
async function getID(parsedTitle) {
  let data = await searchTVShow(parsedTitle);

  if (!data?.results?.length) {
    data = await searchMovie(parsedTitle);
  }

  const match = data?.results?.[0];
  if (match) {
    const result = {
      title: parsedTitle,
      tmdbId: match.id,
    };
    return result;
  }

  await new Promise((r) => setTimeout(r, 300));

  return null;
}
