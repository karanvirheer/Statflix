import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function SampleLoadingPage() {
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [message, setMessage] = useState("Loading sample data...");
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const hasFetched = useRef(false); // 🛡️ guards duplicate call
  const navigate = useNavigate();

  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";

  useEffect(() => {
    const fetchSample = async () => {
      if (hasFetched.current) return; // ⛔ prevent double-call
      hasFetched.current = true;

      try {
        const res = await fetch(`${API_BASE_URL}/api/sample`);
        if (!res.ok) throw new Error("Failed to load sample");
        setSampleLoaded(true);
      } catch (err) {
        console.error(err);
        setMessage("❌ Failed to load sample data.");
      }
    };

    fetchSample();
  }, []); // ✅ empty deps: run only on first mount

  useEffect(() => {
    // if (!sampleLoaded) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/progress`);
        const data = await res.json();
        setProgress(data);

        if (data.current >= data.total) {
          clearInterval(interval);
          navigate("/stats");
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
        <progress
          value={progress.current}
          max={progress.total}
          style={{ width: "300px", height: "20px" }}
        />
      </div>
    </div>
  );
}

export default SampleLoadingPage;
