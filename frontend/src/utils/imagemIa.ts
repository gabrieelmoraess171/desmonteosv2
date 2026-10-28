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
const TAMANHO_MAXIMO_BASE64 = 4 * 1024 * 1024;

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

async function redimensionar(file: File): Promise<string> {
  const imagem = await carregarImagem(file);
  const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
  const escala =
    maiorLado > DIMENSAO_MAXIMA ? DIMENSAO_MAXIMA / maiorLado : 1;
  const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
  const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
  const canvas = document.createElement('canvas');

  canvas.width = largura;
  canvas.height = altura;

  const contexto = canvas.getContext('2d');
  if (!contexto) {
    return lerComoDataUrl(file);
  }

  contexto.drawImage(imagem, 0, 0, largura, altura);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALIDADE_JPEG);
  return dataUrl.length > TAMANHO_MAXIMO_BASE64
    ? canvas.toDataURL('image/jpeg', 0.65)
    : dataUrl;
}

/**
 * Prepara as fotos para a leitura multimodal: reduz o tamanho, converte para
 * JPEG e limita a quantidade para não estourar o tempo ou o limite da IA.
 */
export async function prepararImagensParaIa(
  arquivos: ArquivoParaIa[],
  maxImagens = 8
): Promise<ImagemParaIa[]> {
  const selecionados = arquivos
    .filter((item) => item.file && item.file.type.startsWith('image/'))
    .slice(0, maxImagens);
  const resultado: ImagemParaIa[] = [];

  for (const item of selecionados) {
    try {
      const dataUrl = await redimensionar(item.file);
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
