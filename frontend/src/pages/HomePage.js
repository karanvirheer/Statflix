import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundHome from "../components/BackgroundHome";
import logo from "../assets/statflix_logo-01.svg";  

function HomePage() {
    const navigate = useNavigate();

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append("file", file);
    
        try {
            const res = await fetch("http://localhost:3001/api/upload", {
                method: "POST",
                body: formData,
            });
    
            if (!res.ok) {
                throw new Error("Upload failed");
            }
    
            console.log("✅ File uploaded and processed");
            navigate("/carousel"); // Only navigate once data is ready
        } catch (err) {
            console.error("❌ Upload error:", err);
            alert("There was a problem uploading your file.");
        }
    };
    

    return (
        <div style={{
            position: "relative",
            height: "100vh",
            width: "100vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            overflow: "hidden",
        }}>
            <BackgroundHome />

            <div style={{
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
            }}>
                <img src={logo} alt="Statflix Logo" style={{ width: "70%", maxWidth: "300px", marginBottom: "10px" }} />

                <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
                    Your streaming habits, visualized.
                </p>

                {/* Instructions + Upload Section */}
                <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center" }}>
                    {/* Instructions */}
                    <div style={{ textAlign: "left" }}>
                        <h2 style={{ fontSize: "1.5rem", color: "#E50914" }}>Instructions</h2>
                        <ul style={{ padding: 0, listStyleType: "none", fontSize: "1rem" }}>
                            <li>📁 Download your streaming history</li>
                            <li>📊 Upload the CSV file here</li>
                            <li>🚀 Explore your watch stats</li>
                        </ul>
                    </div>

                    {/* Upload Section */}
                    <div style={{
                        background: "#fff",
                        padding: "20px",
                        borderRadius: "10px",
                        textAlign: "center",
                        color: "#000",
                        minWidth: "250px",
                        boxShadow: "0px 5px 15px rgba(255, 255, 255, 0.2)"
                    }}>
                        <h2 style={{ fontSize: "1.5rem" }}>Upload your CSV</h2>
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "block", margin: "10px auto" }} />
                        <button onClick={() => navigate("/carousel")} style={{
                            background: "#E50914",
                            color: "white",
                            padding: "10px 20px",
                            border: "none",
                            borderRadius: "5px",
                            fontSize: "1rem",
                            cursor: "pointer",
                            marginTop: "10px",
                            fontWeight: "bold",
                        }}>
                            Upload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
