import { useState, useEffect, React } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/statflix_logo-01.svg";

function HomePage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  console.log("Base URL:", process.env.REACT_APP_API_BASE_URL);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }
    navigate("/sample-loading", {
      state: { useSample: false, file },
    });
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "2rem 1rem", // ✅ mobile padding
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: "900px", // ✅ desktop limit
          width: "100%", // ✅ full width on mobile
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          padding: "2rem",
          borderRadius: "15px",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <img
          src={logo}
          alt="Statflix Logo"
          style={{ width: "70%", maxWidth: "300px", marginBottom: "10px" }}
        />

        <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
          Your streaming habits, visualized.
        </p>

        <div
          style={{
            backgroundColor: "#222",
            color: "#ccc",
            padding: "10px 20px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontStyle: "italic",
            fontSize: "0.95rem",
          }}
        >
          ⚠️ This is a live demo. Please allow up to 60 seconds for the backend
          to wake up due to free hosting limitations.
        </div>

        {/* Instructions + Upload Section */}

        <div
          style={{
            display: "flex",
            flexDirection: "column", // ✅ always stack vertically
            gap: "2rem",
            width: "100%",
            alignItems: "center",
          }}
        >
          {/* Instructions */}
          <div style={{ textAlign: "left" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                color: "#E50914",
                marginBottom: "0.5rem",
                textAlign: "center",
              }}
            >
              Instructions
            </h2>

            <ul
              style={{
                padding: 0,
                listStyleType: "none",
                fontSize: "1rem",
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              <li>1. Log into your Netflix account</li>
              <li>
                2. Click on <strong>Account</strong> from the profile menu
              </li>
              <li>
                3. Scroll down to <strong>Edit settings</strong> and select your
                profile
              </li>
              <li>
                4. Click <strong>Viewing activity</strong> under your profile
                settings
              </li>
              <li>
                5. On the Viewing Activity page, click{" "}
                <strong>Download all</strong> at the bottom
              </li>
              <li>6. This will download a CSV file — upload that below!</li>
            </ul>
          </div>

          {/* Upload Section */}
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "10px",
              textAlign: "center",
              color: "#000",
              minWidth: "250px",
              boxShadow: "0px 5px 15px rgba(255, 255, 255, 0.2)",
            }}
          >
            <h2 style={{ fontSize: "1.5rem" }}>Upload your CSV</h2>
            <input
              type="file"
              accept=".csv"
              style={{ display: "block", margin: "10px auto", opacity: 1 }}
              onChange={handleFileChange}
            />
            <button
              onClick={handleUpload}
              style={{
                background: "#E50914",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "5px",
                fontSize: "1rem",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Upload
            </button>
            <p>{message}</p>
            <div style={{ margin: "15px 0", fontWeight: "bold" }}>OR</div>

            <button
              onClick={() =>
                navigate("/sample-loading", {
                  state: { useSample: true },
                  replace: true,
                })
              }
              style={{
                background: "#E50914",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "5px",
                fontSize: "1rem",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Try with Sample Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
