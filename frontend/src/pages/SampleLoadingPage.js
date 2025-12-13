import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function apiUrl(base, path) {
  const b = (base || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return b ? `${b}${p}` : p; // if no base, use relative (/api/...) so CRA proxy can handle it
}

export default function SampleLoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const useSample = location.state?.useSample ?? true;
  const file = location.state?.file ?? null;

  // CRA only injects env vars prefixed with REACT_APP_
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

  const [progress, setProgress] = useState({ current: 0, total: 1, title: "" });
  const [status, setStatus] = useState("Analyzing your history…");
  const [sub, setSub] = useState("Preparing analysis…");
  const [error, setError] = useState("");

  const startedRef = useRef(false);
  const jobDoneRef = useRef(false);

  const pct = useMemo(() => {
    const total = Number(progress.total || 0);
    const current = Number(progress.current || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
  }, [progress]);

  // Start the backend job once
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();

    (async () => {
      try {
        setError("");
        setStatus("Analyzing your history…");
        setSub("Warming up the backend…");

        const startUrl = apiUrl(API_BASE_URL, useSample ? "/api/sample" : "/api/upload");

        let res;
        if (useSample) {
          res = await fetch(startUrl, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          });
        } else {
          if (!file) throw new Error("No CSV file provided.");
          const formData = new FormData();
          formData.append("file", file);
          res = await fetch(startUrl, {
            method: "POST",
            body: formData,
            cache: "no-store",
            signal: controller.signal,
          });
        }

        if (!res.ok) throw new Error(`Failed to start analysis (${res.status})`);
        jobDoneRef.current = true;

        // Wait until stats-json exists (avoids getting stuck at 98% forever)
        const statsUrl = apiUrl(API_BASE_URL, "/api/stats-json");
        for (let i = 0; i < 60; i++) {
          const s = await fetch(statsUrl, { cache: "no-store" });
          if (s.ok) {
            navigate("/stats");
            return;
          }
          await new Promise((r) => setTimeout(r, 400));
        }

        // Fallback: still navigate; StatsPage can show an error if needed
        navigate("/stats");
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error(e);
        setError(e?.message || "Failed to analyze history.");
        setStatus("Couldn’t analyze your history");
        setSub("Try again, or go back and re-upload your CSV.");
      }
    })();

    return () => controller.abort();
  }, [API_BASE_URL, file, navigate, useSample]);

  // Poll progress
  useEffect(() => {
    const controller = new AbortController();

    const tick = async () => {
      try {
        const url = apiUrl(API_BASE_URL, "/api/progress");
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;

        const data = await res.json();
        setProgress(data);

        if (data?.title) {
          setSub(`Now processing: ${data.title}`);
        } else if (jobDoneRef.current) {
          setSub("Finalizing stats…");
        } else {
          setSub("Matching titles with TMDb…");
        }
      } catch {
        // ignore transient errors during startup/shutdown
      }
    };

    tick();
    const interval = setInterval(tick, 450);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [API_BASE_URL]);

  const onHome = async () => {
    try {
      await fetch(apiUrl(API_BASE_URL, "/api/reset"), { method: "POST" });
    } catch {}
    navigate("/");
  };

  // ---- styles (kept inline so you only change one file) ----
  const wrap = {
    height: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  };

  const card = {
    width: "min(920px, 92vw)",
    borderRadius: "18px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
    padding: "28px 28px 22px",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  };

  const headerRow = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
  };

  const titleStyle = {
    fontSize: "28px",
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.95)",
  };

  const subStyle = {
    marginTop: "6px",
    color: "rgba(255,255,255,0.70)",
    fontSize: "15px",
    lineHeight: 1.4,
  };

  const pill = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.85)",
    fontSize: "13px",
    whiteSpace: "nowrap",
  };

  const dot = {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#ff2b2b",
    boxShadow: "0 0 10px rgba(255,43,43,0.65)",
  };

  const barOuter = {
    marginTop: "16px",
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const barInner = {
    height: "100%",
    width: `${pct}%`,
    borderRadius: "999px",
    background: "linear-gradient(90deg, rgba(255,43,43,0.95), rgba(51,255,104,0.95))",
    transition: "width 240ms ease",
  };

  const counts = {
    marginTop: "10px",
    color: "rgba(255,255,255,0.65)",
    fontSize: "13px",
  };

  const info = {
    marginTop: "18px",
    padding: "16px 16px",
    borderRadius: "14px",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const infoHead = {
    fontWeight: 700,
    color: "rgba(255,255,255,0.85)",
    marginBottom: "6px",
  };

  const infoText = {
    color: "rgba(255,255,255,0.70)",
    margin: 0,
    lineHeight: 1.5,
    fontSize: "14px",
  };

  const homeBtn = {
    marginTop: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.9)",
    padding: "10px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={headerRow}>
          <div>
            <h1 style={titleStyle}>{status}</h1>
            <div style={subStyle}>{error ? sub : sub}</div>
          </div>

          <div style={pill}>
            <span style={dot} />
            <span>{pct}%</span>
          </div>
        </div>

        <div style={barOuter}>
          <div style={barInner} />
        </div>

        <div style={counts}>
          {progress.current} / {progress.total}
        </div>

        <div style={info}>
          <div style={infoHead}>What’s happening?</div>
          <p style={infoText}>
            Statflix matches titles with TMDb, then computes genres, watch time, and binge streaks — all from your Netflix history.
          </p>
        </div>

        <button style={homeBtn} onClick={onHome}>
          Home
        </button>
      </div>
    </div>
  );
}
