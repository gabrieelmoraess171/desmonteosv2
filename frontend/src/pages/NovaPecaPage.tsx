import { useState } from 'react';
import {
  BadgeCheck,
  Camera,
  Car,
  ChevronRight,
  FileText,
  Package,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import ModalCadastroPeca from '../components/ModalCadastroPeca';

interface NovaPecaPageProps {
  onSuccess: () => void;
}

const RECURSOS = [
  {
    icon: Tag,
    titulo: 'SKU automático',
    descricao: 'Sugestão com a inicial do nome configurado em Configurações.',
  },
  {
    icon: Car,
    titulo: 'Compatibilidade completa',
    descricao: 'Marca, modelo, ano, OEM e aplicação para evitar devoluções.',
  },
  {
    icon: FileText,
    titulo: 'Ficha por categoria',
    descricao: 'Atributos específicos de retrovisor, farol, motor e muito mais.',
  },
  {
    icon: Camera,
    titulo: 'Até 20 fotos',
    descricao: 'Fotos organizadas com capa definida para o anúncio do ML.',
  },
];

export default function NovaPecaPage({ onSuccess }: NovaPecaPageProps) {
  const [modalAberto, setModalAberto] = useState(true);

  return (
    <div className="space-y-6">
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Cadastro completo
            </span>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Um anúncio forte começa com uma ficha completa
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Preencha os dados que o Mercado Livre usa para mostrar, filtrar e
              vender a peça. O formulário completo já abre em tela ampla para
              você começar pelo título e pelas fotos.
            </p>

            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Abrir cadastro de peça
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                Ficha padrão Mercado Livre
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                Categoria detectada automaticamente
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                Cada peça = 1 anúncio
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Antes de começar</p>
                <p className="text-xs text-muted">Tenha estas informações em mãos</p>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {[
                'Nome e aplicação da peça',
                'Código OEM ou referência',
                'Peso e medidas para o frete',
                'Fotos reais da peça (até 20)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RECURSOS.map((recurso) => (
          <div
            key={recurso.titulo}
            className="group rounded-2xl border border-line bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent transition-transform duration-300 group-hover:scale-105">
              <recurso.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-semibold">{recurso.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {recurso.descricao}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Tudo pronto para cadastrar?</h3>
            <p className="mt-1 text-sm text-muted">
              O cadastro abre em uma ficha completa, em tela ampla, com leitura
              das fotos por IA, classificação automática e prévia do SKU.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accentSoft px-5 py-3 text-sm font-semibold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent/20"
          >
            <Plus className="h-4 w-4" />
            Nova peça
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
