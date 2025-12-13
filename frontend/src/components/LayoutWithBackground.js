import React from "react";
import BackgroundHome from "./BackgroundHome";

const LayoutWithBackground = ({ children }) => {
  return (
    <div className="app-shell">
      <BackgroundHome />
      <div className="app-content">{children}</div>
    </div>
  );
};

export default LayoutWithBackground;
