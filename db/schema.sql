CREATE TABLE IF NOT EXISTS entries (
  id          BIGSERIAL PRIMARY KEY,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS stories (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  title           TEXT NOT NULL,
  prompt_context  TEXT,
  body            TEXT NOT NULL,
  source_entry_ids BIGINT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS questions (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  text         TEXT NOT NULL,
  company_tags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS matches (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_id    BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  strength    TEXT NOT NULL CHECK (strength IN ('strong','weak')),
  reason      TEXT NOT NULL,
  UNIQUE (entry_id, question_id)
);
