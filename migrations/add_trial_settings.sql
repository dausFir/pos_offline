-- Migration: Add trial version settings
-- Description: Initialize trial version configuration with 7-day trial period and 20 product limit

-- Insert trial configuration settings
INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES 
('is_trial_version', 'true', CURRENT_TIMESTAMP),
('trial_start_date', datetime('now'), CURRENT_TIMESTAMP),
('trial_expires_at', datetime('now', '+7 days'), CURRENT_TIMESTAMP),
('max_products', '20', CURRENT_TIMESTAMP);