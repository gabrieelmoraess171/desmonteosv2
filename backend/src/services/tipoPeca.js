// O tipo vem do começo do título. Um nome citado depois ("alma do
// para-choque", "suporte de farol") não muda o produto que foi vendido.
const COMPOSTOS = [
  ['Para-choque', /^para[\s-]*choques?\b/],
  ['Paralama', /^para[\s-]*lamas?\b/],
  ['Para-brisa', /^para[\s-]*brisas?\b/],
  ['Para-barro', /^para[\s-]*barros?\b/],
  ['Porta-malas', /^porta[\s-]*malas?\b/],
  ['Porta-luvas', /^porta[\s-]*luvas?\b/],
  ['Porta-copos', /^porta[\s-]*copos?\b/],
  ['Quebra-sol', /^quebra[\s-]+(?:sol|sois)\b/],
  ['Semieixo', /^semi[\s-]*eixos?\b/],
];

// Singularização explícita: não se retira um "s" de qualquer palavra.
const NOMES = new Map([
  ['macaneta', 'Maçaneta'], ['macanetas', 'Maçaneta'],
  ['console', 'Console'], ['consoles', 'Console'],
  ['lanterna', 'Lanterna'], ['lanternas', 'Lanterna'],
  ['farol', 'Farol'], ['farois', 'Farol'],
  ['retrovisor', 'Retrovisor'], ['retrovisores', 'Retrovisor'],
  ['fechadura', 'Fechadura'], ['fechaduras', 'Fechadura'],
  ['porta', 'Porta'], ['portas', 'Porta'],
  ['motor', 'Motor'], ['motores', 'Motor'],
  ['painel', 'Painel'], ['paineis', 'Painel'],
  ['moldura', 'Moldura'], ['molduras', 'Moldura'],
  ['acabamento', 'Acabamento'], ['acabamentos', 'Acabamento'],
  ['suporte', 'Suporte'], ['suportes', 'Suporte'],
  ['grade', 'Grade'], ['grades', 'Grade'],
  ['alma', 'Alma'], ['almas', 'Alma'],
  ['absorvedor', 'Absorvedor'], ['absorvedores', 'Absorvedor'],
  ['tampao', 'Tampão'], ['tampoes', 'Tampão'],
  ['tampa', 'Tampa'], ['tampas', 'Tampa'],
  ['parafuso', 'Parafuso'], ['parafusos', 'Parafuso'],
  ['amortecedor', 'Amortecedor'], ['amortecedores', 'Amortecedor'],
  ['banco', 'Banco'], ['bancos', 'Banco'],
  ['mola', 'Mola'], ['molas', 'Mola'],
  ['bomba', 'Bomba'], ['bombas', 'Bomba'],
  ['bobina', 'Bobina'], ['bobinas', 'Bobina'],
  ['sensor', 'Sensor'], ['sensores', 'Sensor'],
  ['compressor', 'Compressor'], ['compressores', 'Compressor'],
  ['radiador', 'Radiador'], ['radiadores', 'Radiador'],
  ['bateria', 'Bateria'], ['baterias', 'Bateria'],
  ['disco', 'Disco'], ['discos', 'Disco'],
  ['pinca', 'Pinça'], ['pincas', 'Pinça'],
  ['alavanca', 'Alavanca'], ['alavancas', 'Alavanca'],
  ['puxador', 'Puxador'], ['puxadores', 'Puxador'],
  ['carpete', 'Carpete'], ['carpetes', 'Carpete'],
  ['forro', 'Forro'], ['forros', 'Forro'],
  ['volante', 'Volante'], ['volantes', 'Volante'],
  ['airbag', 'Airbag'], ['airbags', 'Airbag'],
  ['reservatorio', 'Reservatório'], ['reservatorios', 'Reservatório'],
  ['roda', 'Roda'], ['rodas', 'Roda'],
  ['pneu', 'Pneu'], ['pneus', 'Pneu'],
  ['lente', 'Lente'], ['lentes', 'Lente'],
  ['eixo', 'Eixo'], ['eixos', 'Eixo'],
  ['kit', 'Kit'], ['kits', 'Kit'],
  ['jogo', 'Jogo'], ['jogos', 'Jogo'],
  ['peca', 'Peça'], ['pecas', 'Peça'],
]);

export function tipoPeca(nome) {
  const original = String(nome || '').trim().replace(/^[^\p{L}\p{N}]+/u, '');
  const normalizado = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!normalizado) return 'Produto sem nome';

  for (const [tipo, padrao] of COMPOSTOS) {
    if (padrao.test(normalizado)) return tipo;
  }

  const palavra = original.match(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/u)?.[0];
  if (!palavra) return 'Produto sem nome';
  const chave = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return NOMES.get(chave) || palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1).toLocaleLowerCase('pt-BR');
}
