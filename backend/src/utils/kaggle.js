import * as db from "../db/db.js";

async function useKaggleDatasets() {
  await db.createTmdbTable().catch(console.error);
  await parseKaggleShowDataset();
  await parseKaggleMovieDataset();
}

async function parseKaggleMovieDataset() {
  const idList = [];
  const titleList = [];

  let kaggleMovieDict = {};

  const kaggleMovieFilePath = "./data/kaggle/movies_dataset.csv";

  return new Promise((resolve, reject) => {
    fs.createReadStream(kaggleMovieFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const showID = row.show_id;
        const title = row.title;

        if (helper.isValidString(showID) && helper.isValidString(title)) {
          kaggleMovieDict[showID] = {
            normalizedTitle: helper.getBaseTitle(title),
            originalTitle: title,
          };

          idList.push(showID);
          titleList.push(title);
        }
      })
      .on("end", async () => {
        try {
          for (const showID of Object.keys(kaggleMovieDict)) {
            const csvData = kaggleMovieDict[showID];
            let detailsData = await api.getMovieDetails(showID);
            let result = {
              normalized_title: csvData.normalizedTitle || null,
              original_title: csvData.originalTitle || null,
              tmdb_id: showID || null,
              media_type: 1,
              genres: detailsData.genres || null,
              runtime: detailsData.runtime || null,
              number_of_episodes: null,
              episode_run_time: null,
              release_date: detailsData.release_date || null,
              first_air_date: null,
              poster_path: detailsData.poster_path || null,
            };
            await db.cacheResult(result);

            helper.print(`LOGGED: ${csvData.normalizedTitle}`);
            await new Promise((r) => setTimeout(r, 300));
          }

          console.log("✅ Kaggle Movie Dataset processing done.");

          resolve({ idList, titleList });
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function parseKaggleShowDataset() {
  const idList = [];
  const titleList = [];

  let kaggleShowDict = {};

  const kaggleShowFilePath = "./data/kaggle/shows_dataset.csv";

  return new Promise((resolve, reject) => {
    fs.createReadStream(kaggleShowFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const showID = row.show_id;
        const title = row.title;

        if (helper.isValidString(showID) && helper.isValidString(title)) {
          kaggleShowDict[showID] = {
            normalizedTitle: helper.getBaseTitle(title),
            originalTitle: title,
          };

          idList.push(showID);
          titleList.push(title);
        }
      })
      .on("end", async () => {
        try {
          for (const showID of Object.keys(kaggleShowDict)) {
            const csvData = kaggleShowDict[showID];
            let detailsData = await api.getTVDetails(showID);
            let result = {
              normalized_title: csvData.normalizedTitle || null,
              original_title: csvData.originalTitle || null,
              tmdb_id: showID || null,
              media_type: 0,
              genres: detailsData.genres || null,
              runtime: null,
              number_of_episodes: detailsData.number_of_episodes || null,
              episode_run_time: await helper.getEpisodeRunTime(detailsData),
              release_date: null,
              first_air_date: detailsData.first_air_date || null,
              poster_path: detailsData.poster_path || null,
            };
            await db.cacheResult(result);
            helper.print(`LOGGED: ${csvData.normalizedTitle}`);
            await new Promise((r) => setTimeout(r, 300));
          }

          console.log("✅ Kaggle TV Show Dataset processing done.");

          resolve({ idList, titleList });
        } catch (error) {
          reject(error);
        }
      });
  });
}
