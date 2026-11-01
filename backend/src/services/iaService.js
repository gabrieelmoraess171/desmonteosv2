import dotenv from 'dotenv';

dotenv.config();

const MODELO_PADRAO = 'gemini-3.5-flash-lite';
const MODELOS_RESERVA = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
const TIMEOUT_MS = 15000;
const TIMEOUT_RESERVA_MS = 10000;
const TIMEOUT_FREELLMAPI_MS = 15000;

// A chave do Google AI Studio também pode ser configurada como GOOGLE_AI_KEY.
// Assim o painel aceita tanto a nomenclatura antiga (GEMINI_*) quanto a nova.
function chaveGemini() {
  return String(
    process.env.GEMINI_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      ''
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function modeloGemini() {
  return String(
    process.env.GEMINI_MODEL ||
      process.env.GOOGLE_AI_MODEL ||
      MODELO_PADRAO
  ).trim();
}

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
    if (
      /\b(beleza|obrigad|valeu|entendi|ok|ta bom|tá bom|certo|perfeito|fechado|terça|terca)\b/.test(
        textoPergunta
      )
    ) {
      linhas.push(
        'Perfeito! Qualquer dúvida sobre a peça ou a compatibilidade, pode me chamar por aqui.'
      );
    } else {
      linhas.push(
        `Claro! A peça anunciada é ${nome}. Se quiser confirmar a compatibilidade, me informe o modelo e o ano do veículo.`
      );
    }
  }

  if (!linhas.some((linha) => /pode me chamar por aqui/i.test(linha))) {
    linhas.push('Qualquer coisa, é só chamar por aqui.');
  }
  return limparTexto(linhas.join(' '), 700);
}

