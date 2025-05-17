import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
});

export default pool;

export async function getCachedResult(normalizedTitle) {
  const res = await pool.query(
    `SELECT * FROM tmdb_titles WHERE normalized_title = $1`,
    [normalizedTitle],
  );
  return res.rows[0] || null;
}

export async function cacheResult(data) {
  const {
    normalized_title,
    original_title,
    tmdb_id,
    media_type,
    genres,
    runtime,
    number_of_episodes,
    episode_run_time,
    release_date,
    first_air_date,
    poster_path,
  } = data;

  const safeGenres = JSON.stringify(genres);

  try {
    await pool.query(
      `INSERT INTO tmdb_titles (
        normalized_title, original_title, tmdb_id, media_type, genres,
        runtime, number_of_episodes, episode_run_time,
        release_date, first_air_date, poster_path
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11
      )
      ON CONFLICT (tmdb_id) DO UPDATE SET
        normalized_title = EXCLUDED.normalized_title,
        original_title = EXCLUDED.original_title,
        media_type = EXCLUDED.media_type,
        genres = EXCLUDED.genres,
        runtime = EXCLUDED.runtime,
        number_of_episodes = EXCLUDED.number_of_episodes,
        episode_run_time = EXCLUDED.episode_run_time,
        release_date = EXCLUDED.release_date,
        first_air_date = EXCLUDED.first_air_date,
        poster_path = EXCLUDED.poster_path,
        updated_at = CURRENT_TIMESTAMP;`,
      [
        normalized_title,
        original_title,
        tmdb_id,
        media_type,
        safeGenres,
        runtime,
        number_of_episodes,
        episode_run_time,
        release_date,
        first_air_date,
        poster_path,
      ],
    );
  } catch (err) {
    console.error("Error inserting TMDb result:", err);
    throw err;
  }
}

export async function createTmdbTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tmdb_titles (
      serial_id SERIAL PRIMARY KEY,
      normalized_title TEXT,
      original_title TEXT,
      tmdb_id INT UNIQUE,
      media_type INT CHECK (media_type IN (0, 1)), -- 0 = TV, 1 = Movie
      genres JSONB,
      runtime INT,
      number_of_episodes INT,
      episode_run_time INT,
      release_date DATE,
      first_air_date DATE,
      poster_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_normalized_title ON tmdb_titles (normalized_title);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_tmdb_id ON tmdb_titles (tmdb_id);`,
  );

  console.log("✅ tmdb_titles table is ready.");
}
