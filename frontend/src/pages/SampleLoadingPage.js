import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";

function SampleLoadingPage() {
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [message, setMessage] = useState("Loading sample data...");
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const hasFetched = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const useSample = location.state?.useSample ?? true;
  const file = location.state?.file ?? null;

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    return () => {
      fetch(`${API_BASE_URL}/api/reset`, {
        method: "POST",
      }).catch((err) => console.error("Reset failed", err));
    };
  }, [API_BASE_URL]);

  useEffect(() => {
    const runLoading = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        if (useSample) {
          const res = await fetch(`${API_BASE_URL}/api/sample`, {
            method: "GET",
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to load sample data");
        } else {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: "POST",
            body: formData,
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to upload user file");
        }
        // 2. Poll /api/stats until ready
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
          await new Promise((r) => setTimeout(r, 500));
        }

        throw new Error("Stats not ready after retries");
      } catch (err) {
        console.error(err);
        setMessage("❌ Failed to load stats.");
      }
    };

    runLoading();
  }, [API_BASE_URL, navigate, useSample, file]);

  useEffect(() => {
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
  }, [API_BASE_URL, sampleLoaded, navigate]);

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

        <p>
          {progress.title ||
            "Fetching title" + ".".repeat(progress.current % 4)}
        </p>

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
