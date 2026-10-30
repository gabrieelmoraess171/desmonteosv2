const FAMILIAS = [
  ['Maçaneta', /\bmacanetas?\b/],
  ['Console', /\bconsoles?\b/],
  ['Lanterna', /\blanternas?\b/],
  ['Farol', /\bfaro(?:l|is)\b/],
  ['Retrovisor', /\bretrovisores?\b/],
  ['Fechadura', /\bfechaduras?\b/],
  ['Para-choque', /\bpara[ -]?choques?\b/],
  ['Porta', /\bportas?\b/],
  ['Paralama', /\bpara[ -]?lamas?\b/],
  ['Motor', /\bmotores?\b/],
  ['Painel', /\bpaine(?:l|is)\b/],
  ['Moldura', /\bmolduras?\b/],
  ['Acabamento', /\bacabamentos?\b/],
  ['Suporte', /\bsuportes?\b/],
  ['Grade', /\bgrades?\b/],
];

export function tipoPeca(nome) {
  const original = String(nome || '').trim();
  const normalizado = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [familia, padrao] of FAMILIAS) {
    if (padrao.test(normalizado)) return familia;
  }
  return original || 'Produto sem nome';
}
