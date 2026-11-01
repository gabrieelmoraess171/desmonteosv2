import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Barcode,
  Car,
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Pause,
  Play,
  RefreshCw,
  Ruler,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import axios from 'axios';
import PecaFotosEditor from '../components/PecaFotosEditor';
import MercadoLivreDetalhes from '../components/MercadoLivreDetalhes';
import {
  CAMPOS_CATEGORIA,
  CATEGORIAS_PECA,
  camposDaCategoria,
  categoriaMlDe,
  lerAtributos,
} from '../config/categorias';

interface Peca {
  id: number;
  nome: string;
  sku?: string | null;
  carro?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  categoria_ml?: string | null;
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
  tipo_anuncio?: string | null;
  gtin?: string | null;
  localizacao?: string | null;
  video_url?: string | null;
  modo_compra?: string | null;
  preco?: number | null;
  quantidade?: number | null;
  ml_titulo?: string | null;
  ml_item_id?: string | null;
  ml_status?: string | null;
  ml_ativo?: number | boolean | null;
  ml_permalink?: string | null;
  imagem_principal?: string | null;
  imagens_count?: number | null;
  status?: 'inativo' | 'revisar' | 'pronto' | string;
  motivos?: string[];
}

interface FormAnuncio {
  titulo: string;
  descricao: string;
  preco: string;
  quantidade: string;
  mlAtivo: boolean;
  observacao: string;
  nome: string;
  sku: string;
  carro: string;
  categoria: string;
  categoriaMl: string;
  marca: string;
  modelo: string;
  ano: string;
  condicao: string;
  numeroOem: string;
  garantia: string;
  pesoKg: string;
  comprimentoCm: string;
  larguraCm: string;
  alturaCm: string;
  tipoAnuncio: string;
  gtin: string;
  localizacao: string;
  modoCompra: string;
  atributos: Record<string, string>;
}

interface FichaCompletaIa {
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
  estimados?: string[];
}

interface RespostaFichaCompletaIa {
  dados: FichaCompletaIa;
  fonte: string;
  modelo?: string;
  estimados?: string[];
  aviso?: string;
  imagensAnalisadas?: number;
}

interface ResultadoVerificadorAnuncio {
  aprovado: boolean;
  confianca: string;
  problemas: Array<{ campo: string; mensagem: string }>;
  avisos: Array<{ campo: string; mensagem: string }>;
  confirmados: string[];
  observacao?: string;
}

interface EditorAnunciosPageProps {
  onOpenApproval?: () => void;
  onOpenNew?: () => void;
}

function formatarMoeda(valor?: number | null): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}

function textoNumero(valor?: number | null): string {
  if (valor === null || valor === undefined) return '';
  const numero = Number(valor);
  return Number.isFinite(numero) ? String(numero) : '';
}

/**
 * Converte o preço digitado em número.
 * Aceita "1234,56", "1.234,56" e "1234.56".
 */
