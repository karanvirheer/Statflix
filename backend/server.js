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
// async function parseCSV() {
//   const results = [];
//   const promises = [];
//   const titles = [];

//   return new Promise((resolve, reject) => {
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on("data", (row) => {
//         if (row.Title) {
//           const promise = getTitle(row.Title)
//             .then((title) => titles.push(title))
//             .catch(console.error); // optional error handling
//           promises.push(promise);
//         }
//       })
//       .on("end", async () => {
//         await Promise.all(promises);
//         console.log("CSV file successfully processed!");
//         for (const title of titles){
//           console.log(title);
//           getID(title).then((id) => results.push(id))
//         }
//         console.log(results);
//         resolve(results); // resolve with results if needed
//       })
//       .on("error", reject); // catch stream errors
//   });
// }


// parseCSV();


async function parseCSV() {
  const results = [];
  const titlePromises = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (row.Title) {
          const titlePromise = getTitle(row.Title);
          titlePromises.push(titlePromise);
        }
      })
      .on("end", async () => {
        try {
          const titles = await Promise.all(titlePromises);
          const results = [];
      
          for (const title of titles) {
            const id = await getID(title);
            results.push(id);
          }
      
          console.log("✅ CSV processing done.");
          console.log(results);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      });
  });
}
parseCSV();

async function getID(parsedTitle) {
  // Check cache first
  if (cache[parsedTitle]) {
    console.log(`✅ Cache hit: ${parsedTitle}`);
    return cache[parsedTitle]; // Return cached result
    
  }

  // Not in cache, make API calls
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
    console.log(result);
    cache[parsedTitle] = result; // Save result to cache
    return result;
  }

  // Optional delay to avoid hammering the API in case of no result
  await new Promise((r) => setTimeout(r, 300));

  cache[parsedTitle] = null; // Still cache null to avoid repeated failed lookups
  return null;
}

