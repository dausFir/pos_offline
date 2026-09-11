export function isLicenseToken(value) {
  return /^poslic-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value || '').trim());
}
