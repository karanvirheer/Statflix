import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/statflix_logo-01.svg";
import { event as trackEvent } from "../lib/analytics";

function HomePage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const wheelLock = useRef(false);

  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setMessage("");

    // GA: user selected a file
    if (picked) {
      trackEvent("csv_selected", {
        page: "home",
        file_name: picked.name,
        file_type: picked.type || "unknown",
      });
    }
  };

  const handleUpload = async () => {
    // GA: user clicked upload/analyze
    trackEvent("click_upload_analyze", {
      page: "home",
      has_file: !!file,
      file_name: file?.name || "",
    });

    if (!file) {
      setMessage("Please select a CSV first.");
      return;
    }

    navigate("/sample-loading", { state: { useSample: false, file } });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;

    // optional guard: only accept CSV-ish files
    const isCsv =
      dropped.type === "text/csv" ||
      dropped.name.toLowerCase().endsWith(".csv") ||
      dropped.type === "application/vnd.ms-excel";

    if (!isCsv) {
      setMessage("Please drop a .csv file.");
      trackEvent("csv_drop_rejected", {
        page: "home",
        file_name: dropped.name,
        file_type: dropped.type || "unknown",
      });
      return;
    }

    setFile(dropped);
    setMessage("");

    // GA: user dropped a CSV file
    trackEvent("csv_dropped", {
      page: "home",
      file_name: dropped.name,
      file_type: dropped.type || "unknown",
    });
  };

  return (
    <main className="page">
      <div className="container">
        <section className="hero-card">
          <header className="header">
            <div className="brand">
              <img className="brand-logo" src={logo} alt="Statflix" />
              <div className="brand-sub">
                <p className="tagline">Your streaming habits, visualized.</p>
              </div>
            </div>
          </header>

          <div className="callout">
            <strong>Heads up:</strong> this is a live demo — the backend may
            take ~60 seconds to wake up on free hosting.
          </div>

          <div className="grid-2">
            {/* Instructions */}
            <div className="panel">
              <h2 className="section-title">Instructions</h2>
              <ul className="instructions">
                <li>
                  <span className="step">1</span>
                  <span>Log into your Netflix account</span>
                </li>
                <li>
                  <span className="step">2</span>
                  <span>
                    Open <strong>Account</strong> from the profile menu
                  </span>
                </li>
                <li>
                  <span className="step">3</span>
                  <span>
                    Under <strong>Edit settings</strong>, select your profile
                  </span>
                </li>
                <li>
                  <span className="step">4</span>
                  <span>
                    Open <strong>Viewing activity</strong>
                  </span>
                </li>
                <li>
                  <span className="step">5</span>
                  <span>
                    Click <strong>Download all</strong> at the bottom
                  </span>
                </li>
                <li>
                  <span className="step">6</span>
                  <span>Upload that CSV here</span>
                </li>
              </ul>
            </div>

            {/* Upload */}
            <div className="panel upload-box">
              <h2 className="section-title">Upload your CSV</h2>

              <div
                className={`dropzone ${isDragging ? "dropzone--active" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  id="csvInput"
                  className="file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                />

                <div className="dropzone-title">NetflixViewingActivity.csv</div>
                <div className="dropzone-sub">
                  {file
                    ? `Selected: ${file.name}`
                    : "Choose a CSV or drag & drop it here"}
                </div>

                <div className="dropzone-actions">
                  <label
                    className="btn btn-file"
                    htmlFor="csvInput"
                    onClick={() =>
                      trackEvent("click_choose_csv", {
                        page: "home",
                        has_file: !!file,
                      })
                    }
                  >
                    {file ? "Change CSV" : "Choose CSV"}
                  </label>

                  {file ? (
                    <span className="file-chip">
                      <span className="file-chip-dot" />
                      Ready to upload
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleUpload}>
                  Upload & Analyze
                </button>
              </div>

              {message ? (
                <div className="callout callout--error">{message}</div>
              ) : null}

              <div className="divider">OR</div>

              <button
                className="btn btn-secondary btn-or"
                onClick={() => {
                  trackEvent("click_try_sample", { page: "home" });
                  navigate("/sample-loading", {
                    state: { useSample: true },
                    replace: true,
                  });
                }}
              >
                Try Sample Data
              </button>

              <div className="or-help">
                No upload required — explore the dashboard instantly with
                curated sample data.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default HomePage;
