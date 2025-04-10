const fs = require("fs");
const csv = require("csv-parser");
const { searchTVShow, searchMovie, tvDetails } = require("./tmdb");
require("dotenv").config();

const filePath = "./ViewingActivity.csv"; // CSV should be in same folder

// Helper Function
// Extracts the valid title from the string title
function getShowName(rawTitle) {
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
  }
  // The title is everything before "Season"
  let showTitle = parsedTitle[0].trim();

  console.log(showTitle); // Output: "Formula 1: Drive to Survive:"
}

async function processCSV(filePath) {
  const titles = [];
  const cache = {}; // Simple in-memory cache
  getShowName("");
  return;

  // return new Promise((resolve, reject) => {
  //   fs.createReadStream(filePath)
  //     .pipe(csv())
  //     .on("data", (row) => {
  //       if (row["Title"]) titles.push(getShowName(row["Title"]));
  //     })
  //     .on("end", async () => {
  //       try {
  //         const results = [];
  //
  //         for (const title of titles) {
  //           if (cache[title]) {
  //             console.log(`Cache hit for: ${title}`);
  //             results.push(cache[title]);
  //             continue;
  //           }
  //
  //           console.log("Searching for:", title);
  //           let data = await searchTVShow(title);
  //
  //           if (!data?.results?.length) {
  //             data = await searchMovie(title);
  //           }
  //
  //           const match = data?.results?.[0];
  //           if (match) {
  //             const result = {
  //               title,
  //               type: match.media_type || (match.first_air_date ? "tv" : "movie"),
  //               tmdbId: match.id,
  //               popularity: match.popularity,
  //               genres: match.genre_ids,
  //               country: match.origin_country,
  //             };
  //             cache[title] = result; // Save to cache
  //             console.log(await tvDetails(match.id));
  //             results.push(result);
  //           } else {
  //             console.warn(`No match found for: ${title}`);
  //           }
  //
  //           await new Promise((r) => setTimeout(r, 300));
  //         }
  //
  //         console.log("Final Results:\n", JSON.stringify(results, null, 2));
  //         resolve();
  //       } catch (err) {
  //         console.error("Error during processing:", err);
  //         reject(err);
  //       }
  //     });
  // });
}

processCSV(filePath).catch((err) => {
  console.error("Failed to process CSV:", err);
});
