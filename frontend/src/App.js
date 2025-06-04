import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LayoutWithBackground from "./components/LayoutWithBackground";
import SampleLoadingPage from "./pages/SampleLoadingPage";
import StatsPage from "./pages/StatsPage";

function App() {
  return (
    <Router>
      <LayoutWithBackground>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sample-loading" element={<SampleLoadingPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </LayoutWithBackground>
    </Router>
  );
}

export default App;
