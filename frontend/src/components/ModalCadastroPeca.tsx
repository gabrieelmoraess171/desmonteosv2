import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Camera,
  Car,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Ruler,
  Sparkles,
  Store,
  Tag,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import axios from 'axios';
import ProductPhotoPicker, {
  type FotoSelecionada,
} from './ProductPhotoPicker';
import PecaFotosEditor from './PecaFotosEditor';
import FichaMercadoLivre, { CompatibilidadeMl, type ConfigAnuncioMl } from './FichaMercadoLivre';
import {
  CAMPOS_CATEGORIA,
  CATEGORIAS_PECA,
  camposDaCategoria,
  categoriaMlDe,
  lerAtributos,
  prefixoSku,
} from '../config/categorias';
import { STORAGE_KEYS } from '../config/app';
import { prepararImagensParaIa } from '../utils/imagemIa';
import {
  derivarAtributosMl,
  type FichaMlCarregada,
} from '../config/atributosMl';
import Bloco from './cadastro/Bloco';
import FichaRevisaoIa, {
  type ResumoFichaIa,
} from './cadastro/FichaRevisaoIa';
import { calcularPendencias, contarPorBloco } from './cadastro/pendenciasMl';

export interface PecaCompleta {
  id: number;
  nome: string;
  sku?: string | null;
  carro?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  categoria_ml?: string | null;
  ml_category_id?: string | null;
  ml_config?: string | ConfigAnuncioMl | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | null;
  condicao?: string | null;
  numero_oem?: string | null;
  garantia?: string | null;
  peso_kg?: number | null;
  comprimento_cm?: number | null;
  largura_cm?: number | null;
  altura_cm?: number | null;
  atributos?: string | Record<string, string> | null;
  ml_titulo?: string | null;
  tipo_anuncio?: string | null;
  gtin?: string | null;
  localizacao?: string | null;
  video_url?: string | null;
  modo_compra?: string | null;
  quantidade?: number | null;
  preco?: number | null;
  ml_ativo?: number | boolean | null;
  ml_item_id?: string | null;
  ml_permalink?: string | null;
  imagens_count?: number | null;
}

interface ModalCadastroPecaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  peca?: PecaCompleta | null;
}

interface FichaIaPeca {
  sku?: string;
  titulo?: string;
  nome?: string;
  categoria?: string;
  categoria_ml?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  carro?: string;
  condicao?: string;
  numero_oem?: string;
  garantia?: string;
  peso_kg?: number;
  comprimento_cm?: number;
  largura_cm?: number;
  altura_cm?: number;
  descricao?: string;
  preco_sugerido?: number;
  quantidade_sugerida?: number;
  gtin?: string;
  localizacao?: string;
  tipo_anuncio?: string;
  modo_compra?: string;
  atributos?: Record<string, string>;
  atributos_ml?: Record<string, string>;
  confianca?: string;
  estimados?: string[];
  observacoes?: string;
}

interface RespostaFichaCompletaIa {
  dados: FichaIaPeca;
  fonte: string;
  modelo?: string;
  estimados?: string[];
  aviso?: string;
  imagensAnalisadas?: number;
}

interface PecaFormData {
  nome: string;
  ml_titulo: string;
  sku: string;
  carro: string;
  descricao: string;
  categoria: string;
  categoria_ml: string;
  ml_category_id: string;
  ml_config: ConfigAnuncioMl;
  marca: string;
  modelo: string;
  ano: string;
  condicao: string;
  numero_oem: string;
  garantia: string;
  peso_kg: string;
  comprimento_cm: string;
  largura_cm: string;
  altura_cm: string;
  tipo_anuncio: string;
  gtin: string;
  localizacao: string;
  modo_compra: string;
  quantidade: string;
  preco: string;
  ml_ativo: boolean;
  atributos: Record<string, string>;
}

const createInitialFormData = (): PecaFormData => ({
  nome: '',
  ml_titulo: '',
  sku: '',
  carro: '',
  descricao: '',
  categoria: '',
  categoria_ml: '',
  ml_category_id: '',
  ml_config: {
    shipping: { mode: 'not_specified', free_shipping: false, local_pick_up: false },
    sale_terms: { WARRANTY_TYPE: 'Sem garantia' },
  },
  marca: '',
  modelo: '',
  ano: '',
  condicao: 'usado',
  numero_oem: '',
  garantia: 'Sem garantia',
  peso_kg: '',
  comprimento_cm: '',
  largura_cm: '',
  altura_cm: '',
  tipo_anuncio: 'premium',
  gtin: '',
  localizacao: '',
  modo_compra: 'buy_it_now',
  quantidade: '1',
  preco: '',
  ml_ativo: false,
  atributos: {},
});

function readUserName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.userName)?.trim() || '';
  } catch {
    return '';
  }
}

function textoNumero(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  return Number.isFinite(numero) ? String(numero) : '';
}

function expandirFaixaAnos(valor: string): string {
  const texto = String(valor || '').trim();
  const faixa = texto.match(/\b(19\d{2}|20\d{2})\s*(?:a|até|[-–—])\s*(19\d{2}|20\d{2})\b/i);
  if (!faixa) return texto;
  const inicio = Number(faixa[1]);
  const fim = Number(faixa[2]);
  if (fim < inicio || fim - inicio > 30) return texto;
  return Array.from({ length: fim - inicio + 1 }, (_, indice) => String(inicio + indice)).join(' ');
}

function formatarSkuIa(valor: unknown, atual: string): string {
  const lido = String(valor || '').trim().toUpperCase();
  if (!lido) return atual;
  const numero = lido.match(/\d+/)?.[0];
  const prefixo = atual.match(/^(.*?)(?:\d+)\s*$/)?.[1]?.trim();
  if (numero && prefixo && !/[A-Z]/.test(lido)) return `${prefixo}${numero}`.replace(/\s+/g, ' ').trim();
  return lido.replace(/\bG\s*SKU\b/i, 'G SKU').replace(/\s+/g, ' ').trim();
}

