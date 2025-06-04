CREATE TABLE tmdb_titles (
  serial_id INTEGER PRIMARY KEY,
  normalized_title TEXT,
  original_title TEXT,
  tmdb_id INTEGER UNIQUE,
  media_type INTEGER,
  genres TEXT,
  runtime INTEGER,
  number_of_episodes INTEGER,
  episode_run_time INTEGER,
  release_date TEXT,
  first_air_date TEXT,
  poster_path TEXT,
  created_at TEXT,
  updated_at TEXT
);

