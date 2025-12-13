import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";

export default function SampleLoadingPage() {
  const [progress, setProgress] = useState({ current: 0, total: 1, title: "" });
  const [message, setMessage] = useState("Loading…");
  const hasFetched = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();
  const useSample = location.state?.useSample ?? true;
  const file = location.state?.file ?? null;

  useEffect(() => {
    const run = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        setMessage(useSample ? "Loading sample data…" : "Uploading your CSV…");

        // Optional: clear any previous run BEFORE starting a new one
        await fetch(`${API_BASE_URL}/api/reset`, { method: "POST" }).catch(
          () => {}
        );

        if (useSample) {
          const res = await fetch(`${API_BASE_URL}/api/sample`, {
            method: "GET",
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to load sample data");
        } else {
          if (!file) throw new Error("No file provided.");
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: "POST",
            body: formData,
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to upload user file");
        }

        // At this point backend has finished (your /api/sample awaits main())
        navigate("/stats", { replace: true });
      } catch (err) {
        console.error(err);
        setMessage("❌ Failed to load stats.");
      }
    };

    run();
  }, [navigate, useSample, file]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/progress`, {
          cache: "no-store",
        });
        const data = await res.json();
        setProgress(data);
      } catch (err) {
        console.error("Progress poll failed:", err);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

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
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "820px",
          width: "92%",
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "34px",
          borderRadius: "16px",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0px 18px 60px rgba(0,0,0,0.55)",
          backdropFilter: "blur(14px)",
        }}
      >
        <h1 style={{ margin: 0 }}>{message}</h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>
          {progress.current} / {progress.total}
        </p>

        <p style={{ opacity: 0.85, marginTop: 8 }}>
          {progress.title || "Fetching title" + ".".repeat(progress.current % 4)}
        </p>

        <progress
          value={progress.current}
          max={progress.total}
          style={{ width: "320px", height: "18px", marginTop: 10 }}
        />
      </div>
    </div>
  );
}
