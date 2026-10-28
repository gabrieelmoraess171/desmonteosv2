import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  FileText,
  ImagePlus,
  Loader2,
  Package,
  Ruler,
  Save,
  Settings,
  Sparkles,
  Upload,
  Weight,
} from 'lucide-react';
import axios from 'axios';
import PhotoUploader, {
  type UploadedFile,
} from '../components/PhotoUploader';
import GroupingEditor, {
  type ProductGroup,
} from '../components/GroupingEditor';
import loteService, {
  getApiErrorMessage,
  isCanceledRequest,
  type LoteGroup,
} from '../services/loteService';
import { prepararImagensParaIa } from '../utils/imagemIa';

type ProcessingMode = 'same_vehicle' | 'mixed';

interface ActiveLot {
  id: number;
  name: string;
}

interface ImportLotPageProps {
  initialLoteId?: number;
}

interface ProdutoLidoIa {
  sku: string;
  nome: string;
  arquivos: string[];
  peso_kg?: number;
  comprimento_cm?: number;
  largura_cm?: number;
  altura_cm?: number;
  observacoes?: string;
}

interface LeituraLoteIa {
  produtos: ProdutoLidoIa[];
  alertas: string[];
  fonte: string;
  modelo?: string;
}

const MAX_FILES = 200;

function createFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function detectSkuFromFileName(name: string): string | undefined {
  const match = name.match(/sku[\s_-]*([a-z0-9]+(?:-[a-z0-9]+)*)/i);
  return match ? match[1].toUpperCase() : undefined;
}

function toProductGroup(group: LoteGroup): ProductGroup {
  return {
    id: String(group.produtoId),
    sku: group.sku,
    name: group.nome,
    suggestedName: group.suggestedName || undefined,
    confidence: group.confidence,
    alerts: group.alerts || [],
    images: group.images.map((image) => ({
      id: String(image.id),
      preview: image.url,
      fileName: image.fileName,
      detectedAsSKU: image.detectedAsSKU,
    })),
  };
}