function orientacaoCompatibilidade(pergunta, peca) {
  const texto = normalizar(pergunta);
  if (!/serve|compat|aplica|modelo|ano|cabe|encaix/.test(texto)) {
    return 'A pergunta não solicita confirmação de compatibilidade; responda diretamente ao assunto perguntado.';
  }

  const anosPergunta = anosDoTexto(pergunta);
  const anosPeca = anosDaPeca(peca);
  const aplicacao = aplicacaoDaPeca(peca);

  if (anosPergunta.length === 0) {
    return `Aplicação cadastrada no anúncio: ${aplicacao}. Não há ano explícito na pergunta para confirmar.`;
  }

  const confirmados = anosPergunta.filter((ano) => anosPeca.includes(ano));
  const fora = anosPergunta.filter((ano) => !anosPeca.includes(ano));

  return [
    `Aplicação cadastrada no anúncio: ${aplicacao}.`,
    `Ano(s) perguntado(s): ${anosPergunta.join(', ')}.`,
    `Ano(s) encontrado(s) na aplicação: ${confirmados.join(', ') || 'nenhum'}.`,
    `Ano(s) não encontrado(s): ${fora.join(', ') || 'nenhum'}.`,
    'Não confirme compatibilidade se o ano/modelo não estiver sustentado pela ficha; peça apenas o dado que faltar.'
  ].join(' ');
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
      : conteudo,
    opcoes.limiteCaracteres ?? 700
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
  const chave = chaveGemini();
  const modeloConfigurado = modeloGemini();
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
    `Verificação objetiva antes de responder: ${orientacaoCompatibilidade(
      perguntaLimpa,
      peca
    )}`,
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
            ...(opcoes.googleSearch ? { tools: [{ google_search: {} }] } : {}),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 320,
              topP: 0.9,
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
  const chave = chaveGemini();

  if (!chave) throw new Error('Gemini não configurado');

  const modeloConfigurado = modeloGemini();
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
            opcoes.timeoutMs ??
              (indice === 0 ? TIMEOUT_MS : TIMEOUT_RESERVA_MS)
          )
        }
      );

      if (!resposta.ok) {
        throw new Error(`Gemini respondeu ${resposta.status}`);
      }

      const dados = await resposta.json();
      const partes = dados?.candidates?.[0]?.content?.parts || [];
      const texto = limparTexto(
        partes.map((parte) => parte?.text || '').join(' '),
        opcoes.limiteCaracteres ?? 700
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

// Usa explicitamente o Google AI Studio, sem passar pelo provedor alternativo.
export async function gerarTextoComGemini(prompt, opcoes = {}) {
  return gerarTextoGeminiGenerico(prompt, opcoes);
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

export function extrairJson(texto) {
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

async function chamarVisaoFreeLLMAPI(prompt, imagens, configuracao, opcoes = {}) {
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
      temperature: opcoes.temperature ?? 0.25,
      max_tokens: opcoes.maxTokens ?? 1400
    }),
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? TIMEOUT_VISAO_MS)
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

async function chamarVisaoGemini(prompt, imagens, opcoes = {}) {
  const chave = chaveGemini();

  if (!chave) throw new Error('Gemini não configurado');

  const modeloConfigurado = String(
    opcoes.modelo || process.env.GEMINI_VISAO_MODEL || modeloGemini()
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
            ...(opcoes.googleSearch ? { tools: [{ google_search: {} }] } : {}),
            generationConfig: {
              temperature: opcoes.temperature ?? 0.25,
              maxOutputTokens: opcoes.maxTokens ?? 1400,
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
            opcoes.timeoutMs ??
              (indice === 0 ? TIMEOUT_VISAO_MS : 30000)
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

export async function gerarVisaoComIa(prompt, imagens, opcoes = {}) {
  if (!Array.isArray(imagens) || imagens.length === 0) {
    return null;
  }

  const freeLLMAPI = configuracaoFreeLLMAPI();
  let ultimoErro = null;

  if (freeLLMAPI && !opcoes.googleSearchOnly) {
    try {
      return await chamarVisaoFreeLLMAPI(
        prompt,
        imagens,
        freeLLMAPI,
        opcoes
      );
    } catch (error) {
      ultimoErro = error;
      console.warn(
        'Visão via FreeLLMAPI indisponível:',
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    return await chamarVisaoGemini(prompt, imagens, opcoes);
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
  'Analise TODAS as fotos enviadas e monte a ficha completa do anúncio. A identificação visual vem antes de qualquer pesquisa externa.',
  'As fotos chegam com rótulos de grupo no nome: [SKU], [PRODUTO], [MEDIDAS] e [CODIGO]. Esses rótulos são a fonte principal para saber a função de cada imagem.',
  'Leia a foto [SKU] com OCR visual: aproxime-se da etiqueta, copie todos os caracteres visíveis e não substitua letras por números. Se houver apenas um número, use somente esse número no campo sku.',
  'Nas fotos [MEDIDAS], leia a escala da trena/régua e converta para centímetros. Nas fotos de balança, leia o visor e converta para quilogramas. Se houver mais de uma medida, associe a maior dimensão a comprimento, a seguinte a largura e a menor a altura.',
  'Responda SOMENTE com um JSON válido, sem explicações, usando exatamente este formato:',
  '{',
  '  "sku": "número/código lido na etiqueta; se a etiqueta mostrar apenas 543, retorne 543",',
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
  '- Não transforme uma hipótese em certeza. Se a peça puder ser confundida com outra, use o nome funcional mais conservador e marque confianca como baixa.',
  '- A pesquisa externa não pode substituir o que aparece nas fotos e não pode escolher um resultado só porque contém uma palavra parecida.',
  '- Nunca use o número do SKU como numero_oem sem evidência de que é um código OEM.',
  '- Se uma foto de medida ou peso estiver legível, preencha os números mesmo que outras informações da peça estejam incertas.',
  '- Se houver marca, logotipo, inscrição moldada ou código OEM, use essa evidência para pesquisar a aplicação e o modelo correto.',
  '- Se o modelo não puder ser confirmado, deixe modelo e ano vazios e explique em observacoes; não invente um veículo.',
  '- Classifique primeiro o objeto visível pela forma e função. Uma peça de acabamento, console, difusor, moldura ou painel interno nunca pode virar retrovisor apenas porque uma busca encontrou esse termo.',
  '- Diferencie peças de acabamento interno de peças mecânicas: porta-luvas, console, moldura, difusor, painel e acabamento interno não são amortecedor, suspensão, motor ou outra peça mecânica.',
  '- Para chamar algo de amortecedor, é obrigatório haver evidência visual de conjunto telescópico/cilindro, haste e/ou mola. Sem essa evidência, deixe a classificação mecânica vazia e explique a dúvida.',
  '- Para chamar algo de retrovisor, é obrigatório haver carcaça/espelho ou conjunto externo de retrovisão. Uma moldura, tampa, acabamento interno ou porta-objeto nunca deve receber esse nome.',
  '- Estas regras valem para qualquer fabricante: Chevrolet, Volkswagen, Fiat, Ford, Renault, Hyundai, Toyota, Honda, Nissan, Jeep, BMW, Mercedes-Benz, Audi, Volvo e demais marcas.',
  '- Não use "Universal" nem anos genéricos sem evidência visual ou código confirmado.',
  '- Classifique primeiro o objeto visível pela forma e função. Uma peça de acabamento, console, difusor, moldura ou painel interno nunca pode virar retrovisor apenas porque uma busca encontrou esse termo.',
  '- Não use "Universal" nem anos genéricos sem evidência visual ou código confirmado.',
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
    `Nomes dos arquivos e grupos: ${imagens
      .map((imagem) => imagem.nome)
      .filter(Boolean)
      .join(', ')}`
  ].join('\n');

  const resultado = await gerarVisaoComIa(prompt, imagens, {
    modelo: 'gemini-2.5-flash',
    // A primeira etapa deve interpretar a foto sem resultados de busca
    // contaminando a classificação visual. A pesquisa só é feita depois,
    // quando há um OEM legível para confirmar aplicação.
    googleSearch: false,
    // A API agregadora está configurada com um modelo lite e estava gerando
    // classificações visuais frágeis. Para a Nova peça, use diretamente o
    // Gemini Flash com visão, deixando a pesquisa para a etapa seguinte.
    googleSearchOnly: true,
    temperature: 0.08,
    maxTokens: 2800,
    timeoutMs: 120000
  });

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
    sku: limparTexto(json.sku, 100),
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

  let dadosFinais = dados;
  const codigoParaPesquisa = /^[A-Z0-9][A-Z0-9.\/-]{4,}$/i.test(dados.numero_oem || '') && !/^não visível$/i.test(dados.numero_oem)
    ? dados.numero_oem
    : '';

  if (codigoParaPesquisa) {
    const identificado = await identificarProdutoLoteComGoogle({
      numero_oem: codigoParaPesquisa,
      nome: dados.nome,
      observacoes: dados.observacoes
    });
    dadosFinais = {
      ...dados,
      // A leitura visual da peça é a fonte principal. A pesquisa externa só
      // completa campos que a imagem não conseguiu preencher.
      nome: dados.nome || identificado.peca,
      marca: dados.marca || identificado.marca,
      modelo: dados.modelo || identificado.modelo,
      ano: dados.ano || identificado.anos,
      carro: dados.carro || identificado.aplicacao,
      observacoes: [dados.observacoes, identificado.observacoes].filter(Boolean).join(' ')
    };
  }

  const dadosConfirmados = await confirmarFichaComPesquisa(dadosFinais, imagens);

  return {
    dados: dadosConfirmados,
    fonte: `${resultado.fonte} + Google Search/MODO IA + Mercado Livre`,
    modelo: resultado.modelo,
    aviso:
      dadosConfirmados.observacoes ||
      'Confira os dados lidos nas fotos antes de salvar o anúncio.'
  };
}

const PROMPT_LOTE = [
  'Você é especialista em desmonte de veículos e organização de fotos de autopeças.',
  'A ordem correta das fotos de cada produto é: 1) foto da etiqueta/SKU, 2) fotos do produto, 3) fotos das medidas, 4) foto do peso.',
  'Classifique primeiro a forma e a função física da peça e depois confirme fabricante, código OEM, modelo e anos. Essa regra vale para qualquer marca.',
  'Uma peça de acabamento, console, difusor, moldura ou painel interno não pode ser classificada como retrovisor, farol ou outra peça externa sem evidência visual.',
  'Analise as fotos e os nomes dos arquivos enviados e agrupe cada produto.',
  'Responda SOMENTE com JSON válido neste formato:',
  '{',
  '  "produtos": [',
  '    {',
  '      "sku": "SKU INTERNO LIDO NA ETIQUETA",',
  '      "numero_oem": "código do fabricante legível na peça ou etiqueta original, ou vazio",',
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
  '- Aponte em alertas quando a sequência estiver fora da ordem ou faltar a foto de SKU/medidas/peso.',
  '- SKU interno e código OEM são campos diferentes. Nunca copie o SKU interno para numero_oem nem deduza aplicação pelo SKU.',
  '- Só informe numero_oem quando estiver explicitamente legível na peça ou na etiqueta do fabricante. A última imagem pode ser uma foto de peso/medidas; não presuma que contenha OEM.',
  '- Não descarte fotos recebidas. Os nomes devem ser copiados exatamente, inclusive arquivos IMG_*.jpeg.'
].join('\n');

async function buscarAnunciosMercadoLivreLote(sku) {
  const resposta = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(sku)}&limit=5`, {
    signal: AbortSignal.timeout(8000),
    headers: {
      accept: 'application/json',
      'user-agent': 'DesmonteOS/1.0 lote lookup',
      ...(process.env.MERCADOLIVRE_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.MERCADOLIVRE_ACCESS_TOKEN}` } : {})
    }
  });
  if (!resposta.ok) return [];
  const dados = await resposta.json();
  return (Array.isArray(dados.results) ? dados.results : []).slice(0, 5).map((item) => ({
    titulo: limparTexto(item.title, 240),
    url: limparTexto(item.permalink, 500),
    atributos: Array.isArray(item.attributes) ? item.attributes.filter((atributo) => /BRAND|MODEL|OEM|PART|NUMBER|REFER/i.test(`${atributo.id} ${atributo.name}`)).map((atributo) => `${atributo.name || atributo.id}: ${atributo.value_name || ''}`).join(' | ') : ''
  }));
}

export function codigoOemParaPesquisa(produto = {}) {
  const codigo = limparTexto(produto.numero_oem || produto.oem || produto.part_number, 120);
  if (!/^[a-z0-9][a-z0-9 .\/-]{3,119}$/i.test(codigo) || !/\d/.test(codigo)) return '';
  if (/desconhecido|nao visivel|não visível|nao informado|não informado/i.test(codigo)) return '';
  return codigo;
}

