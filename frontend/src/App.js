import React from "react";
import Carousel from "./components/Carousel";
import Background from "./components/Background";

function App() {
    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
            <Background />
            <Carousel />
        </div>
    );
}

export default App;
