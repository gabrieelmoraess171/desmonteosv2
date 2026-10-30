export function redirectUriLocal(uri) {
  try {
    const host = new URL(String(uri || '')).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.endsWith('.localhost');
  } catch { return false; }
}

export function urlPublicaBackend(ambiente = process.env) {
  for (const valor of [ambiente.BACKEND_PUBLIC_URL, ambiente.API_PUBLIC_URL, ambiente.RENDER_EXTERNAL_URL]) {
    try {
      const url = new URL(String(valor || '').trim());
      if (url.protocol === 'https:' && !redirectUriLocal(url.href) && !url.username && !url.password) return url.origin;
    } catch { /* Tenta a próxima origem configurada. */ }
  }
  return '';
}

export function resolverRedirectUriMl(redirectBanco = '', ambiente = process.env) {
  const configurada = String(ambiente.ML_REDIRECT_URI || '').trim() || String(redirectBanco || '').trim();
  const publica = urlPublicaBackend(ambiente);
  // Mantém callbacks explícitos públicos, inclusive caminhos de domínios próprios.
  // Uma configuração local antiga não deve impedir o uso da origem pública.
  if (configurada && (!redirectUriLocal(configurada) || !publica)) return configurada;
  if (publica) return `${publica}/api/mercadolivre/oauth/callback`;
  return configurada || `http://localhost:${ambiente.PORT || 3001}/api/mercadolivre/oauth/callback`;
}

export function resolverUrlFrontend(ambiente = process.env) {
  const configurada = String(ambiente.FRONTEND_URL || '').trim();
  const noRender = ambiente.RENDER === 'true' || Boolean(ambiente.RENDER_EXTERNAL_URL);
  if (noRender && (!configurada || redirectUriLocal(configurada))) return 'https://desmonteos.onrender.com';
  return (configurada || 'http://localhost:3000').replace(/\/+$/, '');
}