export async function identificarProdutoLoteComGoogle(produto) {
  const codigo = codigoOemParaPesquisa(produto);
  if (!codigo) return produto;
  let anuncios = [];
  try { anuncios = await buscarAnunciosMercadoLivreLote(codigo); } catch { anuncios = []; }
  const prompt = `Identifique esta autopeça pelo código OEM do fabricante "${codigo}". O SKU interno não é uma referência de fabricante. Primeiro respeite o nome e a forma visual já reconhecida; use Google e Mercado Livre apenas para confirmar aplicação. Isso vale para qualquer fabricante. Nunca troque uma peça interna por retrovisor, farol ou peça externa apenas por coincidência de busca. Não use Universal ou anos sem evidência. Retorne confiança baixa se houver conflito. Responda somente JSON: {"peca":"", "lado":"direito|esquerdo|", "marca":"", "modelo":"", "anos":"", "aplicacao":"", "confianca":"alta|media|baixa", "observacao":""}. Anúncios: ${JSON.stringify(anuncios)}. Nome preliminar: ${produto.nome || 'não informado'}.`;
  try {
    const resposta = await gerarTextoComGemini(prompt, { modelo: 'gemini-2.5-flash', googleSearch: true, maxTokens: 500, limiteCaracteres: 1800, timeoutMs: 20000 });
    const json = extrairJson(resposta?.texto || '');
    return {
      ...produto,
      peca: produto.peca || produto.nome || limparTexto(json?.peca, 160),
      lado: produto.lado || limparTexto(json?.lado, 30),
      marca: produto.marca || limparTexto(json?.marca, 100),
      modelo: produto.modelo || limparTexto(json?.modelo, 100),
      anos: produto.anos || limparTexto(json?.anos, 100),
      aplicacao: produto.aplicacao || limparTexto(json?.aplicacao, 300),
      confianca: limparTexto(json?.confianca || 'baixa', 20),
      referenciasMercadoLivre: anuncios,
      observacoes: [produto.observacoes, limparTexto(json?.observacao, 500)].filter(Boolean).join(' ')
    };
  } catch {
    return { ...produto, referenciasMercadoLivre: anuncios };
  }
}

