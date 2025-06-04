import React, { useEffect, useState } from "react";

function StatsPage() {
  const [statsText, setStatsText] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch(
        process.env.REACT_APP_API_BASE_URL + "/api/stats",
      );
      const data = await res.text(); // get plain text
      setStatsText(data);
    };

    fetchStats();
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
        <h1
          style={{
            textAlign: "left",
            color: "#E50914",
            marginBottom: "20px",
          }}
        >
          📊 StatFlix Summary
        </h1>
        <pre
          style={{
            backgroundColor: "#1a1a1a",
            color: "#e0e0e0",
            padding: "20px",
            borderRadius: "10px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap", // ✅ keeps spacing + wraps long lines
            lineHeight: "1.5",
            overflowY: "auto", // ✅ enables vertical scroll
            maxHeight: "80vh", // ✅ limits height to 80% of viewport
            fontSize: "0.95rem",
            boxShadow: "0 0 10px rgba(0,0,0,0.4)",
          }}
        >
          {statsText}
        </pre>{" "}
      </div>
    </div>
  );
}

export default StatsPage;
