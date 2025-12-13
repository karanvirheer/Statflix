// App.js
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomePage from "./pages/HomePage";
import LayoutWithBackground from "./components/LayoutWithBackground";
import SampleLoadingPage from "./pages/SampleLoadingPage";
import StatsPage from "./pages/StatsPage";
import { pageview } from "./lib/analytics";

function AppRoutes() {
  const location = useLocation();
  useEffect(() => {
    pageview(location.pathname + location.search);
  }, [location]);
  return (
    <LayoutWithBackground>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sample-loading" element={<SampleLoadingPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </AnimatePresence>
    </LayoutWithBackground>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