async function confirmarFichaComPesquisa(dados, imagens) {
  const desconhecido = (valor) => {
    const texto = normalizar(valor);
    return !texto || [
      'nao informado',
      'nao visivel',
      'peca usada',
      'peca nao identificada',
      'produto para revisao'
    ].includes(texto);
  };
  const consulta = [dados.numero_oem, dados.nome, dados.marca, dados.modelo]
    .map((item) => limparTexto(item, 120))
    .filter(Boolean)
    .join(' ');

  if (!Array.isArray(imagens) || imagens.length === 0) {
    return dados;
  }

  let anuncios = [];
  try {
    anuncios = await buscarAnunciosMercadoLivreLote(consulta);
  } catch {
    anuncios = [];
  }

  const prompt = [
    'Você é um agente de confirmação de autopeças usadas.',
    'Analise novamente as fotos e cruze a evidência visual com Google Search/MODO IA e os anúncios do Mercado Livre fornecidos.',
    'A forma e a função visíveis nas fotos têm prioridade. Pesquisa serve para confirmar marca, modelo, ano e OEM; nunca escolha um resultado apenas por conter uma palavra semelhante.',
    'Se a pesquisa discordar da imagem, mantenha o tipo visual da peça e marque confiança baixa.',
    'Não invente carro, ano, lado, OEM ou compatibilidade. Nunca use Universal sem evidência.',
    'Exemplo de bloqueio: uma peça de acabamento interno, porta-luvas, console, moldura ou difusor não pode ser convertida em amortecedor, retrovisor ou outra peça mecânica/externa sem evidência visual clara.',
    'Responda somente com JSON válido neste formato:',
    '{"nome":"","marca":"","modelo":"","ano":"","numero_oem":"","aplicacao":"","confianca":"alta|media|baixa","observacoes":"","fontes":[""]}',
    '',
    `Ficha visual preliminar: ${JSON.stringify({
      nome: dados.nome,
      marca: dados.marca,
      modelo: dados.modelo,
      ano: dados.ano,
      numero_oem: dados.numero_oem,
      confianca: dados.confianca
    })}`,
    `Consulta no Mercado Livre: ${consulta}`,
    `Anúncios encontrados no Mercado Livre: ${JSON.stringify(anuncios)}`
  ].join('\n');

  try {
    const resposta = await gerarVisaoComIa(prompt, imagens, {
      modelo: 'gemini-2.5-flash',
      googleSearch: true,
      googleSearchOnly: true,
      temperature: 0.08,
      maxTokens: 1200,
      timeoutMs: 120000
    });
    const json = extrairJson(resposta?.texto || '');
    if (!json) return dados;

    const confianca = limparTexto(json.confianca || dados.confianca || 'baixa', 20).toLowerCase();
    const fontes = Array.isArray(json.fontes)
      ? json.fontes.map((fonte) => limparTexto(fonte, 300)).filter(Boolean).slice(0, 5)
      : [];
    const fontesComReferencia = fontes.filter((fonte) => /^https?:\/\//i.test(fonte));
    const aplicacaoConfirmada = confianca === 'alta' &&
      (fontesComReferencia.length >= 2 || anuncios.length >= 2);

    return {
      ...dados,
      // O resultado visual continua sendo a base. A confirmação só completa
      // campos vazios ou corrige o tipo quando a segunda leitura encontrou
      // evidência visual e fontes concordantes.
      nome: confianca !== 'baixa' && json.nome && desconhecido(dados.nome)
        ? limparTexto(json.nome, 200)
        : dados.nome,
      marca: desconhecido(dados.marca) && aplicacaoConfirmada ? limparTexto(json.marca, 120) : dados.marca,
      modelo: desconhecido(dados.modelo) && aplicacaoConfirmada ? limparTexto(json.modelo, 120) : dados.modelo,
      ano: desconhecido(dados.ano) && aplicacaoConfirmada ? limparTexto(json.ano, 40) : dados.ano,
      numero_oem: desconhecido(dados.numero_oem) ? limparTexto(json.numero_oem, 120) : dados.numero_oem,
      carro: desconhecido(dados.carro) && aplicacaoConfirmada ? limparTexto(json.aplicacao, 300) : dados.carro,
      confianca,
      observacoes: [
        dados.observacoes,
        limparTexto(json.observacoes, 600),
        fontes.length ? `Fontes consultadas: ${fontes.join(' | ')}` : '',
        !aplicacaoConfirmada ? 'Aplicação do veículo não confirmada por fontes suficientes; revise antes de publicar.' : '',
        anuncios.length ? `${anuncios.length} anúncio(s) do Mercado Livre usado(s) como referência.` : ''
      ].filter(Boolean).join(' ')
    };
  } catch {
    return dados;
  }
}

export async function analisarFotosLoteComIa({
  imagens = [],
  arquivos = [],
  contexto = {}
} = {}) {
  const nomes = arquivos
    .map((arquivo) => limparTexto(arquivo, 220))
    .filter(Boolean);
  const skuPorArquivo = contexto.skuPorArquivo && typeof contexto.skuPorArquivo === 'object'
    ? contexto.skuPorArquivo
    : {};
  const prompt = [
    PROMPT_LOTE,
    '',
    `Veículo de origem informado: ${limparTexto(
      contexto.veiculoOrigem,
      200
    ) || 'não informado'}.`,
    `Modo do lote: ${limparTexto(contexto.modo, 40) || 'misto'}.`,
    `Mapeamento de SKU já detectado pelos nomes dos arquivos: ${JSON.stringify(skuPorArquivo)}`,
    '',
    'Nomes de todos os arquivos do lote:',
    nomes.join('\n') || 'nenhum nome informado'
  ].join('\n');

  const produtosFallback = Object.entries(skuPorArquivo)
    .reduce((grupos, [arquivo, sku]) => {
      const codigo = limparTexto(sku, 100).toUpperCase();
      if (!codigo) return grupos;
      const atual = grupos.get(codigo) || {
        sku: codigo,
        nome: `Produto ${codigo}`,
        arquivos: [],
        peso_kg: 0,
        comprimento_cm: 0,
        largura_cm: 0,
        altura_cm: 0,
        observacoes: 'Agrupamento recuperado pelo nome da etiqueta; revise os dados com a IA.'
      };
      atual.arquivos.push(arquivo);
      grupos.set(codigo, atual);
      return grupos;
    }, new Map())
    .values();
  const fallbackProdutos = Array.from(produtosFallback);
  if (fallbackProdutos.length === 0 && nomes.length > 0) {
    fallbackProdutos.push({
      sku: 'DESCONHECIDO',
      nome: 'Produto para revisão',
      arquivos: nomes,
      peso_kg: 0,
      comprimento_cm: 0,
      largura_cm: 0,
      altura_cm: 0,
      observacoes: 'A IA não respondeu; confira o SKU e separe os grupos manualmente.'
    });
  }

  const resultado = await gerarVisaoComIa(prompt, imagens, {
    modelo: 'gemini-2.5-flash',
    googleSearch: true,
    maxTokens: 2600,
    timeoutMs: 120000
  });

  if (!resultado?.texto) {
    return {
      alertas: [
        'A IA não respondeu agora. Os grupos foram recuperados pelos nomes das etiquetas; tente a leitura novamente para completar nome, aplicação, medidas e peso.'
      ],
      fonte: 'local',
      produtos: fallbackProdutos
    };
  }

  const json = extrairJson(resultado.texto);

  if (!json) {
    return {
      produtos: fallbackProdutos,
      alertas: [
        'A IA respondeu em um formato inesperado. Os grupos foram recuperados pelos nomes das etiquetas; revise o agrupamento manualmente.'
      ],
      fonte: resultado.fonte
    };
  }

  const produtos = Array.isArray(json.produtos)
    ? json.produtos
        .map((produto) => ({
          sku: limparTexto(produto?.sku, 100).toUpperCase() || 'DESCONHECIDO',
          nome: limparTexto(produto?.nome, 200),
          numero_oem: limparTexto(produto?.numero_oem, 120),
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

  const produtosEnriquecidos = [...produtos];
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(3, produtos.length) }, async () => {
    while (proximo < produtos.length) {
      const indice = proximo++;
      produtosEnriquecidos[indice] = await identificarProdutoLoteComGoogle(produtos[indice]);
    }
  }));
  if (produtosEnriquecidos.length === 0) {
    return {
      produtos: fallbackProdutos,
      alertas: [
        ...(Array.isArray(json.alertas)
          ? json.alertas.map((alerta) => limparTexto(alerta, 300)).filter(Boolean)
          : []),
        'A IA não encontrou grupos válidos nessa resposta. As fotos foram preservadas para revisão; tente a leitura novamente para completar a identificação.'
      ],
      fonte: resultado.fonte,
      modelo: resultado.modelo
    };
  }
  return {
    produtos: produtosEnriquecidos,
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

const ROTULOS_ESTIMADOS = {
  titulo: 'Título',
  nome: 'Nome',
  categoria: 'Categoria',
  categoria_ml: 'Categoria Mercado Livre',
  marca: 'Marca',
  modelo: 'Modelo',
  ano: 'Ano',
  carro: 'Aplicação',
  aplicacao: 'Aplicação',
  condicao: 'Condição',
  numero_oem: 'Código OEM',
  garantia: 'Garantia',
  peso_kg: 'Peso',
  comprimento_cm: 'Medidas',
  largura_cm: 'Medidas',
  altura_cm: 'Medidas',
  descricao: 'Descrição',
  preco_sugerido: 'Preço',
  preco: 'Preço',
  quantidade_sugerida: 'Quantidade',
  quantidade: 'Quantidade',
  gtin: 'GTIN',
  localizacao: 'Localização',
  tipo_anuncio: 'Tipo de anúncio',
  modo_compra: 'Modo de compra'
};

function rotuloEstimado(item, campos = [], atributosExistentes = {}) {
  const limpo = limparTexto(item, 120);
  if (!limpo) return '';

  const semPrefixo = limpo.replace(/^atributos?\./i, '');

  if (['atributo', 'atributos'].includes(semPrefixo.toLowerCase())) {
    return '';
  }

  const campo = campos.find(
    (candidato) =>
      normalizarComparacao(candidato.key) ===
        normalizarComparacao(semPrefixo) ||
      normalizarComparacao(candidato.label) ===
        normalizarComparacao(semPrefixo)
  );

  if (campo) {
    const existente =
      atributosExistentes[campo.key] ??
      atributosExistentes[campo.label] ??
      '';
    if (valorUtil(existente)) return '';
    return campo.label || campo.key;
  }

  return ROTULOS_ESTIMADOS[semPrefixo.toLowerCase()] || limpo;
}

function atributosDePeca(peca = {}) {
  const valor = peca?.atributos;

  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return normalizarAtributosIa(valor);
  }

  if (typeof valor === 'string' && valor.trim()) {
    try {
      const json = JSON.parse(valor);

      if (json && typeof json === 'object' && !Array.isArray(json)) {
        return normalizarAtributosIa(json);
      }
    } catch {
      return {};
    }
  }

  return {};
}

function descricaoValida(valor, minimo = 80) {
  const texto = limparBloco(valor, 5000);
  return texto.length >= minimo ? texto : '';
}

function descricaoCompletaFallback(peca = {}, categoria = '') {
  const nome = limparTexto(peca.nome || 'Peça', 200);
  const aplicacao = limparTexto(
    peca.carro || 'aplicação informada no anúncio',
    200
  );
  const condicao = limparTexto(peca.condicao || 'usado', 40);
  const garantia = limparTexto(peca.garantia, 120) || '90 dias';
  const linhas = [
    `${nome}${peca.carro ? ` para ${aplicacao}` : ''}${
      categoria ? ` - ${categoria}` : ''
    }.`,
    'Peça usada de desmonte, revisada visualmente e armazenada em estoque interno.',
    `Condição: ${condicao}.`,
    `Garantia: ${garantia}.`,
    peca.numero_oem
      ? `Código OEM/referência: ${limparTexto(peca.numero_oem, 120)}.`
      : '',
    `Aplicação: ${aplicacao}. Confirme o modelo, o ano e a versão do veículo antes de comprar.`,
    'A instalação deve ser feita por profissional qualificado. Em caso de dúvida, use o campo de perguntas do anúncio.'
  ];

  return limparBloco(linhas.filter(Boolean).join('\n\n'), 5000);
}

const PERFIS_CATEGORIA = {
  Retrovisores: {
    peso_kg: 1.2,
    comprimento_cm: 30,
    largura_cm: 20,
    altura_cm: 15,
    preco: 300,
    atributos: {
      lado: 'Par',
      acionamento: 'Elétrico',
      cor: 'Preta',
      aquecimento: 'Não'
    }
  },
  'Faróis e Lanternas': {
    peso_kg: 2,
    comprimento_cm: 50,
    largura_cm: 30,
    altura_cm: 25,
    preco: 400,
    atributos: {
      lado: 'Par',
      tipo_lampada: 'H4',
      lente: 'Original',
      regulagem: 'Manual'
    }
  },
  Parachoques: {
    peso_kg: 5,
    comprimento_cm: 140,
    largura_cm: 45,
    altura_cm: 35,
    preco: 600,
    atributos: {
      posicao: 'Dianteiro',
      cor: 'Preta',
      sensores: 'Não',
      farol_milha: 'Não'
    }
  },
  'Portas e Capôs': {
    peso_kg: 12,
    comprimento_cm: 110,
    largura_cm: 90,
    altura_cm: 15,
    preco: 700,
    atributos: {
      posicao: 'Dianteira esquerda',
      cor: 'Preta',
      vidro: 'Sim',
      macaneta: 'Sim'
    }
  },
  'Motor e Componentes': {
    peso_kg: 35,
    comprimento_cm: 50,
    largura_cm: 40,
    altura_cm: 40,
    preco: 3500,
    atributos: {
      combustivel: 'Flex',
      cilindrada: '1.0',
      cambio: 'Manual',
      numero_cilindros: '4'
    }
  },
  'Suspensão e Direção': {
    peso_kg: 4,
    comprimento_cm: 55,
    largura_cm: 20,
    altura_cm: 20,
    preco: 350,
    atributos: {
      posicao: 'Dianteira',
      tipo: 'Amortecedor',
      lado: 'Par'
    }
  },
  Freios: {
    peso_kg: 5,
    comprimento_cm: 35,
    largura_cm: 35,
    altura_cm: 15,
    preco: 300,
    atributos: {
      posicao: 'Dianteiro',
      tipo: 'Disco',
      diametro: '280 mm'
    }
  },
  'Rodas e Pneus': {
    peso_kg: 8,
    comprimento_cm: 60,
    largura_cm: 60,
    altura_cm: 20,
    preco: 450,
    atributos: {
      medida: '185/65 R15',
      aro: '15',
      material: 'Liga leve',
      pneu_incluso: 'Não'
    }
  },
  'Radiadores e Arrefecimento': {
    peso_kg: 4,
    comprimento_cm: 65,
    largura_cm: 45,
    altura_cm: 15,
    preco: 500,
    atributos: {
      material: 'Alumínio',
      transmissao: 'Manual',
      ventoinha: 'Não'
    }
  },
  Elétrica: {
    peso_kg: 4,
    comprimento_cm: 30,
    largura_cm: 25,
    altura_cm: 20,
    preco: 350,
    atributos: {
      tipo: 'Alternador',
      tensao: '12V',
      conectores: '4 pinos'
    }
  },
  Interior: {
    peso_kg: 4,
    comprimento_cm: 50,
    largura_cm: 40,
    altura_cm: 30,
    preco: 250,
    atributos: {
      posicao: 'Dianteira',
      cor: 'Preta',
      material: 'Tecido'
    }
  },
  Vidros: {
    peso_kg: 5,
    comprimento_cm: 110,
    largura_cm: 70,
    altura_cm: 10,
    preco: 300,
    atributos: {
      posicao: 'Para-brisa',
      tipo: 'Original',
      cor: 'Incolor'
    }
  },
  Escapamento: {
    peso_kg: 6,
    comprimento_cm: 90,
    largura_cm: 30,
    altura_cm: 25,
    preco: 350,
    atributos: {
      posicao: 'Traseiro',
      material: 'Aço carbono',
      catalisador: 'Não'
    }
  },
  Transmissão: {
    peso_kg: 30,
    comprimento_cm: 50,
    largura_cm: 40,
    altura_cm: 35,
    preco: 1800,
    atributos: {
      tipo: 'Câmbio',
      cambio: 'Manual',
      tracao: 'Dianteira'
    }
  },
  Baterias: {
    peso_kg: 15,
    comprimento_cm: 30,
    largura_cm: 20,
    altura_cm: 20,
    preco: 350,
    atributos: {
      amperagem: '60Ah',
      tensao: '12V',
      tecnologia: 'Chumbo-ácido'
    }
  },
  Outros: {
    peso_kg: 3,
    comprimento_cm: 30,
    largura_cm: 30,
    altura_cm: 30,
    preco: 200,
    atributos: {
      aplicacao: 'Não informada'
    }
  }
};

const MODOS_COMPRA = ['buy_it_now', 'auction'];

function normalizarComparacao(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function opcaoValida(valor, opcoes = []) {
  const alvo = normalizarComparacao(valor);
  if (!alvo) return '';

  return (
    opcoes.find((opcao) => normalizarComparacao(opcao) === alvo) || ''
  );
}

function normalizarTipoAnuncio(valor) {
  const tipo = normalizarComparacao(valor);

  if (tipo === 'gold pro' || tipo === 'gold premium' || tipo === 'premium') {
    return 'premium';
  }

  if (tipo === 'gold special' || tipo === 'classico') {
    return 'clássico';
  }

  if (tipo === 'free' || tipo === 'gratis') {
    return 'grátis';
  }

  return '';
}

function valorUtil(valor, limite = 200) {
  const texto = limparTexto(valor, limite);
  if (!texto) return '';

  const normalizado = normalizarComparacao(texto);

  if (
    [
      'nao informado',
      'nao informada',
      'nao visivel',
      'nao identificado',
      'nao identificada',
      'desconhecido',
      'desconhecida',
      'sem informacao',
      'nao sei'
    ].includes(normalizado)
  ) {
    return '';
  }

  return texto;
}

function perfilCategoria(categoria) {
  return PERFIS_CATEGORIA[categoria] || PERFIS_CATEGORIA.Outros;
}

function pareceMoto(peca = {}) {
  return /moto|motocicleta|scooter|cinquentinha/i.test(
    `${peca.ml_titulo || ''} ${peca.nome || ''} ${peca.carro || ''}`
  );
}

function ajustarAtributosMoto(
  atributos,
  estimadosAtributos = [],
  campos = [],
  peca = {}
) {
  if (!pareceMoto(peca)) return;

  const foiEstimado = (label) =>
    estimadosAtributos.some(
      (item) =>
        normalizarComparacao(item) === normalizarComparacao(label)
    );
  const temCampo = (key) => campos.some((campo) => campo.key === key);

  if (temCampo('numero_cilindros') && foiEstimado('Número de cilindros')) {
    atributos.numero_cilindros = '1';
  }

  if (temCampo('combustivel') && foiEstimado('Combustível')) {
    atributos.combustivel = 'Gasolina';
  }
}

function normalizarCamposPorCategoria(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};

  return Object.fromEntries(
    Object.entries(valor)
      .map(([categoria, campos]) => [
        limparTexto(categoria, 80),
        Array.isArray(campos)
          ? campos
              .map((campo) => ({
                key: limparTexto(campo?.key, 80),
                label: limparTexto(campo?.label, 120),
                tipo: campo?.tipo === 'select' ? 'select' : 'text',
                opcoes: Array.isArray(campo?.opcoes)
                  ? campo.opcoes
                      .map((opcao) => limparTexto(opcao, 120))
                      .filter(Boolean)
                  : []
              }))
              .filter((campo) => campo.key)
          : []
      ])
      .filter(([categoria]) => categoria)
  );
}

function completarAtributos(
  categoria,
  atributosIa = {},
  campos = [],
  atributosExistentes = {}
) {
  const perfil = perfilCategoria(categoria);
  const existentes =
    atributosExistentes && typeof atributosExistentes === 'object'
      ? normalizarAtributosIa(atributosExistentes)
      : {};
  // Preserva atributos que já existem, inclusive os de outras categorias.
  const atributos = { ...existentes };
  const estimados = [];

  for (const campo of campos) {
    const existente = existentes[campo.key] ?? existentes[campo.label] ?? '';
    const bruto =
      atributosIa && typeof atributosIa === 'object'
        ? atributosIa[campo.key] ?? atributosIa[campo.label]
        : '';

    if (campo.tipo === 'select') {
      const opcaoExistente = opcaoValida(existente, campo.opcoes || []);

      if (opcaoExistente) {
        atributos[campo.key] = opcaoExistente;
        continue;
      }

      const opcao = opcaoValida(bruto, campo.opcoes || []);

      if (opcao) {
        atributos[campo.key] = opcao;
      } else {
        const estimativa =
          opcaoValida(perfil.atributos?.[campo.key], campo.opcoes || []) ||
          campo.opcoes?.[0] ||
          'Não informado';
        atributos[campo.key] = estimativa;
        estimados.push(campo.label || campo.key);
      }
    } else {
      const textoExistente = valorUtil(existente);

      if (textoExistente) {
        atributos[campo.key] = textoExistente;
        continue;
      }

      const texto = valorUtil(bruto);

      if (texto) {
        atributos[campo.key] = texto;
      } else {
        atributos[campo.key] =
          valorUtil(perfil.atributos?.[campo.key]) || 'Não informado';
        estimados.push(campo.label || campo.key);
      }
    }
  }

  return { atributos, estimados };
}

function fichaCompletaFallback(peca = {}, categoria = '', campos = []) {
  const categoriaFinal =
    categoria || limparTexto(peca.categoria, 80) || 'Outros';
  const perfil = perfilCategoria(categoriaFinal);
  const { atributos, estimados: estimadosAtributos } = completarAtributos(
    categoriaFinal,
    {},
    campos,
    atributosDePeca(peca)
  );

  ajustarAtributosMoto(atributos, estimadosAtributos, campos, peca);

  const titulo = limparTexto(
    peca.ml_titulo || peca.nome || 'Peça usada',
    60
  );
  const nome = limparTexto(
    peca.nome || peca.ml_titulo || 'Peça usada',
    200
  );
  const condicaoInformada = String(peca.condicao || '').toLowerCase();
  const condicao = ['novo', 'usado', 'recondicionado'].includes(
    condicaoInformada
  )
    ? condicaoInformada
    : 'usado';
  const descricao =
    descricaoValida(peca.descricao) ||
    descricaoCompletaFallback(
      {
        ...peca,
        nome,
        condicao
      },
      categoriaFinal
    );
  const estimados = [];

  if (!valorUtil(peca.marca, 120)) estimados.push('Marca');
  if (!valorUtil(peca.modelo, 120)) estimados.push('Modelo');
  if (!valorUtil(peca.ano, 40)) estimados.push('Ano');
  if (!valorUtil(peca.carro, 200)) estimados.push('Aplicação');
  if (!valorUtil(peca.numero_oem, 120)) estimados.push('Código OEM');
  if (!valorUtil(peca.garantia, 120)) estimados.push('Garantia');
  if (!numero(peca.peso_kg)) estimados.push('Peso');
  if (
    !numero(peca.comprimento_cm) ||
    !numero(peca.largura_cm) ||
    !numero(peca.altura_cm)
  ) {
    estimados.push('Medidas');
  }
  if (!numero(peca.preco)) estimados.push('Preço');
  if (!numero(peca.quantidade)) estimados.push('Quantidade');
  if (!valorUtil(peca.categoria_ml, 300)) {
    estimados.push('Categoria Mercado Livre');
  }
  estimados.push(...estimadosAtributos);

  return {
    dados: {
      titulo,
      nome,
      categoria: categoriaFinal,
      categoria_ml:
        valorUtil(peca.categoria_ml, 300) ||
        'Autopeças > Peças de Carros e Caminhonetes > Outros',
      marca: valorUtil(peca.marca, 120) || 'Não informado',
      modelo: valorUtil(peca.modelo, 120) || 'Não informado',
      ano: valorUtil(peca.ano, 40) || 'Não informado',
      carro: valorUtil(peca.carro, 200) || 'Não informado',
      condicao,
      numero_oem: valorUtil(peca.numero_oem, 120) || 'Não visível',
      garantia: valorUtil(peca.garantia, 120) || '90 dias',
      peso_kg: numero(peca.peso_kg) || perfil.peso_kg,
      comprimento_cm: numero(peca.comprimento_cm) || perfil.comprimento_cm,
      largura_cm: numero(peca.largura_cm) || perfil.largura_cm,
      altura_cm: numero(peca.altura_cm) || perfil.altura_cm,
      descricao,
      preco_sugerido: numero(peca.preco) || perfil.preco,
      quantidade_sugerida: Math.max(
        1,
        Math.trunc(numero(peca.quantidade) || 1)
      ),
      gtin: valorUtil(peca.gtin, 40) || 'SEM GTIN',
      localizacao:
        valorUtil(peca.localizacao, 120) || 'Estoque interno',
      tipo_anuncio: normalizarTipoAnuncio(peca.tipo_anuncio) || 'clássico',
      modo_compra: MODOS_COMPRA.includes(
        String(peca.modo_compra || '').toLowerCase()
      )
        ? String(peca.modo_compra).toLowerCase()
        : 'buy_it_now',
      atributos,
      confianca: 'baixa',
      estimados: [...new Set(estimados)],
      observacoes:
        'Ficha completada com estimativas locais. Confira os campos marcados antes de salvar.'
    },
    estimados: [...new Set(estimados)]
  };
}

const PROMPT_FICHA_COMPLETA = [
  'Você é especialista em autopeças usadas de desmonte e anúncios do Mercado Livre no Brasil.',
  'Sua tarefa é COMPLETAR TODA a ficha de um anúncio a partir do título e das fotos enviadas.',
  'Preencha o que estiver comprovado nas fotos ou nos dados já informados. Identidade da peça, veículo, marca, modelo, ano e OEM não podem ser inventados para evitar deixar campos vazios.',
  '',
  'Responda SOMENTE com um JSON válido, sem markdown e sem explicações, neste formato:',
  '{',
  '  "sku": "código lido na etiqueta; se aparecer apenas o número, mantenha somente o número",',
  '  "titulo": "título do anúncio com no máximo 60 caracteres",',
  '  "nome": "nome interno da peça",',
  '  "categoria": "uma categoria da lista permitida",',
  '  "categoria_ml": "caminho da categoria no Mercado Livre, se souber",',
  '  "marca": "marca do veículo ou da peça",',
  '  "modelo": "modelo do veículo",',
  '  "ano": "ano ou faixa de anos",',
  '  "carro": "veículo/aplicação completa",',
  '  "condicao": "usado, novo ou recondicionado",',
  '  "numero_oem": "código OEM/referência visível ou Não visível",',
  '  "garantia": "garantia informada ou 90 dias",',
  '  "peso_kg": 0,',
  '  "comprimento_cm": 0,',
  '  "largura_cm": 0,',
  '  "altura_cm": 0,',
  '  "descricao": "descrição de 3 a 6 parágrafos curtos",',
  '  "preco_sugerido": 0,',
  '  "quantidade_sugerida": 1,',
  '  "gtin": "SEM GTIN",',
  '  "localizacao": "Estoque interno",',
  '  "tipo_anuncio": "clássico, premium ou grátis",',
  '  "modo_compra": "buy_it_now ou auction",',
  '  "atributos": { "chave_tecnica": "valor" },',
  '  "confianca": "alta, media ou baixa",',
  '  "estimados": ["nomes dos campos preenchidos por estimativa"],',
  '  "observacoes": "o que precisa ser conferido"',
  '}',
  '',
  'Regras obrigatórias:',
  '- Use as fotos para identificar a peça, lado, posição, cor, material, conectores, etiqueta OEM, medidas e peso.',
  '- As fotos podem vir rotuladas como [SKU], [PRODUTO], [MEDIDAS] e [CODIGO]. Leia primeiro [SKU] e [CODIGO] com OCR e use [MEDIDAS] para preencher peso e dimensões.',
  '- Use o título para identificar veículo, marca, modelo, ano e aplicação.',
  '- Quando a informação não estiver visível, deixe o campo de identificação vazio e inclua o nome em "estimados". Medidas e peso também devem ficar em 0 quando não houver leitura legível.',
  '- Para campos de seleção, use EXATAMENTE uma das opções informadas na ficha técnica.',
  '- Para "atributos", preencha TODAS as chaves da categoria escolhida.',
  '- Se a categoria atual estiver definida, mantenha-a; caso contrário, escolha a mais adequada da lista.',
  '- O título deve ter no máximo 60 caracteres e conter peça, lado/posição, veículo e ano quando possível.',
  '- Classifique primeiro a forma e a função. Console central, porta-luvas, moldura, difusor e acabamento interno não são alternador, amortecedor, farol ou retrovisor.',
  '- Para alternador, amortecedor, farol ou retrovisor, exige-se evidência visual específica da peça; uma busca externa nunca pode criar essa evidência.',
  '- Não use "Universal", "Geral" ou anos genéricos. Se não houver aplicação confirmada, deixe marca, modelo, carro e ano sem preencher.',
  '- A descrição deve ter 3 a 6 parágrafos curtos, sem emojis, com aplicação, condição, garantia, procedência e orientações.',
  '- Preço sugerido em BRL para peça usada; quantidade sugerida mínima 1; GTIN "SEM GTIN" se não houver; localização "Estoque interno".',
  '- OEM: use o código visível ou "Não visível". Garantia: use a informada ou "90 dias".',
  '- "estimados" deve listar os nomes dos campos preenchidos por estimativa.',
  '- Se usar um valor padrão porque a informação não estava disponível (por exemplo, "90 dias", "SEM GTIN", "Estoque interno" ou "Não visível"), inclua o campo correspondente em "estimados".',
  '- "observacoes" deve resumir o que o vendedor precisa conferir.'
].join('\n');

export async function completarFichaComIa({
  peca = {},
  imagens = [],
  categorias = [],
  camposPorCategoria = {},
  modo = 'completo'
} = {}) {
  const categoriasLimpas = Array.isArray(categorias)
    ? categorias.map((item) => limparTexto(item, 80)).filter(Boolean)
    : [];
  const camposLimpos = normalizarCamposPorCategoria(camposPorCategoria);
  const categoriaAtual =
    categoriasLimpas.length > 0
      ? categoriasLimpas.find(
          (categoria) =>
            normalizarComparacao(categoria) ===
            normalizarComparacao(peca.categoria)
        ) || ''
      : limparTexto(peca.categoria, 80);
  const categoriaParaFallback =
    categoriaAtual ||
    (categoriasLimpas.length === 1 ? categoriasLimpas[0] : 'Outros');
  const camposFallback =
    camposLimpos[categoriaParaFallback] || camposLimpos.Outros || [];

  const schema = JSON.stringify(
    Object.fromEntries(
      Object.entries(camposLimpos).map(([categoria, campos]) => [
        categoria,
        campos.map((campo) => ({
          chave: campo.key,
          rotulo: campo.label,
          tipo: campo.tipo,
          opcoes: campo.opcoes
        }))
      ])
    )
  );

  const prompt = [
    PROMPT_FICHA_COMPLETA,
    '',
    'Dados atuais da peça:',
    resumoPeca(peca),
    '',
    `Categorias permitidas: ${
      categoriasLimpas.join(', ') || 'não informadas'
    }.`,
    `Categoria atual: ${categoriaAtual || 'não definida'}.`,
    '',
    'Ficha técnica por categoria (JSON):',
    schema || '{}',
    '',
    `Nomes das fotos: ${
      imagens
        .map((imagem) => imagem?.nome)
        .filter(Boolean)
        .join(', ') || 'nenhuma foto enviada'
    }`,
    '',
    `Modo solicitado: ${limparTexto(modo, 40) || 'completo'}.`
  ].join('\n');

  let resultado = null;

  if (Array.isArray(imagens) && imagens.length > 0) {
    resultado = await gerarVisaoComIa(prompt, imagens, {
      modelo: 'gemini-2.5-flash',
      googleSearch: false,
      googleSearchOnly: true,
      maxTokens: 3000,
      temperature: 0.08,
      timeoutMs: 60000
    });
  }

  if (!resultado?.texto) {
    resultado = await gerarTextoComIa(prompt, {
      maxTokens: 3000,
      temperature: 0.3,
      timeoutMs: 60000,
      limiteCaracteres: 20000
    });
  }

  if (!resultado?.texto) {
    const fallback = fichaCompletaFallback(
      peca,
      categoriaParaFallback,
      camposFallback
    );

    return {
      ...fallback,
      fonte: 'local',
      modelo: null,
      aviso:
        'A IA não respondeu agora. A ficha foi completada com os dados atuais e estimativas locais. Revise os campos marcados.'
    };
  }

  const json = extrairJson(resultado.texto);

  if (!json && process.env.DEBUG_IA_FICHA === '1') {
    console.warn(
      'Resposta bruta da IA (ficha):',
      String(resultado.texto || '').slice(0, 8000)
    );
  }

  if (!json) {
    const fallback = fichaCompletaFallback(
      peca,
      categoriaParaFallback,
      camposFallback
    );

    return {
      ...fallback,
      fonte: resultado.fonte,
      modelo: resultado.modelo,
      aviso:
        'A IA respondeu em um formato inesperado. A ficha foi completada com os dados atuais e estimativas locais. Revise os campos marcados.'
    };
  }

  const categoriaIa = normalizarCategoriaIa(json.categoria, categoriasLimpas);
  const categoria =
    categoriaAtual ||
    (categoriasLimpas.length > 0
      ? categoriasLimpas.includes(categoriaIa)
        ? categoriaIa
        : categoriasLimpas.includes('Outros')
          ? 'Outros'
          : categoriasLimpas[0]
      : categoriaIa || 'Outros');
  const campos =
    camposLimpos[categoria] || camposLimpos[categoriaAtual] || camposFallback;
  const atributosExistentes = atributosDePeca(peca);
  const { atributos, estimados: estimadosAtributos } = completarAtributos(
    categoria,
    json.atributos,
    campos,
    atributosExistentes
  );

  ajustarAtributosMoto(atributos, estimadosAtributos, campos, peca);

  const perfil = perfilCategoria(categoria);
  const condicaoExistente = String(peca.condicao || '').toLowerCase();
  const condicaoInformada = String(json.condicao || '').toLowerCase();
  const condicao = ['novo', 'usado', 'recondicionado'].includes(
    condicaoExistente
  )
    ? condicaoExistente
    : ['novo', 'usado', 'recondicionado'].includes(condicaoInformada)
      ? condicaoInformada
      : 'usado';
  const tipoExistente = normalizarTipoAnuncio(peca.tipo_anuncio);
  const tipoInformado = normalizarTipoAnuncio(json.tipo_anuncio);
  const tipoAnuncio = tipoExistente || tipoInformado || 'clássico';
  const modoExistente = String(peca.modo_compra || '').toLowerCase();
  const modoInformado = String(json.modo_compra || '').toLowerCase();
  const modoCompra = MODOS_COMPRA.includes(modoExistente)
    ? modoExistente
    : MODOS_COMPRA.includes(modoInformado)
      ? modoInformado
      : 'buy_it_now';
  const titulo = limparTexto(
    peca.ml_titulo || peca.nome || json.titulo || json.nome || 'Peça usada',
    60
  );
  const nome = limparTexto(
    peca.nome || json.nome || json.titulo || 'Peça usada',
    200
  );
  const descricao =
    descricaoValida(peca.descricao) ||
    descricaoValida(json.descricao) ||
    descricaoCompletaFallback(
      {
        ...peca,
        nome,
        condicao
      },
      categoria
    );
  const estimados = new Set(
    Array.isArray(json.estimados)
      ? json.estimados
          .map((item) => rotuloEstimado(item, campos, atributosExistentes))
          .filter(Boolean)
      : []
  );

  estimadosAtributos.forEach((item) => estimados.add(item));

  if (!valorUtil(peca.marca, 120) && !valorUtil(json.marca, 120)) {
    estimados.add('Marca');
  }
  if (!valorUtil(peca.modelo, 120) && !valorUtil(json.modelo, 120)) {
    estimados.add('Modelo');
  }
  if (!valorUtil(peca.ano, 40) && !valorUtil(json.ano, 40)) {
    estimados.add('Ano');
  }
  if (
    !valorUtil(peca.carro, 200) &&
    !valorUtil(json.carro || json.aplicacao, 200)
  ) {
    estimados.add('Aplicação');
  }
  if (
    !valorUtil(peca.numero_oem, 120) &&
    !valorUtil(json.numero_oem, 120)
  ) {
    estimados.add('Código OEM');
  }
  if (
    !valorUtil(peca.garantia, 120) &&
    !valorUtil(json.garantia, 120)
  ) {
    estimados.add('Garantia');
  }
  if (!numero(peca.peso_kg) && !numero(json.peso_kg)) {
    estimados.add('Peso');
  }
  if (
    (!numero(peca.comprimento_cm) && !numero(json.comprimento_cm)) ||
    (!numero(peca.largura_cm) && !numero(json.largura_cm)) ||
    (!numero(peca.altura_cm) && !numero(json.altura_cm))
  ) {
    estimados.add('Medidas');
  }
  if (!numero(peca.preco) && !numero(json.preco_sugerido)) {
    estimados.add('Preço');
  }
  if (
    !numero(peca.quantidade) &&
    !numero(json.quantidade_sugerida)
  ) {
    estimados.add('Quantidade');
  }
  if (
    !valorUtil(peca.categoria_ml, 300) &&
    !valorUtil(json.categoria_ml, 300)
  ) {
    estimados.add('Categoria Mercado Livre');
  }

  const dados = {
    titulo,
    nome,
    categoria,
    categoria_ml:
      valorUtil(peca.categoria_ml, 300) ||
      valorUtil(json.categoria_ml, 300) ||
      'Autopeças > Peças de Carros e Caminhonetes > Outros',
    marca:
      valorUtil(peca.marca, 120) ||
      valorUtil(json.marca, 120) ||
      'Não informado',
    modelo:
      valorUtil(peca.modelo, 120) ||
      valorUtil(json.modelo, 120) ||
      'Não informado',
    ano:
      valorUtil(peca.ano, 40) ||
      valorUtil(json.ano, 40) ||
      'Não informado',
    carro:
      valorUtil(peca.carro, 200) ||
      valorUtil(json.carro || json.aplicacao, 200) ||
      'Não informado',
    condicao,
    numero_oem:
      valorUtil(peca.numero_oem, 120) ||
      valorUtil(json.numero_oem, 120) ||
      'Não visível',
    garantia:
      valorUtil(peca.garantia, 120) ||
      valorUtil(json.garantia, 120) ||
      '90 dias',
    peso_kg: numero(peca.peso_kg) || numero(json.peso_kg) || perfil.peso_kg,
    comprimento_cm:
      numero(peca.comprimento_cm) ||
      numero(json.comprimento_cm) ||
      perfil.comprimento_cm,
    largura_cm:
      numero(peca.largura_cm) ||
      numero(json.largura_cm) ||
      perfil.largura_cm,
    altura_cm:
      numero(peca.altura_cm) ||
      numero(json.altura_cm) ||
      perfil.altura_cm,
    descricao,
    preco_sugerido:
      numero(peca.preco) || numero(json.preco_sugerido) || perfil.preco,
    quantidade_sugerida: Math.max(
      1,
      Math.trunc(
        numero(peca.quantidade) || numero(json.quantidade_sugerida) || 1
      )
    ),
    gtin:
      valorUtil(peca.gtin, 40) ||
      valorUtil(json.gtin, 40) ||
      'SEM GTIN',
    localizacao:
      valorUtil(peca.localizacao, 120) ||
      valorUtil(json.localizacao, 120) ||
      'Estoque interno',
    tipo_anuncio: tipoAnuncio,
    modo_compra: modoCompra,
    atributos,
    confianca: limparTexto(json.confianca || 'media', 20),
    estimados: [...estimados],
    observacoes: limparTexto(json.observacoes, 600)
  };

  const estimadosLista = dados.estimados;
  const fonteLabel =
    resultado.fonte === 'freellmapi'
      ? 'FreeLLMAPI'
      : resultado.fonte === 'gemini'
        ? 'Gemini'
        : 'IA';

  // O primeiro modelo pode acertar o tipo da peça e ainda errar o veículo.
  // Para a confirmação, descarte aplicação inferida e mantenha apenas o que
  // já foi informado pelo vendedor; o agente de pesquisa precisa reconquistar
  // marca/modelo/ano com fontes suficientes.
  const dadosParaConfirmacao = {
    ...dados,
    marca: valorUtil(peca.marca, 120) ? dados.marca : '',
    modelo: valorUtil(peca.modelo, 120) ? dados.modelo : '',
    ano: valorUtil(peca.ano, 40) ? dados.ano : '',
    carro: valorUtil(peca.carro, 200) ? dados.carro : ''
  };
  const dadosConfirmados = await confirmarFichaComPesquisa(dadosParaConfirmacao, imagens);

  return {
    dados: dadosConfirmados,
    fonte: `${resultado.fonte} + Google Search/MODO IA + Mercado Livre`,
    modelo: resultado.modelo,
    estimados: estimadosLista,
    aviso: [
      `Ficha completa gerada com ${fonteLabel}.`,
      estimadosLista.length > 0
        ? `Campos estimados: ${estimadosLista
            .slice(0, 14)
            .join(', ')}${estimadosLista.length > 14 ? '...' : ''}.`
        : 'Nenhum campo precisou de estimativa.',
      'Revise os dados antes de salvar.'
    ].join(' ')
  };
}
