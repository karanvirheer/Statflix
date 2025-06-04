import * as helper from "./helpers.js";

/*
 * ==============================
 *        STATISTICS FUNCTIONS
 * ==============================
 */

/**
 * Prints out all the User Statistics to the console.
 */
export function printUserStats(userStats) {
  if (Object.keys(userStats.genres).length > 0) {
    helper.print("TOP GENRES");
    getTopGenres(userStats);
  }

  if (userStats.numUniqueTitlesWatched.total > 0) {
    helper.print("UNIQUE TITLES WATCHED");
    getUniqueTitlesWatched(userStats);
  }

  if (userStats.totalWatchTime > 0) {
    helper.print("TOTAL WATCH TIME");
    getTotalWatchTime(userStats);

    helper.print("TOP 5 TITLES BY WATCH TIME");
    getTopWatchedTitles(userStats);

    helper.print("YOU SPENT THE MOST TIME WATCHING");
    getMostWatchedTitle(userStats);
  }

  if (userStats.mostBingedShow.eps_binged > 0) {
    helper.print("MOST BINGED SHOW");
    getMostBingedShow(userStats);
  }

  if (userStats.showsCompleted.length > 1) {
    helper.print("NUMBER OF SHOWS COMPLETED");
    getNumShowsCompleted(userStats);
  }

  if (userStats.oldestWatchedShow.title != "") {
    helper.print("OLDEST WATCHED SHOW");
    getOldestWatchedShow(userStats);
  }

  if (userStats.oldestWatchedMovie.title != "") {
    helper.print("OLDEST WATCHED MOVIE");
    getOldestWatchedMovie(userStats);
  }

  if (userStats.missedTitles.count > 0) {
    helper.print("MISSED TITLES");
    getMissedTitles(userStats);
  }
}

/*
 * ------------------------------
 *         TOP GENRES
 * ------------------------------
 */

/**
 * Updates userStats["genres"] dict to keep track of the occurrences of each genre.
 *
 * @param {string} genreArray - Genres of current title
 */
export function logTopGenres(userStats, genreArray) {
  if (typeof genreArray === typeof "hello") {
    genreArray = JSON.parse(genreArray);
  }
  for (const genre of genreArray) {
    console.log(genre.name);
    if (genre.name in userStats.genres) {
      userStats.genres[genre.name] += 1;
    } else {
      userStats.genres[genre.name] = 1;
    }
  }
}

/**
 * Prints the Top 3 Genres based on the userStats
 */
export function getTopGenres(userStats) {
  userStats.topGenres = Object.entries(userStats.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [key, value] of userStats.topGenres) {
    console.log(`${key}: ${value}`);
  }
}

/*
 * ---------------------------- --
 *    UNIQUE TITLES WATCHED
 * ------------------------------
 */

export function logUniqueShowsAndMovies(userStats, mediaType) {
  if (mediaType == 0) {
    userStats.numUniqueTitlesWatched.tvShows += 1;
  } else {
    userStats.numUniqueTitlesWatched.movies += 1;
  }
}

export function logUniqueTitlesWatched(userStats) {
  userStats.numUniqueTitlesWatched.total += 1;
}

/**
 * Prints Total Unique Titles Watched of the user
 */
export function getUniqueTitlesWatched(userStats) {
  console.log(`Total Titles: ${userStats.numUniqueTitlesWatched.total}`);
  console.log(`Total TV Shows: ${userStats.numUniqueTitlesWatched.tvShows}`);
  console.log(`Total Movies: ${userStats.numUniqueTitlesWatched.movies}`);
}

/*
 * ------------------------------
 *    TOTAL WATCH TIME
 * ------------------------------
 */

/**
 * Updates userStats.totalWatchTime] and userStats[watch_time_by_title] for each title
 *
 * @function
 * @param {string} normalizedTitle - Normalized title used as the key
 * @param {int} mediaType - TV Show (1) or Movie (0)
 * @param {int} timeWatched - Number of minutes watched
 */
