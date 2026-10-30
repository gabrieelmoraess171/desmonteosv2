import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, MessageCircleQuestion, ShoppingCart } from 'lucide-react';

export interface NotificacaoItem {
  id: string;
  tipo: 'venda' | 'pergunta' | 'reclamacao';
  titulo: string;
  detalhe: string;
  data?: string | null;
  destino: 'vendas' | 'atendimento';
  vendaId?: number;
}

interface NotificacoesBellProps {
  itens: NotificacaoItem[];
  naoLidas: number;
  onAbrir: (item: NotificacaoItem) => void;
  onMarcarLidas: () => void;
}

function formatarHora(valor?: string | null): string {
  if (!valor) return '';
  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '';

  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificacoesBell({
  itens,
  naoLidas,
  onAbrir,
  onMarcarLidas,
}: NotificacoesBellProps) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (!caixaRef.current?.contains(event.target as Node)) {
        setAberto(false);
      }
    };

    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setAberto((valor) => !valor);
          if (!aberto) onMarcarLidas();
        }}
        className="relative inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-muted transition-colors hover:text-ink"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          className="absolute right-0 z-[100] mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-line bg-sidebar shadow-2xl"
          style={{
            backgroundColor: 'rgba(7, 15, 28, 0.98)',
            backgroundImage: 'none',
          }}
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">Notificações</p>
            <p className="text-[11px] text-muted">
              Vendas novas e reclamações do Mercado Livre
            </p>
          </div>
          {itens.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nenhuma notificação recente.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {itens.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAbrir(item);
                      setAberto(false);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <span
                      className={`mt-0.5 rounded-lg p-1.5 ${
                      item.tipo === 'venda'
                          ? 'bg-successSoft text-success'
                        : item.tipo === 'reclamacao'
                          ? 'bg-dangerSoft text-danger'
                          : 'bg-accentSoft text-accent'
                      }`}
                    >
                      {item.tipo === 'venda' ? (
                        <ShoppingCart className="h-4 w-4" />
                      ) : item.tipo === 'reclamacao' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <MessageCircleQuestion className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.titulo}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {item.detalhe}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {formatarHora(item.data)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
