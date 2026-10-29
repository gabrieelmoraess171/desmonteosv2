import {
  useCallback,
  createContext,
  useContext,
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
  FileText,
  Loader2,
  Package,
  Ruler,
  Sparkles,
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
  CATEGORIAS_PECA,
  camposDaCategoria,
  categoriaMlDe,
  lerAtributos,
  prefixoSku,
} from '../config/categorias';
import { STORAGE_KEYS } from '../config/app';
import { prepararImagensParaIa } from '../utils/imagemIa';

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
  titulo?: string;
  nome?: string;
  categoria?: string;
  categoria_ml?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  condicao?: string;
  numero_oem?: string;
  garantia?: string;
  peso_kg?: number;
  comprimento_cm?: number;
  largura_cm?: number;
  altura_cm?: number;
  descricao?: string;
  atributos?: Record<string, string>;
  confianca?: string;
  observacoes?: string;
}

interface RespostaIaPeca {
  dados: FichaIaPeca;
  fonte: string;
  modelo?: string;
  aviso?: string;
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
  video_url: string;
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
  ml_config: {},
  marca: '',
  modelo: '',
  ano: '',
  condicao: 'usado',
  numero_oem: '',
  garantia: '',
  peso_kg: '',
  comprimento_cm: '',
  largura_cm: '',
  altura_cm: '',
  tipo_anuncio: 'clássico',
  gtin: '',
  localizacao: '',
  video_url: '',
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
    ml_config: (() => { try { return typeof peca.ml_config === 'string' ? JSON.parse(peca.ml_config) : peca.ml_config || {}; } catch { return {}; } })(),
    marca: peca.marca || '',
    modelo: peca.modelo || '',
    ano: peca.ano || '',
    condicao: peca.condicao || 'usado',
    numero_oem: peca.numero_oem || '',
    garantia: peca.garantia || '',
    peso_kg: textoNumero(peca.peso_kg),
    comprimento_cm: textoNumero(peca.comprimento_cm),
    largura_cm: textoNumero(peca.largura_cm),
    altura_cm: textoNumero(peca.altura_cm),
    tipo_anuncio: peca.tipo_anuncio || 'clássico',
    gtin: peca.gtin || '',
    localizacao: peca.localizacao || '',
    video_url: peca.video_url || '',
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

const EtapaContext = createContext('01');
const ETAPAS = ['Identificação e fotos', 'Aplicação da peça', 'Ficha Mercado Livre', 'Preço e estoque', 'Descrição'];

function Secao({
  numero,
  titulo,
  descricao,
  icone,
  children,
}: {
  numero: string;
  titulo: string;
  descricao: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-etapa={numero} hidden={useContext(EtapaContext) !== numero} className="rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accentSoft text-accent">
          {icone}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            Etapa {numero}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-ink">{titulo}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ModalCadastroPeca({
  isOpen,
  onClose,
  onSuccess,
  peca = null,
}: ModalCadastroPecaProps) {
  const editando = Boolean(peca);
  const [etapa, setEtapa] = useState('01');
  const [formData, setFormData] = useState<PecaFormData>(createInitialFormData);
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const [loading, setLoading] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [lendoFotos, setLendoFotos] = useState(false);
  const [iaAviso, setIaAviso] = useState('');
  const [iaFonte, setIaFonte] = useState('');
  const [error, setError] = useState('');
  const [skuSugerido, setSkuSugerido] = useState('');
  const tituloInputRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<FotoSelecionada[]>([]);

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

  const handleAddFotos = useCallback((files: File[]) => {
    const novas = files.slice(0, 20).map((file) => ({
      id: criarIdFoto(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setFotos((atuais) => [...atuais, ...novas].slice(0, 20));
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
        ml_titulo: textoPreenchido(dados.titulo, atual.ml_titulo).slice(0, 60),
        nome: textoPreenchido(dados.nome, atual.nome),
        categoria: categoriaValida,
        categoria_ml:
          categoriaValida !== atual.categoria
            ? categoriaMlDe(categoriaValida)
            : textoPreenchido(dados.categoria_ml, atual.categoria_ml),
        marca: textoPreenchido(dados.marca, atual.marca),
        modelo: textoPreenchido(dados.modelo, atual.modelo),
        ano: textoPreenchido(dados.ano, atual.ano),
        condicao,
        numero_oem: textoPreenchido(dados.numero_oem, atual.numero_oem),
        garantia: textoPreenchido(dados.garantia, atual.garantia),
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

  const handleLerFotosComIa = useCallback(async () => {
    if (lendoFotos || loading) return;

    if (fotos.length === 0) {
      setError(
        'Adicione as fotos da peça antes de usar a leitura com IA. A primeira foto deve ser a etiqueta com o SKU.'
      );
      return;
    }

    setLendoFotos(true);
    setError('');
    setIaAviso('');
    setIaFonte('');

    try {
      const imagens = await prepararImagensParaIa(
        fotos.map((foto) => ({ file: foto.file, nome: foto.file.name })),
        8
      );

      if (imagens.length === 0) {
        throw new Error(
          'As fotos selecionadas não puderam ser lidas. Use JPG, PNG ou WEBP.'
        );
      }

      const { data } = await axios.post<RespostaIaPeca>(
        '/api/ia/analisar-fotos',
        {
          imagens,
          contexto: {
            categorias: CATEGORIAS_PECA,
            peca: {
              nome: formData.nome || formData.ml_titulo,
              ml_titulo: formData.ml_titulo,
              carro: formData.carro,
              marca: formData.marca,
              modelo: formData.modelo,
              ano: formData.ano,
              categoria: formData.categoria,
              descricao: formData.descricao,
            },
          },
        },
        { timeout: 120000 }
      );

      if (data?.dados) aplicarFichaIa(data.dados);
      setIaFonte(data?.fonte || '');
      setIaAviso(
        data?.aviso ||
          'Ficha preenchida com a leitura das fotos. Confira cada campo antes de salvar.'
      );
    } catch (err: unknown) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(
          err.response?.data?.error ||
            'Não foi possível ler as fotos com IA agora.'
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Não foi possível ler as fotos com IA agora.');
      }
    } finally {
      setLendoFotos(false);
    }
  }, [aplicarFichaIa, formData, fotos, lendoFotos, loading]);

  const handleClose = useCallback(() => {
    if (loading) return;

    setFormData(createInitialFormData());
    limparFotos();
    setError('');
    setIaAviso('');
    setIaFonte('');
    setLendoFotos(false);
    onClose();
  }, [limparFotos, loading, onClose]);

  // Abre sempre com os dados corretos: ficha limpa ou peça em edição.
  useEffect(() => {
    if (!isOpen) return;

    const dados = peca ? dadosDaPeca(peca) : createInitialFormData();
    setEtapa('01');
    setFormData(dados);
    limparFotos();
    setError('');
    setSkuSugerido('');
    setIaAviso('');
    setIaFonte('');
    setLendoFotos(false);

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
      if (!formData.ml_titulo.trim() || !formData.sku.trim() || !formData.categoria) setEtapa('01');
      else if (!Number.isFinite(parsePreco(formData.preco)) || Number(formData.quantidade) < 0) setEtapa('04');
      else if (!formData.descricao.trim()) setEtapa('05');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append(
        'nome',
        formData.ml_titulo.trim() || formData.nome.trim() || 'Peça sem título'
      );
      payload.append('ml_titulo', formData.ml_titulo.trim());
      payload.append('sku', formData.sku.trim().toUpperCase());
      payload.append('carro', formData.carro.trim());
      payload.append('descricao', formData.descricao.trim());
      payload.append('categoria', formData.categoria);
      payload.append('categoria_ml', formData.categoria_ml.trim());
      payload.append('ml_category_id', formData.ml_category_id);
      payload.append('ml_config', JSON.stringify(formData.ml_config));
      payload.append('marca', formData.marca.trim());
      payload.append('modelo', formData.modelo.trim());
      payload.append('ano', formData.ano.trim());
      payload.append('condicao', formData.condicao);
      payload.append('numero_oem', formData.numero_oem.trim());
      payload.append('garantia', formData.garantia.trim());
      payload.append('peso_kg', formData.peso_kg || '0');
      payload.append('comprimento_cm', formData.comprimento_cm || '0');
      payload.append('largura_cm', formData.largura_cm || '0');
      payload.append('altura_cm', formData.altura_cm || '0');
      payload.append('atributos', JSON.stringify(formData.atributos));
      payload.append('tipo_anuncio', formData.tipo_anuncio);
      payload.append('gtin', formData.gtin.trim());
      payload.append('localizacao', formData.localizacao.trim());
      payload.append('video_url', formData.video_url.trim());
      payload.append('modo_compra', formData.modo_compra);
      payload.append('quantidade', formData.quantidade);
      payload.append('preco', String(parsePreco(formData.preco)));
      payload.append('ml_ativo', formData.ml_ativo ? '1' : '0');

      if (!editando) {
        fotos.forEach((foto) => payload.append('fotos', foto.file));
      }

      const response = await axios.request<{
        message: string;
        imagens?: number;
      }>({
        url: editando ? `/api/pecas/${peca?.id}` : '/api/pecas',
        method: editando ? 'put' : 'post',
        data: payload,
        timeout: 90000,
      });

      const totalFotos = response.data.imagens || 0;
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
            <p className="mt-1 text-xs text-muted">
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

        <nav aria-label="Etapas do cadastro" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {ETAPAS.map((nome, indice) => {
            const chave = String(indice + 1).padStart(2, '0');
            return <button key={chave} type="button" onClick={() => setEtapa(chave)} aria-current={etapa === chave ? 'step' : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${etapa === chave ? 'bg-accentSoft text-accent' : 'text-muted hover:bg-white/5'}`}>{indice + 1}. {nome}</button>;
          })}
        </nav>
        <EtapaContext.Provider value={etapa}>
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

          <Secao
            numero="01"
            titulo="Título, fotos e identificação"
            descricao="Comece pelo título do anúncio e envie as fotos. A IA lê a etiqueta, a peça e as medidas para preencher a ficha automaticamente."
            icone={<Camera className="h-4 w-4" />}
          >
            <div className="cadastro-titulo grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="peca-titulo-ml" className="text-sm font-medium">
                    Título do anúncio no Mercado Livre *
                  </label>
                  <span
                    className={`text-xs ${
                      formData.ml_titulo.length > 60
                        ? 'text-danger'
                        : 'text-muted'
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
                  Comece pelo título: é ele que aparece na busca do Mercado
                  Livre. Use peça, lado/posição, veículo e ano em até 60
                  caracteres.
                </p>
              </div>

            </div>

            <div className="cadastro-ia mt-5 rounded-2xl border border-accent/25 bg-accentSoft/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accentSoft text-accent">
                    <Wand2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Fotos do anúncio e leitura com IA
                    </p>
                    <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">
                      Envie etiqueta com SKU, produto, medidas e peso. A IA sugere os dados; confira antes de salvar.
                    </p>
                  </div>
                </div>

                {!editando && (
                  <button
                    type="button"
                    onClick={() => void handleLerFotosComIa()}
                    disabled={lendoFotos || loading || fotos.length === 0}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {lendoFotos ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {lendoFotos ? 'Lendo fotos...' : 'Ler fotos com IA'}
                  </button>
                )}
              </div>

              {!editando && fotos.length === 0 && (
                <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted">
                  Adicione as fotos abaixo para liberar a leitura com IA.
                </p>
              )}

              {iaAviso && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/25 bg-successSoft px-3 py-2.5 text-xs leading-relaxed text-success">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>{iaAviso}</p>
                    {iaFonte && (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-success/80">
                        Fonte: {iaFonte}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="cadastro-fotos">
            {editando && peca ? (
              <PecaFotosEditor
                pecaId={peca.id}
                onChange={() => onSuccess()}
              />
            ) : (
              <ProductPhotoPicker
                photos={fotos}
                onAddFiles={handleAddFotos}
                onRemove={handleRemoveFoto}
                onMakeCover={handleMakeCover}
                maxPhotos={20}
                maxFileSizeMB={10}
                disabled={loading || lendoFotos}
              />
            )}

            </div>
            <div className="cadastro-video mt-4">
              <label htmlFor="peca-video" className="mb-1.5 block text-sm font-medium">
                Vídeo do anúncio (opcional)
              </label>
              <input
                id="peca-video"
                type="url"
                name="video_url"
                value={formData.video_url}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="mt-1.5 text-[11px] text-muted">
                O Mercado Livre aceita vídeo do YouTube no anúncio.
              </p>
            </div>

            <div className="cadastro-dados mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="peca-categoria" className="text-sm font-medium">
                    Categoria da peça *
                  </label>
                  <button
                    type="button"
                    onClick={() => void detectarCategoria(false)}
                    disabled={classificando}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-cyan disabled:opacity-50"
                  >
                    {classificando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Detectar
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
                  A categoria agrupa o ranking e libera a ficha técnica certa.
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

              <div>
                <label htmlFor="peca-categoria-ml" className="mb-1.5 block text-sm font-medium">
                  Categoria no Mercado Livre
                </label>
                <input
                  id="peca-categoria-ml"
                  type="text"
                  name="categoria_ml"
                  value={formData.categoria_ml}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3 text-xs"
                  placeholder="Preenchida ao escolher a categoria"
                />
                <button type="button" onClick={() => setEtapa('03')} className="mt-1 text-[11px] text-accent hover:underline">Selecionar categoria oficial e características →</button>
              </div>

              <div>
                <label htmlFor="peca-tipo" className="mb-1.5 block text-sm font-medium">
                  Tipo de anúncio
                </label>
                <select
                  id="peca-tipo"
                  name="tipo_anuncio"
                  value={formData.tipo_anuncio}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3"
                >
                  <option value="clássico">Clássico</option>
                  <option value="premium">Premium</option>
                  <option value="grátis">Grátis</option>
                </select>
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
          </Secao>

          <Secao
            numero="02"
            titulo="Compatibilidade"
            descricao="Aplique a peça ao veículo certo e evite perguntas e devoluções."
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
                  placeholder="Ex: Onix LT"
                />
              </div>
              <div>
                <label htmlFor="peca-ano" className="mb-1.5 block text-sm font-medium">
                  Ano / faixa de anos
                </label>
                <input
                  id="peca-ano"
                  type="text"
                  name="ano"
                  value={formData.ano}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3"
                  placeholder="Ex: 2020 a 2024"
                />
              </div>
              <div>
                <label htmlFor="peca-condicao" className="mb-1.5 block text-sm font-medium">
                  Condição
                </label>
                <select
                  id="peca-condicao"
                  name="condicao"
                  value={formData.condicao}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3"
                >
                  <option value="usado">Usado</option>
                  <option value="novo">Novo</option>
                  <option value="recondicionado">Recondicionado</option>
                </select>
              </div>
              <div>
                <label htmlFor="peca-garantia" className="mb-1.5 block text-sm font-medium">
                  Garantia
                </label>
                <input
                  id="peca-garantia"
                  type="text"
                  name="garantia"
                  value={formData.garantia}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3"
                  placeholder="Ex: 90 dias"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="peca-oem" className="mb-1.5 block text-sm font-medium">
                  Código OEM / referência
                </label>
                <input
                  id="peca-oem"
                  type="text"
                  name="numero_oem"
                  value={formData.numero_oem}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3 font-mono"
                  placeholder="Ex: 52123456 ou 93328030"
                />
              </div>
            </div>
          </Secao>

          <Secao
            numero="03"
            titulo="Ficha técnica da categoria"
            descricao={
              formData.categoria
                ? `Atributos específicos de ${formData.categoria} usados pelos filtros do Mercado Livre.`
                : 'Escolha a categoria para liberar os atributos específicos do anúncio.'
            }
            icone={<FileText className="h-4 w-4" />}
          >
            <FichaMercadoLivre categoryId={formData.ml_category_id} titulo={formData.ml_titulo}
              atributos={formData.atributos} config={formData.ml_config}
              onCategoria={(id, nome) => setFormData((atual) => ({ ...atual, ml_category_id: id, categoria_ml: nome, atributos: {}, ml_config: { ...atual.ml_config, sale_terms: {} } }))}
              onAtributos={(atributos) => setFormData((atual) => ({ ...atual, atributos }))}
              onConfig={(ml_config) => setFormData((atual) => ({ ...atual, ml_config }))} />
            <CompatibilidadeMl categoryId={formData.ml_category_id} config={formData.ml_config} onConfig={(ml_config) => setFormData((atual) => ({ ...atual, ml_config }))} />
            {!formData.ml_category_id && <details className="mt-4 text-xs"><summary className="cursor-pointer text-muted">Ficha local por tipo de peça</summary>
            {!formData.categoria ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5 text-sm text-muted">
                Selecione a categoria na etapa 01 para ver os campos técnicos.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            </details>}
          </Secao>

          <Secao
            numero="04"
            titulo="Preço, estoque e logística"
            descricao="Preço, quantidade, peso e medidas corretos evitam cobrança errada de frete e atrasos no envio."
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
                    Valor formatado: {precoAtual.toLocaleString('pt-BR', {
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
                    value={String(formData[campo.name as keyof PecaFormData] || '')}
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

              <div>
                <label htmlFor="peca-localizacao" className="mb-1.5 block text-sm font-medium">
                  Localização do estoque
                </label>
                <input
                  id="peca-localizacao"
                  type="text"
                  name="localizacao"
                  value={formData.localizacao}
                  onChange={handleChange}
                  className="w-full rounded-xl border p-3"
                  placeholder="Ex: Corredor B, prateleira 3"
                />
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
          </Secao>

          <Secao
            numero="05"
            titulo="Descrição do anúncio"
            descricao="Explique aplicação, condição, o que acompanha e garantia. Textos completos convertem mais."
            icone={<Package className="h-4 w-4" />}
          >
            <textarea
              id="peca-descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              rows={6}
              maxLength={5000}
              className="w-full resize-y rounded-xl border p-3"
              placeholder="Ex: Retrovisor elétrico direito original, com carcaça preta e lente em bom estado. Acompanha motor e conectores. Garantia de 90 dias."
              required
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>Use no mínimo 40 caracteres.</span>
              <span>{formData.descricao.length}/5000</span>
            </div>
          </Secao>

        </form>
        </EtapaContext.Provider>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#07111f]/55 px-4 py-2.5 backdrop-blur-xl">
          <p className="hidden text-xs text-muted sm:block">
            <Check className="mr-1 inline h-3.5 w-3.5 text-success" />
            Salvo no estoque local, pronto para revisão e publicação
          </p>
          <div className="flex w-full gap-3 sm:w-auto">
            {etapa !== '01' && <button type="button" onClick={() => setEtapa(String(Number(etapa) - 1).padStart(2, '0'))} className="rounded-lg border border-line px-3 py-2 text-xs">Anterior</button>}
            {etapa !== '05' && <button type="button" onClick={() => setEtapa(String(Number(etapa) + 1).padStart(2, '0'))} className="rounded-lg border border-accent/30 px-3 py-2 text-xs text-accent">Próxima etapa</button>}
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-50 sm:flex-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="peca-cadastro-form"
              disabled={loading}
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
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