export function logWatchTime(
  userStats,
  title,
  mediaType,
  timeWatched,
  titleToData,
) {
  userStats.totalWatchTime += timeWatched;

  if (userStats.watchTimeByTitle[title]) {
    userStats.watchTimeByTitle[title].minutes += timeWatched;
  } else {
    userStats.watchTimeByTitle[title] = {
      mediaType: mediaType,
      posterPath: titleToData[title].poster_path,
      minutes: timeWatched,
    };
  }
}

/**
 * Prints userStats["total_watch_time"] of the user
 */
export function getTotalWatchTime(userStats) {
  console.log(`${userStats.totalWatchTime} minutes`);
  console.log(
    `That’s about ${(userStats.totalWatchTime / 60).toFixed(2)} hours`,
  );
}

/*
 * ------------------------------
 *    TOP WATCHED TITLES
 * ------------------------------
 */

export function logTopWatchedTitles(userStats) {
  userStats.topWatchedTitles = Object.entries(userStats.watchTimeByTitle)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5);
}

/**
 * Prints Top 5 Watched Titles by Watch Time
 */
export function getTopWatchedTitles(userStats) {
  userStats.topWatchedTitles.forEach(([title, data]) => {
    console.log(`${title}: ${data.minutes} minutes`);
  });
}

/*
 * ------------------------------
 *  MOST WATCHED TITLE (SINGULAR)
 * ------------------------------
 */

/**
 * Prints Most Watched Title
 */
export function logMostWatchedTitle(userStats, titleToData) {
  const [title, mostWatched] = Object.entries(userStats.watchTimeByTitle).sort(
    (a, b) => b[1].minutes - a[1].minutes,
  )[0];

  userStats.mostWatchedTitle.title = title;
  userStats.mostWatchedTitle.posterPath = titleToData[title].poster_path;
  userStats.mostWatchedTitle.minutes = mostWatched.minutes;
}

export function getMostWatchedTitle(userStats) {
  console.log(
    `${userStats.mostWatchedTitle.title} (${userStats.mostWatchedTitle.minutes} minutes)`,
  );
}

/*
 * ------------------------------
 *     MOST BINGED SHOW
 * ------------------------------
 */

/*
 * A binge is defined as a show you've watched back-to-back a minimum of once within 24 hours of the previous episode.
 */
export function logMostBingedShow(userStats, titleToDateFreq, titleToData) {
  function getHourDiff(date2, date1) {
    return (date2 - date1) / (1000 * 60 * 60);
  }

  let mostBingedShow = "";

  // Dates the show was binged on
  let mostBingedDates = [];

  // Longest number of episodes binged of a show
  let longestBingeStreak = 1;

  // 2 hour gap allowed between eps
  const minEpisodeGap = 2;

  for (const [title, value] of Object.entries(titleToDateFreq)) {
    // Sorted Dates - Descending Fashion
    let dateList = value.datesWatched.sort((a, b) => a - b);

    // Current longest streak of episodes binged of title
    let currentBingeStreak = 1;

    let epsWatchedConsecutively = 1;

    let currBingedDates = [dateList[0]];
    // let dateStartedBinge = null;

    // Going through the dates of each Title
    for (let i = 1; i < dateList.length; i++) {
      // if (dateStartedBinge == null) {
      //   dateStartedBinge = dateList[i - 1];
      //   dates.push(dateList[i - 1]);
      // }

      const diff = getHourDiff(dateList[i], dateList[i - 1]);

      // Episodes watched within the same day
      if (diff <= minEpisodeGap) {
        epsWatchedConsecutively += 1;
        currentBingeStreak += 1;
        currBingedDates.push(dateList[i]);

        // Continue binge streak ONLY if you've watched 3 eps back-to-back already
      } else if (epsWatchedConsecutively >= 3 && diff < 30) {
        // reset consecutive count because you stopped watching back-to-back
        epsWatchedConsecutively = 1;
        currentBingeStreak += 1;
        currBingedDates.push(dateList[i]);

        // FULL RESET
        // Episodes not watched within minEpisodeGap
        // Did not meet epsWatchedConsecutively >= 3 to keep streak alive
      } else {
        epsWatchedConsecutively = 1;
        currentBingeStreak = 1;
        currBingedDates = [];
      }

      if (currentBingeStreak > longestBingeStreak) {
        mostBingedShow = title;
        longestBingeStreak = currentBingeStreak;
        mostBingedDates = currBingedDates;
      }
    }
  }
  userStats.mostBingedShow = {
    title: mostBingedShow,
    posterPath: titleToData[mostBingedShow].poster_path,
    eps_binged: longestBingeStreak,
    dates_binged: mostBingedDates,
  };
}

