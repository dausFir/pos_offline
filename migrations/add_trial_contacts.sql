-- Migration: Add trial contacts table for lead generation
-- Description: Create table to store trial user contact forms

CREATE TABLE IF NOT EXISTS trial_contacts (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    name        TEXT     NOT NULL,
    email       TEXT     NOT NULL,
    phone       TEXT     NOT NULL DEFAULT '',
    message     TEXT     NOT NULL DEFAULT '',
    interest    TEXT     NOT NULL DEFAULT 'upgrade', -- 'upgrade', 'demo', 'support'
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded   BOOLEAN  NOT NULL DEFAULT 0,
    notes       TEXT     NOT NULL DEFAULT ''
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_trial_contacts_email ON trial_contacts(email);
CREATE INDEX IF NOT EXISTS idx_trial_contacts_date ON trial_contacts(submitted_at);