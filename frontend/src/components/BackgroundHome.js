import React from "react";

const BackgroundHome = () => {
  return (
    <div className="bg-scene" aria-hidden="true">
      <video
        className="bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      >
        <source src={`/bg-motion.webm`} type="video/webm" />
      </video>

      <div className="bg-overlay" />
      <div className="bg-vignette" />
      <div className="bg-noise" />
    </div>
  );
};

export default BackgroundHome;
