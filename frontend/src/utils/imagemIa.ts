export interface ImagemParaIa {
  nome: string;
  dataUrl: string;
  mime: string;
}

interface ArquivoParaIa {
  file: File;
  nome?: string;
}

const DIMENSAO_MAXIMA = 1280;
const QUALIDADE_JPEG = 0.82;
const TAMANHO_MAXIMO_BASE64 = 850 * 1024;

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const imagem = new Image();

    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Formato de imagem não suportado: ${file.name}`));
    };
    imagem.src = url;
  });
}

async function redimensionar(file: File, tamanhoMaximoBase64 = TAMANHO_MAXIMO_BASE64): Promise<string> {
  const imagem = await carregarImagem(file);
  const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
  const escala =
    maiorLado > DIMENSAO_MAXIMA ? DIMENSAO_MAXIMA / maiorLado : 1;
  const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
  const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  let larguraAtual = largura;
  let alturaAtual = altura;
  let qualidade = QUALIDADE_JPEG;

  for (let tentativa = 0; tentativa < 9; tentativa += 1) {
    canvas.width = larguraAtual;
    canvas.height = alturaAtual;

    const contexto = canvas.getContext('2d');
    if (!contexto) {
      const original = await lerComoDataUrl(file);
      if (original.length <= tamanhoMaximoBase64) return original;
      throw new Error(`Não foi possível reduzir o tamanho de ${file.name}`);
    }

    contexto.drawImage(imagem, 0, 0, larguraAtual, alturaAtual);
    const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
    if (dataUrl.length <= tamanhoMaximoBase64) return dataUrl;

    if (qualidade > 0.58) {
      qualidade = Math.max(0.58, qualidade - 0.12);
    } else {
      larguraAtual = Math.max(1, Math.round(larguraAtual * 0.8));
      alturaAtual = Math.max(1, Math.round(alturaAtual * 0.8));
      qualidade = 0.72;
    }
  }

  throw new Error(`Não foi possível reduzir o tamanho de ${file.name}`);
}

/**
 * Prepara as fotos para a leitura multimodal: reduz o tamanho, converte para
 * JPEG e limita a quantidade para não estourar o tempo ou o limite da IA.
 */
export async function prepararImagensParaIa(
  arquivos: ArquivoParaIa[],
  maxImagens = 8,
  tamanhoMaximoBase64 = TAMANHO_MAXIMO_BASE64
): Promise<ImagemParaIa[]> {
  const selecionados = arquivos
    .filter((item) => item.file && item.file.type.startsWith('image/'))
    .slice(0, maxImagens);
  const resultado: ImagemParaIa[] = [];

  for (const item of selecionados) {
    try {
      const dataUrl = await redimensionar(item.file, tamanhoMaximoBase64);
      const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] || 'image/jpeg';

      if (dataUrl.startsWith('data:image/')) {
        resultado.push({
          nome: item.nome || item.file.name,
          dataUrl,
          mime,
        });
      }
    } catch (error) {
      console.warn('Foto ignorada na leitura com IA:', error);
    }
  }

  return resultado;
}

export function dataUrlParaBase64(dataUrl: string): string {
  return String(dataUrl).replace(/^data:[^;]+;base64,/, '');
}
