export const THEMES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
});

export function normalizeTheme(value) {
  return value === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
}

export function nextTheme(value) {
  return normalizeTheme(value) === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
}
