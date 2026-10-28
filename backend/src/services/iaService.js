import dotenv from 'dotenv';

dotenv.config();

const MODELO_PADRAO = 'gemini-3.5-flash';
const MODELOS_RESERVA = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const TIMEOUT_MS = 15000;
const TIMEOUT_RESERVA_MS = 10000;
const TIMEOUT_FREELLMAPI_MS = 15000;

function limparTexto(valor, limite = 700) {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^["'`\s]+|["'`\s]+$/g, '')
    .trim()
    .slice(0, limite);
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido > 0 ? convertido : 0;
}

function resumoPeca(peca = {}) {
  let atributos = peca.atributos;

  if (atributos && typeof atributos === 'string') {
    try {
      const interpretado = JSON.parse(atributos);
      atributos = Array.isArray(interpretado)
        ? interpretado
            .map((item) =>
              item?.name
                ? `${item.name}: ${item.value_name || item.value || ''}`.trim()
                : ''
            )
            .filter(Boolean)
            .join(' | ')
        : interpretado;
    } catch {
      atributos = atributos;
    }
  } else if (atributos && typeof atributos === 'object') {
    atributos = Object.entries(atributos)
      .map(([chave, valor]) => `${chave}: ${valor}`)
      .join(' | ');
  }

  return [
    `Título do anúncio: ${peca.ml_titulo || peca.nome || 'peça sem título'}`,
    `Peça: ${peca.nome || 'não informada'}`,
    `Aplicação (veículos compatíveis): ${aplicacaoDaPeca(peca)}`,
    `Marca: ${peca.marca || 'não informada'}`,
    `Modelo: ${peca.modelo || 'não informado'}`,
    `Ano: ${peca.ano || 'não informado'}`,
    `Condição: ${peca.condicao || 'não informada'}`,
    `Garantia: ${peca.garantia || 'não informada'}`,
    `Código OEM: ${peca.numero_oem || 'não informado'}`,
    `Categoria: ${peca.categoria || peca.categoria_ml || 'não informada'}`,
    `Estoque: ${Number(peca.quantidade) || 0} unidade(s)`,
    `Preço: R$ ${Number(peca.preco || 0).toFixed(2)}`,
    `Descrição do anúncio: ${peca.descricao || 'não informada'}`,
    `Atributos: ${String(atributos || 'não informados').slice(0, 1200)}`
  ].join('\n');
}

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const ANO_REGEX = /\b(19[5-9]\d|20[0-3]\d)\b/g;

function anosDoTexto(valor) {
  const texto = normalizar(valor);
  const anos = new Set();

  for (const achado of texto.matchAll(ANO_REGEX)) {
    anos.add(Number(achado[1]));
  }

  // Faixas como "2006 a 2017", "2006-2017" ou "2006 até 2017" viram uma lista,
  // para conseguir comparar com o ano que o comprador informou.
  for (const achado of texto.matchAll(
    /\b(19[5-9]\d|20[0-3]\d)\s*(?:a|ate|-)\s*(19[5-9]\d|20[0-3]\d)\b/g
  )) {
    const inicio = Number(achado[1]);
    const fim = Number(achado[2]);

    if (fim >= inicio && fim - inicio <= 30) {
      for (let ano = inicio; ano <= fim; ano += 1) anos.add(ano);
    }
  }

  return [...anos].sort((a, b) => a - b);
}

function resumirAnos(anos) {
  if (!Array.isArray(anos) || anos.length === 0) return '';

  const partes = [];
  let inicio = anos[0];
  let anterior = anos[0];

  for (let indice = 1; indice <= anos.length; indice += 1) {
    const atual = anos[indice];

    if (atual === anterior + 1) {
      anterior = atual;
      continue;
    }

    partes.push(
      inicio === anterior ? String(inicio) : `${inicio} a ${anterior}`
    );
    inicio = atual;
    anterior = atual;
  }

  return partes.join(', ');
}

// Muitas peças antigas têm o campo "carro" vazio, mas a descrição ou o título
// trazem a aplicação. Isso evita uma resposta genérica do tipo "não informada".
function aplicacaoDaPeca(peca = {}) {
  const carro = limparTexto(peca.carro || '', 300);

  if (carro) return carro;

  const compativel = String(peca.descricao || '').match(
    /compat\S*\s+com\s*:?\s*([^\n\r]+)/i
  );
  const modelo = [peca.marca, peca.modelo].filter(Boolean).join(' ');
  const titulo = limparTexto(peca.ml_titulo || peca.nome || '', 220);
  const base = modelo || titulo;

  if (compativel) {
    const anos = anosDoTexto(compativel[1]);
    const resumo = anos.length > 0 ? resumirAnos(anos) : limparTexto(compativel[1], 120);

    if (resumo) {
      return limparTexto(base ? `${base} — ${resumo}` : resumo, 300);
    }
  }

  return limparTexto(base, 300) || 'não informada';
}

function perguntaCitaAplicacao(pergunta, peca) {
  const alvo = normalizar(
    `${peca?.carro || ''} ${peca?.modelo || ''} ${peca?.ml_titulo || ''} ${peca?.descricao || ''}`
  );
  const palavras = normalizar(pergunta)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length >= 4);

  return palavras.some((palavra) => alvo.includes(palavra));
}

