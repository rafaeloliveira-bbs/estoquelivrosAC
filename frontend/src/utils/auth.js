export function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getUserRole() {
  return getUser()?.role ?? null;
}

export function getFilialIds() {
  return getUser()?.filial_ids ?? [];
}

export function isAuthenticated() {
  return getUser() !== null;
}
