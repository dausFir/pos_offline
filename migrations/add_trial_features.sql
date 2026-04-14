-- Migration: Add trial contacts and license key tracking tables
-- Description: Tables for tracking trial user contacts and license activations

CREATE TABLE IF NOT EXISTS trial_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    interest TEXT NOT NULL DEFAULT 'upgrade' CHECK(interest IN ('upgrade', 'demo', 'support')),
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    followed_up BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS license_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trial_contacts_email ON trial_contacts(email);
CREATE INDEX IF NOT EXISTS idx_trial_contacts_submitted ON trial_contacts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_license_activations_key ON license_activations(license_key);