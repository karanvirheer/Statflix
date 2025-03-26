import React, { useState } from "react";
import "../styles/Carousel.css";

const Carousel = () => {
    const [index, setIndex] = useState(0);

    const items = [
        {
            title: "Average Rating",
            value: "4.5",
            image: "https://images.pexels.com/photos/9821386/pexels-photo-9821386.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
        },
        {
            title: "Total Runtime",
            value: "500 hours",
            image: "https://via.placeholder.com/400x200?text=Image+2"
        },
        {
            title: "Top Genres",
            value: "Drama, Comedy",
            image: "https://via.placeholder.com/400x200?text=Image+3"
        }
    ];

    const moveSlide = (direction) => {
        setIndex((prevIndex) => (prevIndex + direction + items.length) % items.length);
    };

    return (
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
    );
};

export default Carousel;
