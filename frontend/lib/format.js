export function defaultAvatar(username) {
  const name = (username || 'U').trim();
  const initial = (name[0] || 'U').toUpperCase();
  const palettes = [
    ['#4f46e5', '#7c3aed'],
    ['#059669', '#10b981'],
    ['#d97706', '#f59e0b'],
    ['#db2777', '#f43f5e'],
    ['#2563eb', '#38bdf8'],
    ['#7c3aed', '#c084fc'],
    ['#0891b2', '#2dd4bf'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pair = palettes[Math.abs(hash) % palettes.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${pair[0]}"/><stop offset="100%" stop-color="${pair[1]}"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g)"/><text x="50" y="55" font-family="system-ui, sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function avatarSrc(user) {
  return user?.avatarUrl || defaultAvatar(user?.username);
}

export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function previewText(text, max = 72) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (!value) return 'No messages yet';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
