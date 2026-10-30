import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  Image as ImageIcon,
  ImagePlus,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';

export interface FotoSelecionada {
  id: string;
  file: File;
  preview: string;
  grupo?: 'sku' | 'produto' | 'medidas' | 'codigo';
}

interface ProductPhotoPickerProps {
  photos: FotoSelecionada[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
  maxPhotos?: number;
  maxFileSizeMB?: number;
  disabled?: boolean;
  heading?: string;
  description?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProductPhotoPicker({
  photos,
  onAddFiles,
  onRemove,
  onMakeCover,
  maxPhotos = 10,
  maxFileSizeMB = 10,
  disabled = false,
  heading = 'Fotos do produto',
  description = 'Arraste imagens ou selecione. JPG, PNG, WEBP, GIF ou BMP, até',
}: ProductPhotoPickerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const dragDepth = useRef(0);
  const inputId = useId();

  const remainingSlots = Math.max(0, maxPhotos - photos.length);
  const selectionDisabled = disabled || remainingSlots === 0;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      if (disabled) {
        setValidationMessage('Aguarde o cadastro terminar.');
        return;
      }

      if (remainingSlots === 0) {
        setValidationMessage(`Limite de ${maxPhotos} fotos atingido.`);
        return;
      }

      const imagens = files.filter((file) => file.type.startsWith('image/'));
      const validas = imagens.filter((file) => file.size <= maxFileSizeBytes);
      const novas = validas
        .filter(
          (file) =>
            !photos.some(
              (foto) =>
                foto.file.name === file.name &&
                foto.file.size === file.size &&
                foto.file.lastModified === file.lastModified
            )
        )
        .slice(0, remainingSlots);

      const erros: string[] = [];

      if (imagens.length !== files.length) {
        erros.push('Alguns arquivos foram ignorados: envie apenas imagens.');
      }

      if (validas.length !== imagens.length) {
        erros.push(`Cada foto deve ter no máximo ${maxFileSizeMB} MB.`);
      }

      if (novas.length < validas.length) {
        erros.push('Fotos repetidas ou excedentes não foram adicionadas.');
      }

      setValidationMessage(erros.join(' '));

      if (novas.length > 0) {
        onAddFiles(novas);
      }
    },
    [
      disabled,
      maxFileSizeBytes,
      maxFileSizeMB,
      maxPhotos,
      onAddFiles,
      photos,
      remainingSlots,
    ]
  );

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = selectionDisabled ? 'none' : 'copy';
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);

    if (event.dataTransfer.files.length > 0) {
      handleFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    handleFiles(files);
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
          dragActive
            ? 'border-accent bg-accentSoft'
            : 'border-line bg-secondary/40'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-card border border-line text-accent shrink-0">
            <ImagePlus className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink">{heading}</p>
            <p className="text-sm text-muted">
              {description}{' '}
              {maxFileSizeMB} MB cada.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted whitespace-nowrap">
              {photos.length}/{maxPhotos}
            </span>
            <label
              htmlFor={inputId}
              aria-disabled={selectionDisabled}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectionDisabled
                  ? 'bg-secondary text-muted cursor-not-allowed'
                  : 'bg-accent text-white hover:brightness-110 cursor-pointer'
              }`}
            >
              <Upload className="h-4 w-4" />
              Adicionar fotos
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
              onChange={handleChange}
              disabled={selectionDisabled}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {validationMessage && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-warning"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{validationMessage}</span>
        </p>
      )}

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {photos.map((foto, index) => (
            <div
              key={foto.id}
              className="group relative overflow-hidden rounded-lg border border-line bg-card"
            >
              <div className="aspect-square bg-primary">
                <img
                  src={foto.preview}
                  alt={foto.file.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {index === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  <Star className="h-3 w-3" />
                  Capa
                </span>
              )}

              <div className="p-2">
                <p
                  className="truncate text-xs font-medium"
                  title={foto.file.name}
                >
                  {foto.file.name}
                </p>
                <p className="text-[11px] text-muted">
                  {formatFileSize(foto.file.size)}
                </p>
              </div>

              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => onMakeCover(foto.id)}
                    disabled={disabled}
                    title="Usar como capa"
                    aria-label={`Usar ${foto.file.name} como capa`}
                    className="rounded-full bg-card/90 border border-line p-1.5 text-warning hover:bg-card disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(foto.id)}
                  disabled={disabled}
                  title="Remover foto"
                  aria-label={`Remover ${foto.file.name}`}
                  className="rounded-full bg-card/90 border border-line p-1.5 text-danger hover:bg-card disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card/50 py-6 text-sm text-muted">
          <ImageIcon className="h-5 w-5" />
          Nenhuma foto selecionada ainda
        </div>
      )}
    </div>
  );
}
