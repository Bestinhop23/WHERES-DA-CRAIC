const USER_KEY = 'craic-user-id';

export function getOrCreateUserID(): string {
  const existing = localStorage.getItem(USER_KEY);
  if (existing) return existing;
  const generated = `user-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(USER_KEY, generated);
  return generated;
}

export function getDeviceFingerprint(): string {
  const ua = navigator.userAgent || 'unknown';
  const lang = navigator.language || 'en';
  const width = window.screen?.width ?? 0;
  const height = window.screen?.height ?? 0;
  return `${ua}|${lang}|${width}x${height}`.slice(0, 120);
}
