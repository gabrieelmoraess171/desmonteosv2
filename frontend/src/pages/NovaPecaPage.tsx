import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import ModalCadastroPeca from '../components/ModalCadastroPeca';

interface NovaPecaPageProps {
  onSuccess: () => void;
}

export default function NovaPecaPage({ onSuccess }: NovaPecaPageProps) {
  const [modalAberto, setModalAberto] = useState(true);

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Cadastro completo
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
              Cadastrar nova peça
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Envie as fotos primeiro. A IA lê a etiqueta, a peça e as medidas e
              preenche os dados que o Mercado Livre exige.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Abrir cadastro
          </button>
        </div>
      </section>

      <ModalCadastroPeca
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={onSuccess}
      />
    </div>
  );
}
