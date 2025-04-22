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

                const slides = [
                    {
                        title: "Top Genres",
                        value: data.topGenres.map(([genre]) => genre).join(", "),
                        image: "https://via.placeholder.com/400x200?text=Genres"
                    },
                    {
                        title: "Unique Titles Watched",
                        value: data.uniqueTitles,
                        image: "https://via.placeholder.com/400x200?text=Unique+Titles"
                    },
                    {
                        title: "Total Watch Time",
                        value: `${data.totalWatchTimeMinutes} min (${data.totalWatchTimeHours.toFixed(1)} hrs)`,
                        image: "https://via.placeholder.com/400x200?text=Watch+Time"
                    },
                    {
                        title: "Top 5 Titles",
                        value: data.topTitles.map(([title, mins]) => `${title}: ${mins} min`).join(" | "),
                        image: "https://via.placeholder.com/400x200?text=Top+5+Titles"
                    },
                    {
                        title: "Most Watched",
                        value: `${data.mostWatched.title} (${data.mostWatched.minutes} min)`,
                        image: "https://via.placeholder.com/400x200?text=Most+Watched"
                    },
                    {
                        title: "Most Binged Show",
                        value: `${data.mostBinged.title} (Streak: ${data.mostBinged.streak} days)`,
                        image: "https://via.placeholder.com/400x200?text=Most+Binged"
                    }
                ];

                setItems(slides);
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchStats();
    }, []);

    const moveSlide = (direction) => {
        setIndex((prevIndex) => (prevIndex + direction + items.length) % items.length);
    };

    return (
        <div className="carousel-container">
            <Background />
            <div className="carousel">
                {items.map((item, i) => (
                    <div key={i} className={`carousel-item ${i === index ? "active" : ""}`}>
                        <div className="carousel-image">
                            <img src={item.image} alt={item.title} />
                        </div>
                        <div className="carousel-content">
                            <h2>{item.title}</h2>
                            <p>{item.value}</p>
                        </div>
                    </div>
                ))}
                <button className="prev" onClick={() => moveSlide(-1)}>&#10094;</button>
                <button className="next" onClick={() => moveSlide(1)}>&#10095;</button>
            </div>
        </div>
    );
};

export default Carousel;