export function getMostBingedShow(userStats) {
  const title = userStats.mostBingedShow.title;

  const dates = userStats.mostBingedShow.dates_binged;

  if (dates.length > 0) {
    const startBinge = dates[0].toDateString();
    const endBinge = dates[dates.length - 1].toDateString();

    console.log(
      `${title}: ${userStats.mostBingedShow.eps_binged} episodes watched back-to-back!`,
    );

    console.log(`You binged from ${startBinge} to ${endBinge}!`);
  } else {
    console.log("No dates available");
  }
}

/*
 * ------------------------------
 *     NUMBER OF SHOWS COMPLETED
 * ------------------------------
 */

export function logNumShowsCompleted(
  titleToDateFreq,
  userStats,
  numEps,
  showName,
) {
  let titleFrequency = helper.getTitleWatchFrequency(titleToDateFreq, showName);

  // helper.print(`${showName} || API: ${numEps} || USER: ${titleFrequency}`);

  if (titleFrequency >= numEps) {
    userStats.showsCompleted[0] += 1;
    userStats.showsCompleted.push(showName);
  }
}

export function getNumShowsCompleted(userStats) {
  console.log(`Amount Completed: ${userStats.showsCompleted[0]}`);
  for (let i = 1; i < userStats.showsCompleted.length; i++) {
    console.log(userStats.showsCompleted[i]);
  }
}

/*
 * ------------------------------
 *     OLDEST WATCHED SHOW
 * ------------------------------
 */

export function logOldestWatchedShowAndMovie(
  userStats,
  mediaType,
  release_date,
  title,
  titleToData,
) {
  let date = new Date(release_date);
  // TV Show
  if (mediaType == 0) {
    if (userStats.oldestWatchedShow.title == "") {
      userStats.oldestWatchedShow = {
        title: title,
        posterPath: titleToData[title].poster_path,
        dateObject: date,
        date: date.toDateString(userStats),
      };
    } else if (date < userStats.oldestWatchedShow.dateObject) {
      userStats.oldestWatchedShow = {
        title: title,
        posterPath: titleToData[title].poster_path,
        dateObject: date,
        date: date.toDateString(userStats),
      };
    }
    // Movie
  } else {
    if (userStats.oldestWatchedMovie.title == "") {
      userStats.oldestWatchedMovie = {
        title: title,
        posterPath: titleToData[title].poster_path,
        dateObject: date,
        date: date.toDateString(),
      };
    } else if (date < userStats.oldestWatchedMovie.dateObject) {
      userStats.oldestWatchedMovie = {
        title: title,
        posterPath: titleToData[title].poster_path,
        dateObject: date,
        date: date.toDateString(),
      };
    }
  }
}

export function getOldestWatchedShow(userStats) {
  console.log(
    `${userStats.oldestWatchedShow.title}: ${userStats.oldestWatchedShow.date}`,
  );
}

export function getOldestWatchedMovie(userStats) {
  console.log(
    `${userStats.oldestWatchedMovie.title}: ${userStats.oldestWatchedMovie.date}`,
  );
}

/*
 * ------------------------------
 *     MISSING TITLES
 * ------------------------------
 */
export function logMissedTitles(userStats, title) {
  userStats.missedTitles.count += 1;
  userStats.missedTitles.titlesArr.push(title);
}

export function getMissedTitles(userStats) {
  console.log(`Missed: ${userStats.missedTitles.count}`);
  console.log(userStats.missedTitles.titlesArr);
}