function montarTituloPadrao(dados: { nome?: string; titulo?: string; marca?: string; modelo?: string; ano?: string; lado?: string }): string {
  const marca = String(dados.marca || '').trim();
  const modelo = String(dados.modelo || '').trim();
  // Sem marca/modelo confirmados, anos soltos criam títulos genéricos e
  // passam uma aplicação que a foto não comprovou.
  const anos = marca || modelo ? expandirFaixaAnos(String(dados.ano || '')).trim() : '';
  const baseOriginal = String(dados.nome || dados.titulo || 'Peça automotiva').trim();
  const lado = String(dados.lado || baseOriginal.match(/\b(direito|esquerdo)\b/i)?.[1] || '').toLowerCase();
  const base = baseOriginal
    .replace(new RegExp(`\\b${marca.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'ig'), '')
    .replace(new RegExp(`\\b${modelo.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'ig'), '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/\b(universal|geral|usado|nova?|principal)\b/ig, '')
    .replace(/\b(direito|esquerdo)\b/ig, '')
    .replace(/\s+/g, ' ').trim();
  return [base, lado ? lado.charAt(0).toUpperCase() + lado.slice(1) : '', marca, modelo, anos]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function ordemFotosParaEnvio(lista: FotoSelecionada[]): FotoSelecionada[] {
  const ordem: Array<FotoSelecionada['grupo']> = ['sku', 'produto', 'medidas', 'codigo'];
  return [...lista].sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
}

function dadosDaPeca(peca: PecaCompleta): PecaFormData {
  return {
    nome: peca.nome || '',
    ml_titulo: peca.ml_titulo || peca.nome || '',
    sku: peca.sku || '',
    carro: peca.carro || '',
    descricao: peca.descricao || '',
    categoria: peca.categoria || '',
    categoria_ml: peca.categoria_ml || '',
    ml_category_id: peca.ml_category_id || '',
    ml_config: (() => { try { return { shipping: { mode: 'not_specified', free_shipping: false, local_pick_up: false }, sale_terms: { WARRANTY_TYPE: 'Sem garantia' }, ...(typeof peca.ml_config === 'string' ? JSON.parse(peca.ml_config) : peca.ml_config || {}) }; } catch { return { shipping: { mode: 'not_specified', free_shipping: false, local_pick_up: false }, sale_terms: { WARRANTY_TYPE: 'Sem garantia' } }; } })(),
    marca: peca.marca || '',
    modelo: peca.modelo || '',
    ano: peca.ano || '',
    condicao: peca.condicao || 'usado',
    numero_oem: peca.numero_oem || '',
    garantia: 'Sem garantia',
    peso_kg: textoNumero(peca.peso_kg),
    comprimento_cm: textoNumero(peca.comprimento_cm),
    largura_cm: textoNumero(peca.largura_cm),
    altura_cm: textoNumero(peca.altura_cm),
    tipo_anuncio: 'premium',
    gtin: peca.gtin || '',
    localizacao: peca.localizacao || '',
    modo_compra: peca.modo_compra || 'buy_it_now',
    quantidade: textoNumero(peca.quantidade) || '0',
    preco: textoNumero(peca.preco),
    ml_ativo: Boolean(peca.ml_ativo),
    atributos: lerAtributos(peca.atributos),
  };
}

/**
 * Converte o preço digitado em número.
 * Aceita "1234,56", "1.234,56" e "1234.56".
 */
function parsePreco(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, '');
  if (!cleaned) return NaN;

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function textoPreenchido(valor: unknown, atual: string): string {
  const texto = String(valor ?? '').trim();
  return texto || atual;
}

function numeroPreenchido(valor: unknown, atual: string): string {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : atual;
}

function criarIdFoto(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type BlocoCadastro = 'fotos' | 'identificacao' | 'aplicacao' | 'fichaMl' | 'preco' | 'descricao';

const ORDEM_BLOCOS: Array<{ id: BlocoCadastro; rotulo: string }> = [
  { id: 'fotos', rotulo: 'Fotos' },
  { id: 'identificacao', rotulo: 'Identificação' },
  { id: 'aplicacao', rotulo: 'Aplicação' },
  { id: 'fichaMl', rotulo: 'Ficha ML' },
  { id: 'preco', rotulo: 'Preço' },
  { id: 'descricao', rotulo: 'Descrição' },
];

const BLOCOS_INICIAIS: Record<BlocoCadastro, boolean> = {
  fotos: true,
  identificacao: false,
  aplicacao: false,
  fichaMl: false,
  preco: false,
  descricao: false,
};

// O operador abre um bloco por vez: os resumos mostram o que já está preenchido
// sem precisar reabrir cada etapa.
function resumoDe(valores: Array<string | number | undefined | null>, vazio: string) {
  const preenchidos = valores
    .map((valor) => String(valor ?? '').trim())
    .filter(Boolean);

  return preenchidos.length > 0 ? preenchidos.join(' • ') : vazio;
}

function formatarMedidas(formData: PecaFormData): string {
  const medidas = [formData.comprimento_cm, formData.largura_cm, formData.altura_cm]
    .map((valor) => String(valor || '').trim())
    .filter(Boolean);

  return medidas.length === 3 ? `${medidas.join(' × ')} cm` : '';
}

// Resumo curto do que a IA leu, exibido acima dos blocos. A ideia é o operador
// conferir a leitura inteira sem abrir cada campo.
function montarResumoIa(dados: FichaIaPeca, estimados: string[]): ResumoFichaIa {
  const estado = (valor?: string | number | null) => {
    const texto = String(valor ?? '').trim();
    return texto || 'Não informado';
  };
  const medidas = [dados.comprimento_cm, dados.largura_cm, dados.altura_cm]
    .filter((valor) => Number(valor) > 0);

  return {
    nome: estado(dados.nome),
    ml_titulo: estado(dados.titulo),
    categoria: estado(dados.categoria),
    categoria_ml: estado(dados.categoria_ml),
    lado: estado(dados.atributos?.lado),
    acionamento: estado(
      dados.atributos?.acionamento || dados.atributos?.tipo_acionamento
    ),
    veiculo: estado(dados.carro),
    marca: estado(dados.marca),
    modelo: estado(dados.modelo),
    ano: estado(dados.ano),
    preco: Number(dados.preco_sugerido) > 0
      ? Number(dados.preco_sugerido).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : 'Não sugerido',
    peso: Number(dados.peso_kg) > 0 ? `${dados.peso_kg} kg` : 'Não informado',
    medidas: medidas.length === 3 ? `${medidas.join(' × ')} cm` : 'Não informadas',
    descricao: estado(dados.descricao),
    numero_oem: estado(dados.numero_oem),
    gtin: estado(dados.gtin),
    atributosMl: Object.keys(dados.atributos || {}).length,
  };
}

export default function ModalCadastroPeca({
  isOpen,
  onClose,
  onSuccess,
  peca = null,
}: ModalCadastroPecaProps) {
  const editando = Boolean(peca);
  const [blocosAbertos, setBlocosAbertos] = useState(BLOCOS_INICIAIS);
  const [fichaMl, setFichaMl] = useState<FichaMlCarregada | null>(null);
  const [revisaoIa, setRevisaoIa] = useState<ResumoFichaIa | null>(null);
  const [imagensAnalisadasIa, setImagensAnalisadasIa] = useState<number | undefined>();
  const [formData, setFormData] = useState<PecaFormData>(createInitialFormData);
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const [loading, setLoading] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [completandoFicha, setCompletandoFicha] = useState(false);
  // Liga quando o operador solta uma foto: o efeito abaixo chama a IA sozinho.
  const [leituraAutomaticaPendente, setLeituraAutomaticaPendente] = useState(false);
  const [pecaSalva, setPecaSalva] = useState<{ id: number; fotos: number } | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [publicacao, setPublicacao] = useState<{ permalink: string | null; itemId: string | null } | null>(null);
  const [iaAviso, setIaAviso] = useState('');
  const [iaFonte, setIaFonte] = useState('');
  const [estimadosIa, setEstimadosIa] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [skuSugerido, setSkuSugerido] = useState('');
  const [consultandoOem, setConsultandoOem] = useState(false);
  const [referenciasOem, setReferenciasOem] = useState<Array<{ titulo: string; marca: string; modelo: string; url: string; numero?: string; aplicacoes?: string; fonte?: string }>>([]);
  const [fontesOem, setFontesOem] = useState<Array<{ nome: string; url: string; status: string }>>([]);
  const [identificacaoIa, setIdentificacaoIa] = useState<{ peca?: string; lado?: string; marca?: string; modelos?: string[]; anos?: string; veiculos?: string[]; confianca?: string; observacao?: string; fonte?: string } | null>(null);
  const tituloInputRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<FotoSelecionada[]>([]);

  const alternarBloco = useCallback((id: BlocoCadastro, aberto: boolean) => {
    setBlocosAbertos((atual) => ({ ...atual, [id]: aberto }));

    if (aberto) {
      window.setTimeout(() => {
        document
          .getElementById(`bloco-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }, []);

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  const limparFotos = useCallback(() => {
    fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.preview));
    fotosRef.current = [];
    setFotos([]);
  }, []);

  useEffect(
    () => () => {
      fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.preview));
    },
    []
  );

  const handleAddFotos = useCallback((files: File[], grupo: FotoSelecionada['grupo']) => {
    const novas = files.slice(0, 20).map((file) => ({
      id: criarIdFoto(),
      file,
      preview: URL.createObjectURL(file),
      grupo,
    }));

    setFotos((atuais) => [...atuais, ...novas].slice(0, 20));

    // A leitura com IA começa sozinha: o operador só escolhe a foto da peça.
    // Fotos de medidas não disparam a leitura, pois costumam vir depois da ficha.
    if (grupo !== 'medidas') setLeituraAutomaticaPendente(true);
  }, []);

  const handleRemoveFoto = useCallback((id: string) => {
    setFotos((atuais) => {
      const foto = atuais.find((item) => item.id === id);
      if (foto) URL.revokeObjectURL(foto.preview);
      return atuais.filter((item) => item.id !== id);
    });
  }, []);

  const handleMakeCover = useCallback((id: string) => {
    setFotos((atuais) => {
      const foto = atuais.find((item) => item.id === id);
      if (!foto) return atuais;
      return [foto, ...atuais.filter((item) => item.id !== id)];
    });
  }, []);

  const aplicarFichaIa = useCallback((dados: FichaIaPeca) => {
    setFormData((atual) => {
      const categoriaInformada = String(dados.categoria || '').trim();
      const categoriaValida = (
        CATEGORIAS_PECA as readonly string[]
      ).includes(categoriaInformada)
        ? categoriaInformada
        : atual.categoria;
      const condicaoInformada = String(dados.condicao || '').toLowerCase();
      const condicao = ['novo', 'usado', 'recondicionado'].includes(
        condicaoInformada
      )
        ? condicaoInformada
        : atual.condicao;
      const atributosIa =
        dados.atributos && typeof dados.atributos === 'object'
          ? Object.fromEntries(
              Object.entries(dados.atributos)
                .map(([chave, valor]) => [
                  String(chave || '').trim(),
                  String(valor ?? '').trim(),
                ])
                .filter(([chave, valor]) => chave && valor)
            )
          : {};

      return {
        ...atual,
        ml_titulo: montarTituloPadrao({ nome: dados.nome || atual.nome, titulo: dados.titulo || atual.ml_titulo, marca: dados.marca || atual.marca, modelo: dados.modelo || atual.modelo, ano: dados.ano || atual.ano }),
        sku: formatarSkuIa(dados.sku, atual.sku),
        nome: textoPreenchido(dados.nome, atual.nome),
        categoria: categoriaValida,
        categoria_ml:
          categoriaValida !== atual.categoria
            ? categoriaMlDe(categoriaValida)
            : textoPreenchido(dados.categoria_ml, atual.categoria_ml),
        marca: textoPreenchido(dados.marca, atual.marca),
        modelo: textoPreenchido(dados.modelo, atual.modelo),
        ano: textoPreenchido(dados.ano, atual.ano),
        condicao: 'usado',
        numero_oem: textoPreenchido(atual.numero_oem, dados.numero_oem || ''),
        garantia: 'Sem garantia',
        peso_kg: numeroPreenchido(dados.peso_kg, atual.peso_kg),
        comprimento_cm: numeroPreenchido(
          dados.comprimento_cm,
          atual.comprimento_cm
        ),
        largura_cm: numeroPreenchido(dados.largura_cm, atual.largura_cm),
        altura_cm: numeroPreenchido(dados.altura_cm, atual.altura_cm),
        descricao: textoPreenchido(dados.descricao, atual.descricao),
        atributos: { ...atual.atributos, ...atributosIa },
      };
    });
  }, []);

  const aplicarFichaCompletaIa = useCallback((dados: FichaIaPeca) => {
    setFormData((atual) => {
      const categoriaInformada = String(dados.categoria || '').trim();
      const categoriaValida = (
        CATEGORIAS_PECA as readonly string[]
      ).includes(categoriaInformada)
        ? categoriaInformada
        : atual.categoria;
      const categoriaFinal = atual.categoria || categoriaValida;
      const condicaoInformada = String(dados.condicao || '').toLowerCase();
      const condicao = ['novo', 'usado', 'recondicionado'].includes(
        condicaoInformada
      )
        ? condicaoInformada
        : atual.condicao;
      const tipoInformado = String(dados.tipo_anuncio || '').toLowerCase();
      const modoInformado = String(dados.modo_compra || '').toLowerCase();
      const atributosIa =
        dados.atributos && typeof dados.atributos === 'object'
          ? Object.fromEntries(
              Object.entries(dados.atributos)
                .map(([chave, valor]) => [
                  String(chave || '').trim(),
                  String(valor ?? '').trim(),
                ])
                .filter(([chave, valor]) => chave && valor)
            )
          : {};
      const atributosAtuais = Object.fromEntries(
        Object.entries(atual.atributos || {}).filter(([, valor]) =>
          String(valor ?? '').trim()
        )
      );
      const precoAtual = parsePreco(atual.preco);
      const precoSugerido = Number(dados.preco_sugerido);
      const quantidadeAtual = Number(atual.quantidade);
      const quantidadeSugerida = Number(dados.quantidade_sugerida);
      const categoriaMl =
        atual.categoria_ml ||
        textoPreenchido(dados.categoria_ml, '') ||
        categoriaMlDe(categoriaFinal);

      return {
        ...atual,
        ml_titulo: montarTituloPadrao({ nome: dados.nome || atual.nome, titulo: dados.titulo || atual.ml_titulo, marca: dados.marca || atual.marca, modelo: dados.modelo || atual.modelo, ano: dados.ano || atual.ano }),
        sku: formatarSkuIa(dados.sku, atual.sku),
        nome: textoPreenchido(
          dados.nome,
          atual.nome || dados.titulo || atual.ml_titulo
        ).slice(0, 200),
        categoria: categoriaFinal,
        categoria_ml: categoriaMl,
        marca: textoPreenchido(dados.marca, atual.marca),
        modelo: textoPreenchido(dados.modelo, atual.modelo),
        ano: textoPreenchido(dados.ano, atual.ano),
        carro: textoPreenchido(dados.carro, atual.carro),
        condicao: 'usado',
        numero_oem: textoPreenchido(atual.numero_oem, dados.numero_oem || ''),
        garantia: 'Sem garantia',
        peso_kg: numeroPreenchido(dados.peso_kg, atual.peso_kg),
        comprimento_cm: numeroPreenchido(
          dados.comprimento_cm,
          atual.comprimento_cm
        ),
        largura_cm: numeroPreenchido(dados.largura_cm, atual.largura_cm),
        altura_cm: numeroPreenchido(dados.altura_cm, atual.altura_cm),
        descricao: textoPreenchido(dados.descricao, atual.descricao),
        preco:
          precoAtual > 0
            ? atual.preco
            : Number.isFinite(precoSugerido) && precoSugerido > 0
              ? precoSugerido.toFixed(2)
              : atual.preco,
        quantidade:
          quantidadeAtual > 0
            ? atual.quantidade
            : Number.isFinite(quantidadeSugerida) && quantidadeSugerida > 0
              ? String(Math.trunc(quantidadeSugerida))
              : atual.quantidade,
        gtin: textoPreenchido(dados.gtin, atual.gtin),
        localizacao: '',
        tipo_anuncio: 'premium',
        modo_compra:
          atual.modo_compra ||
          (['buy_it_now', 'auction'].includes(modoInformado)
            ? modoInformado
            : 'buy_it_now'),
        atributos: { ...atributosIa, ...atributosAtuais },
      };
    });
  }, []);

  const handleCompletarFichaComIa = useCallback(
    async (origem: 'manual' | 'auto' = 'manual') => {
    if (completandoFicha || loading) return;

    const titulo = formData.ml_titulo.trim() || formData.nome.trim();

    if (!peca && fotos.length === 0 && !titulo) {
      setError(
        'Informe o título ou adicione ao menos uma foto para a IA completar a ficha.'
      );
      return;
    }

    setCompletandoFicha(true);
    setError('');
    setIaAviso('');
    setIaFonte('');
    setEstimadosIa([]);

    try {
      const imagens =
        fotos.length > 0
          ? await prepararImagensParaIa(
              ordemFotosParaEnvio(fotos).map((foto) => ({
                file: foto.file,
                nome: `[${foto.grupo?.toUpperCase() || 'PRODUTO'}] ${foto.file.name}`,
              })),
              20
            )
          : [];

      const { data } = await axios.post<RespostaFichaCompletaIa>(
        '/api/ia/completar-ficha',
        {
          pecaId: peca?.id,
          imagens,
          categorias: CATEGORIAS_PECA,
          camposPorCategoria: CAMPOS_CATEGORIA,
          // A IA precisa saber os ids oficiais da categoria para devolver
          // atributos_ml que o Mercado Livre aceite.
          fichaMl: fichaMl
            ? {
                categoryId: fichaMl.categoria?.id || formData.ml_category_id,
                atributos: (fichaMl.atributos || []).map((campo) => ({
                  id: campo.id,
                  name: campo.name,
                  value_type: campo.value_type,
                  tags: campo.tags,
                  values: (campo.values || []).slice(0, 40).map((valor) => valor.name),
                  allowed_units: (campo.allowed_units || []).map((unidade) => unidade.name),
                })),
                saleTerms: (fichaMl.termos || []).map((termo) => ({
                  id: termo.id,
                  name: termo.name,
                  tags: termo.tags,
                  values: (termo.values || []).slice(0, 40).map((valor) => valor.name),
                })),
              }
            : null,
          contexto: {
            peca: {
              nome: formData.nome,
              ml_titulo: formData.ml_titulo,
              sku: formData.sku,
              carro: formData.carro,
              descricao: formData.descricao,
              categoria: formData.categoria,
              categoria_ml: formData.categoria_ml,
              marca: formData.marca,
              modelo: formData.modelo,
              ano: formData.ano,
              condicao: formData.condicao,
              numero_oem: formData.numero_oem,
              garantia: 'Sem garantia',
              peso_kg: Number(formData.peso_kg) || 0,
              comprimento_cm: Number(formData.comprimento_cm) || 0,
              largura_cm: Number(formData.largura_cm) || 0,
              altura_cm: Number(formData.altura_cm) || 0,
              tipo_anuncio: 'premium',
              gtin: formData.gtin,
              localizacao: '',
              modo_compra: formData.modo_compra,
              quantidade: Number(formData.quantidade) || 0,
              preco: parsePreco(formData.preco) || 0,
              atributos: formData.atributos,
            },
          },
        },
        { timeout: 150000 }
      );

      if (data?.dados) aplicarFichaCompletaIa(data.dados);

      // A leitura preenche os blocos e mostra o resumo logo abaixo das fotos.
      // Os blocos ficam fechados com o resumo preenchido, para o operador
      // conferir só o que precisa.

      const estimados = Array.isArray(data?.estimados)
        ? data.estimados
        : Array.isArray(data?.dados?.estimados)
          ? data.dados.estimados
          : [];

      setEstimadosIa(estimados);
      setImagensAnalisadasIa(data?.imagensAnalisadas);
      setIaFonte(data?.fonte || '');
      setIaAviso(
        data?.aviso ||
          `Ficha completa gerada${
            data?.imagensAnalisadas
              ? ` com ${data.imagensAnalisadas} foto(s)`
              : ''
          }. Confira os campos antes de salvar.`
      );

      if (data?.dados) setRevisaoIa(montarResumoIa(data.dados, estimados));
    } catch (err: unknown) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(
          err.response?.data?.error ||
            'Não foi possível completar a ficha com IA agora.'
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Não foi possível completar a ficha com IA agora.');
      }
    } finally {
      setCompletandoFicha(false);
    }
    },
    [
      aplicarFichaCompletaIa,
      completandoFicha,
      formData,
      fotos,
      loading,
      peca,
    ]
  );


  const handlePublicar = useCallback(async () => {
    if (!pecaSalva || publicando) return;

    setPublicando(true);
    setError('');

    try {
      const { data } = await axios.post<{
        item_id?: string;
        permalink?: string;
        mensagem?: string;
      }>(`/api/mercadolivre/pecas/${pecaSalva.id}/publicar`, {}, { timeout: 90000 });

      setPublicacao({
        permalink: data.permalink || null,
        itemId: data.item_id || null,
      });
      onSuccess();
    } catch (err: unknown) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(
          err.response?.data?.error ||
            'Não foi possível publicar o anúncio no Mercado Livre.'
        );
      } else {
        setError('Não foi possível publicar o anúncio no Mercado Livre.');
      }
    } finally {
      setPublicando(false);
    }
  }, [onSuccess, pecaSalva, publicando]);

  const handleClose = useCallback(() => {
    if (loading) return;

    setFormData(createInitialFormData());
    limparFotos();
    setError('');
    setIaAviso('');
    setIaFonte('');
    setEstimadosIa([]);
    setCompletandoFicha(false);
    setPecaSalva(null);
    setPublicacao(null);
    onClose();
  }, [limparFotos, loading, onClose]);

  // Abre sempre com os dados corretos: ficha limpa ou peça em edição.
  useEffect(() => {
    if (!isOpen) return;

    const dados = peca ? dadosDaPeca(peca) : createInitialFormData();
    setBlocosAbertos(BLOCOS_INICIAIS);
    setRevisaoIa(null);
    setImagensAnalisadasIa(undefined);
    setFormData(dados);
    limparFotos();
    setError('');
    setSkuSugerido('');
    setIaAviso('');
    setIaFonte('');
    setEstimadosIa([]);
    setCompletandoFicha(false);
    setPecaSalva(null);
    setPublicacao(null);
    setPublicando(false);

    const timer = window.setTimeout(() => tituloInputRef.current?.focus(), 120);

    if (!peca) {
      const prefixo = prefixoSku(readUserName());
      axios
        .get<{ sku: string }>(
          `/api/pecas/proximo-sku?prefixo=${encodeURIComponent(prefixo)}`,
          { timeout: 8000 }
        )
        .then(({ data }) => {
          setSkuSugerido(data.sku);
          setFormData((atual) =>
            atual.sku.trim() ? atual : { ...atual, sku: data.sku }
          );
        })
        .catch(() => {
          setSkuSugerido(`SKU ${prefixo}001`);
        });
    }

    return () => window.clearTimeout(timer);
  }, [isOpen, peca, limparFotos]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setError('');

    if (name === 'ml_ativo') {
      setFormData((atual) => ({
        ...atual,
        ml_ativo: (e.target as HTMLInputElement).checked,
      }));
      return;
    }

    if (name === 'nome') {
      setFormData((atual) => ({
        ...atual,
        nome: value,
        ml_titulo: atual.ml_titulo || value,
      }));
      return;
    }

    if (name === 'categoria') {
      setFormData((atual) => ({
        ...atual,
        categoria: value,
        categoria_ml: categoriaMlDe(value),
        ml_category_id: '',
        atributos: {},
      }));
      return;
    }

    if (name === 'categoria_ml' || name === 'ml_titulo') {
      setFormData((atual) => ({ ...atual, [name]: value }));
      return;
    }

    setFormData((atual) => ({ ...atual, [name]: value }));
  };

  const handleAtributoChange = (chave: string, valor: string) => {
    setFormData((atual) => ({
      ...atual,
      atributos: { ...atual.atributos, [chave]: valor },
    }));
  };

  const detectarCategoria = useCallback(async (silencioso = false) => {
    const nome = formData.nome.trim() || formData.ml_titulo.trim();
    if (!nome) {
      if (!silencioso) {
        setError('Informe o título do anúncio antes de detectar a categoria.');
      }
      return;
    }

    setClassificando(true);

    try {
      const { data } = await axios.post<{
        categoria: string;
        categoria_ml: string;
      }>(
        '/api/pecas/classificar',
        {
          nome,
          descricao: formData.descricao,
          carro: formData.carro,
        },
        { timeout: 8000 }
      );

      setFormData((atual) => ({
        ...atual,
        categoria: data.categoria,
        categoria_ml: data.categoria_ml || categoriaMlDe(data.categoria),
        atributos: {},
      }));
      setError('');
    } catch {
      if (!silencioso) {
        setError('Não foi possível detectar a categoria agora.');
      }
    } finally {
      setClassificando(false);
    }
  }, [formData.nome, formData.ml_titulo, formData.descricao, formData.carro]);

  const handleTituloBlur = () => {
    if (!formData.categoria && formData.ml_titulo.trim()) {
      void detectarCategoria(true);
    }
  };

  const consultarPartNumber = useCallback(async () => {
    const partNumber = formData.numero_oem.trim();
    if (partNumber.length < 3) return;
    setConsultandoOem(true);
    setError('');
    try {
      type ResultadoCatalogo = { titulo: string; marca: string; modelo: string; url: string; numero?: string; aplicacoes?: string; fonte?: string };
      type RespostaCatalogo = { resultados?: ResultadoCatalogo[]; fontes?: Array<{ nome: string; url: string; status: string }>; identificacaoIa?: { peca?: string; lado?: string; marca?: string; modelos?: string[]; anos?: string; veiculos?: string[]; confianca?: string; observacao?: string; fonte?: string } | null };
      let data: RespostaCatalogo;
      try {
        ({ data } = await axios.get<RespostaCatalogo>(`/api/catalogo/part-number/${encodeURIComponent(partNumber)}`));
      } catch (backendError) {
        const consulta = partNumber.replace(/[^a-zA-Z0-9]/g, '');
        const resposta7zap = await axios.get<{ results?: Array<{ code?: string; brand?: string; brand_code?: string; name?: string; applicability_count?: number }> }>('https://7zap.com/api/parts-search/search-prefix', { params: { q: consulta, limit: 24 }, headers: { Accept: 'application/json' } });
        const resultados = (resposta7zap.data.results || []).map((item) => ({
          titulo: item.name || item.code || partNumber,
          marca: item.brand || '', modelo: '', numero: item.code || partNumber,
          aplicacoes: item.applicability_count ? `${item.applicability_count} aplicação(ões) no catálogo` : '',
          url: `https://7zap.com/pt/part/${encodeURIComponent(item.brand_code || item.brand || 'catalog')}/${encodeURIComponent(item.code || partNumber)}/`, fonte: '7zap'
        }));
        if (!resultados.length && axios.isAxiosError(backendError)) throw backendError;
        data = { resultados, fontes: [{ nome: '7zap', url: 'https://7zap.com/pt/catalog/cars/', status: resultados.length ? 'encontrado' : 'nenhum resultado' }] };
      }
      setReferenciasOem(data.resultados || []);
      setFontesOem(data.fontes || []);
      setIdentificacaoIa(data.identificacaoIa || null);
      const primeiro = data.resultados?.[0];
      if (primeiro) {
        setFormData((atual) => ({
          ...atual,
          marca: atual.marca || data.identificacaoIa?.marca || primeiro.marca,
          modelo: atual.modelo || primeiro.modelo || data.identificacaoIa?.modelos?.[0] || '',
          ml_titulo: atual.ml_titulo || montarTituloPadrao({ nome: data.identificacaoIa?.peca || primeiro.titulo, titulo: primeiro.titulo, marca: data.identificacaoIa?.marca || primeiro.marca, modelo: data.identificacaoIa?.modelos?.[0] || primeiro.modelo, ano: data.identificacaoIa?.anos, lado: data.identificacaoIa?.lado }),
          descricao: atual.descricao || `Peça identificada automaticamente pelo ${primeiro.fonte || 'catálogo'}: ${primeiro.titulo}.${primeiro.marca ? ` Marca: ${primeiro.marca}.` : ''}${primeiro.aplicacoes ? ` ${primeiro.aplicacoes}.` : ''}`,
        }));
      }
    } catch (err) {
      setError(axios.isAxiosError<{ error?: string }>(err) ? err.response?.data?.error || 'Não foi possível identificar o part number.' : 'Não foi possível identificar o part number.');
    } finally {
      setConsultandoOem(false);
    }
  }, [formData.numero_oem]);

  const aplicarIdentificacaoIa = useCallback(() => {
    if (!identificacaoIa) return;
    const primeiro = referenciasOem[0];
    const veiculos = identificacaoIa.veiculos?.filter(Boolean) || [];
    const modelo = identificacaoIa.modelos?.[0] || primeiro?.modelo || '';
    const marca = identificacaoIa.marca || primeiro?.marca || '';
    const nomePeca = identificacaoIa.peca || primeiro?.titulo || '';
    const nomeVeiculo = veiculos[0] || `${marca} ${modelo}`.trim();
    const descricao = [
      nomePeca ? `Peça identificada: ${nomePeca}.` : '',
      marca ? `Marca: ${marca}.` : '',
      modelo ? `Modelo: ${modelo}.` : '',
      identificacaoIa.anos ? `Anos compatíveis: ${identificacaoIa.anos}.` : '',
      veiculos.length ? `Aplicações: ${veiculos.join(', ')}.` : '',
      identificacaoIa.observacao || ''
    ].filter(Boolean).join(' ');

    setFormData((atual) => ({
      ...atual,
      numero_oem: primeiro?.numero || atual.numero_oem,
      marca: marca || atual.marca,
      modelo: modelo || atual.modelo,
      ano: expandirFaixaAnos(identificacaoIa.anos || atual.ano),
      carro: nomeVeiculo || atual.carro,
      ml_titulo: montarTituloPadrao({ nome: nomePeca, marca, modelo, ano: identificacaoIa.anos, lado: identificacaoIa.lado }),
      nome: nomePeca || `${marca} ${modelo}`.trim() || atual.nome,
      descricao: descricao || atual.descricao
    }));
    setIaAviso('Dados da identificação aplicados à ficha. Revise antes de salvar.');
  }, [identificacaoIa, referenciasOem]);

  const validar = (): string | null => {
    if (!formData.ml_titulo.trim()) {
      return 'Título do anúncio é obrigatório.';
    }
    if (!formData.sku.trim()) return 'SKU é obrigatório.';
    if (!formData.categoria) return 'Selecione ou detecte a categoria da peça.';

    const preco = parsePreco(formData.preco);
    if (!Number.isFinite(preco) || preco < 0) return 'Informe um preço válido.';

    const quantidade = Number.parseInt(formData.quantidade, 10);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      return 'A quantidade deve ser um número inteiro maior ou igual a zero.';
    }

    if (!formData.descricao.trim()) {
      return 'Descreva a peça para completar o anúncio.';
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const mensagem = validar();
    if (mensagem) {
      setError(mensagem);
      // Leva o operador direto ao bloco que impede o cadastro.
      if (!formData.ml_titulo.trim() || !formData.sku.trim() || !formData.categoria) {
        alternarBloco('identificacao', true);
      } else if (!Number.isFinite(parsePreco(formData.preco)) || Number(formData.quantidade) < 0) {
        alternarBloco('preco', true);
      } else if (!formData.descricao.trim()) {
        alternarBloco('descricao', true);
      }
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = new FormData();
      const fotosParaEnviar = ordemFotosParaEnvio(fotos);
      payload.append(
        'nome',
        formData.ml_titulo.trim() || formData.nome.trim() || 'Peça sem título'
      );
      const tituloPadrao = montarTituloPadrao({ nome: formData.nome, titulo: formData.ml_titulo, marca: formData.marca, modelo: formData.modelo, ano: formData.ano });
      payload.append('ml_titulo', tituloPadrao);
      payload.append('sku', formData.sku.trim().toUpperCase());
      payload.append('carro', formData.carro.trim());
      payload.append('descricao', formData.descricao.trim());
      payload.append('categoria', formData.categoria);
      payload.append('categoria_ml', formData.categoria_ml.trim());
      payload.append('ml_category_id', formData.ml_category_id);
      payload.append('ml_config', JSON.stringify(formData.ml_config));
      payload.append('marca', formData.marca.trim());
      payload.append('modelo', formData.modelo.trim());
      payload.append('ano', expandirFaixaAnos(formData.ano));
      payload.append('condicao', formData.condicao);
      payload.append('numero_oem', formData.numero_oem.trim());
      payload.append('garantia', 'Sem garantia');
      payload.append('peso_kg', formData.peso_kg || '0');
      payload.append('comprimento_cm', formData.comprimento_cm || '0');
      payload.append('largura_cm', formData.largura_cm || '0');
      payload.append('altura_cm', formData.altura_cm || '0');
      payload.append('atributos', JSON.stringify(formData.atributos));
      payload.append('tipo_anuncio', 'premium');
      payload.append('gtin', formData.gtin.trim());
      payload.append('localizacao', '');
      payload.append('modo_compra', formData.modo_compra);
      payload.append('quantidade', formData.quantidade);
      payload.append('preco', String(parsePreco(formData.preco)));
      payload.append('ml_ativo', formData.ml_ativo ? '1' : '0');

      if (!editando) {
        fotosParaEnviar.forEach((foto) => payload.append('fotos', foto.file));
        payload.append('foto_grupos', JSON.stringify(fotosParaEnviar.map((foto) => foto.grupo || 'produto')));
      }

      const response = await axios.request<{
        id?: number;
        message: string;
        imagens?: number;
      }>({
        url: editando ? `/api/pecas/${peca?.id}` : '/api/pecas',
        method: editando ? 'put' : 'post',
        data: payload,
        timeout: 90000,
      });

      const totalFotos = response.data.imagens || 0;
      const idSalvo = Number(response.data.id) || peca?.id || null;

      // Na peça nova, o cadastro vira uma etapa da publicação: o operador
      // confirma o anúncio no Mercado Livre com um clique, sem sair da tela.
      if (!editando && idSalvo) {
        setPecaSalva({ id: idSalvo, fotos: totalFotos });
        setFormData(createInitialFormData());
        limparFotos();
        setError('');
        onSuccess();
        return;
      }

      alert(
        `✅ ${response.data.message}${
          totalFotos > 0 ? ` ${totalFotos} foto(s) enviada(s).` : ''
        }`
      );

      setFormData(createInitialFormData());
      limparFotos();
      setError('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || 'Erro ao salvar a peça.');
      } else {
        setError('Erro ao salvar a peça.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const camposTecnicos = camposDaCategoria(formData.categoria);
  const precoAtual = parsePreco(formData.preco);

  const pendencias = calcularPendencias({
    formData,
    fotos: fotos.length,
    ficha: fichaMl,
    editando,
  });
  const pendenciasPorBloco = contarPorBloco(pendencias);

  const resumoIdentificacao = resumoDe(
    [formData.ml_titulo, formData.sku, formData.categoria, formData.categoria_ml],
    'Título, SKU e categorias ainda em branco'
  );

  const resumoAplicacao = resumoDe(
    [formData.marca, formData.modelo, formData.ano, formData.carro],
    'Marca, modelo e ano ainda em branco'
  );

  const resumoFicha = formData.ml_category_id
    ? resumoDe(
        [
          formData.categoria_ml,
          `${Object.keys(formData.atributos || {}).length} atributo(s)`,
        ],
        'Ficha oficial ainda não preenchida'
      )
    : 'Escolha a categoria oficial do Mercado Livre';

  const resumoPreco = resumoDe(
    [
      precoAtual > 0
        ? precoAtual.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
        : '',
      formData.quantidade ? `${formData.quantidade} un.` : '',
      formData.peso_kg ? `${formData.peso_kg} kg` : '',
      formatarMedidas(formData),
    ],
    'Preço, estoque e medidas ainda em branco'
  );

  return createPortal(
    <div className="modal-backdrop overscroll-contain fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-2 backdrop-blur-md sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cadastro-peca-title"
        className="peca-cadastro-compacto modal-panel glass-panel flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl border-white/20 sm:h-[calc(100dvh-2rem)] sm:max-h-[820px]"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-[#0b1628]/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Sparkles className="h-3 w-3" />
              Ficha padrão Mercado Livre
            </span>
            <h2
              id="modal-cadastro-peca-title"
              className="mt-1 text-lg font-bold tracking-[-0.03em] text-ink"
            >
              {editando ? 'Editar peça e anúncio' : 'Cadastrar nova peça'}
            </h2>
            <p className="mt-1 hidden text-xs text-muted sm:block">
              Cada peça tem o seu próprio anúncio. Complete a ficha para
              publicar com mais força no Mercado Livre.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Fechar cadastro"
            className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-muted transition-colors hover:bg-white/[0.09] hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav
          aria-label="Resumo do cadastro"
          hidden={Boolean(pecaSalva)}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2"
        >
          {ORDEM_BLOCOS.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => alternarBloco(id, true)}
              aria-current={
                pendenciasPorBloco[id] > 0 ? 'true' : undefined
              }
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                pendenciasPorBloco[id] > 0
                  ? 'bg-warningSoft text-warning'
                  : 'text-muted hover:bg-white/5'
              }`}
            >
              {rotulo}
              {pendenciasPorBloco[id] > 0 && (
                <span className="rounded-full bg-warning/25 px-1.5 text-[10px] font-bold">
                  {pendenciasPorBloco[id]}
                </span>
              )}
            </button>
          ))}
        </nav>
        <form
          id="peca-cadastro-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          noValidate
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/30 bg-dangerSoft p-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pecaSalva && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    publicacao
                      ? 'border-ml/40 bg-ml/15 text-ml'
                      : 'border-success/30 bg-successSoft text-success'
                  }`}
                >
                  {publicacao ? (
                    <Store className="h-5 w-5" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {publicacao
                      ? 'Anúncio publicado no Mercado Livre'
                      : 'Peça cadastrada no estoque'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {publicacao
                      ? `A peça já está no ar${
                          publicacao.itemId ? ` sob o código ${publicacao.itemId}` : ''
                        }. Você pode acompanhar pelo painel.`
                      : 'A ficha foi salva. Publique o anúncio agora ou continue o cadastro da próxima peça.'}
                  </p>
                  {publicacao?.permalink && (
                    <a
                      href={publicacao.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                    >
                      Abrir anúncio no Mercado Livre
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div hidden={Boolean(pecaSalva)} className="space-y-3">
            <Bloco
              id="fotos"
              aberto={blocosAbertos.fotos}
              onToggle={(aberto) => alternarBloco('fotos', aberto)}
              titulo="1. Fotos do produto"
              descricao="Solta as imagens aqui. A IA lê a etiqueta e a peça automaticamente e já preenche a ficha."
              resumo={`${fotos.length} foto(s) selecionada(s)`}
              pendencias={pendenciasPorBloco.fotos}
              icone={<Camera className="h-4 w-4" />}
            >
              <div className="space-y-4">
                {editando && peca ? (
                  <PecaFotosEditor
                    pecaId={peca.id}
                    mlItemId={peca.ml_item_id}
                    onChange={() => onSuccess()}
                  />
                ) : (
                  <>
                    <ProductPhotoPicker
                      photos={fotos.filter((foto) => foto.grupo === 'sku')}
                      onAddFiles={(arquivos) => handleAddFotos(arquivos, 'sku')}
                      onRemove={handleRemoveFoto}
                      onMakeCover={handleMakeCover}
                      maxPhotos={1}
                      maxFileSizeMB={10}
                      heading="Etiqueta do SKU"
                      description="Uma foto nítida da etiqueta ou código SKU."
                      disabled={loading || completandoFicha}
                    />
                    <ProductPhotoPicker
                      photos={fotos.filter((foto) => foto.grupo === 'produto')}
                      onAddFiles={(arquivos) => handleAddFotos(arquivos, 'produto')}
                      onRemove={handleRemoveFoto}
                      onMakeCover={handleMakeCover}
                      maxPhotos={12}
                      maxFileSizeMB={10}
                      heading="Produto"
                      description="A peça por diferentes ângulos, até 12 imagens."
                      disabled={loading || completandoFicha}
                    />
                    <ProductPhotoPicker
                      photos={fotos.filter((foto) => foto.grupo === 'medidas')}
                      onAddFiles={(arquivos) => handleAddFotos(arquivos, 'medidas')}
                      onRemove={handleRemoveFoto}
                      onMakeCover={handleMakeCover}
                      maxPhotos={4}
                      maxFileSizeMB={10}
                      heading="Medidas e peso"
                      description="Fotos mostrando medidas, dimensões e peso."
                      disabled={loading || completandoFicha}
                    />
                    <ProductPhotoPicker
                      photos={fotos.filter((foto) => foto.grupo === 'codigo')}
                      onAddFiles={(arquivos) => handleAddFotos(arquivos, 'codigo')}
                      onRemove={handleRemoveFoto}
                      onMakeCover={handleMakeCover}
                      maxPhotos={1}
                      maxFileSizeMB={10}
                      heading="Código da peça"
                      description="Etiqueta do part number/OEM, quando existir."
                      disabled={loading || completandoFicha}
                    />
                  </>
                )}

                <div className="rounded-xl border border-accent/25 bg-accentSoft/40 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accentSoft text-accent">
                        <Wand2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          Identificar com IA
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          A IA lê as fotos e a etiqueta e preenche título,
                          categoria, aplicação, atributos do Mercado Livre, peso,
                          medidas e descrição. O que ela não comprovar fica
                          marcado como estimado.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCompletarFichaComIa('manual')}
                      disabled={
                        completandoFicha ||
                        loading ||
                        (!editando &&
                          fotos.length === 0 &&
                          !formData.ml_titulo.trim() &&
                          !formData.nome.trim())
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {completandoFicha ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      {completandoFicha ? 'Lendo as fotos...' : 'Identificar com IA'}
                    </button>
                  </div>
                  {!editando && fotos.length === 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                      Adicione as fotos para liberar a leitura com IA.
                    </p>
                  )}
                </div>
              </div>
            </Bloco>

            {revisaoIa && (
              <FichaRevisaoIa
                resumo={revisaoIa}
                estimados={estimadosIa}
                fonte={iaFonte}
                aviso={iaAviso}
                imagensAnalisadas={imagensAnalisadasIa}
                ocupado={completandoFicha}
                onRepetir={() => void handleCompletarFichaComIa('auto')}
                onRevisar={() => {
                  alternarBloco('identificacao', true);
                  window.setTimeout(
                    () => document.getElementById('peca-titulo-ml')?.focus(),
                    220
                  );
                }}
              />
            )}

            {!revisaoIa && iaAviso && (
              <p className="rounded-xl border border-success/25 bg-successSoft px-3 py-2.5 text-xs leading-relaxed text-success">
                {iaAviso}
              </p>
            )}

            <Bloco
              id="identificacao"
              aberto={blocosAbertos.identificacao}
              onToggle={(aberto) => alternarBloco('identificacao', aberto)}
              titulo="2. Identificação do anúncio"
              descricao="Título, SKU e as duas categorias: a interna e a oficial do Mercado Livre."
              resumo={resumoIdentificacao}
              pendencias={pendenciasPorBloco.identificacao}
              icone={<Tag className="h-4 w-4" />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label htmlFor="peca-titulo-ml" className="text-sm font-medium">
                      Título do anúncio no Mercado Livre *
                    </label>
                    <span
                      className={`text-xs ${
                        formData.ml_titulo.length > 60 ? 'text-danger' : 'text-muted'
                      }`}
                    >
                      {formData.ml_titulo.length}/60
                    </span>
                  </div>
                  <input
                    ref={tituloInputRef}
                    id="peca-titulo-ml"
                    type="text"
                    name="ml_titulo"
                    value={formData.ml_titulo}
                    onChange={handleChange}
                    onBlur={handleTituloBlur}
                    maxLength={60}
                    className="w-full rounded-xl border p-3 text-base"
                    placeholder="Ex: Retrovisor Elétrico Direito Onix 2020 a 2024 Original"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    É o que aparece na busca do Mercado Livre. Use peça,
                    lado/posição, veículo e ano em até 60 caracteres.
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="peca-categoria" className="text-sm font-medium">
                      Categoria da peça *
                    </label>
                    <button
                      type="button"
                      onClick={() => void detectarCategoria(false)}
                      disabled={classificando}
                      className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
                    >
                      {classificando ? 'Detectando...' : 'Detectar'}
                    </button>
                  </div>
                  <select
                    id="peca-categoria"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3"
                    required
                  >
                    <option value="">Selecione ou detecte automaticamente</option>
                    {CATEGORIAS_PECA.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Agrupa o ranking e libera a ficha técnica local.
                  </p>
                </div>

                <div>
                  <label htmlFor="peca-sku" className="mb-1.5 block text-sm font-medium">
                    SKU *
                  </label>
                  <input
                    id="peca-sku"
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3 font-mono uppercase"
                    placeholder="SKU G001"
                    required
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    {skuSugerido
                      ? `Sugestão automática: ${skuSugerido} (inicial do seu nome).`
                      : 'Pré-preenchido com a inicial do nome em Configurações.'}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="peca-categoria-ml" className="mb-1.5 block text-sm font-medium">
                    Categoria no Mercado Livre
                  </label>
                  <input
                    id="peca-categoria-ml"
                    type="text"
                    name="categoria_ml"
                    value={formData.categoria_ml}
                    readOnly
                    className="w-full rounded-xl border p-3 text-sm"
                    placeholder="Escolhida no bloco Ficha Mercado Livre"
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    É a categoria oficial (MLB) — ela define quais atributos o
                    Mercado Livre exige. Escolha no bloco 4.
                  </p>
                </div>

                <div>
                  <label htmlFor="peca-oem" className="mb-1.5 block text-sm font-medium">
                    Número OEM / part number
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="peca-oem"
                      type="text"
                      name="numero_oem"
                      value={formData.numero_oem}
                      onChange={handleChange}
                      onBlur={() => void consultarPartNumber()}
                      className="min-w-0 flex-1 rounded-xl border p-3 font-mono"
                      placeholder="Digite o número da peça para consultar os catálogos"
                    />
                    <button
                      type="button"
                      onClick={() => void consultarPartNumber()}
                      disabled={consultandoOem || formData.numero_oem.trim().length < 3}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-accent/30 px-3 text-xs font-semibold text-accent disabled:opacity-50"
                    >
                      {consultandoOem ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Consultar
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Consulta automática no plan.parts, 7zap e Mercado Livre.
                    Quando a chave do plan.parts estiver ativa, ele será
                    priorizado para identificar o código OEM, marca e aplicação.
                  </p>
                  {(referenciasOem.length > 0 || fontesOem.length > 0) && (
                    <div className="mt-2 rounded-xl border border-accent/20 bg-accentSoft p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-accent">Identificação automática</p>
                        <div className="flex flex-wrap justify-end gap-1">
                          {fontesOem.map((fonte) => (
                            <span
                              key={fonte.nome}
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                fonte.status === 'encontrado'
                                  ? 'border-success/40 text-success'
                                  : 'border-white/10 text-muted'
                              }`}
                            >
                              {fonte.nome} · {fonte.status}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!!referenciasOem.length && (
                        <div className="mt-2 space-y-2">
                          {referenciasOem.slice(0, 8).map((referencia, indice) => (
                            <div
                              key={`${referencia.numero || referencia.url}-${indice}`}
                              className="rounded-lg border border-white/10 bg-black/10 p-2"
                            >
                              <p className="font-semibold text-ink">{referencia.titulo}</p>
                              <p className="mt-0.5 text-muted">
                                {referencia.numero || 'Código não informado'}
                                {referencia.marca ? ` · ${referencia.marca}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="peca-gtin" className="mb-1.5 block text-sm font-medium">
                    GTIN / EAN
                  </label>
                  <input
                    id="peca-gtin"
                    type="text"
                    name="gtin"
                    value={formData.gtin}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3 font-mono"
                    placeholder="Código de barras do fabricante"
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Preencha quando a peça tiver código de barras. Sem GTIN, o ML
                    usa a categoria e a ficha técnica.
                  </p>
                </div>
              </div>
            </Bloco>

            <Bloco
              id="aplicacao"
              aberto={blocosAbertos.aplicacao}
              onToggle={(aberto) => alternarBloco('aplicacao', aberto)}
              titulo="3. Aplicação e condição"
              descricao="Veículo, marca, modelo, ano, condição e garantia que o comprador vê no anúncio."
              resumo={resumoAplicacao}
              pendencias={pendenciasPorBloco.aplicacao}
              icone={<Car className="h-4 w-4" />}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="peca-carro" className="mb-1.5 block text-sm font-medium">
                    Veículo / aplicação
                  </label>
                  <input
                    id="peca-carro"
                    type="text"
                    name="carro"
                    value={formData.carro}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3"
                    placeholder="Ex: Onix 2021"
                  />
                </div>
                <div>
                  <label htmlFor="peca-marca" className="mb-1.5 block text-sm font-medium">
                    Marca
                  </label>
                  <input
                    id="peca-marca"
                    type="text"
                    name="marca"
                    value={formData.marca}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3"
                    placeholder="Ex: Chevrolet"
                  />
                </div>
                <div>
                  <label htmlFor="peca-modelo" className="mb-1.5 block text-sm font-medium">
                    Modelo
                  </label>
                  <input
                    id="peca-modelo"
                    type="text"
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3"
                    placeholder="Ex: Onix"
                  />
                </div>
                {[
                  { name: 'ano', label: 'Ano', placeholder: 'Ex: 2020 a 2024' },
                  { name: 'garantia', label: 'Garantia', placeholder: 'Ex: 90 dias' },
                ].map((campo) => (
                  <div key={campo.name}>
                    <label
                      htmlFor={`peca-${campo.name}`}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {campo.label}
                    </label>
                    <input
                      id={`peca-${campo.name}`}
                      type="text"
                      name={campo.name}
                      value={campo.name === 'ano' ? formData.ano : formData.garantia}
                      onChange={handleChange}
                      readOnly={campo.name === 'garantia'}
                      className="w-full rounded-xl border p-3"
                      placeholder={campo.placeholder}
                    />
                  </div>
                ))}
              </div>
            </Bloco>

            <Bloco
              id="fichaMl"
              aberto={blocosAbertos.fichaMl}
              onToggle={(aberto) => alternarBloco('fichaMl', aberto)}
              titulo="4. Ficha oficial do Mercado Livre"
              descricao={
                formData.categoria
                  ? `Categoria oficial, atributos obrigatórios e termos de venda da ${formData.categoria}.`
                  : 'Categoria oficial, atributos obrigatórios e termos de venda do Mercado Livre.'
              }
              resumo={resumoFicha}
              pendencias={pendenciasPorBloco.fichaMl}
              icone={<FileText className="h-4 w-4" />}
            >
              <FichaMercadoLivre
                categoryId={formData.ml_category_id}
                titulo={formData.ml_titulo}
                atributos={formData.atributos}
                config={formData.ml_config}
                onCategoria={(id, nome) =>
                  setFormData((atual) => ({
                    ...atual,
                    ml_category_id: id,
                    categoria_ml: nome,
                    atributos: {},
                    ml_config: { ...atual.ml_config, sale_terms: {} },
                  }))
                }
                onAtributos={(atributos) =>
                  setFormData((atual) => ({ ...atual, atributos }))
                }
                onConfig={(ml_config) => setFormData((atual) => ({ ...atual, ml_config }))}
                onFicha={setFichaMl}
              />
              <CompatibilidadeMl
                categoryId={formData.ml_category_id}
                config={formData.ml_config}
                onConfig={(ml_config) => setFormData((atual) => ({ ...atual, ml_config }))}
              />
              {!formData.ml_category_id && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted">
                    Ficha local por tipo de peça
                  </summary>
                  {!formData.categoria ? (
                    <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5 text-sm text-muted">
                      Selecione a categoria no bloco 2 para ver os campos técnicos.
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {camposTecnicos.map((campo) => (
                        <div key={campo.key}>
                          <label
                            htmlFor={`atributo-${campo.key}`}
                            className="mb-1.5 block text-sm font-medium"
                          >
                            {campo.label}
                          </label>
                          {campo.tipo === 'select' ? (
                            <select
                              id={`atributo-${campo.key}`}
                              value={formData.atributos[campo.key] || ''}
                              onChange={(event) =>
                                handleAtributoChange(campo.key, event.target.value)
                              }
                              className="w-full rounded-xl border p-3"
                            >
                              <option value="">Selecione</option>
                              {(campo.opcoes || []).map((opcao) => (
                                <option key={opcao} value={opcao}>
                                  {opcao}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`atributo-${campo.key}`}
                              type="text"
                              value={formData.atributos[campo.key] || ''}
                              onChange={(event) =>
                                handleAtributoChange(campo.key, event.target.value)
                              }
                              className="w-full rounded-xl border p-3"
                              placeholder={campo.placeholder}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              )}
            </Bloco>

            <Bloco
              id="preco"
              aberto={blocosAbertos.preco}
              onToggle={(aberto) => alternarBloco('preco', aberto)}
              titulo="5. Preço, estoque e logística"
              descricao="Preço, quantidade, peso e medidas evitam frete errado e atraso no envio."
              resumo={resumoPreco}
              pendencias={pendenciasPorBloco.preco}
              icone={<Ruler className="h-4 w-4" />}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="peca-preco" className="mb-1.5 block text-sm font-medium">
                    Preço (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-sm text-muted">R$</span>
                    <input
                      id="peca-preco"
                      type="text"
                      name="preco"
                      value={formData.preco}
                      onChange={handleChange}
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-xl border p-3 pl-10"
                      placeholder="0,00"
                      required
                    />
                  </div>
                  {Number.isFinite(precoAtual) && precoAtual > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Valor formatado:{' '}
                      {precoAtual.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="peca-quantidade" className="mb-1.5 block text-sm font-medium">
                    Quantidade *
                  </label>
                  <input
                    id="peca-quantidade"
                    type="number"
                    name="quantidade"
                    value={formData.quantidade}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className="w-full rounded-xl border p-3"
                    required
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Cada peça é um anúncio individual no Mercado Livre.
                  </p>
                </div>

                <div>
                  <label htmlFor="peca-peso" className="mb-1.5 block text-sm font-medium">
                    Peso (kg)
                  </label>
                  <input
                    id="peca-peso"
                    type="number"
                    name="peso_kg"
                    value={formData.peso_kg}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border p-3"
                    placeholder="Ex: 2.4"
                  />
                </div>

                {[
                  { name: 'comprimento_cm', label: 'Comprimento (cm)', placeholder: 'Ex: 45' },
                  { name: 'largura_cm', label: 'Largura (cm)', placeholder: 'Ex: 30' },
                  { name: 'altura_cm', label: 'Altura (cm)', placeholder: 'Ex: 20' },
                ].map((campo) => (
                  <div key={campo.name}>
                    <label
                      htmlFor={`peca-${campo.name}`}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {campo.label}
                    </label>
                    <input
                      id={`peca-${campo.name}`}
                      type="number"
                      name={campo.name}
                      value={
                        campo.name === 'comprimento_cm'
                          ? formData.comprimento_cm
                          : campo.name === 'largura_cm'
                            ? formData.largura_cm
                            : formData.altura_cm
                      }
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      className="w-full rounded-xl border p-3"
                      placeholder={campo.placeholder}
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="peca-modo-compra" className="mb-1.5 block text-sm font-medium">
                    Modo de compra
                  </label>
                  <select
                    id="peca-modo-compra"
                    name="modo_compra"
                    value={formData.modo_compra}
                    onChange={handleChange}
                    className="w-full rounded-xl border p-3"
                  >
                    <option value="buy_it_now">Comprar agora</option>
                    <option value="auction">Somente anúncio</option>
                  </select>
                </div>
              </div>

              <label
                htmlFor="peca-ml-ativo"
                className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <input
                  type="checkbox"
                  name="ml_ativo"
                  checked={formData.ml_ativo}
                  onChange={handleChange}
                  id="peca-ml-ativo"
                  className="h-5 w-5"
                />
                <span>
                  <span className="block text-sm font-medium">Publicar no Mercado Livre</span>
                  <span className="block text-xs text-muted">
                    Anúncios novos são publicados no Mercado Livre após aprovação.
                  </span>
                </span>
              </label>
            </Bloco>

            <Bloco
              id="descricao"
              aberto={blocosAbertos.descricao}
              onToggle={(aberto) => alternarBloco('descricao', aberto)}
              titulo="6. Descrição do anúncio"
              descricao="Aplicação, condição, o que acompanha e garantia. Textos completos convertem mais."
              resumo={`${formData.descricao.length} caracteres`}
              pendencias={pendenciasPorBloco.descricao}
              icone={<Package className="h-4 w-4" />}
            >
              <textarea
                id="peca-descricao"
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                rows={8}
                maxLength={5000}
                className="w-full resize-y rounded-xl border p-3"
                placeholder="Ex: Retrovisor elétrico direito original, com carcaça preta e lente em bom estado. Acompanha motor e conectores. Garantia de 90 dias."
                required
              />
              <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>Use no mínimo 40 caracteres.</span>
                <span>{formData.descricao.length}/5000</span>
              </div>
            </Bloco>
          </div>

        </form>

        <div className="modal-rodape flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#07111f]/55 px-4 py-2.5 backdrop-blur-xl">
          <p className="hidden text-xs text-muted sm:block">
            <Check className="mr-1 inline h-3.5 w-3.5 text-success" />
            {pecaSalva && !publicacao
              ? 'Peça salva no estoque. Falta publicar o anúncio.'
              : 'Salvo no estoque local, pronto para revisão e publicação'}
          </p>
          <div className="flex w-full gap-3 sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || publicando}
              className="flex-1 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-50 sm:flex-none"
            >
              {pecaSalva && !publicacao ? 'Fechar sem publicar' : 'Cancelar'}
            </button>
            {pecaSalva && !publicacao ? (
              <button
                type="button"
                onClick={() => void handlePublicar()}
                disabled={publicando}
                aria-busy={publicando}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ml px-6 py-3 text-sm font-bold text-[#0b1233] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {publicando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Store className="h-4 w-4" />
                )}
                {publicando ? 'Publicando...' : 'Publicar no Mercado Livre'}
              </button>
            ) : (
              <button
                type="submit"
                form="peca-cadastro-form"
                disabled={loading || publicacao !== null}
                aria-busy={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editando ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {loading
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Cadastrar peça'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
