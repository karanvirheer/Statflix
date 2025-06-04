import React, { useState, useEffect } from "react";
import Background from "../components/Background";
import "../styles/Carousel.css";

const Carousel = () => {
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/stats");
        const data = await res.json();
        const path = "https://image.tmdb.org/t/p/original/";

        const topGenresStr = data.topGenres.map(([genre]) => genre).join(", ");
        const mostWatchedTitlesStr = data.topWatchedTitles
          .map(([title, data]) => `${title}: ${data.minutes} mins`)
          .join("\n");

        const slides = [
          {
            title: "Top Genres",
            value: topGenresStr,
            image: "https://via.placeholder.com/400x200?text=Genres",
          },
          {
            title: "Unique Titles Watched",
            value: data.numTotalUniqueTitlesWatched,
            image: "https://via.placeholder.com/400x200?text=Unique+Titles",
          },
          {
            title: "Unique TV Shows Watched",
            value: data.numUniqueTVShowsWatched,
            image: "https://via.placeholder.com/400x200?text=Unique+Titles",
          },
          {
            title: "Unique Movies Watched",
            value: data.numUniqueMoviesWatched,
            image: "https://via.placeholder.com/400x200?text=Unique+Titles",
          },
          {
            title: "Total Watch Time",
            value: `${data.totalWatchTimeMinutes} min (${data.totalWatchTimeHours.toFixed(1)} hrs)`,
          },
          {
            title: "Top 5 Titles",
            value: mostWatchedTitlesStr,
            image: "https://via.placeholder.com/400x200?text=Top+5+Titles",
          },
          {
            title: "Most Watched",
            value: `${data.mostWatchedTitle.title} (${data.mostWatchedTitle.minutes} min)`,
            image: path + data.mostWatchedTitle.posterPath,
          },
          {
            title: "Most Binged Show",
            value: `${data.mostBingedShow.title} (Streak: ${data.mostBingedShow.eps_binged} episodes)`,
            image: path + data.mostBingedShow.posterPath,
          },
          {
            title: "Oldest TV Show Watched",
            value: `${data.oldestWatchedShow.title} (Released: ${data.oldestWatchedShow.date})`,
            image: path + data.oldestWatchedShow.posterPath,
          },
          {
            title: "Most Binged Show",
            value: `${data.oldestWatchedMovie.title} (Released: ${data.oldestWatchedMovie.date})`,
            image: path + data.oldestWatchedMovie.posterPath,
          },
        ];

        setItems(slides);
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  const moveSlide = (direction) => {
    setIndex(
      (prevIndex) => (prevIndex + direction + items.length) % items.length,
    );
  };

  return (
    <div className="carousel-container">
      <Background />
      <div className="carousel">
        {items.map((item, i) => (
          <div
            key={i}
            className={`carousel-item ${i === index ? "active" : ""}`}
          >
            <div className="carousel-image">
              <img src={item.image} alt={item.title} />
            </div>
            <div className="carousel-content">
              <h2>{item.title}</h2>
              <p>{item.value}</p>
            </div>
          </div>
        ))}
        <button className="prev" onClick={() => moveSlide(-1)}>
          &#10094;
        </button>
        <button className="next" onClick={() => moveSlide(1)}>
          &#10095;
        </button>
      </div>
    </div>
  );
};

export default Carousel;
