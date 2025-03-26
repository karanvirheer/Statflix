import React, { useState } from "react";
import "../styles/Carousel.css";

const Carousel = () => {
    const [index, setIndex] = useState(0);

    const items = [
        { title: "Average Rating", value: "4.5" },
        { title: "Total Runtime", value: "500 hours" },
        { title: "Top Genres", value: "Drama, Comedy" },
    ];

    const moveSlide = (direction) => {
        setIndex((prevIndex) => (prevIndex + direction + items.length) % items.length);
    };

    return (
        <div className="carousel">
            {items.map((item, i) => (
                <div key={i} className={`carousel-item ${i === index ? "active" : ""}`}>
                    <h2>{item.title}</h2>
                    <p>{item.value}</p>
                </div>
            ))}
            <button className="prev" onClick={() => moveSlide(-1)}>&#10094;</button>
            <button className="next" onClick={() => moveSlide(1)}>&#10095;</button>
        </div>
    );
};

export default Carousel;
