import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface BlocoProps {
  id: string;
  titulo: string;
  descricao?: string;
  icone: ReactNode;
  aberto: boolean;
  onToggle: (aberto: boolean) => void;
  resumo?: ReactNode;
  pendencias?: number;
  concluido?: boolean;
  children: ReactNode;
}

export default function Bloco({
  id,
  titulo,
  descricao,
  icone,
  aberto,
  onToggle,
  resumo,
  pendencias = 0,
  concluido = false,
  children,
}: BlocoProps) {
  const conteudoRef = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | undefined>(aberto ? undefined : 0);

  useEffect(() => {
    const elemento = conteudoRef.current;
    if (!elemento) return;

    if (aberto) {
      setAltura(elemento.scrollHeight);
      const timer = window.setTimeout(() => setAltura(undefined), 220);
      return () => window.clearTimeout(timer);
    }

    setAltura(elemento.scrollHeight);
    const frame = window.requestAnimationFrame(() => setAltura(0));
    return () => window.cancelAnimationFrame(frame);
  }, [aberto]);

  return (
    <section
      id={`bloco-${id}`}
      data-aberto={aberto}
      className="scroll-mt-20 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]"
    >
      <button
        type="button"
        onClick={() => onToggle(!aberto)}
        aria-expanded={aberto}
        aria-controls={`bloco-${id}-conteudo`}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-white/[0.04] sm:p-4"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accentSoft text-accent">
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink sm:text-base">
            {titulo}
          </span>
          {descricao && !aberto && (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              {descricao}
            </span>
          )}
          {resumo && !aberto && (
            <span className="mt-1 block truncate text-xs text-muted">{resumo}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {pendencias > 0 ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              {pendencias} {pendencias === 1 ? 'pendência' : 'pendências'}
            </span>
          ) : concluido ? (
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              Completo
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-muted transition-transform duration-200 ${
              aberto ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      <div
        ref={conteudoRef}
        id={`bloco-${id}-conteudo`}
        style={{ height: altura }}
        className="overflow-hidden transition-[height] duration-200 ease-out"
        aria-hidden={!aberto}
      >
        <div className="border-t border-white/10 p-3 sm:p-4">{children}</div>
      </div>
    </section>
  );
}
