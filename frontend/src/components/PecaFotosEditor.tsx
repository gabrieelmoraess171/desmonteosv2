import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ChangeEvent,
} from 'react';
import axios from 'axios';
import {
  AlertCircle,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
} from 'lucide-react';

interface PecaImagem {
  id: number;
  caminho: string;
  nome_arquivo?: string | null;
  is_principal: number;
  ordem: number;
}

interface PecaFotosEditorProps {
  pecaId: number;
  onChange?: () => void;
}

const MAX_FOTOS = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

export default function PecaFotosEditor({
  pecaId,
  onChange,
}: PecaFotosEditorProps) {
  const [imagens, setImagens] = useState<PecaImagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();

  const fetchImagens = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get<PecaImagem[]>(
        `/api/pecas/${pecaId}/imagens`,
        { timeout: 10000 }
      );
      setImagens(response.data);
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || 'Erro ao carregar as fotos');
      } else {
        setError('Erro ao carregar as fotos');
      }
    } finally {
      setLoading(false);
    }
  }, [pecaId]);

  useEffect(() => {
    fetchImagens();
  }, [fetchImagens]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || uploading) return;

    const disponiveis = MAX_FOTOS - imagens.length;

    if (disponiveis <= 0) {
      setError(`Limite de ${MAX_FOTOS} fotos atingido.`);
      return;
    }

    const validas = files.filter(
      (file) => IMAGE_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE
    );

    if (validas.length !== files.length) {
      setError('Use JPG, PNG, WEBP, GIF ou BMP de até 10 MB cada.');
    }

    const selecionadas = validas.slice(0, disponiveis);

    if (selecionadas.length === 0) return;

    const payload = new FormData();
    selecionadas.forEach((file) => payload.append('fotos', file));

    setUploading(true);

    try {
      const response = await axios.post<{
        message: string;
        imagens: PecaImagem[];
      }>(`/api/pecas/${pecaId}/imagens`, payload, { timeout: 60000 });

      setImagens(response.data.imagens);
      setError('');
      onChange?.();
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || 'Erro ao enviar as fotos');
      } else {
        setError('Erro ao enviar as fotos');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrincipal = async (imagemId: number) => {
    if (uploading) return;
    setUploading(true);

    try {
      const response = await axios.patch<{
        message: string;
        imagens: PecaImagem[];
      }>(`/api/pecas/${pecaId}/imagens/${imagemId}/principal`);

      setImagens(response.data.imagens);
      setError('');
      onChange?.();
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(
          err.response?.data?.error || 'Erro ao definir a foto principal'
        );
      } else {
        setError('Erro ao definir a foto principal');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imagem: PecaImagem) => {
    if (uploading) return;
    if (!confirm('Remover esta foto da peça?')) return;

    setUploading(true);

    try {
      const response = await axios.delete<{
        message: string;
        imagens: PecaImagem[];
      }>(`/api/pecas/${pecaId}/imagens/${imagem.id}`);

      setImagens(response.data.imagens);
      setError('');
      onChange?.();
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || 'Erro ao remover a foto');
      } else {
        setError('Erro ao remover a foto');
      }
    } finally {
      setUploading(false);
    }
  };

  const limiteAtingido = imagens.length >= MAX_FOTOS;

  return (
    <div className="border-t border-line pt-4 mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-accent" />
            Fotos do produto
          </h4>
          <p className="text-xs text-muted">
            {imagens.length}/{MAX_FOTOS} fotos • a capa vai para o anúncio
          </p>
        </div>

        <label
          htmlFor={inputId}
          aria-disabled={limiteAtingido || uploading}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            limiteAtingido || uploading
              ? 'bg-secondary text-muted cursor-not-allowed'
              : 'bg-accent text-white hover:brightness-110 cursor-pointer'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {uploading ? 'Enviando...' : 'Adicionar fotos'}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
          onChange={handleUpload}
          disabled={limiteAtingido || uploading}
          className="hidden"
        />
      </div>

      {error && (
        <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando fotos...
        </div>
      ) : imagens.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-secondary/30 px-3 py-4 text-sm text-muted">
          <ImageIcon className="h-5 w-5" />
          Nenhuma foto cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {imagens.map((imagem) => (
            <div
              key={imagem.id}
              className="group relative overflow-hidden rounded-lg border border-line bg-secondary"
            >
              <div className="aspect-square">
                <img
                  src={imagem.caminho}
                  alt={imagem.nome_arquivo || 'Foto da peça'}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

              {imagem.is_principal === 1 && (
                <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  <Star className="h-2.5 w-2.5" />
                  Capa
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                {imagem.is_principal !== 1 && (
                  <button
                    type="button"
                    onClick={() => handleSetPrincipal(imagem.id)}
                    disabled={uploading}
                    title="Definir como capa"
                    aria-label="Definir como capa"
                    className="rounded-full bg-card/90 p-1.5 text-warning hover:bg-card disabled:opacity-50"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(imagem)}
                  disabled={uploading}
                  title="Remover foto"
                  aria-label="Remover foto"
                  className="rounded-full bg-card/90 p-1.5 text-danger hover:bg-card disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