function anosDaPeca(peca = {}) {
  return anosDoTexto(
    `${peca.carro || ''} ${peca.modelo || ''} ${peca.ano || ''} ${
      peca.ml_titulo || ''
    } ${peca.descricao || ''}`
  );
}

function fallback(pergunta, peca) {
  const textoPergunta = normalizar(pergunta);
  const nome = peca?.ml_titulo || peca?.nome || 'esta peça';
  const aplicacao = aplicacaoDaPeca(peca);
  const garantia = peca?.garantia || '';
  const codigoOem = limparTexto(peca?.numero_oem || '', 40);
  const descricao = limparTexto(peca?.descricao || '', 240);
  const citouAplicacao = perguntaCitaAplicacao(pergunta, peca);
  const citouVersao =
    /2\s*portas|4\s*portas|celebration|versao|motor|flex|diesel|turbo/.test(
      textoPergunta
    );
  const anosPergunta = anosDoTexto(pergunta);
  const anosPeca = anosDaPeca(peca);
  const anosConfirmados = anosPergunta.filter((ano) => anosPeca.includes(ano));
  const anosFora = anosPergunta.filter((ano) => !anosPeca.includes(ano));
  const linhas = [];

  if (/serve|compat|aplica|modelo|ano|cabe/.test(textoPergunta)) {
    if (anosPergunta.length > 0) {
      if (anosConfirmados.length > 0) {
        const anosTexto = anosConfirmados.join(' e ');
        const verbo = anosConfirmados.length > 1 ? 'estão' : 'está';

        linhas.push(
          `Pelo anúncio, essa peça atende ${aplicacao}, então o ano ${anosTexto} ${verbo} dentro da aplicação e serve sim${anosFora.length > 0 ? ` (só o ano ${anosFora.join(', ')} não aparece na lista)` : ''}.`
        );

        if (citouVersao && codigoOem) {
          linhas.push(
            `Só vale conferir o código ${codigoOem} da sua peça, porque entre versões do mesmo ano pode mudar o encaixe.`
          );
        }
      } else {
        linhas.push(
          `Pelo anúncio a aplicação é ${aplicacao}, e o ano ${anosFora.join(', ')} não aparece nessa lista. Me confirma o modelo e a motorização que eu verifico certinho para você.`
        );
      }
    } else if (citouAplicacao) {
      linhas.push(
        `Pelo anúncio, essa peça atende ${aplicacao}, então pelo modelo que você comentou a aplicação confere.`
      );
    } else {
      linhas.push(
        `No anúncio a aplicação é ${aplicacao}. Me manda o ano, o modelo e a motorização do seu carro que eu confirmo certinho se serve.`
      );
    }
  }

  if (/nota|fiscal|procedencia/.test(textoPergunta)) {
    linhas.push(
      `Ela sai com nota fiscal de desmonte e procedência${garantia ? `, com garantia de ${garantia}` : ''}.`
    );
  }

  if (/garantia|defeito|troca|devolu/.test(textoPergunta)) {
    linhas.push(
      garantia
        ? `A garantia é de ${garantia} contra defeitos de funcionamento.`
        : 'A garantia está descrita no anúncio e cobre defeitos de funcionamento.'
    );
  }

  if (/entrega|envio|frete|prazo|correio/.test(textoPergunta)) {
    linhas.push(
      'Enviamos para todo o Brasil com rastreamento; o prazo e o frete aparecem no Mercado Livre depois que você informa o CEP.'
    );
  }

  if (/original|paralelo|procedencia/.test(textoPergunta)) {
    linhas.push(
      'É peça original de desmonte, revisada e conferida pela nossa equipe. As condições exatas estão na descrição do anúncio.'
    );
  }

  if (/preco|valor|desconto/.test(textoPergunta)) {
    linhas.push(
      'O valor do anúncio já é o preço final da peça. Qualquer condição especial precisa ser confirmada antes da compra.'
    );
  }

  if (linhas.length === 0) {
    linhas.push(
      `Sobre ${nome}: ${
        descricao || 'a peça está revisada, testada e pronta para envio.'
      }`
    );
    linhas.push(
      `A aplicação no anúncio é ${aplicacao}; se quiser, me diz o ano e o modelo do seu carro que eu confiro para você.`
    );
  }

  linhas.push('Qualquer coisa, é só chamar por aqui.');
  return limparTexto(linhas.join(' '), 700);
}

