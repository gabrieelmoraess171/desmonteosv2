import { Star } from 'lucide-react';
import {
  avaliarQualidadeMl,
  type DadosQualidadeMl,
} from '../utils/mlQualidade';

interface NotaMlBadgeProps {
  peca: DadosQualidadeMl;
  compacto?: boolean;
  className?: string;
}

export default function NotaMlBadge({
  peca,
  compacto = false,
  className = '',
}: NotaMlBadgeProps) {
  const qualidade = avaliarQualidadeMl(peca);
  const titulo = qualidade.semAnuncio
    ? qualidade.detalhe
    : `${qualidade.detalhe}${
        qualidade.pontos.length
          ? ` Para melhorar: ${qualidade.pontos.join(', ')}.`
          : ''
      }`;

  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        qualidade.semAnuncio
          ? 'border-white/10 bg-white/[0.04] text-muted'
          : qualidade.badge
      } ${className}`}
    >
      <Star
        className="h-3 w-3 shrink-0"
        fill="currentColor"
        aria-hidden="true"
      />
      {qualidade.semAnuncio
        ? compacto
          ? 'ML —'
          : 'Sem anúncio ML'
        : compacto
          ? `ML ${qualidade.nota}`
          : `${qualidade.nota}/100 · ${qualidade.label}`}
    </span>
  );
}
