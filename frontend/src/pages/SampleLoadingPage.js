import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function SampleLoadingPage() {
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [message, setMessage] = useState("Loading sample data...");
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const hasFetched = useRef(false); // 🛡️ guards duplicate call
  const navigate = useNavigate();

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    const fetchSample = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        // 1. Trigger backend processing
        const res = await fetch(`${API_BASE_URL}/api/sample`, {
          method: "GET",
          cache: "no-store", // force bypass browser cache
        });
        if (!res.ok) throw new Error("Failed to load sample");

        // 2. Wait for backend to fully write statsOutput

        let statsText = "";
        let maxRetries = 10;

        for (let i = 0; i < maxRetries; i++) {
          const statsRes = await fetch(`${API_BASE_URL}/api/stats`, {
            cache: "no-store",
          });
          statsText = await statsRes.text();

          if (statsText && !statsText.includes("No output")) {
            navigate("/stats", { state: { statsText } });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 500)); // wait 0.5s
        }

        throw new Error("Stats not ready after retries");
      } catch (err) {
        console.error(err);
        setMessage("❌ Failed to load sample data.");
      }
    };

    fetchSample();
  }, []);

  useEffect(() => {
    // if (!sampleLoaded) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/progress`);
        const data = await res.json();
        setProgress(data);

        if (data.current >= data.total) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Progress poll failed:", err);
        clearInterval(interval);
        setMessage("❌ Failed to fetch progress.");
      }
    }, 300);

    return () => clearInterval(interval);
  }, [sampleLoaded, navigate]);

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100%",
        maxWidth: "100vw",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "800px",
          width: "90%",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          padding: "40px",
          borderRadius: "15px",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <h1>{message}</h1>
        <p>{`${progress.current} / ${progress.total}`}</p>
        <p>{`${progress.title}`}</p>
        <progress
          value={progress.current}
          max={progress.total}
          style={{ width: "300px", height: "20px" }}
        />

        <div
          style={{
            marginTop: "30px",
            backgroundColor: "#222",
            padding: "15px 20px",
            borderRadius: "10px",
            color: "#f1f1f1",
            fontSize: "0.95rem",
            lineHeight: "1.5",
            maxWidth: "600px",
            textAlign: "left",
            boxShadow: "0 0 10px rgba(0,0,0,0.3)",
          }}
        >
          <strong>What’s happening?</strong>
          <p>
            Statflix is analyzing your streaming history: matching titles with
            TMDb using fuzzy logic, calculating genres, watch time, and binge
            streaks — all based on the sample data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SampleLoadingPage;