function configuracaoFreeLLMAPI() {
  const url = String(process.env.FREELLMAPI_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const chave = String(process.env.FREELLMAPI_KEY || '').trim();

  if (!url || !chave) return null;

  return {
    url,
    chave,
    modelo: String(process.env.FREELLMAPI_MODEL || 'auto').trim() || 'auto'
  };
}

async function gerarSugestaoFreeLLMAPI(prompt, configuracao, opcoes = {}) {
  const endpoint = configuracao.url.endsWith('/v1')
    ? `${configuracao.url}/chat/completions`
    : `${configuracao.url}/v1/chat/completions`;

  const resposta = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${configuracao.chave}`
    },
    body: JSON.stringify({
      model: configuracao.modelo,
      messages: [{ role: 'user', content: prompt }],
      temperature: opcoes.temperature ?? 0.7,
      max_tokens: opcoes.maxTokens ?? 320
    }),
    signal: AbortSignal.timeout(
      opcoes.timeoutMs ?? TIMEOUT_FREELLMAPI_MS
    )
  });

  if (!resposta.ok) {
    let detalhe = '';
    try {
      const erro = await resposta.json();
      detalhe = String(erro?.error?.message || erro?.error || '');
    } catch {
      detalhe = '';
    }

    throw new Error(
      `FreeLLMAPI respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : ''}`
    );
  }

  const dados = await resposta.json();
  const conteudo = dados?.choices?.[0]?.message?.content;
  const texto = limparTexto(
    Array.isArray(conteudo)
      ? conteudo
          .map((parte) =>
            typeof parte === 'string' ? parte : parte?.text || ''
          )
          .join(' ')
      : conteudo
  );

  if (!texto) throw new Error('FreeLLMAPI não retornou texto');

  return {
    sugestao: texto,
    fonte: 'freellmapi',
    modelo: String(dados?.model || configuracao.modelo)
  };
}

export async function gerarSugestaoResposta({ pergunta, peca }) {
  const perguntaLimpa = limparTexto(pergunta, 600);
  const sugestaoFallback = fallback(perguntaLimpa, peca);
  const chave = String(process.env.GEMINI_KEY || '').trim();
  const modeloConfigurado = String(
    process.env.GEMINI_MODEL || MODELO_PADRAO
  ).trim();
  const modelos = [modeloConfigurado, ...MODELOS_RESERVA]
    .filter(
      (modelo, indice, lista) => modelo && lista.indexOf(modelo) === indice
    )
    .slice(0, 2);
  const freeLLMAPI = configuracaoFreeLLMAPI();

  if (!perguntaLimpa || (!chave && !freeLLMAPI)) {
    return { sugestao: sugestaoFallback, fonte: 'fallback' };
  }

  const prompt = [
    'Você atende no balcão de uma autopeças de desmonte e responde as perguntas dos compradores no Mercado Livre.',
    'Escreva como uma pessoa de verdade: português do Brasil natural, próximo, educado e objetivo. Nada de texto de robô, de SAC ou de formulário.',
    '',
    'Como responder:',
    '- Leia o anúncio e a pergunta antes de escrever. A resposta precisa fazer sentido para o anúncio específico, citando a peça ou a aplicação quando ajudar.',
    '- Comece respondendo diretamente o que o comprador perguntou, sem repetir a pergunta.',
    '- Se ele citar carro, ano ou modelo, compare com a aplicação do anúncio e diga com clareza se serve, se não serve ou se falta informação. Use os anos da ficha/descrição para confirmar o ano citado.',
    '- Quando o ano do comprador estiver dentro da aplicação, diga isso de forma direta ("o seu 2008 está na lista, então serve sim"). Quando não estiver, avise com educação e peça a versão/motorização antes de afirmar.',
    '- Se não houver dado suficiente para confirmar, diga o que está confirmado no anúncio e peça só o que falta (ano, modelo e motorização).',
    '- Use de 2 a 4 frases curtas, em tom de conversa. Sem listas, sem markdown, sem emojis, sem assinatura.',
    '- Nunca invente prazos, descontos, estoque ou condições que não estejam na ficha.',
    '- Evite frases prontas como "Prezado cliente", "Informamos que" ou "Fico à disposição".',
    '',
    'Exemplo de resposta ruim: "Prezado cliente, informamos que a peça é compatível. Fico à disposição."',
    'Exemplo de resposta boa: "Boa tarde! Pelo anúncio essa peça é do Onix 2012 a 2016, então serve sim no seu 2014. A garantia é de 90 dias e ela vai com nota fiscal. Precisa de mais alguma informação?"',
    '',
    'Ficha da peça:',
    resumoPeca(peca),
    '',
    `Pergunta do comprador: ${perguntaLimpa}`,
    '',
    'Resposta para enviar ao comprador:'
  ].join('\n');

  let ultimoErro = null;

  if (freeLLMAPI) {
    try {
      return await gerarSugestaoFreeLLMAPI(prompt, freeLLMAPI);
    } catch (error) {
      ultimoErro = error;
      console.warn(
        'Sugestão via FreeLLMAPI indisponível:',
        error instanceof Error ? error.message : error
      );
    }
  }

  if (!chave) {
    console.warn(
      'Sugestão de IA indisponível, usando resposta local:',
      ultimoErro instanceof Error ? ultimoErro.message : ultimoErro
    );

    return {
      sugestao: sugestaoFallback,
      fonte: 'fallback',
      aviso:
        'A IA não respondeu agora. A sugestão abaixo foi montada com os dados da peça.'
    };
  }

  for (const [indice, modelo] of modelos.entries()) {
    try {
      const resposta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelo
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': chave
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 320,
              topP: 0.9,
              thinkingConfig: { thinkingBudget: 0 }
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH'
              }
            ]
          }),
          signal: AbortSignal.timeout(
            indice === 0 ? TIMEOUT_MS : TIMEOUT_RESERVA_MS
          )
        }
      );

      if (!resposta.ok) {
        throw new Error(`Gemini respondeu ${resposta.status}`);
      }

      const dados = await resposta.json();
      const partes = dados?.candidates?.[0]?.content?.parts || [];
      const texto = limparTexto(
        partes.map((parte) => parte?.text || '').join(' ')
      );

      if (!texto) throw new Error('Gemini não retornou texto');

      return { sugestao: texto, fonte: 'gemini', modelo };
    } catch (error) {
      ultimoErro = error;
      console.warn(
        `Sugestão de IA indisponível no modelo ${modelo}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.warn(
    'Sugestão de IA indisponível, usando resposta local:',
    ultimoErro instanceof Error ? ultimoErro.message : ultimoErro
  );

  return {
    sugestao: sugestaoFallback,
    fonte: 'fallback',
    aviso:
      'A IA não respondeu agora. A sugestão abaixo foi montada com os dados da peça.'
  };
}

