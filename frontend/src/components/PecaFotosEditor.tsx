import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import axios from 'axios';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
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
  origem?: 'local' | 'mercado_livre';
}

interface PecaFotosEditorProps {
  pecaId: number;
  mlItemId?: string | null;
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
  mlItemId,
  onChange,
}: PecaFotosEditorProps) {
  const [imagens, setImagens] = useState<PecaImagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imagemArrastada, setImagemArrastada] = useState<number | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
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
      const locais = response.data.map((imagem) => ({
        ...imagem,
        origem: 'local' as const,
      }));
      let remotas: PecaImagem[] = [];

      if (mlItemId) {
        try {
          const mercadoLivre = await axios.get<{ imagens?: string[] }>(
            `/api/mercadolivre/pecas/${pecaId}/imagens`,
            { timeout: 20000 }
          );
          remotas = (mercadoLivre.data.imagens || []).map((caminho, indice) => ({
            id: -(indice + 1),
            caminho,
            nome_arquivo: `Foto do Mercado Livre ${indice + 1}`,
            is_principal: indice === 0 ? 1 : 0,
            ordem: indice,
            origem: 'mercado_livre' as const,
          }));
        } catch {
          // As fotos locais continuam disponíveis mesmo se o ML estiver lento.
        }
      }

      setImagens([...remotas, ...locais]);
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || 'Erro ao carregar as fotos');
      } else {
        setError('Erro ao carregar as fotos');
      }
    } finally {
      setLoading(false);
    }
  }, [mlItemId, pecaId]);

  useEffect(() => {
    fetchImagens();
  }, [fetchImagens]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || uploading) return;

    const fotosLocais = imagens.filter(
      (imagem) => imagem.origem !== 'mercado_livre'
    );
    const disponiveis = MAX_FOTOS - fotosLocais.length;

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

      await fetchImagens();
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
    const imagem = imagens.find((item) => item.id === imagemId);
    if (imagem?.origem === 'mercado_livre') return;
    if (uploading) return;
    setUploading(true);

    try {
      const response = await axios.patch<{
        message: string;
        imagens: PecaImagem[];
      }>(`/api/pecas/${pecaId}/imagens/${imagemId}/principal`);

      await fetchImagens();
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
    if (imagem.origem === 'mercado_livre') {
      setError(
        'As fotos do Mercado Livre são exibidas aqui e não podem ser removidas por este botão.'
      );
      return;
    }
    if (uploading) return;
    if (!confirm('Remover esta foto da peça?')) return;

    setUploading(true);

    try {
      const response = await axios.delete<{
        message: string;
        imagens: PecaImagem[];
      }>(`/api/pecas/${pecaId}/imagens/${imagem.id}`);

      await fetchImagens();
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

  const moverImagem = async (origemId: number, destinoId: number) => {
    const locais = imagens.filter((imagem) => imagem.origem !== 'mercado_livre');
    const origem = locais.findIndex((imagem) => imagem.id === origemId);
    const destino = locais.findIndex((imagem) => imagem.id === destinoId);
    if (origem < 0 || destino < 0 || origem === destino || uploading || sincronizando) return;

    const reordenadas = [...locais];
    const [movida] = reordenadas.splice(origem, 1);
    reordenadas.splice(destino, 0, movida);
    setImagens([...imagens.filter((imagem) => imagem.origem === 'mercado_livre'), ...reordenadas]);
    setSincronizando(true);
    setError('');

    try {
      const response = await axios.patch<{ imagens: PecaImagem[]; aviso?: string }>(
        `/api/pecas/${pecaId}/imagens/ordem`,
        { ids: reordenadas.map((imagem) => imagem.id), sincronizarMl: Boolean(mlItemId) }
      );
      setImagens(response.data.imagens.map((imagem) => ({ ...imagem, origem: 'local' })));
      if (response.data.aviso) setError(response.data.aviso);
      onChange?.();
    } catch (err) {
      await fetchImagens();
      setError(
        axios.isAxiosError<{ error?: string }>(err)
          ? err.response?.data?.error || 'Não foi possível mover a foto.'
          : 'Não foi possível mover a foto.'
      );
    } finally {
      setSincronizando(false);
      setImagemArrastada(null);
    }
  };

  const handleDropImagem = (event: DragEvent<HTMLDivElement>, destinoId: number) => {
    event.preventDefault();
    if (imagemArrastada !== null) void moverImagem(imagemArrastada, destinoId);
  };

  const moverComBotao = (imagemId: number, direcao: -1 | 1) => {
    const locais = imagens.filter((imagem) => imagem.origem !== 'mercado_livre');
    const indice = locais.findIndex((imagem) => imagem.id === imagemId);
    const destino = indice + direcao;
    if (indice < 0 || destino < 0 || destino >= locais.length) return;
    void moverImagem(imagemId, locais[destino].id);
  };

  const limiteAtingido =
    imagens.filter((imagem) => imagem.origem !== 'mercado_livre').length >=
    MAX_FOTOS;

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
          {uploading ? 'Enviando...' : sincronizando ? 'Sincronizando ML...' : 'Adicionar fotos'}
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
              draggable={imagem.origem !== 'mercado_livre' && !uploading && !sincronizando}
              onDragStart={() => setImagemArrastada(imagem.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropImagem(event, imagem.id)}
              className="group relative cursor-grab overflow-hidden rounded-lg border border-line bg-secondary active:cursor-grabbing"
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

              {imagem.origem === 'mercado_livre' && (
                <span className="absolute right-1 top-1 rounded bg-cyan/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  ML
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                {imagem.origem !== 'mercado_livre' && (
                  <span className="rounded bg-black/60 px-1.5 py-1 text-[9px] font-semibold text-white">
                    Arraste para mover
                  </span>
                )}
                <span className="flex gap-1">
                {imagem.origem !== 'mercado_livre' && (
                  <>
                    <button
                      type="button"
                      onClick={() => moverComBotao(imagem.id, -1)}
                      disabled={uploading || sincronizando}
                      title="Mover foto para a esquerda"
                      aria-label="Mover foto para a esquerda"
                      className="rounded-full bg-card/90 p-1.5 text-ink hover:bg-card disabled:opacity-50"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverComBotao(imagem.id, 1)}
                      disabled={uploading || sincronizando}
                      title="Mover foto para a direita"
                      aria-label="Mover foto para a direita"
                      className="rounded-full bg-card/90 p-1.5 text-ink hover:bg-card disabled:opacity-50"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </>
                )}
                {imagem.origem !== 'mercado_livre' && imagem.is_principal !== 1 && (
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
                {imagem.origem !== 'mercado_livre' && (
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
                )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
