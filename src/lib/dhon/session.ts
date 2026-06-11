const STORAGE_KEY = 'astrabon_dhon_session_id';

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredSessionId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredSessionId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