function parsePreco(value: string): number {
  const cleaned = String(value || '').replace(/[^\d.,]/g, '');
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

function normalizarTipoAnuncio(valor?: string | null): string {
  const tipo = String(valor || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (['gold_pro', 'gold_premium', 'premium'].includes(tipo)) return 'premium';
  if (['free', 'gratis', 'grátis'].includes(tipo)) return 'grátis';
  return 'clássico';
}

function numeroPreenchido(valor: unknown, atual: string): string {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : atual;
}

function formularioDaPeca(peca: Peca): FormAnuncio {
  return {
    titulo: String(peca.ml_titulo || peca.nome || '').slice(0, 60),
    descricao: String(peca.descricao || ''),
    preco: Number(peca.preco || 0).toFixed(2),
    quantidade: String(Math.max(0, Math.trunc(Number(peca.quantidade) || 0))),
    mlAtivo: Boolean(peca.ml_ativo),
    observacao: '',
    nome: peca.nome || '',
    sku: peca.sku || '',
    carro: peca.carro || '',
    categoria: peca.categoria || '',
    categoriaMl: peca.categoria_ml || '',
    marca: peca.marca || '',
    modelo: peca.modelo || '',
    ano: peca.ano || '',
    condicao: peca.condicao || 'usado',
    numeroOem: peca.numero_oem || '',
    garantia: peca.garantia || '',
    pesoKg: textoNumero(peca.peso_kg),
    comprimentoCm: textoNumero(peca.comprimento_cm),
    larguraCm: textoNumero(peca.largura_cm),
    alturaCm: textoNumero(peca.altura_cm),
    tipoAnuncio: normalizarTipoAnuncio(peca.tipo_anuncio),
    gtin: peca.gtin || '',
    localizacao: peca.localizacao || '',
    modoCompra: peca.modo_compra || 'buy_it_now',
    atributos: lerAtributos(peca.atributos),
  };
}

function badgeAnuncio(peca: Peca) {
  if (!peca.ml_item_id) {
    return {
      label: 'Sem anúncio ML',
      className: 'border-white/10 bg-white/[0.05] text-muted',
    };
  }

  if (peca.ml_status === 'active') {
    return {
      label: 'Ativo no ML',
      className: 'border-success/20 bg-successSoft text-success',
    };
  }

  if (peca.ml_status === 'paused') {
    return {
      label: 'Pausado no ML',
      className: 'border-warning/20 bg-warningSoft text-warning',
    };
  }

  if (peca.ml_status === 'closed') {
    return {
      label: 'Vendido',
      className: 'border-warning/25 bg-warningSoft text-warning',
    };
  }

  return {
    label: peca.ml_status || 'Vinculado',
    className: 'border-accent/20 bg-accentSoft text-accent',
  };
}

function Campo({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] leading-relaxed text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}

function Bloco({
  titulo,
  descricao,
  icone,
  children,
}: {
  titulo: string;
  descricao: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accentSoft text-accent">
          {icone}
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {descricao}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function EditorAnunciosPage({
  onOpenApproval,
  onOpenNew,
}: EditorAnunciosPageProps) {
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [pecaId, setPecaId] = useState<number | null>(null);
  const [pecaDetalhe, setPecaDetalhe] = useState<Peca | null>(null);
  const [formulario, setFormulario] = useState<FormAnuncio | null>(null);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [gerando, setGerando] = useState(false);
  const [completandoFicha, setCompletandoFicha] = useState(false);
  const [estimadosFicha, setEstimadosFicha] = useState<string[]>([]);
  const [verificandoAnuncio, setVerificandoAnuncio] = useState(false);
  const [resultadoVerificacao, setResultadoVerificacao] = useState<ResultadoVerificadorAnuncio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const mutacaoEmCurso = useRef(false);
  const preservarFormularioAposStatus = useRef<{
    id: number;
    ativo: boolean;
  } | null>(null);
  const mutacaoPendente = enviando || excluindo || alterandoStatus;

  const carregar = async (manterSelecao = true) => {
    setLoading(true);
    setErro('');

    try {
      const { data } = await axios.get<Peca[]>('/api/pecas?resumo=1', {
        timeout: 15000,
      });

      setPecas(data);
      setPecaId((atual) => {
        const preferida = manterSelecao
          ? data.find((peca) => peca.id === atual)
          : null;

        return (
          preferida?.id ||
          data.find((peca) => peca.ml_item_id)?.id ||
          data[0]?.id ||
          null
        );
      });
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível carregar as peças do estoque.'
        );
      } else {
        setErro('Não foi possível carregar as peças do estoque.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar(false);
  }, []);

  // A lista vem resumida para a página abrir rápido; a ficha completa (com
  // descrição e atributos) é carregada só para a peça selecionada.
  useEffect(() => {
    if (pecaId === null) {
      setPecaDetalhe(null);
      return;
    }

    let ativo = true;

    axios
      .get<Peca>(`/api/pecas/${pecaId}`, { timeout: 15000 })
      .then(({ data }) => {
        if (ativo) setPecaDetalhe(data);
      })
      .catch(() => {
        if (ativo) setPecaDetalhe(null);
      });

    return () => {
      ativo = false;
    };
  }, [pecaId]);

  const pecasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const filtradas = !termo
      ? [...pecas]
      : pecas.filter((peca) =>
          [peca.nome, peca.sku, peca.ml_titulo, peca.ml_item_id]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(termo))
        );

    return filtradas.sort((a, b) => {
      const ativoA = a.ml_ativo && a.ml_status !== 'closed' ? 1 : 0;
      const ativoB = b.ml_ativo && b.ml_status !== 'closed' ? 1 : 0;
      if (ativoA !== ativoB) return ativoB - ativoA;
      const vendidoA = a.ml_status === 'closed' || Number(a.quantidade) <= 0 ? 1 : 0;
      const vendidoB = b.ml_status === 'closed' || Number(b.quantidade) <= 0 ? 1 : 0;
      if (vendidoA !== vendidoB) return vendidoA - vendidoB;
      return b.id - a.id;
    });
  }, [busca, pecas]);

  const pecaSelecionada = useMemo(
    () => pecas.find((peca) => peca.id === pecaId) || null,
    [pecaId, pecas]
  );

  const pecaDetalheSelecionada = useMemo(
    () =>
      pecaDetalhe && pecaSelecionada && pecaDetalhe.id === pecaSelecionada.id
        ? pecaDetalhe
        : null,
    [pecaDetalhe, pecaSelecionada]
  );

  useEffect(() => {
    if (pecaDetalheSelecionada) {
      const statusAtualizado = preservarFormularioAposStatus.current;
      preservarFormularioAposStatus.current = null;

      if (statusAtualizado?.id === pecaDetalheSelecionada.id) {
        // Pausar/reativar altera somente o status e mantém o rascunho atual.
        setFormulario((atual) =>
          atual
            ? { ...atual, mlAtivo: statusAtualizado.ativo }
            : formularioDaPeca(pecaDetalheSelecionada)
        );
        return;
      }

      setFormulario(formularioDaPeca(pecaDetalheSelecionada));
      setErro('');
      setAviso('');
      setEstimadosFicha([]);
      setResultadoVerificacao(null);
      setCompletandoFicha(false);
    } else if (!pecaSelecionada) {
      setFormulario(null);
    }
  }, [pecaDetalheSelecionada, pecaSelecionada]);

  const atualizarCampo = <C extends keyof FormAnuncio>(
    campo: C,
    valor: FormAnuncio[C]
  ) => {
    setFormulario((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setAviso('');
  };

  const atualizarCategoria = (categoria: string) => {
    setFormulario((atual) =>
      atual
        ? {
            ...atual,
            categoria,
            categoriaMl: categoriaMlDe(categoria),
            atributos: {},
          }
        : atual
    );
    setAviso('');
  };

  const atualizarAtributo = (chave: string, valor: string) => {
    setFormulario((atual) =>
      atual
        ? {
            ...atual,
            atributos: { ...atual.atributos, [chave]: valor },
          }
        : atual
    );
    setAviso('');
  };

  const gerarComIa = async () => {
    if (!pecaSelecionada || mutacaoEmCurso.current) return;

    setGerando(true);
    setErro('');
    setAviso('');
    setEstimadosFicha([]);

    try {
      const { data } = await axios.post<{
        titulo: string;
        descricao: string;
        fonte: string;
        aviso?: string;
      }>(
        '/api/ia/anuncio',
        { pecaId: pecaSelecionada.id },
        { timeout: 60000 }
      );

      setFormulario((atual) =>
        atual
          ? {
              ...atual,
              titulo: String(data.titulo || '').slice(0, 60),
              descricao: String(data.descricao || ''),
            }
          : atual
      );
      setAviso(
        data.aviso ||
          `Título e descrição gerados com ${
            data.fonte === 'local' ? 'os dados da peça' : data.fonte
          }. Revise antes de enviar para aprovação.`
      );
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível gerar o anúncio com IA.'
        );
      } else {
        setErro('Não foi possível gerar o anúncio com IA.');
      }
    } finally {
      setGerando(false);
    }
  };

  const aplicarFichaCompleta = (dados: FichaCompletaIa) => {
    setFormulario((atual) => {
      if (!atual) return atual;

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
        atual.categoriaMl ||
        textoPreenchido(dados.categoria_ml, '') ||
        categoriaMlDe(categoriaFinal);

      return {
        ...atual,
        titulo: textoPreenchido(dados.titulo, atual.titulo).slice(0, 60),
        descricao: textoPreenchido(dados.descricao, atual.descricao),
        nome: textoPreenchido(
          dados.nome,
          atual.nome || dados.titulo || atual.titulo
        ).slice(0, 200),
        categoria: categoriaFinal,
        categoriaMl,
        carro: textoPreenchido(dados.carro, atual.carro),
        marca: textoPreenchido(dados.marca, atual.marca),
        modelo: textoPreenchido(dados.modelo, atual.modelo),
        ano: textoPreenchido(dados.ano, atual.ano),
        condicao,
        numeroOem: textoPreenchido(dados.numero_oem, atual.numeroOem),
        garantia: textoPreenchido(dados.garantia, atual.garantia),
        pesoKg: numeroPreenchido(dados.peso_kg, atual.pesoKg),
        comprimentoCm: numeroPreenchido(
          dados.comprimento_cm,
          atual.comprimentoCm
        ),
        larguraCm: numeroPreenchido(dados.largura_cm, atual.larguraCm),
        alturaCm: numeroPreenchido(dados.altura_cm, atual.alturaCm),
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
        localizacao: textoPreenchido(dados.localizacao, atual.localizacao),
        tipoAnuncio:
          atual.tipoAnuncio ||
          (['clássico', 'premium', 'grátis'].includes(tipoInformado)
            ? tipoInformado
            : 'clássico'),
        modoCompra:
          atual.modoCompra ||
          (['buy_it_now', 'auction'].includes(modoInformado)
            ? modoInformado
            : 'buy_it_now'),
        atributos: { ...atributosIa, ...atributosAtuais },
      };
    });
  };

  const completarFichaComIa = async () => {
    if (!pecaSelecionada || !formulario || completandoFicha || mutacaoEmCurso.current) return;

    setCompletandoFicha(true);
    setErro('');
    setAviso('');
    setEstimadosFicha([]);

    try {
      const { data } = await axios.post<RespostaFichaCompletaIa>(
        '/api/ia/completar-ficha',
        {
          pecaId: pecaSelecionada.id,
          categorias: CATEGORIAS_PECA,
          camposPorCategoria: CAMPOS_CATEGORIA,
          contexto: {
            peca: {
              nome: formulario.nome,
              ml_titulo: formulario.titulo,
              sku: formulario.sku,
              carro: formulario.carro,
              descricao: formulario.descricao,
              categoria: formulario.categoria,
              categoria_ml: formulario.categoriaMl,
              marca: formulario.marca,
              modelo: formulario.modelo,
              ano: formulario.ano,
              condicao: formulario.condicao,
              numero_oem: formulario.numeroOem,
              garantia: formulario.garantia,
              peso_kg: Number(formulario.pesoKg) || 0,
              comprimento_cm: Number(formulario.comprimentoCm) || 0,
              largura_cm: Number(formulario.larguraCm) || 0,
              altura_cm: Number(formulario.alturaCm) || 0,
              tipo_anuncio: formulario.tipoAnuncio,
              gtin: formulario.gtin,
              localizacao: formulario.localizacao,
              modo_compra: formulario.modoCompra,
              quantidade: Number(formulario.quantidade) || 0,
              preco: parsePreco(formulario.preco) || 0,
              atributos: formulario.atributos,
            },
          },
        },
        { timeout: 150000 }
      );

      if (data?.dados) aplicarFichaCompleta(data.dados);

      const estimados = Array.isArray(data?.estimados)
        ? data.estimados
        : Array.isArray(data?.dados?.estimados)
          ? data.dados.estimados
          : [];

      setEstimadosFicha(estimados);
      setAviso(
        data?.aviso ||
          `Ficha completa gerada${
            data?.imagensAnalisadas
              ? ` com ${data.imagensAnalisadas} foto(s)`
              : ''
          }. Revise os campos antes de enviar para aprovação.`
      );
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível completar a ficha com IA.'
        );
      } else {
        setErro('Não foi possível completar a ficha com IA.');
      }
    } finally {
      setCompletandoFicha(false);
    }
  };

  const enviarParaAprovacao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pecaSelecionada || !formulario || mutacaoEmCurso.current) return;

    const titulo = formulario.titulo.replace(/\s+/g, ' ').trim();
    const descricao = formulario.descricao.trim();
    const preco = parsePreco(formulario.preco);
    const quantidade = Math.trunc(Number(formulario.quantidade));

    if (!titulo) {
      setErro('Informe o título do anúncio.');
      return;
    }

    if (titulo.length > 60) {
      setErro('O título do Mercado Livre pode ter no máximo 60 caracteres.');
      return;
    }

    if (!Number.isFinite(preco) || preco <= 0) {
      setErro('Informe um preço maior que zero.');
      return;
    }

    if (!Number.isFinite(quantidade) || quantidade < 0) {
      setErro('A quantidade não pode ser negativa.');
      return;
    }

    if (!formulario.nome.trim()) {
      setErro('Informe o nome interno da peça.');
      return;
    }

    if (!formulario.sku.trim()) {
      setErro('Informe o SKU da peça.');
      return;
    }

    if (!formulario.categoria) {
      setErro('Selecione a categoria da peça.');
      return;
    }

    mutacaoEmCurso.current = true;
    setEnviando(true);
    setErro('');
    setAviso('');

    try {
      const dados = {
        nome: formulario.nome.trim(),
        sku: formulario.sku.trim().toUpperCase(),
        carro: formulario.carro.trim(),
        categoria: formulario.categoria,
        categoria_ml:
          formulario.categoriaMl.trim() || categoriaMlDe(formulario.categoria),
        marca: formulario.marca.trim(),
        modelo: formulario.modelo.trim(),
        ano: formulario.ano.trim(),
        condicao: formulario.condicao,
        numero_oem: formulario.numeroOem.trim(),
        garantia: formulario.garantia.trim(),
        peso_kg: Number(formulario.pesoKg) || 0,
        comprimento_cm: Number(formulario.comprimentoCm) || 0,
        largura_cm: Number(formulario.larguraCm) || 0,
        altura_cm: Number(formulario.alturaCm) || 0,
        atributos: formulario.atributos,
        tipo_anuncio: formulario.tipoAnuncio,
        gtin: formulario.gtin.trim(),
        localizacao: formulario.localizacao.trim(),
        modo_compra: formulario.modoCompra,
      };
      const payload = {
        pecaId: pecaSelecionada.id,
        titulo,
        descricao,
        preco,
        quantidade,
        mlAtivo: formulario.mlAtivo ? 1 : 0,
        observacao: formulario.observacao.trim(),
        dados,
      };

      const existenteNoMl = Boolean(pecaSelecionada.ml_item_id);
      const { data } = await axios.post<{ mensagem?: string }>(
        existenteNoMl
          ? `/api/mercadolivre/pecas/${pecaSelecionada.id}/salvar`
          : '/api/aprovacoes',
        payload,
        { timeout: existenteNoMl ? 120000 : 15000 }
      );

      if (existenteNoMl) {
        await carregar(true);
        const atualizada = await axios.get<Peca>(
          `/api/pecas/${pecaSelecionada.id}`,
          { timeout: 15000 }
        );
        setPecaDetalhe(atualizada.data);
      }

      setAviso(
        data.mensagem ||
          (existenteNoMl
            ? 'Alterações salvas e sincronizadas com o Mercado Livre.'
            : 'Alterações enviadas para a fila de aprovação.')
      );
      setFormulario((atual) =>
        atual ? { ...atual, observacao: '' } : atual
      );
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível enviar as alterações para aprovação.'
        );
      } else {
        setErro('Não foi possível enviar as alterações para aprovação.');
      }
    } finally {
      mutacaoEmCurso.current = false;
      setEnviando(false);
    }
  };

  const verificarAnuncio = async () => {
    if (!pecaSelecionada || verificandoAnuncio || mutacaoEmCurso.current) return;
    setVerificandoAnuncio(true);
    setErro('');
    try {
      const { data } = await axios.post<ResultadoVerificadorAnuncio>(
        '/api/ia/verificar-anuncio',
        { pecaId: pecaSelecionada.id },
        { timeout: 150000 }
      );
      setResultadoVerificacao(data);
      setAviso(data.aprovado ? 'Agente verificador: anúncio pronto para revisão final.' : 'Agente verificador encontrou pontos que precisam ser corrigidos.');
    } catch (error) {
      setErro(axios.isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error || 'Não foi possível verificar o anúncio.'
        : 'Não foi possível verificar o anúncio.');
    } finally {
      setVerificandoAnuncio(false);
    }
  };

  const excluirAnuncio = async () => {
    if (!pecaSelecionada?.ml_item_id || mutacaoEmCurso.current) return;

    const confirmado = window.confirm(
      `Excluir o anúncio ${pecaSelecionada.ml_item_id} no Mercado Livre?\n\nA peça continuará no estoque, mas o anúncio será encerrado e desvinculado. Essa ação não pode ser desfeita pelo painel.`
    );

    if (!confirmado) return;

    mutacaoEmCurso.current = true;
    setExcluindo(true);
    setErro('');
    setAviso('');

    try {
      const { data } = await axios.post<{ mensagem?: string }>(
        `/api/pecas/${pecaSelecionada.id}/anuncio/excluir`,
        {},
        { timeout: 30000 }
      );

      setAviso(
        data.mensagem ||
          'Anúncio excluído no Mercado Livre e desvinculado do estoque.'
      );
      await carregar(true);
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setErro(
          error.response?.data?.error ||
            'Não foi possível excluir o anúncio no Mercado Livre.'
        );
      } else {
        setErro('Não foi possível excluir o anúncio no Mercado Livre.');
      }
    } finally {
      mutacaoEmCurso.current = false;
      setExcluindo(false);
    }
  };

  const statusMlSelecionado = String(
    pecaDetalheSelecionada?.ml_status || pecaSelecionada?.ml_status || ''
  ).toLowerCase();
  const permiteAlterarStatus = ['active', 'paused'].includes(statusMlSelecionado);
  const anuncioPausado = statusMlSelecionado === 'paused';

  const alternarStatusAnuncio = async () => {
    if (
      !pecaSelecionada?.ml_item_id ||
      !pecaDetalheSelecionada ||
      !formulario ||
      !permiteAlterarStatus ||
      mutacaoEmCurso.current ||
      loading ||
      gerando ||
      completandoFicha ||
      verificandoAnuncio
    ) return;

    const id = pecaSelecionada.id;
    const ativo = anuncioPausado;
    mutacaoEmCurso.current = true;
    setAlterandoStatus(true);
    setErro('');
    setAviso('');

    try {
      await axios.put(
        `/api/pecas/${id}`,
        { ml_ativo: ativo ? 1 : 0 },
        { timeout: 30000 }
      );

      // A API confirma a atualização no ML antes de gravar o status local.
      // Atualizar só esses campos evita recarregar e apagar edições não salvas.
      const status = { ml_ativo: ativo ? 1 : 0, ml_status: ativo ? 'active' : 'paused' };
      preservarFormularioAposStatus.current = { id, ativo };
      setPecas((atuais) => atuais.map((peca) => peca.id === id ? { ...peca, ...status } : peca));
      setPecaDetalhe((atual) => atual?.id === id ? { ...atual, ...status } : atual);
      setAviso(
        ativo
          ? 'Anúncio reativado no Mercado Livre. As demais edições continuam no formulário.'
          : 'Anúncio pausado no Mercado Livre. As demais edições continuam no formulário.'
      );
    } catch (error) {
      setErro(
        axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error || 'Não foi possível alterar o status do anúncio no Mercado Livre.'
          : 'Não foi possível alterar o status do anúncio no Mercado Livre.'
      );
    } finally {
      mutacaoEmCurso.current = false;
      setAlterandoStatus(false);
    }
  };

  const camposTecnicos = camposDaCategoria(formulario?.categoria);

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Wand2 className="h-3.5 w-3.5" />
              Ficha completa do Mercado Livre
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Editor de anúncios
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Revise título, descrição, categoria, compatibilidade, ficha
              técnica, logística e fotos. O que você enviar entra na fila de
              aprovação antes de chegar ao Mercado Livre.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenApproval && (
              <button
                type="button"
                onClick={onOpenApproval}
                disabled={mutacaoPendente}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.09] hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Abrir fila de aprovação
              </button>
            )}
            <button
              type="button"
              onClick={() => void carregar(true)}
              disabled={loading || mutacaoPendente}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {(erro || aviso) && (
        <div
          role={erro ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
            erro
              ? 'border-danger/25 bg-dangerSoft text-danger'
              : 'border-success/25 bg-successSoft text-success'
          }`}
        >
          {erro ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p>{erro || aviso}</p>
            {!erro && onOpenApproval && (
              <button
                type="button"
                onClick={onOpenApproval}
                disabled={mutacaoPendente}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-success/25 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                Ver fila de aprovação
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-16 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Carregando peças...
        </div>
      ) : pecas.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center shadow-lg shadow-black/20">
          <ImageIcon className="mx-auto h-9 w-9 text-muted" />
          <h3 className="mt-3 text-xl font-bold">Nenhuma peça cadastrada</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Cadastre uma peça ou sincronize seus anúncios do Mercado Livre para
            começar a editar.
          </p>
          {onOpenNew && (
            <button
              type="button"
              onClick={onOpenNew}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Cadastrar peça
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)]">
          <section className="min-w-0 rounded-2xl border border-line bg-card p-4 shadow-lg shadow-black/20 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Estoque
                </p>
                <h3 className="mt-1 text-xl font-bold">Escolha a peça</h3>
              </div>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-muted">
                {pecas.length}
              </span>
            </div>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, SKU ou MLB..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent/50"
              />
            </label>

            <div className="mt-3 max-h-[640px] space-y-2 overflow-y-auto pr-1">
              {pecasFiltradas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
                  Nenhuma peça encontrada para esta busca.
                </p>
              ) : (
                <>
                  {pecasFiltradas.slice(0, 100).map((peca) => {
                    const badge = badgeAnuncio(peca);
                    const ativa = peca.id === pecaId;

                    return (
                    <button
                      key={peca.id}
                      type="button"
                      onClick={() => setPecaId(peca.id)}
                      disabled={mutacaoPendente}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        ativa
                          ? 'border-accent/50 bg-accentSoft'
                          : 'border-white/10 bg-white/[0.03] hover:border-accent/30 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-secondary">
                        {peca.imagem_principal ? (
                          <img
                            src={peca.imagem_principal}
                            alt={peca.nome}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {peca.nome}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {peca.sku || 'Sem SKU'} •{' '}
                          {peca.ml_item_id || 'sem MLB'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-muted">
                            {formatarMoeda(peca.preco)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                  {pecasFiltradas.length > 100 && (
                    <p className="rounded-xl border border-dashed border-line p-3 text-center text-[11px] leading-relaxed text-muted">
                      Mostrando 100 de {pecasFiltradas.length} peças. Use a busca
                      para encontrar as demais.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-lg shadow-black/20 sm:p-6">
            {pecaSelecionada && formulario ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Editando anúncio
                    </p>
                    <h3 className="mt-1 truncate text-xl font-bold">
                      {pecaSelecionada.nome}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {pecaSelecionada.ml_item_id
                        ? `Item ${pecaSelecionada.ml_item_id}`
                        : 'Esta peça ainda não está vinculada ao Mercado Livre'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {pecaSelecionada.ml_permalink && (
                      <a
                        href={pecaSelecionada.ml_permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-white/[0.08]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver no ML
                      </a>
                    )}

                    {pecaSelecionada.ml_item_id && permiteAlterarStatus && (
                      <button
                        type="button"
                        onClick={() => void alternarStatusAnuncio()}
                        disabled={mutacaoPendente || !pecaDetalheSelecionada || gerando || completandoFicha || verificandoAnuncio}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accentSoft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {alterandoStatus ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : anuncioPausado ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                        {alterandoStatus
                          ? anuncioPausado ? 'Reativando...' : 'Pausando...'
                          : anuncioPausado ? 'Reativar anúncio' : 'Pausar anúncio'}
                      </button>
                    )}

                    {pecaSelecionada.ml_item_id && (
                      <button
                        type="button"
                        onClick={() => void excluirAnuncio()}
                        disabled={mutacaoPendente}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/25 bg-dangerSoft px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {excluindo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {excluindo ? 'Excluindo...' : 'Excluir anúncio'}
                      </button>
                    )}
                  </div>
                </div>

                {pecaSelecionada.motivos &&
                  pecaSelecionada.motivos.length > 0 && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warningSoft px-3.5 py-3 text-xs leading-relaxed text-warning">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Pontos de revisão: {pecaSelecionada.motivos.join(', ')}.
                      </p>
                    </div>
                  )}

                {pecaSelecionada.ml_item_id && (
                  <div className="mt-4">
                    <MercadoLivreDetalhes pecaId={pecaSelecionada.id} compact />
                  </div>
                )}

                <form
                  onSubmit={(event) => void enviarParaAprovacao(event)}
                  className="mt-5 space-y-5"
                >
                  <Bloco
                    titulo="Conteúdo do anúncio"
                    descricao="O título aparece na busca. A descrição vende, tira dúvidas e reduz devoluções."
                    icone={<Sparkles className="h-4 w-4" />}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted">
                        Complete a ficha com IA e revise antes de enviar.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void completarFichaComIa()}
                          disabled={completandoFicha || gerando || mutacaoPendente}
                          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {completandoFicha ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5" />
                          )}
                          {completandoFicha
                            ? 'Completando ficha...'
                            : 'Completar ficha com IA'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void gerarComIa()}
                          disabled={gerando || completandoFicha || mutacaoPendente}
                          className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accentSoft px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {gerando ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {gerando ? 'Gerando...' : 'Gerar com IA'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void verificarAnuncio()}
                          disabled={verificandoAnuncio || gerando || completandoFicha || mutacaoPendente}
                          className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-successSoft px-3.5 py-2 text-xs font-semibold text-success transition hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {verificandoAnuncio ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {verificandoAnuncio ? 'Verificando...' : 'Verificar anúncio'}
                        </button>
                      </div>
                    </div>

                    {estimadosFicha.length > 0 && (
                      <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warningSoft px-3.5 py-2.5 text-xs leading-relaxed text-warning">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-semibold">
                            Campos preenchidos por estimativa
                          </p>
                          <p className="mt-1">{estimadosFicha.join(', ')}.</p>
                          <p className="mt-1">
                            A IA não confirmou esses dados nas fotos ou no
                            título. Revise antes de salvar.
                          </p>
                        </div>
                      </div>
                    )}

                    {resultadoVerificacao && (
                      <div className={`mb-3 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${resultadoVerificacao.aprovado ? 'border-success/25 bg-successSoft text-success' : 'border-warning/25 bg-warningSoft text-warning'}`}>
                        <p className="font-semibold">
                          Agente verificador • confiança {resultadoVerificacao.confianca}
                        </p>
                        {resultadoVerificacao.problemas.length > 0 && (
                          <ul className="mt-1 list-disc pl-4">
                            {resultadoVerificacao.problemas.map((item, indice) => <li key={`problema-${indice}`}>{item.mensagem}</li>)}
                          </ul>
                        )}
                        {resultadoVerificacao.avisos.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 opacity-90">
                            {resultadoVerificacao.avisos.map((item, indice) => <li key={`aviso-${indice}`}>{item.mensagem}</li>)}
                          </ul>
                        )}
                        {resultadoVerificacao.confirmados.length > 0 && (
                          <p className="mt-1">Confirmado: {resultadoVerificacao.confirmados.join(' • ')}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-4">
                      <Campo label="Título do anúncio">
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            value={formulario.titulo}
                            onChange={(event) =>
                              atualizarCampo(
                                'titulo',
                                event.target.value.slice(0, 60)
                              )
                            }
                            maxLength={60}
                            placeholder="Peça, marca, modelo e ano"
                            className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                          />
                          <span
                            className={`shrink-0 text-xs ${
                              formulario.titulo.length > 60
                                ? 'text-danger'
                                : 'text-muted'
                            }`}
                          >
                            {formulario.titulo.length}/60
                          </span>
                        </div>
                      </Campo>

                      <Campo label="Descrição">
                        <textarea
                          rows={7}
                          value={formulario.descricao}
                          onChange={(event) =>
                            atualizarCampo('descricao', event.target.value)
                          }
                          placeholder="Aplicação, condição, garantia, procedência e orientações..."
                          className="mt-1 w-full resize-y rounded-xl border border-white/10 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>
                    </div>
                  </Bloco>

                  <Bloco
                    titulo="Identificação e categoria"
                    descricao="Dados usados pelo Mercado Livre para classificar e filtrar o anúncio."
                    icone={<Package className="h-4 w-4" />}
                  >
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <Campo label="Nome interno da peça">
                        <input
                          value={formulario.nome}
                          onChange={(event) =>
                            atualizarCampo('nome', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="SKU">
                        <input
                          value={formulario.sku}
                          onChange={(event) =>
                            atualizarCampo('sku', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 font-mono text-sm uppercase text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Categoria da peça">
                        <select
                          value={formulario.categoria}
                          onChange={(event) =>
                            atualizarCategoria(event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        >
                          <option value="">Selecione</option>
                          {CATEGORIAS_PECA.map((categoria) => (
                            <option key={categoria} value={categoria}>
                              {categoria}
                            </option>
                          ))}
                        </select>
                      </Campo>

                      <Campo label="Categoria no Mercado Livre">
                        <input
                          value={formulario.categoriaMl}
                          onChange={(event) =>
                            atualizarCampo('categoriaMl', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-xs text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Tipo de anúncio">
                        <select
                          value={formulario.tipoAnuncio}
                          onChange={(event) =>
                            atualizarCampo('tipoAnuncio', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        >
                          <option value="clássico">Clássico</option>
                          <option value="premium">Premium</option>
                          <option value="grátis">Grátis</option>
                        </select>
                      </Campo>

                      <Campo label="Condição">
                        <select
                          value={formulario.condicao}
                          onChange={(event) =>
                            atualizarCampo('condicao', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        >
                          <option value="usado">Usado</option>
                          <option value="novo">Novo</option>
                          <option value="recondicionado">Recondicionado</option>
                        </select>
                      </Campo>

                      <Campo label="GTIN / EAN">
                        <input
                          value={formulario.gtin}
                          onChange={(event) =>
                            atualizarCampo('gtin', event.target.value)
                          }
                          placeholder="Código de barras do fabricante"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>
                    </div>
                  </Bloco>

                  <Bloco
                    titulo="Compatibilidade"
                    descricao="Aplicação correta reduz perguntas, devoluções e reclamações."
                    icone={<Car className="h-4 w-4" />}
                  >
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <Campo label="Veículo / aplicação">
                        <input
                          value={formulario.carro}
                          onChange={(event) =>
                            atualizarCampo('carro', event.target.value)
                          }
                          placeholder="Ex: Onix 2021"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Marca">
                        <input
                          value={formulario.marca}
                          onChange={(event) =>
                            atualizarCampo('marca', event.target.value)
                          }
                          placeholder="Ex: Chevrolet"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Modelo">
                        <input
                          value={formulario.modelo}
                          onChange={(event) =>
                            atualizarCampo('modelo', event.target.value)
                          }
                          placeholder="Ex: Onix LT"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Ano / faixa de anos">
                        <input
                          value={formulario.ano}
                          onChange={(event) =>
                            atualizarCampo('ano', event.target.value)
                          }
                          placeholder="Ex: 2020 a 2024"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Código OEM / referência">
                        <input
                          value={formulario.numeroOem}
                          onChange={(event) =>
                            atualizarCampo('numeroOem', event.target.value)
                          }
                          placeholder="Ex: 52123456"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 font-mono text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Garantia">
                        <input
                          value={formulario.garantia}
                          onChange={(event) =>
                            atualizarCampo('garantia', event.target.value)
                          }
                          placeholder="Ex: 90 dias"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>
                    </div>
                  </Bloco>

                  <Bloco
                    titulo="Ficha técnica da categoria"
                    descricao="Atributos específicos que o Mercado Livre usa nos filtros e na busca."
                    icone={<FileText className="h-4 w-4" />}
                  >
                    {!formulario.categoria ? (
                      <p className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 text-xs text-muted">
                        Selecione a categoria para liberar a ficha técnica.
                      </p>
                    ) : (
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        {camposTecnicos.map((campo) => (
                          <Campo key={campo.key} label={campo.label}>
                            {campo.tipo === 'select' ? (
                              <select
                                value={formulario.atributos[campo.key] || ''}
                                onChange={(event) =>
                                  atualizarAtributo(
                                    campo.key,
                                    event.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
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
                                value={formulario.atributos[campo.key] || ''}
                                onChange={(event) =>
                                  atualizarAtributo(
                                    campo.key,
                                    event.target.value
                                  )
                                }
                                placeholder={campo.placeholder}
                                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                              />
                            )}
                          </Campo>
                        ))}
                      </div>
                    )}
                  </Bloco>

                  <Bloco
                    titulo="Preço, estoque e logística"
                    descricao="Peso e medidas corretos evitam frete errado. O modo de compra define como o comprador fecha a compra."
                    icone={<Ruler className="h-4 w-4" />}
                  >
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <Campo label="Preço (R$)">
                        <input
                          value={formulario.preco}
                          onChange={(event) =>
                            atualizarCampo('preco', event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Estoque disponível">
                        <input
                          value={formulario.quantidade}
                          onChange={(event) =>
                            atualizarCampo(
                              'quantidade',
                              event.target.value.replace(/[^\d]/g, '')
                            )
                          }
                          inputMode="numeric"
                          placeholder="0"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Peso (kg)">
                        <input
                          value={formulario.pesoKg}
                          onChange={(event) =>
                            atualizarCampo('pesoKg', event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex: 2.4"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Modo de compra">
                        <select
                          value={formulario.modoCompra}
                          onChange={(event) =>
                            atualizarCampo('modoCompra', event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        >
                          <option value="buy_it_now">Comprar agora</option>
                          <option value="auction">Somente anúncio</option>
                        </select>
                      </Campo>

                      <Campo label="Comprimento (cm)">
                        <input
                          value={formulario.comprimentoCm}
                          onChange={(event) =>
                            atualizarCampo('comprimentoCm', event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex: 45"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Largura (cm)">
                        <input
                          value={formulario.larguraCm}
                          onChange={(event) =>
                            atualizarCampo('larguraCm', event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex: 30"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Altura (cm)">
                        <input
                          value={formulario.alturaCm}
                          onChange={(event) =>
                            atualizarCampo('alturaCm', event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex: 20"
                          className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                        />
                      </Campo>

                      <Campo label="Localização do estoque">
                        <div className="relative mt-1">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                          <input
                            value={formulario.localizacao}
                            onChange={(event) =>
                              atualizarCampo('localizacao', event.target.value)
                            }
                            placeholder="Ex: Corredor B, prateleira 3"
                            className="w-full rounded-xl border border-white/10 py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-accent/50"
                          />
                        </div>
                      </Campo>
                    </div>
                  </Bloco>

                  <Bloco
                    titulo="Fotos do cadastro"
                    descricao="Organize até 20 fotos e escolha a imagem de capa da peça."
                    icone={<ImageIcon className="h-4 w-4" />}
                  >
                    <PecaFotosEditor
                      pecaId={pecaSelecionada.id}
                      mlItemId={pecaSelecionada.ml_item_id}
                    />
                  </Bloco>

                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={formulario.mlAtivo}
                      disabled={mutacaoPendente}
                      onChange={(event) =>
                        atualizarCampo('mlAtivo', event.target.checked)
                      }
                      className="h-4 w-4 accent-[#4c9dff]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        Anúncio ativo no Mercado Livre
                      </span>
                      <span className="block text-[11px] text-muted">
                        {pecaSelecionada.ml_item_id
                          ? 'Ao salvar, o status será atualizado no Mercado Livre.'
                          : 'Ao aprovar, o anúncio será publicado com esse status.'}
                      </span>
                    </span>
                  </label>

                  <Campo label="Observação para aprovação (opcional)">
                    <input
                      value={formulario.observacao}
                      onChange={(event) =>
                        atualizarCampo('observacao', event.target.value)
                      }
                      maxLength={500}
                      placeholder="Ex.: revisar aplicação antes de publicar"
                      className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
                    />
                  </Campo>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[11px] leading-relaxed text-muted">
                    <p className="flex items-start gap-2">
                      <Barcode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      {pecaSelecionada.ml_item_id
                        ? 'Título, descrição, preço, estoque, atributos, condição, ficha técnica e fotos são sincronizados com o anúncio ao salvar.'
                        : 'Anúncios novos entram na fila de aprovação; depois da aprovação, os dados da ficha e as fotos são publicados no Mercado Livre.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                    <button
                      type="submit"
                      disabled={mutacaoPendente}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {enviando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {enviando
                        ? 'Salvando...'
                        : pecaSelecionada.ml_item_id
                          ? 'Salvar e aplicar no Mercado Livre'
                          : 'Enviar para aprovação'}
                    </button>

                    {pecaSelecionada.ml_item_id && (
                      <button
                        type="button"
                        onClick={() => void excluirAnuncio()}
                        disabled={mutacaoPendente}
                        className="inline-flex items-center gap-2 rounded-xl border border-danger/25 bg-dangerSoft px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {excluindo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {excluindo ? 'Excluindo...' : 'Excluir anúncio'}
                      </button>
                    )}

                    <p className="text-[11px] leading-relaxed text-muted">
                      {pecaSelecionada.ml_item_id
                        ? 'As alterações são aplicadas imediatamente no anúncio existente.'
                        : 'O anúncio novo será publicado após a aprovação na fila.'}
                    </p>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                <Wand2 className="h-9 w-9 text-muted" />
                <p className="mt-3 text-sm font-medium">
                  Selecione uma peça para editar
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted">
                  O editor carrega os dados atuais do estoque e do anúncio no
                  Mercado Livre.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
