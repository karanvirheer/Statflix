<p align="center">
  <img src="./frontend/src/assets/statflix_logo-01.svg" alt="StatFlix Banner" width="400"/>
</p>
StatFlix is a full-stack web application that helps users upload and analyze their Netflix viewing history. Users get a visual overview into their top genres, most-watched titles, viewing trends and more - similar to Spotify's Yearly Wrapped! 

# Features
- 📂 Upload your NetflixViewingHistory.csv
- 🔍 Normalize titles (no double-counting different seasons or volumes)
- 🎭 Enrich data using the TMDb API (genres, content type, runtime, etc.)
- 📈 Visual analytics (top genres, daily watch patterns, total hours)
- ⚡ PostgreSQL backend for persistent and scalable data storage
- 👥 Built to support multiple or simultaneous users

## Tech Stack

**Frontend**  
- [React.js](https://reactjs.org/) – UI library for building interactive interfaces  
- [TailwindCSS](https://tailwindcss.com/) – Utility-first CSS framework  

**Backend**  
- [Node.js](https://nodejs.org/) – JavaScript runtime for backend logic  
- [Express.js](https://expressjs.com/) – Web framework for building APIs  

**Database**  
- [PostgreSQL](https://www.postgresql.org/) – Relational database for storing user and title data  

**API & Data Enrichment**  
- [TMDb API](https://www.themoviedb.org/documentation/api) – Used to enrich Netflix titles with genres, runtime, etc.

**Deployment & Environment**  
- [Docker](https://www.docker.com/) – Containerized environment for consistent development and deployment  
- Vercel / Render - Hosting