export default function ImportLotPage({
  initialLoteId,
}: ImportLotPageProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('mixed');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [lotName, setLotName] = useState('');
  const [autoDetectSKU, setAutoDetectSKU] = useState(true);

  const [activeLot, setActiveLot] = useState<ActiveLot | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isLoadingLot, setIsLoadingLot] = useState(Boolean(initialLoteId));
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [analisandoIa, setAnalisandoIa] = useState(false);
  const [leituraIa, setLeituraIa] = useState<LeituraLoteIa | null>(null);
  const [iaErro, setIaErro] = useState('');
  const [nomesIa, setNomesIa] = useState<Record<string, string>>({});

  const previewUrls = useRef(new Set<string>());
  const fileById = useRef(new Map<string, File>());
  const abortController = useRef<AbortController | null>(null);

  const clearPreviews = useCallback(() => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const revokePreview = useCallback((url: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
  }, []);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
      clearPreviews();
    };
  }, [clearPreviews]);

  useEffect(() => {
    if (!initialLoteId) return;

    const controller = new AbortController();
    let cancelled = false;

    const loadLote = async () => {
      setIsLoadingLot(true);
      setErrorMessage('');
      setSuccessMessage('');

      try {
        const response = await loteService.buscarLoteDetalhado(
          initialLoteId,
          controller.signal
        );

        if (cancelled) return;

        const mappedGroups = response.produtos.map(toProductGroup);

        setActiveLot({
          id: response.lote.id,
          name: response.lote.nome,
        });
        setGroups(mappedGroups);
        setIsReviewing(true);
        setHasUnsavedChanges(false);
      } catch (error) {
        if (isCanceledRequest(error) || controller.signal.aborted) return;
        if (!cancelled) setErrorMessage(getApiErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoadingLot(false);
      }
    };

    loadLote();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialLoteId]);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const remainingSlots = MAX_FILES - uploadedFiles.length;
      if (remainingSlots <= 0 || files.length === 0) return;

      const newFiles: UploadedFile[] = files
        .slice(0, remainingSlots)
        .map((file) => {
          const id = createFileId();
          const preview = URL.createObjectURL(file);

          previewUrls.current.add(preview);
          fileById.current.set(id, file);

          return {
            id,
            name: file.name,
            preview,
            size: file.size,
            type: file.type,
            skuDetected: autoDetectSKU
              ? detectSkuFromFileName(file.name)
              : undefined,
            status: 'pending',
          };
        });

      setUploadedFiles((previous) => [...previous, ...newFiles]);
      setErrorMessage('');
      setSuccessMessage('');
    },
    [autoDetectSKU, uploadedFiles.length]
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      const file = uploadedFiles.find((item) => item.id === id);
      if (file) revokePreview(file.preview);

      fileById.current.delete(id);
      setUploadedFiles((previous) =>
        previous.filter((item) => item.id !== id)
      );
    },
    [revokePreview, uploadedFiles]
  );

  const handleToggleAutoDetect = useCallback(() => {
    const nextValue = !autoDetectSKU;
    setAutoDetectSKU(nextValue);

    if (nextValue) {
      setUploadedFiles((previous) =>
        previous.map((file) =>
          file.skuDetected
            ? file
            : {
                ...file,
                skuDetected: detectSkuFromFileName(file.name),
              }
        )
      );
    }
  }, [autoDetectSKU]);

  const handleLerLoteComIa = useCallback(async () => {
    if (uploadedFiles.length === 0 || analisandoIa) return;

    const arquivos = uploadedFiles
      .map((item) => ({
        ...item,
        file: fileById.current.get(item.id),
      }))
      .filter(
        (item): item is UploadedFile & { file: File } =>
          item.file !== undefined
      );

    if (arquivos.length === 0) {
      setIaErro('Não foi possível recuperar as fotos selecionadas.');
      return;
    }

    // Etiquetas de SKU primeiro: são elas que definem o agrupamento correto.
    const etiquetas = arquivos.filter((item) =>
      /(etiqueta|tag|sku|codigo|código)/i.test(item.name)
    );
    const restantes = arquivos.filter(
      (item) => !etiquetas.some((etiqueta) => etiqueta.id === item.id)
    );
    const selecionadas = [...etiquetas, ...restantes].slice(0, 8);

    setAnalisandoIa(true);
    setIaErro('');
    setSuccessMessage('');

    try {
      const imagens = await prepararImagensParaIa(
        selecionadas.map((item) => ({ file: item.file, nome: item.name })),
        8
      );

      if (imagens.length === 0) {
        throw new Error('As fotos selecionadas não puderam ser lidas.');
      }

      const { data } = await axios.post<LeituraLoteIa>(
        '/api/ia/analisar-lote',
        {
          imagens,
          arquivos: uploadedFiles.map((item) => item.name),
          contexto: {
            veiculoOrigem: selectedVehicle.trim(),
            modo: processingMode,
          },
        },
        { timeout: 120000 }
      );

      const skuPorArquivo: Record<string, string> = {};
      const nomes: Record<string, string> = {};

      for (const produto of data.produtos || []) {
        if (!produto.sku || produto.sku === 'DESCONHECIDO') continue;

        nomes[produto.sku] = produto.nome || `Produto ${produto.sku}`;

        for (const arquivo of produto.arquivos || []) {
          skuPorArquivo[arquivo] = produto.sku;
          const encontrado = uploadedFiles.find(
            (item) =>
              item.name === arquivo ||
              item.name.toLowerCase() === arquivo.toLowerCase()
          );

          if (encontrado) skuPorArquivo[encontrado.name] = produto.sku;
        }
      }

      setNomesIa((atual) => ({ ...atual, ...nomes }));
      setLeituraIa({
        ...data,
        produtos: Array.isArray(data.produtos) ? data.produtos : [],
        alertas: Array.isArray(data.alertas) ? data.alertas : [],
      });

      if (Object.keys(skuPorArquivo).length > 0) {
        setUploadedFiles((anterior) =>
          anterior.map((item) =>
            skuPorArquivo[item.name]
              ? { ...item, skuDetected: skuPorArquivo[item.name] }
              : item
          )
        );
        setAutoDetectSKU(true);
      }

      setSuccessMessage(
        `Leitura com IA concluída: ${
          data.produtos?.length || 0
        } produto(s) identificado(s). Confira os SKUs antes de processar.`
      );
    } catch (error) {
      setIaErro(
        getApiErrorMessage(error, 'Não foi possível ler as fotos com IA.')
      );
    } finally {
      setAnalisandoIa(false);
    }
  }, [
    analisandoIa,
    processingMode,
    selectedVehicle,
    uploadedFiles,
  ]);

  const resetUploadState = useCallback(() => {
    clearPreviews();
    fileById.current.clear();
    setUploadedFiles([]);
    setIsUploading(false);
    setIsReviewing(false);
    setActiveLot(null);
    setGroups([]);
    setHasUnsavedChanges(false);
    setLotName('');
    setSelectedVehicle('');
    setProcessingMode('mixed');
    setAutoDetectSKU(true);
    setErrorMessage('');
    setSuccessMessage('');
    setIsSaving(false);
    setAnalisandoIa(false);
    setLeituraIa(null);
    setIaErro('');
    setNomesIa({});
  }, [clearPreviews]);

  const handleCancelImport = useCallback(() => {
    abortController.current?.abort();
    abortController.current = null;

    const lotToRemove = activeLot?.id;
    if (lotToRemove) {
      loteService.cancelarLote(lotToRemove).catch(() => {});
    }

    resetUploadState();
  }, [activeLot, resetUploadState]);

  const handleStartUpload = useCallback(async () => {
    if (uploadedFiles.length === 0 || isUploading) return;

    if (processingMode === 'same_vehicle' && !selectedVehicle.trim()) {
      setErrorMessage(
        'Informe o veículo de origem para o modo “Mesmo Veículo”.'
      );
      return;
    }

    const filesForUpload = uploadedFiles
      .map((file) => ({
        id: file.id,
        file: fileById.current.get(file.id),
      }))
      .filter(
        (item): item is { id: string; file: File } => item.file !== undefined
      );

    if (filesForUpload.length === 0) {
      setErrorMessage('Não foi possível recuperar os arquivos selecionados.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploading(true);
    setUploadedFiles((previous) =>
      previous.map((file) => ({
        ...file,
        status: 'uploading',
        error: undefined,
      }))
    );

    const controller = new AbortController();
    abortController.current = controller;
    const finalLotName =
      lotName.trim() || `Lote ${new Date().toLocaleString('pt-BR')}`;
    const mapaIA: Record<string, { sku?: string; nome?: string }> = {};

    uploadedFiles.forEach((item) => {
      if (!item.skuDetected) return;
      mapaIA[item.name] = {
        sku: item.skuDetected,
        nome: nomesIa[item.skuDetected],
      };
    });

    let createdLotId: number | null = null;

    try {
      const created = await loteService.criarLote(
        finalLotName,
        processingMode,
        selectedVehicle.trim() || undefined,
        autoDetectSKU,
        controller.signal
      );

      const loteId = created.loteId;
      createdLotId = loteId;
      setActiveLot({ id: loteId, name: finalLotName });

      const uploadResult = await loteService.uploadFotos(
        loteId,
        filesForUpload.map(({ file }) => file),
        {
          modo: processingMode,
          detectarSKU: autoDetectSKU,
          veiculoOrigem: selectedVehicle.trim() || null,
          mapaIA,
          signal: controller.signal,
          onProgress: (percent) => {
            const completed = Math.min(
              filesForUpload.length,
              Math.floor((percent / 100) * filesForUpload.length)
            );

            setUploadedFiles((previous) =>
              previous.map((file, index) => ({
                ...file,
                status: index < completed ? 'success' : 'uploading',
              }))
            );
          },
        }
      );

      const mappedGroups = uploadResult.grupos.map(toProductGroup);

      if (mappedGroups.length === 0) {
        throw new Error('Nenhum grupo foi gerado a partir das fotos enviadas');
      }

      setGroups(mappedGroups);
      setIsReviewing(true);
      setHasUnsavedChanges(false);
      setSuccessMessage(
        `Lote processado: ${uploadResult.totalFotos} foto(s) em ${
          uploadResult.gruposCriados
        } grupo(s). Revise os agrupamentos antes de salvar.`
      );
      setUploadedFiles([]);
      clearPreviews();
      fileById.current.clear();
    } catch (error) {
      if (isCanceledRequest(error) || controller.signal.aborted) {
        return;
      }

      setErrorMessage(getApiErrorMessage(error, 'Erro ao processar o lote'));
      setUploadedFiles((previous) =>
        previous.map((file) => ({ ...file, status: 'error' }))
      );

      if (createdLotId) {
        await loteService.cancelarLote(createdLotId).catch(() => {});
        setActiveLot(null);
      }
    } finally {
      if (abortController.current === controller) {
        abortController.current = null;
      }

      setIsUploading(false);
    }
  }, [
    autoDetectSKU,
    clearPreviews,
    isUploading,
    lotName,
    nomesIa,
    processingMode,
    selectedVehicle,
    uploadedFiles,
  ]);

  const handleGroupUpdate = useCallback((nextGroups: ProductGroup[]) => {
    setGroups(nextGroups);
    setHasUnsavedChanges(true);
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  const handleSaveGroups = useCallback(async () => {
    if (!activeLot || groups.length === 0 || isSaving) return;

    if (!groups.some((group) => group.images.length > 0)) {
      setErrorMessage('Nenhum grupo com fotos para salvar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await loteService.atualizarAgrupamentos(
        activeLot.id,
        groups
      );

      setGroups(response.grupos.map(toProductGroup));
      setHasUnsavedChanges(false);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Erro ao salvar a organização'));
    } finally {
      setIsSaving(false);
    }
  }, [activeLot, groups, isSaving]);

  const handleStartNewLot = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('Existem alterações não salvas. Deseja continuar?')
    ) {
      return;
    }

    resetUploadState();
  }, [hasUnsavedChanges, resetUploadState]);

  const skuGroups = useMemo(() => {
    const map = new Map<string, number>();

    uploadedFiles.forEach((file) => {
      if (!file.skuDetected) return;
      map.set(file.skuDetected, (map.get(file.skuDetected) ?? 0) + 1);
    });

    return Array.from(map, ([sku, count]) => ({ sku, count }));
  }, [uploadedFiles]);

  const uniqueSKUs = skuGroups.length;
  const filesWithSku = uploadedFiles.filter((file) => file.skuDetected).length;
  const totalSizeInMB =
    uploadedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024;

  if (isLoadingLot) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <p>Carregando lote...</p>
      </div>
    );
  }

  if (isReviewing && activeLot) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Revisar Agrupamento</h1>
            <p className="text-text-secondary">
              {activeLot.name} • Confira os grupos e ajuste antes de salvar
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartNewLot}
              disabled={isSaving}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Novo lote
            </button>
            <button
              type="button"
              onClick={handleSaveGroups}
              disabled={isSaving || groups.length === 0}
              aria-busy={isSaving}
              className="px-5 py-2 rounded-lg font-medium flex items-center gap-2 bg-accent text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar organização'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-dangerSoft border border-danger text-danger p-3 rounded-lg"
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2 bg-successSoft border border-success text-success p-3 rounded-lg"
          >
            <Check className="h-5 w-5 mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <GroupingEditor groups={groups} onGroupUpdate={handleGroupUpdate} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Importar Lote de Fotografias</h1>
          <p className="text-text-secondary">
            Organize e agrupe fotos automaticamente por SKU
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCancelImport}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploadedFiles.length === 0 && !isUploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStartUpload}
            disabled={uploadedFiles.length === 0 || isUploading}
            aria-busy={isUploading}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
              uploadedFiles.length === 0 || isUploading
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent text-white hover:brightness-110'
            }`}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>{isUploading ? 'Processando...' : 'Processar Lote'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-dangerSoft border border-danger text-danger p-3 rounded-lg"
        >
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-6">
            <PhotoUploader
              onFilesSelected={handleFilesSelected}
              onRemoveFile={handleRemoveFile}
              uploadedFiles={uploadedFiles}
              isUploading={isUploading}
              maxFiles={MAX_FILES}
            />
          </div>

          {/* Leitura com IA */}
          <div className="mt-6 rounded-xl border border-accent/25 bg-accentSoft/40 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accentSoft text-accent">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">Leitura com IA do lote</h3>
                  <p className="mt-1 max-w-xl text-sm text-text-secondary">
                    A IA lê as etiquetas e as fotos, identifica o SKU de cada
                    peça e separa os grupos antes de processar. Confira o
                    resultado e corrija o que precisar.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleLerLoteComIa()}
                disabled={
                  analisandoIa ||
                  isUploading ||
                  uploadedFiles.length === 0
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analisandoIa ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {analisandoIa ? 'Lendo fotos...' : 'Ler fotos com IA'}
              </button>
            </div>

            {iaErro && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-dangerSoft p-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{iaErro}</span>
              </div>
            )}

            {leituraIa && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-accent/20 bg-accentSoft px-2.5 py-1 font-semibold text-accent">
                    Fonte: {leituraIa.fonte}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-text-secondary">
                    {leituraIa.produtos.length} produto(s)
                  </span>
                  <span className="text-text-secondary">
                    A IA priorizou as etiquetas de SKU e atualizou os grupos
                    abaixo.
                  </span>
                </div>

                {leituraIa.produtos.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {leituraIa.produtos.map((produto) => (
                      <div
                        key={`${produto.sku}-${produto.nome}`}
                        className="rounded-lg border border-white/10 bg-primary/60 px-3 py-2.5"
                      >
                        <p className="font-mono text-xs font-semibold text-accent">
                          {produto.sku}
                        </p>
                        <p className="mt-0.5 text-sm text-text-primary">
                          {produto.nome || 'Produto sem nome'}
                        </p>
                        <p className="mt-1 text-[11px] text-text-secondary">
                          {produto.arquivos.length} foto(s)
                          {produto.peso_kg
                            ? ` • ${produto.peso_kg} kg`
                            : ''}
                          {produto.comprimento_cm
                            ? ` • ${produto.comprimento_cm} × ${
                                produto.largura_cm || 0
                              } × ${produto.altura_cm || 0} cm`
                            : ''}
                        </p>
                        {produto.observacoes && (
                          <p className="mt-1 text-[11px] text-warning">
                            {produto.observacoes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {leituraIa.alertas.length > 0 && (
                  <div className="rounded-lg border border-warning/25 bg-warningSoft p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      Pontos de atenção da IA
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-warning">
                      {leituraIa.alertas.map((alerta) => (
                        <li key={alerta}>• {alerta}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Passo a passo obrigatório */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-warning/25 bg-warningSoft text-warning">
                <Barcode className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold">Ordem correta das fotos</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Siga esta sequência para cada peça do lote. A IA usa a ordem e
                  a etiqueta para separar os produtos.
                </p>
              </div>
            </div>

            <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  numero: '1',
                  titulo: 'Foto do SKU',
                  descricao:
                    'Etiqueta ou código bem legível, de preferência a primeira foto da peça.',
                  icon: Barcode,
                },
                {
                  numero: '2',
                  titulo: 'Fotos do produto',
                  descricao:
                    'Frente, verso, detalhes e defeitos. Todas as fotos da mesma peça juntas.',
                  icon: Camera,
                },
                {
                  numero: '3',
                  titulo: 'Medidas',
                  descricao:
                    'Comprimento, largura e altura com a trena visível na foto.',
                  icon: Ruler,
                },
                {
                  numero: '4',
                  titulo: 'Peso',
                  descricao:
                    'Foto da balança mostrando o peso da peça embalada.',
                  icon: Weight,
                },
              ].map((passo) => {
                const Icone = passo.icon;

                return (
                  <li
                    key={passo.numero}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accentSoft text-xs font-bold text-accent">
                        {passo.numero}
                      </span>
                      <Icone className="h-4 w-4 text-accent" />
                      <p className="text-sm font-semibold">{passo.titulo}</p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                      {passo.descricao}
                    </p>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-dangerSoft px-3.5 py-3 text-xs leading-relaxed text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>Importante:</strong> se as fotos não forem enviadas
                nessa ordem (SKU → produto → medidas → peso), a IA pode agrupar
                peças erradas e gerar anúncios errados. Revise sempre os grupos
                antes de salvar.
              </p>
            </div>
          </div>

          {/* Processing Mode */}
          <div className="mt-6 bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Modo de Processamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProcessingMode('same_vehicle')}
                aria-pressed={processingMode === 'same_vehicle'}
                disabled={isUploading}
                className={`p-4 border rounded-lg text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  processingMode === 'same_vehicle'
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded shrink-0 ${
                      processingMode === 'same_vehicle'
                        ? 'bg-accent'
                        : 'bg-secondary'
                    }`}
                  >
                    <Package
                      className={`h-5 w-5 ${
                        processingMode === 'same_vehicle'
                          ? 'text-white'
                          : 'text-text-secondary'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Mesmo Veículo</h4>
                    <p className="text-sm text-text-secondary">
                      Todas as peças são do mesmo veículo. Informe uma vez e
                      aplique a todo o lote.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProcessingMode('mixed')}
                aria-pressed={processingMode === 'mixed'}
                disabled={isUploading}
                className={`p-4 border rounded-lg text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  processingMode === 'mixed'
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded shrink-0 ${
                      processingMode === 'mixed' ? 'bg-accent' : 'bg-secondary'
                    }`}
                  >
                    <FileText
                      className={`h-5 w-5 ${
                        processingMode === 'mixed'
                          ? 'text-white'
                          : 'text-text-secondary'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Misto / Categoria</h4>
                    <p className="text-sm text-text-secondary">
                      Lote contém peças de diferentes veículos. Cada produto
                      será identificado individualmente.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {processingMode === 'same_vehicle' && (
              <div className="mt-6">
                <label
                  htmlFor="vehicle-origin"
                  className="block text-sm font-medium mb-2"
                >
                  Veículo de Origem *
                </label>
                <input
                  id="vehicle-origin"
                  type="text"
                  value={selectedVehicle}
                  onChange={(event) => setSelectedVehicle(event.target.value)}
                  placeholder="Ex: Volkswagen Golf 2015 1.6"
                  disabled={isUploading}
                  className="w-full bg-primary border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Info & Stats */}
        <div className="space-y-6">
          {/* Lot Configuration */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4">Configuração do Lote</h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="lot-name"
                  className="block text-sm font-medium mb-2"
                >
                  Nome do Lote
                </label>
                <input
                  id="lot-name"
                  type="text"
                  value={lotName}
                  onChange={(event) => setLotName(event.target.value)}
                  placeholder="Ex: LOTE-001-2024"
                  disabled={isUploading}
                  className="w-full bg-primary border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <label
                    id="auto-detect-sku-label"
                    className="text-sm font-medium"
                  >
                    Detecção Automática de SKU
                  </label>
                  <p
                    id="auto-detect-sku-description"
                    className="text-xs text-text-secondary"
                  >
                    Identifica o SKU no nome das fotos
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoDetectSKU}
                  aria-labelledby="auto-detect-sku-label"
                  aria-describedby="auto-detect-sku-description"
                  onClick={handleToggleAutoDetect}
                  disabled={isUploading}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    autoDetectSKU ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoDetectSKU ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Processamento Inteligente
                </label>
                <p className="text-xs text-text-secondary">
                  Agrupa automaticamente por SKU e detecta sequências
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4">Resumo do Lote</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Arquivos selecionados</span>
                <span className="font-bold">{uploadedFiles.length}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-secondary">SKUs detectados</span>
                <span className="font-bold">{uniqueSKUs}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Fotos com SKU</span>
                <span className="font-bold">{filesWithSku}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Espaço utilizado</span>
                <span className="font-bold">
                  {totalSizeInMB.toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-primary border border-border rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-text-secondary">
                  Após processamento, você poderá revisar e corrigir os
                  agrupamentos automaticamente criados.
                </p>
              </div>
            </div>
          </div>

          {/* Estimated Groups */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4">Grupos Estimados</h3>

            {uniqueSKUs === 0 ? (
              <p className="text-text-secondary text-center py-4">
                Selecione fotos com SKU para ver os grupos
              </p>
            ) : (
              <div className="space-y-3">
                {skuGroups.slice(0, 5).map((group) => (
                  <div
                    key={group.sku}
                    className="flex items-center justify-between p-2 hover:bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 bg-primary rounded flex items-center justify-center">
                        <ImagePlus className="h-5 w-5 text-text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate" title={group.sku}>
                          {group.sku}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {group.count}{' '}
                          {group.count === 1 ? 'foto' : 'fotos'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {uniqueSKUs > 5 && (
                  <p className="text-text-secondary text-sm text-center pt-2">
                    +{uniqueSKUs - 5} outros grupos
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