async function gerarTextoGeminiGenerico(prompt, opcoes = {}) {
  const chave = String(process.env.GEMINI_KEY || '').trim();

  if (!chave) throw new Error('Gemini não configurado');

  const modeloConfigurado = String(
    process.env.GEMINI_MODEL || MODELO_PADRAO
  ).trim();
  const modelos = [modeloConfigurado, ...MODELOS_RESERVA]
    .filter(
      (modelo, indice, lista) => modelo && lista.indexOf(modelo) === indice
    )
    .slice(0, 2);
  let ultimoErro = null;

  for (const [indice, modelo] of modelos.entries()) {
    try {
      const resposta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelo
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': chave
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: opcoes.temperature ?? 0.5,
              maxOutputTokens: opcoes.maxTokens ?? 600,
              topP: 0.9,
              thinkingConfig: { thinkingBudget: 0 }
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH'
              }
            ]
          }),
          signal: AbortSignal.timeout(
            indice === 0 ? TIMEOUT_MS : TIMEOUT_RESERVA_MS
          )
        }
      );

      if (!resposta.ok) {
        throw new Error(`Gemini respondeu ${resposta.status}`);
      }

      const dados = await resposta.json();
      const partes = dados?.candidates?.[0]?.content?.parts || [];
      const texto = limparTexto(
        partes.map((parte) => parte?.text || '').join(' ')
      );

      if (!texto) throw new Error('Gemini não retornou texto');

      return { texto, fonte: 'gemini', modelo };
    } catch (error) {
      ultimoErro = error;
      console.warn(
        `Texto de IA indisponível no modelo ${modelo}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw ultimoErro || new Error('Gemini não retornou texto');
}

export async function gerarTextoComIa(prompt, opcoes = {}) {
  const freeLLMAPI = configuracaoFreeLLMAPI();
  let ultimoErro = null;

  if (freeLLMAPI) {
    try {
      const resultado = await gerarSugestaoFreeLLMAPI(
        prompt,
        freeLLMAPI,
        opcoes
      );

      return {
        texto: resultado.sugestao,
        fonte: resultado.fonte,
        modelo: resultado.modelo
      };
    } catch (error) {
      ultimoErro = error;
      console.warn(
        'Texto via FreeLLMAPI indisponível:',
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    return await gerarTextoGeminiGenerico(prompt, opcoes);
  } catch (error) {
    ultimoErro = error;
    console.warn(
      'Texto via Gemini indisponível:',
      error instanceof Error ? error.message : error
    );
  }

  console.warn(
    'Nenhum provedor de IA respondeu:',
    ultimoErro instanceof Error ? ultimoErro.message : ultimoErro
  );

  return null;
}

function limparBloco(valor, limite = 2000) {
  return String(valor ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limite);
}

function normalizarSaidaAnuncio(texto) {
  return String(texto || '')
    .replace(/\s*(?:T[IÍ]TULO)\s*:\s*/gi, '\nTITULO: ')
    .replace(/\s*(?:DESCRI[CÇ][AÃ]O)\s*:\s*/gi, '\nDESCRICAO: ')
    .trim();
}

function extrairCampo(texto, campo) {
  const regex = new RegExp(
    `${campo}\\s*:\\s*([\\s\\S]*?)(?=\\n(?:TITULO|DESCRICAO)\\s*:|$)`,
    'i'
  );
  const encontrado = String(texto || '').match(regex);
  return limparBloco(encontrado?.[1] || '', 2000);
}

function analiseLocal(dados = {}) {
  const pecas = dados.pecas || {};
  const vendas = dados.vendas || {};
  const linhas = [];

  if (Number(pecas.total) === 0) {
    linhas.push(
      '• Sincronize seus anúncios do Mercado Livre para começar a análise.'
    );
  } else {
    if (Number(pecas.semEstoque) > 0) {
      linhas.push(
        `• Reponha ou pause ${pecas.semEstoque} anúncio(s) sem estoque para não perder posição na busca.`
      );
    }
    if (Number(pecas.semFotos) > 0) {
      linhas.push(
        `• Adicione fotos em ${pecas.semFotos} anúncio(s): imagens claras aumentam a taxa de cliques.`
      );
    }
    if (Number(pecas.descricaoCurta) > 0) {
      linhas.push(
        `• Complete a descrição de ${pecas.descricaoCurta} anúncio(s) com aplicação, condição, garantia e procedência.`
      );
    }
    if (Number(pecas.pausadas) > 0) {
      linhas.push(
        `• Revise ${pecas.pausadas} anúncio(s) pausado(s) e reative os que estiverem prontos para venda.`
      );
    }
  }

  if (Number(vendas.total) === 0) {
    linhas.push(
      '• Ainda não há vendas nos últimos 30 dias; priorize anúncios ativos e com estoque para gerar as primeiras métricas.'
    );
  } else {
    linhas.push(
      `• Nos últimos 30 dias foram ${vendas.total} venda(s), com faturamento de R$ ${Number(
        vendas.faturamento || 0
      ).toFixed(2).replace('.', ',')}.`
    );
  }

  if (Number(dados.perguntasPendentes) > 0) {
    linhas.push(
      `• Responda ${dados.perguntasPendentes} pergunta(s) pendente(s) no Atendimento para proteger a reputação.`
    );
  }

  if (Number(dados.reclamacoesAbertas) > 0) {
    linhas.push(
      `• Trate ${dados.reclamacoesAbertas} reclamação(ões) em aberto antes que afetem o termômetro.`
    );
  }

  if (linhas.length === 0) {
    linhas.push(
      '• Seu catálogo está em ordem. Continue acompanhando estoque, perguntas e reputação semanalmente.'
    );
  }

  return linhas.slice(0, 6).join('\n');
}

export async function gerarAnaliseComIa(dados = {}) {
  const pecas = dados.pecas || {};
  const vendas = dados.vendas || {};
  const categorias = Array.isArray(dados.categorias)
    ? dados.categorias
        .map((item) => `${item.categoria} (${item.total})`)
        .join(', ')
    : '';
  const prompt = [
    'Você é um consultor de e-commerce especializado em autopeças e Mercado Livre.',
    'Analise os dados reais abaixo e monte um plano de ação curto, em português do Brasil.',
    'Responda com até 5 linhas. Cada linha deve começar com "•" e trazer uma ação prática e específica.',
    'Priorize o que pode melhorar vendas, conversão e reputação agora.',
    'Não invente números, vendas, anúncios ou compatibilidades que não estejam nos dados.',
    '',
    `Catálogo: ${pecas.total || 0} peça(s), ${pecas.ativas || 0} ativa(s), ${pecas.pausadas || 0} pausada(s), ${pecas.semEstoque || 0} sem estoque, ${pecas.semFotos || 0} sem foto, ${pecas.descricaoCurta || 0} com descrição curta.`,
    `Valor em estoque: R$ ${Number(pecas.valor || 0).toFixed(2)}.`,
    `Categorias: ${categorias || 'não informadas'}.`,
    `Vendas nos últimos 30 dias: ${vendas.total || 0}, faturamento R$ ${Number(vendas.faturamento || 0).toFixed(2)}.`,
    `Perguntas sem resposta: ${dados.perguntasPendentes || 0}.`,
    `Reclamações abertas: ${dados.reclamacoesAbertas || 0}.`,
    '',
    'Lembre-se: o catálogo pode ter poucos anúncios e nenhuma venda; nesse caso, foque em completar e ativar os anúncios antes de falar em escala.'
  ].join('\n');

  const resultado = await gerarTextoComIa(prompt, {
    maxTokens: 700,
    temperature: 0.4
  });

  if (resultado?.texto) {
    return {
      analise: resultado.texto,
      fonte: resultado.fonte,
      modelo: resultado.modelo,
      geradoEm: new Date().toISOString()
    };
  }

  return {
    analise: analiseLocal(dados),
    fonte: 'local',
    modelo: null,
    geradoEm: new Date().toISOString(),
    aviso:
      'A IA não respondeu agora. A análise abaixo foi montada com os dados reais do catálogo.'
  };
}

const TIMEOUT_VISAO_MS = 45000;

function extrairJson(texto) {
  const bruto = String(texto || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');

  if (inicio < 0 || fim <= inicio) return null;

  try {
    return JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

function normalizarCategoriaIa(valor, categorias = []) {
  const informada = limparTexto(valor, 80);
  if (!informada) return '';

  const encontrada = categorias.find(
    (categoria) =>
      String(categoria).toLowerCase() === informada.toLowerCase() ||
      String(categoria)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') ===
        informada
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
  );

  return encontrada ? String(encontrada) : informada;
}

function normalizarAtributosIa(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};

  return Object.fromEntries(
    Object.entries(valor)
      .map(([chave, item]) => [limparTexto(chave, 80), limparTexto(item, 200)])
      .filter(([chave, item]) => chave && item)
  );
}

async function chamarVisaoFreeLLMAPI(prompt, imagens, configuracao) {
  const endpoint = configuracao.url.endsWith('/v1')
    ? `${configuracao.url}/chat/completions`
    : `${configuracao.url}/v1/chat/completions`;

  const resposta = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${configuracao.chave}`
    },
    body: JSON.stringify({
      model: configuracao.modelo,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imagens.map((imagem) => ({
              type: 'image_url',
              image_url: { url: imagem.dataUrl }
            }))
          ]
        }
      ],
      temperature: 0.25,
      max_tokens: 1400
    }),
    signal: AbortSignal.timeout(TIMEOUT_VISAO_MS)
  });

  if (!resposta.ok) {
    let detalhe = '';
    try {
      const erro = await resposta.json();
      detalhe = String(erro?.error?.message || erro?.error || '');
    } catch {
      detalhe = '';
    }

    throw new Error(
      `FreeLLMAPI respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : ''}`
    );
  }

  const dados = await resposta.json();
  const conteudo = dados?.choices?.[0]?.message?.content;
  const texto = Array.isArray(conteudo)
    ? conteudo
        .map((parte) =>
          typeof parte === 'string' ? parte : parte?.text || ''
        )
        .join('\n')
    : String(conteudo || '');

  if (!texto.trim()) throw new Error('FreeLLMAPI não retornou texto');

  return {
    texto,
    fonte: 'freellmapi',
    modelo: String(dados?.model || configuracao.modelo)
  };
}

