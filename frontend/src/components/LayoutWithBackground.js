import React from "react";
import BackgroundHome from "./BackgroundHome";

const LayoutWithBackground = ({ children }) => {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <BackgroundHome />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
};

export default LayoutWithBackground;
