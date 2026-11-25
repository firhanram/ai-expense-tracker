-- The schema in docs/PLAN.md. D1 migrations, not Effect's Migrator (ADR-0010).

CREATE TABLE category (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE expense (
  id           TEXT PRIMARY KEY,
  amount       INTEGER NOT NULL,            -- whole Rupiah, > 0 for outflow, < 0 for a refund
  category_id  INTEGER NOT NULL REFERENCES category(id),
  merchant     TEXT,
  note         TEXT,
  occurred_at  TEXT NOT NULL,               -- 'YYYY-MM-DD', no time
  created_at   TEXT NOT NULL,               -- ISO 8601 UTC
  status       TEXT NOT NULL                -- 'draft' | 'confirmed' | 'discarded'
                 CHECK (status IN ('draft','confirmed','discarded')),
  needs_review INTEGER NOT NULL DEFAULT 0,
  receipt_key  TEXT                          -- R2 object key, null if no receipt
);

CREATE INDEX expense_status_date ON expense(status, occurred_at);
CREATE INDEX expense_draft ON expense(status) WHERE status = 'draft';

CREATE TABLE chat_message (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,                -- 'user' | 'assistant'
  content     TEXT NOT NULL,                -- prose shown in the bubble
  ui_text     TEXT,                         -- raw OpenUI Lang, null for user turns
  created_at  TEXT NOT NULL
);
