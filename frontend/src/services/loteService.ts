import axios from 'axios';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://desmonteos-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export interface LoteInfo {
  id: number;
  nome: string;
  modo: string;
  veiculo_origem: string | null;
  detectar_sku: number | boolean;
  status: string;
  fotos_count: number;
  produtos_count: number;
  metadata?: string | null;
  created_at: string;
  processado_em?: string | null;
}

export interface LoteGroupImage {
  id: number;
  url: string;
  fileName: string;
  detectedAsSKU: boolean;
  isPrincipal?: boolean;
}

export interface LoteGroup {
  produtoId: number;
  sku: string;
  nome?: string;
  statusRevisao?: string;
  suggestedName?: string | null;
  confidence: 'high' | 'medium' | 'low';
  alerts: string[];
  totalImagens: number;
  images: LoteGroupImage[];
}

export interface LoteDetalhado {
  lote: LoteInfo;
  produtos: LoteGroup[];
  estatisticas: {
    totalProdutos: number;
    totalFotos: number;
    porStatus: Record<string, number>;
  };
}

export interface CriarLoteResultado {
  success: boolean;
  message: string;
  loteId: number;
  lote: {
    id: number;
    nome: string;
    modo: string;
    veiculoOrigem: string | null;
    detectarSKU: boolean;
  };
}

export interface UploadLoteResultado {
  success: boolean;
  loteId: number;
  totalFotos: number;
  gruposCriados: number;
  grupos: LoteGroup[];
}

export interface SalvarGruposResultado {
  success: boolean;
  message: string;
  gruposAtualizados: number;
  grupos: LoteGroup[];
}

export interface GrupoAtualizacao {
  id: string | number;
  sku: string;
  name?: string;
  images: Array<{ id: string | number }>;
}

export interface MapaIaArquivo {
  sku?: string;
  nome?: string;
}

export interface UploadFotosOptions {
  modo?: string;
  detectarSKU?: boolean;
  veiculoOrigem?: string | null;
  mapaIA?: Record<string, MapaIaArquivo>;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}

export interface ListarLotesFiltros {
  status?: string;
  limit?: number;
  offset?: number;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Erro ao processar a solicitação'
): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return (
      error.response?.data?.error ||
      (error.code === 'ECONNABORTED'
        ? 'A operação demorou mais que o esperado'
        : error.message) ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export function isCanceledRequest(error: unknown): boolean {
  return axios.isCancel(error);
}

class LoteService {
  async criarLote(
    nome: string,
    modo: string,
    veiculoOrigem?: string,
    detectarSKU = true,
    signal?: AbortSignal
  ): Promise<CriarLoteResultado> {
    const response = await api.post<CriarLoteResultado>(
      '/lotes',
      { nome, modo, veiculoOrigem, detectarSKU },
      { signal }
    );

    return response.data;
  }

  async uploadFotos(
    loteId: number,
    files: File[],
    options: UploadFotosOptions = {}
  ): Promise<UploadLoteResultado> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('fotos', file, file.name);
    });

    formData.append('modo', options.modo || 'mixed');
    formData.append('detectarSKU', String(options.detectarSKU !== false));

    if (options.veiculoOrigem) {
      formData.append('veiculoOrigem', options.veiculoOrigem);
    }

    if (options.mapaIA && Object.keys(options.mapaIA).length > 0) {
      formData.append('mapaIA', JSON.stringify(options.mapaIA));
    }

    const response = await api.post<UploadLoteResultado>(
      `/lotes/${loteId}/upload`,
      formData,
      {
        signal: options.signal,
        timeout: options.timeoutMs ?? 5 * 60 * 1000,
        onUploadProgress: (event) => {
          if (!event.total) return;

          const percent = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          );

          options.onProgress?.(percent);
        },
      }
    );

    return response.data;
  }

  async listarLotes(
    filters: ListarLotesFiltros = {}
  ): Promise<LoteInfo[]> {
    const response = await api.get<LoteInfo[]>('/lotes', {
      params: {
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
      },
    });

    return response.data;
  }

  async buscarLoteDetalhado(
    loteId: number,
    signal?: AbortSignal
  ): Promise<LoteDetalhado> {
    const response = await api.get<LoteDetalhado>(`/lotes/${loteId}`, {
      signal,
    });

    return response.data;
  }

  async atualizarAgrupamentos(
    loteId: number,
    grupos: GrupoAtualizacao[]
  ): Promise<SalvarGruposResultado> {
    const gruposFormatados = grupos
      .filter((grupo) => grupo.images.length > 0)
      .map((grupo) => {
        const sku = grupo.sku.trim().toUpperCase();
        const produtoId = Number(grupo.id);

        return {
          produtoId:
            Number.isInteger(produtoId) && produtoId > 0 ? produtoId : null,
          sku,
          nome: grupo.name?.trim() || `Produto ${sku}`,
          imageIds: grupo.images
            .map((image) => Number(image.id))
            .filter((id) => Number.isInteger(id) && id > 0),
        };
      });

    const response = await api.put<SalvarGruposResultado>(
      `/lotes/${loteId}/grupos`,
      { grupos: gruposFormatados }
    );

    return response.data;
  }

  async cancelarLote(loteId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/lotes/${loteId}`
    );

    return response.data;
  }
}

export default new LoteService();
