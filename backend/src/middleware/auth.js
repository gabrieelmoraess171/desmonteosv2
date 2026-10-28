export function autenticar(req, res, next) {
  const tokenEsperado = process.env.API_TOKEN;

  // Em desenvolvimento, sem API_TOKEN configurado, a rota fica aberta.
  if (!tokenEsperado) {
    return next();
  }

  const [scheme, token] = String(req.headers.authorization || '').split(' ');

  if (scheme === 'Bearer' && token === tokenEsperado) {
    return next();
  }

  return res.status(401).json({ error: 'Não autorizado' });
}
