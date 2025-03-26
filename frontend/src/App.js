import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CarouselPage from "./pages/CarouselPage";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/carousel" element={<CarouselPage />} />
            </Routes>
        </Router>
    );
}

export default App;
