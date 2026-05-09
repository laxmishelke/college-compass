DROP TABLE IF EXISTS saved_colleges;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS colleges;

CREATE TABLE colleges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(220) UNIQUE NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  type VARCHAR(60) NOT NULL,
  established_year INTEGER NOT NULL,
  rating NUMERIC(2, 1) NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5, 2),
  annual_fees INTEGER NOT NULL,
  average_package INTEGER,
  highest_package INTEGER,
  description TEXT NOT NULL,
  website VARCHAR(255),
  image_url TEXT,
  courses TEXT[] NOT NULL DEFAULT '{}',
  facilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_colleges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, college_id)
);

CREATE INDEX colleges_search_idx ON colleges USING GIN (
  to_tsvector('english', name || ' ' || city || ' ' || state || ' ' || type || ' ' || description)
);

CREATE INDEX saved_colleges_user_idx ON saved_colleges(user_id);
