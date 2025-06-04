import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

function StatsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [statsText] = useState(
    location.state?.statsText || "⚠️ No stats found.",
  );

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
        padding: "20px",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "800px",
          width: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          padding: "30px 20px",
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
            textAlign: "center",
            color: "#FFF",
            marginBottom: "15px",
            fontSize: "1.8rem",
          }}
        >
          📊 StatFlix Summary
        </h1>

        {/* 🛠️ Under Construction Notice */}
        <div
          style={{
            backgroundColor: "#333",
            borderLeft: "6px solid #E50914",
            padding: "12px 16px",
            marginBottom: "20px",
            borderRadius: "6px",
            width: "100%",
            fontSize: "0.95rem",
            lineHeight: "1.5",
          }}
        >
          ⚠️ This section is still under construction. Stats are accurate but
          not yet styled.
        </div>

        {/* 🏠 Home Button */}
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#E50914",
            color: "white",
            padding: "10px 24px",
            border: "none",
            borderRadius: "6px",
            fontSize: "1rem",
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: "20px",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#c40811")}
          onMouseLeave={(e) => (e.target.style.background = "#E50914")}
        >
          ← Return Home
        </button>

        {/* 📊 Stats Text */}
        <pre
          style={{
            backgroundColor: "#1a1a1a",
            color: "#e0e0e0",
            padding: "20px",
            borderRadius: "10px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            lineHeight: "1.5",
            overflowY: "auto",
            maxHeight: "70vh",
            width: "100%",
            boxShadow: "0 0 10px rgba(0,0,0,0.4)",
            fontSize: "0.9rem",
          }}
        >
          {statsText}
        </pre>
      </div>
    </div>
  );
}

export default StatsPage;
