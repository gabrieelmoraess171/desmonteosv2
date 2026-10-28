import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  FileArchive,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';

export interface UploadedFile {
  id: string;
  name: string;
  preview: string;
  size: number;
  type: string;
  skuDetected?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface PhotoUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  maxFiles?: number;
  maxFileSizeMB?: number;
}

function isZipFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

function isSupportedFile(file: File): boolean {
  return file.type.startsWith('image/') || isZipFile(file);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function PhotoUploader({
  onFilesSelected,
  onRemoveFile,
  uploadedFiles,
  isUploading,
  maxFiles = 200,
  maxFileSizeMB = 10,
}: PhotoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const dragDepth = useRef(0);
  const fileInputId = useId();

  const remainingSlots = Math.max(0, maxFiles - uploadedFiles.length);
  const hasReachedMax = uploadedFiles.length >= maxFiles;
  const selectionDisabled = hasReachedMax || isUploading;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const successCount = uploadedFiles.filter(
    (file) => file.status === 'success'
  ).length;
  const progress =
    uploadedFiles.length > 0
      ? Math.round((successCount / uploadedFiles.length) * 100)
      : 0;

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      if (isUploading) {
        setValidationMessage('Aguarde o envio dos arquivos atuais.');
        return;
      }

      if (hasReachedMax) {
        setValidationMessage(`Limite de ${maxFiles} fotos atingido.`);
        return;
      }

      const supportedFiles = files.filter(isSupportedFile);
      const validFiles = supportedFiles.filter(
        (file) => file.size <= maxFileSizeBytes
      );
      const filesToAdd = validFiles.slice(0, remainingSlots);
      const errors: string[] = [];

      const unsupportedCount = files.length - supportedFiles.length;
      if (unsupportedCount > 0) {
        errors.push(
          `${unsupportedCount} ${
            unsupportedCount === 1 ? 'arquivo ignorado' : 'arquivos ignorados'
          }: envie imagens ou ZIP.`
        );
      }

      const oversizedCount = supportedFiles.length - validFiles.length;
      if (oversizedCount > 0) {
        errors.push(
          `${oversizedCount} ${
            oversizedCount === 1 ? 'arquivo excede' : 'arquivos excedem'
          } o limite de ${maxFileSizeMB} MB.`
        );
      }

      const skippedCount = validFiles.length - filesToAdd.length;
      if (skippedCount > 0) {
        errors.push(
          `${skippedCount} ${
            skippedCount === 1 ? 'arquivo não foi adicionado' : 'arquivos não foram adicionados'
          } por falta de vagas.`
        );
      }

      setValidationMessage(errors.join(' '));

      if (filesToAdd.length > 0) {
        onFilesSelected(filesToAdd);
      }
    },
    [
      hasReachedMax,
      isUploading,
      maxFileSizeBytes,
      maxFileSizeMB,
      maxFiles,
      onFilesSelected,
      remainingSlots,
    ]
  );

  // Limpa avisos antigos assim que o usuário libera espaço na lista.
  useEffect(() => {
    if (!hasReachedMax) {
      setValidationMessage('');
    }
  }, [hasReachedMax]);

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current += 1;
      setDragActive(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) {
        setDragActive(false);
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = selectionDisabled ? 'none' : 'copy';
      }
    },
    [selectionDisabled]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = 0;
      setDragActive(false);

      if (event.dataTransfer.files.length > 0) {
        handleFiles(Array.from(event.dataTransfer.files));
      }
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);

      // Permite selecionar o mesmo arquivo novamente depois de removê-lo.
      event.target.value = '';

      handleFiles(files);
    },
    [handleFiles]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const files = Array.from(event.clipboardData.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        event.preventDefault();
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  return (
    <div className="relative" onPaste={handlePaste}>
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 transition-all ${
          dragActive ? 'border-accent bg-accent/10' : 'border-border'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-secondary rounded-full">
            <Upload className="h-8 w-8 text-text-secondary" />
          </div>

          <div>
            <h3 className="text-xl font-bold mb-2">Importar fotos do produto</h3>
            <p className="text-text-secondary mb-4">
              Arraste e solte suas fotos aqui ou clique para selecionar
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <span className="px-3 py-1 bg-secondary rounded-full text-sm">
                PNG, JPG, JPEG
              </span>
              <span className="px-3 py-1 bg-secondary rounded-full text-sm">
                Até {maxFileSizeMB}MB por imagem
              </span>
              <span className="px-3 py-1 bg-secondary rounded-full text-sm">
                ZIP suportado
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor={fileInputId}
              aria-disabled={selectionDisabled}
              className={`inline-block px-6 py-3 rounded-lg font-medium transition-colors ${
                selectionDisabled
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent text-white hover:brightness-110 cursor-pointer'
              }`}
            >
              Selecionar arquivos
            </label>
            <input
              id={fileInputId}
              type="file"
              multiple
              accept="image/*,.zip"
              onChange={handleChange}
              disabled={selectionDisabled}
              className="hidden"
            />
            {hasReachedMax && (
              <p className="text-danger text-sm mt-2" role="status">
                Limite de {maxFiles} fotos atingido
              </p>
            )}
            {isUploading && !hasReachedMax && (
              <p className="text-text-secondary text-sm mt-2" role="status">
                Aguarde o envio para adicionar mais arquivos
              </p>
            )}
          </div>

          {validationMessage && (
            <p
              className="flex items-start justify-center gap-2 text-danger text-sm max-w-xl"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{validationMessage}</span>
            </p>
          )}

          <p className="text-text-secondary text-sm">
            <span className="font-medium">{uploadedFiles.length}</span>{' '}
            {uploadedFiles.length === 1
              ? 'arquivo selecionado'
              : 'arquivos selecionados'}{' '}
            • <span className="font-medium ml-2">{remainingSlots}</span>{' '}
            {remainingSlots === 1 ? 'vaga disponível' : 'vagas disponíveis'}
          </p>
        </div>
      </div>

      {/* Upload Status */}
      {isUploading && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-primary font-medium">
              Enviando arquivos...
            </span>
            <span className="text-text-secondary text-sm">
              {successCount} / {uploadedFiles.length}
            </span>
          </div>
          <div
            className="w-full bg-secondary h-2 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Progresso do envio"
          >
            <div
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h4 className="text-lg font-bold mb-4">Arquivos selecionados</h4>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {uploadedFiles.map((file) => {
              const isZip = isZipFile(file);

              return (
                <div
                  key={file.id}
                  className={`relative border rounded-lg overflow-hidden group ${
                    file.status === 'error'
                      ? 'border-danger'
                      : 'border-border'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-primary overflow-hidden">
                    {isZip ? (
                      <div className="h-full flex items-center justify-center">
                        <FileArchive className="h-12 w-12 text-text-secondary" />
                      </div>
                    ) : file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-text-secondary" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="p-2 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium text-text-primary truncate"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {formatFileSize(file.size)}
                        </p>

                        {/* SKU Detection */}
                        {file.skuDetected && (
                          <div className="mt-1">
                            <p className="text-xs bg-accent/20 text-accent px-1 rounded truncate">
                              SKU: {file.skuDetected}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Status Icon */}
                      <div className="ml-2 shrink-0">
                        {file.status === 'pending' && (
                          <Clock
                            className="h-4 w-4 text-text-secondary"
                            aria-label="Aguardando envio"
                          />
                        )}
                        {file.status === 'uploading' && (
                          <span
                            aria-label="Enviando"
                            className="block h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
                          />
                        )}
                        {file.status === 'success' && (
                          <Check
                            className="h-4 w-4 text-success"
                            aria-label="Enviado"
                          />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle
                            className="h-4 w-4 text-danger"
                            aria-label="Erro no envio"
                          />
                        )}
                      </div>
                    </div>

                    {/* Error Message */}
                    {file.error && (
                      <p className="text-xs text-danger mt-1 break-words">
                        {file.error}
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    aria-label={`Remover ${file.name}`}
                    title="Remover arquivo"
                    className="absolute top-2 right-2 p-1 bg-card/90 backdrop-blur-sm rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