async function chamarVisaoGemini(prompt, imagens) {
  const chave = String(process.env.GEMINI_KEY || '').trim();

  if (!chave) throw new Error('Gemini não configurado');

  const modeloConfigurado = String(
    process.env.GEMINI_VISAO_MODEL || process.env.GEMINI_MODEL || MODELO_PADRAO
  ).trim();
  const modelos = [modeloConfigurado, ...MODELOS_RESERVA]
    .filter(
      (modelo, indice, lista) => modelo && lista.indexOf(modelo) === indice
    )
    .slice(0, 2);
  let ultimoErro = null;

  for (const [indice, modelo] of modelos.entries()) {
    try {
      const resposta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelo
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': chave
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  ...imagens.map((imagem) => ({
                    inline_data: {
                      mime_type: imagem.mime || 'image/jpeg',
                      data: String(imagem.dataUrl).replace(
                        /^data:[^;]+;base64,/,
                        ''
                      )
                    }
                  }))
                ]
              }
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 1400,
              topP: 0.9,
              thinkingConfig: { thinkingBudget: 0 }
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH'
              }
            ]
          }),
          signal: AbortSignal.timeout(
            indice === 0 ? TIMEOUT_VISAO_MS : 30000
          )
        }
      );

      if (!resposta.ok) {
        throw new Error(`Gemini respondeu ${resposta.status}`);
      }

      const dados = await resposta.json();
      const partes = dados?.candidates?.[0]?.content?.parts || [];
      const texto = partes.map((parte) => parte?.text || '').join('\n');

      if (!texto.trim()) throw new Error('Gemini não retornou texto');

      return { texto, fonte: 'gemini', modelo };
    } catch (error) {
      ultimoErro = error;
      console.warn(
        `Visão de IA indisponível no modelo ${modelo}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw ultimoErro || new Error('Gemini não retornou texto');
}

async function gerarVisaoComIa(prompt, imagens) {
  if (!Array.isArray(imagens) || imagens.length === 0) {
    return null;
  }

  const freeLLMAPI = configuracaoFreeLLMAPI();
  let ultimoErro = null;

  if (freeLLMAPI) {
    try {
      return await chamarVisaoFreeLLMAPI(prompt, imagens, freeLLMAPI);
    } catch (error) {
      ultimoErro = error;
      console.warn(
        'Visão via FreeLLMAPI indisponível:',
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    return await chamarVisaoGemini(prompt, imagens);
  } catch (error) {
    ultimoErro = error;
    console.warn(
      'Visão via Gemini indisponível:',
      error instanceof Error ? error.message : error
    );
  }

  console.warn(
    'Nenhum provedor de visão respondeu:',
    ultimoErro instanceof Error ? ultimoErro.message : ultimoErro
  );

  return null;
}

const PROMPT_PECA = [
  'Você é especialista em autopeças de desmonte e anúncios do Mercado Livre no Brasil.',
  'Analise TODAS as fotos enviadas e monte a ficha completa do anúncio.',
  'A primeira foto costuma ser a etiqueta com SKU/OEM; as seguintes mostram o produto, medidas e peso.',
  'Responda SOMENTE com um JSON válido, sem explicações, usando exatamente este formato:',
  '{',
  '  "titulo": "título do anúncio com no máximo 60 caracteres",',
  '  "nome": "nome interno da peça",',
  '  "categoria": "uma categoria da lista informada",',
  '  "marca": "marca do veículo ou da peça",',
  '  "modelo": "modelo do veículo",',
  '  "ano": "ano ou faixa de anos",',
  '  "condicao": "usado, novo ou recondicionado",',
  '  "numero_oem": "código OEM/referência visível na etiqueta, ou vazio",',
  '  "garantia": "somente se aparecer nas fotos, ou vazio",',
  '  "peso_kg": 0,',
  '  "comprimento_cm": 0,',
  '  "largura_cm": 0,',
  '  "altura_cm": 0,',
  '  "descricao": "descrição de 3 a 6 parágrafos curtos para o anúncio",',
  '  "atributos": { "chave_tecnica": "valor" },',
  '  "confianca": "alta, media ou baixa",',
  '  "observacoes": "o que não foi possível confirmar nas fotos"',
  '}',
  'Regras obrigatórias:',
  '- Não invente OEM, garantia, medidas, peso, marca, modelo ou ano que não estejam visíveis ou claramente identificáveis.',
  '- Quando não houver certeza, deixe o campo vazio (texto) ou 0 (números).',
  '- O título deve ter no máximo 60 caracteres e conter peça, lado/posição, veículo e ano quando visíveis.',
  '- Use apenas categorias da lista enviada no contexto.',
  '- Nos atributos, use chaves curtas em português, como posicao, lado, material, cor, tensao, conectores, tipo.'
].join('\n');

function fichaFallback(peca = {}) {
  return {
    titulo: limparTexto(peca.ml_titulo || peca.nome, 60),
    nome: limparTexto(peca.nome, 200),
    categoria: limparTexto(peca.categoria, 80),
    categoria_ml: limparTexto(peca.categoria_ml, 300),
    marca: limparTexto(peca.marca, 120),
    modelo: limparTexto(peca.modelo, 120),
    ano: limparTexto(peca.ano, 40),
    condicao: limparTexto(peca.condicao || 'usado', 40),
    numero_oem: limparTexto(peca.numero_oem, 120),
    garantia: limparTexto(peca.garantia, 120),
    peso_kg: numero(peca.peso_kg),
    comprimento_cm: numero(peca.comprimento_cm),
    largura_cm: numero(peca.largura_cm),
    altura_cm: numero(peca.altura_cm),
    descricao: limparBloco(peca.descricao, 5000),
    atributos:
      peca.atributos && typeof peca.atributos === 'object'
        ? normalizarAtributosIa(peca.atributos)
        : {},
    confianca: 'baixa',
    observacoes:
      'A IA não conseguiu ler as fotos. Confira e complete os campos manualmente.'
  };
}

export async function analisarFotosPecaComIa({
  imagens = [],
  contexto = {}
} = {}) {
  const categorias = Array.isArray(contexto.categorias)
    ? contexto.categorias.map((item) => limparTexto(item, 80)).filter(Boolean)
    : [];
  const prompt = [
    PROMPT_PECA,
    '',
    `Categorias permitidas: ${categorias.join(', ') || 'não informadas'}.`,
    `Dados já digitados pelo vendedor: ${resumoPeca(contexto.peca || {})}`,
    `Nomes dos arquivos: ${imagens
      .map((imagem) => imagem.nome)
      .filter(Boolean)
      .join(', ')}`
  ].join('\n');

  const resultado = await gerarVisaoComIa(prompt, imagens);

  if (!resultado?.texto) {
    return {
      dados: fichaFallback(contexto.peca || {}),
      fonte: 'local',
      aviso:
        'A IA não respondeu agora. Preencha os campos manualmente ou tente novamente em alguns instantes.'
    };
  }

  const json = extrairJson(resultado.texto);

  if (!json) {
    return {
      dados: fichaFallback(contexto.peca || {}),
      fonte: resultado.fonte,
      aviso:
        'A IA respondeu em um formato inesperado. Revise os campos antes de salvar.'
    };
  }

  const categoria = normalizarCategoriaIa(json.categoria, categorias);
  const dados = {
    titulo: limparTexto(json.titulo || json.nome, 60),
    nome: limparTexto(json.nome || json.titulo, 200),
    categoria,
    categoria_ml: limparTexto(
      json.categoria_ml || contexto.peca?.categoria_ml,
      300
    ),
    marca: limparTexto(json.marca, 120),
    modelo: limparTexto(json.modelo, 120),
    ano: limparTexto(json.ano, 40),
    condicao: ['novo', 'usado', 'recondicionado'].includes(
      String(json.condicao || '').toLowerCase()
    )
      ? String(json.condicao).toLowerCase()
      : 'usado',
    numero_oem: limparTexto(json.numero_oem, 120),
    garantia: limparTexto(json.garantia, 120),
    peso_kg: numero(json.peso_kg),
    comprimento_cm: numero(json.comprimento_cm),
    largura_cm: numero(json.largura_cm),
    altura_cm: numero(json.altura_cm),
    descricao: limparBloco(json.descricao, 5000),
    atributos: normalizarAtributosIa(json.atributos),
    confianca: limparTexto(json.confianca || 'media', 20),
    observacoes: limparTexto(json.observacoes, 600)
  };

  return {
    dados,
    fonte: resultado.fonte,
    modelo: resultado.modelo,
    aviso:
      dados.observacoes ||
      'Confira os dados lidos nas fotos antes de salvar o anúncio.'
  };
}

const PROMPT_LOTE = [
  'Você é especialista em desmonte de veículos e organização de fotos de autopeças.',
  'A ordem correta das fotos de cada produto é: 1) foto da etiqueta/SKU, 2) fotos do produto, 3) fotos das medidas, 4) foto do peso.',
  'Analise as fotos e os nomes dos arquivos enviados e agrupe cada produto.',
  'Responda SOMENTE com JSON válido neste formato:',
  '{',
  '  "produtos": [',
  '    {',
  '      "sku": "SKU LIDO NA ETIQUETA",',
  '      "nome": "nome curto da peça",',
  '      "arquivos": ["nome-exato-1.jpg", "nome-exato-2.jpg"],',
  '      "peso_kg": 0,',
  '      "comprimento_cm": 0,',
  '      "largura_cm": 0,',
  '      "altura_cm": 0,',
  '      "observacoes": "o que não foi possível confirmar"',
  '    }',
  '  ],',
  '  "alertas": ["fotos fora da ordem ou sem SKU legível"]',
  '}',
  'Regras obrigatórias:',
  '- Use exatamente os nomes de arquivo fornecidos na lista.',
  '- Não invente SKU. Se a etiqueta não estiver legível, use "DESCONHECIDO".',
  '- Agrupe pela peça, não pela ordem de envio.',
  '- Aponte em alertas quando a sequência estiver fora da ordem ou faltar a foto de SKU/medidas/peso.'
].join('\n');

export async function analisarFotosLoteComIa({
  imagens = [],
  arquivos = [],
  contexto = {}
} = {}) {
  const nomes = arquivos
    .map((arquivo) => limparTexto(arquivo, 220))
    .filter(Boolean);
  const prompt = [
    PROMPT_LOTE,
    '',
    `Veículo de origem informado: ${limparTexto(
      contexto.veiculoOrigem,
      200
    ) || 'não informado'}.`,
    `Modo do lote: ${limparTexto(contexto.modo, 40) || 'misto'}.`,
    '',
    'Nomes de todos os arquivos do lote:',
    nomes.join('\n') || 'nenhum nome informado'
  ].join('\n');

  const resultado = await gerarVisaoComIa(prompt, imagens);

  if (!resultado?.texto) {
    return {
      produtos: [],
      alertas: [
        'A IA não respondeu agora. Use a detecção de SKU pelo nome dos arquivos ou organize manualmente.'
      ],
      fonte: 'local'
    };
  }

  const json = extrairJson(resultado.texto);

  if (!json) {
    return {
      produtos: [],
      alertas: [
        'A IA respondeu em um formato inesperado. Revise o agrupamento manualmente.'
      ],
      fonte: resultado.fonte
    };
  }

  const produtos = Array.isArray(json.produtos)
    ? json.produtos
        .map((produto) => ({
          sku: limparTexto(produto?.sku, 100).toUpperCase() || 'DESCONHECIDO',
          nome: limparTexto(produto?.nome, 200),
          arquivos: Array.isArray(produto?.arquivos)
            ? produto.arquivos
                .map((arquivo) => limparTexto(arquivo, 220))
                .filter(Boolean)
            : [],
          peso_kg: numero(produto?.peso_kg),
          comprimento_cm: numero(produto?.comprimento_cm),
          largura_cm: numero(produto?.largura_cm),
          altura_cm: numero(produto?.altura_cm),
          observacoes: limparTexto(produto?.observacoes, 500)
        }))
        .filter((produto) => produto.arquivos.length > 0)
    : [];

  return {
    produtos,
    alertas: Array.isArray(json.alertas)
      ? json.alertas.map((alerta) => limparTexto(alerta, 300)).filter(Boolean)
      : [],
    fonte: resultado.fonte,
    modelo: resultado.modelo
  };
}

function tituloFallback(peca = {}) {
  const partes = [peca.nome, peca.modelo, peca.ano, peca.marca]
    .map((parte) => limparTexto(parte, 60))
    .filter(Boolean);

  return limparTexto(partes.join(' '), 60);
}

function descricaoFallback(peca = {}) {
  const linhas = [
    `${peca.nome || 'Peça'}${peca.carro ? ` para ${peca.carro}` : ''}.`,
    peca.descricao ? limparTexto(peca.descricao, 700) : '',
    peca.condicao ? `Condição: ${peca.condicao}.` : '',
    peca.garantia ? `Garantia: ${peca.garantia}.` : '',
    peca.numero_oem ? `Código OEM: ${peca.numero_oem}.` : '',
    'Confira a aplicação e as medidas antes de finalizar a compra. Em caso de dúvida, envie o modelo e o ano do veículo.'
  ];

  return limparBloco(linhas.filter(Boolean).join('\n\n'), 1500);
}

export async function gerarAnuncioComIa(peca = {}) {
  const prompt = [
    'Você é um especialista em anúncios de autopeças no Mercado Livre.',
    'Gere um título e uma descrição para o anúncio abaixo, em português do Brasil.',
    'Regras do título: no máximo 60 caracteres, sem emojis, incluindo peça, marca, modelo e ano quando existirem.',
    'Regras da descrição: 3 a 6 parágrafos curtos, objetiva, com aplicação, condição, garantia e procedência apenas se estiverem na ficha.',
    'Não invente compatibilidade, garantia, procedência, medidas ou prazos.',
    'Responda exatamente neste formato, sem texto adicional:',
    'TITULO: <título>',
    'DESCRICAO:',
    '<descrição>',
    '',
    'Ficha da peça:',
    resumoPeca(peca)
  ].join('\n');

  const resultado = await gerarTextoComIa(prompt, {
    maxTokens: 800,
    temperature: 0.6
  });

  if (resultado?.texto) {
    const textoNormalizado = normalizarSaidaAnuncio(resultado.texto);
    const titulo = limparTexto(
      extrairCampo(textoNormalizado, 'TITULO'),
      60
    );
    const descricao = limparBloco(
      extrairCampo(textoNormalizado, 'DESCRICAO'),
      1500
    );

    if (titulo && descricao) {
      return {
        titulo,
        descricao,
        fonte: resultado.fonte,
        modelo: resultado.modelo
      };
    }
  }

  return {
    titulo: tituloFallback(peca),
    descricao: descricaoFallback(peca),
    fonte: 'local',
    modelo: null,
    aviso:
      'A IA não respondeu agora. O título e a descrição foram montados com os dados da peça.'
  };
}
