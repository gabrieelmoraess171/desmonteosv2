import { useEffect, useState } from 'react';
import {
  Home,
  Upload,
  ImagePlus,
  Package,
  ShoppingCart,
  Brain,
  Edit,
  CheckSquare,
  ShoppingBag,
  MessageSquare,
  FileText,
  BarChart,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Navigation,
  PackageCheck,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getInitials } from '../utils/greeting';
import { DEFAULT_COMPANY_NAME } from '../config/app';
import type { VendaAba } from '../types/vendas';

export type SidebarKey =
  | 'dashboard'
  | 'nova'
  | 'importar'
  | 'lotes'
  | 'vendas'
  | 'ia'
  | 'editor'
  | 'aprovacao'
  | 'marketplaces'
  | 'atendimento'
  | 'pedidos'
  | 'relatorios'
  | 'config';

export interface SidebarNavItem {
  icon: LucideIcon;
  label: string;
  key: SidebarKey;
}

export const NAV_ITEMS: SidebarNavItem[] = [
  { icon: Home, label: 'Dashboard', key: 'dashboard' },
  { icon: Upload, label: 'Nova peça', key: 'nova' },
  { icon: ImagePlus, label: 'Importar lote', key: 'importar' },
  { icon: ShoppingCart, label: 'Vendas', key: 'vendas' },
  { icon: Package, label: 'Estoque', key: 'lotes' },
  { icon: Brain, label: 'Análise com IA', key: 'ia' },
  { icon: Edit, label: 'Editor de anúncios', key: 'editor' },
  { icon: CheckSquare, label: 'Fila de aprovação', key: 'aprovacao' },
  { icon: ShoppingBag, label: 'Marketplaces', key: 'marketplaces' },
  { icon: MessageSquare, label: 'Atendimento', key: 'atendimento' },
  { icon: FileText, label: 'NF-e', key: 'pedidos' },
  { icon: BarChart, label: 'Relatórios', key: 'relatorios' },
  { icon: Settings, label: 'Configurações', key: 'config' },
];

const VENDAS_SUBMENU: Array<{
  key: VendaAba;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'hoje', label: 'Envios de hoje', icon: Truck },
  { key: 'proximos', label: 'Próximos dias', icon: CalendarClock },
  { key: 'transito', label: 'Em trânsito', icon: Navigation },
  { key: 'finalizadas', label: 'Finalizadas', icon: PackageCheck },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  activeKey: SidebarKey;
  onNavigate: (key: SidebarKey) => void;
  onLogout?: () => void;
  userName?: string;
  companyName?: string;
  badges?: Partial<Record<SidebarKey, number>>;
  vendaAba?: VendaAba;
  onNavigateVendaAba?: (aba: VendaAba) => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen = false,
  onCloseMobile,
  activeKey,
  onNavigate,
  onLogout,
  userName = '',
  companyName = '',
  badges = {},
  vendaAba = 'hoje',
  onNavigateVendaAba,
}: SidebarProps) {
  const cleanName = userName.trim();
  const displayName = cleanName || 'Operador';
  const initials = getInitials(displayName);
  const [vendasAberto, setVendasAberto] = useState(
    activeKey === 'vendas'
  );

  useEffect(() => {
    if (activeKey === 'vendas') setVendasAberto(true);
  }, [activeKey]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-line bg-sidebar shadow-2xl shadow-black/50 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:shadow-none lg:transition-[width] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'w-72 lg:w-20' : 'w-72 lg:w-64'}`}
    >
      {/* Logo */}
      <div className="border-b border-line px-4 py-5">
        <div
          className={`flex w-full items-center justify-between gap-2 ${
            collapsed ? 'lg:justify-center' : ''
          }`}
        >
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <h1 className="bg-gradient-to-r from-white via-[#dcecff] to-[#8ec6ff] bg-clip-text text-2xl font-bold leading-none tracking-tight text-transparent">
              DESMONTE OS
            </h1>
            <p className="mt-1.5 line-clamp-2 text-[10px] font-medium uppercase leading-relaxed tracking-[0.16em] text-muted">
              {companyName.trim() || DEFAULT_COMPANY_NAME}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="shrink-0 rounded-xl p-2 transition-colors hover:bg-white/[0.07] lg:hidden"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden shrink-0 rounded-xl p-2 transition-colors hover:bg-white/[0.07] lg:block"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 text-muted" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-muted" />
            )}
          </button>
        </div>
      </div>

      {/* Menu Principal */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          const badge = Number(badges[item.key] || 0);

          return (
            <div key={item.key}>
              <button
                type="button"
                onClick={() => {
                  if (item.key === 'vendas') {
                    if (activeKey === 'vendas') {
                      setVendasAberto((aberto) => !aberto);
                    } else {
                      setVendasAberto(true);
                      onNavigate('vendas');
                      onCloseMobile?.();
                    }
                    return;
                  }

                  onNavigate(item.key);
                  onCloseMobile?.();
                }}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                aria-expanded={
                  item.key === 'vendas' ? vendasAberto : undefined
                }
                title={item.label}
                className={`group relative flex w-full items-center gap-3 rounded-xl border p-3 transition-all duration-300 ${
                  collapsed ? 'lg:justify-center lg:gap-0' : ''
                } ${
                  active
                    ? 'border-white/10 bg-white/[0.09] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_34px_-22px_rgba(76,157,255,0.9)]'
                    : 'border-transparent text-muted hover:border-white/5 hover:bg-white/[0.055] hover:text-ink'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan to-accent shadow-[0_0_14px_rgba(76,157,255,0.8)]" />
                )}
                <span className="relative shrink-0">
                  <item.icon
                    className={`h-5 w-5 transition-transform duration-300 ${
                      active ? 'text-accent' : 'group-hover:scale-105'
                    }`}
                  />
                  {badge > 0 && collapsed ? (
                    <span className="absolute -right-1.5 -top-1.5 hidden h-4 min-w-4 rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white lg:inline-flex lg:items-center lg:justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-left font-medium ${
                    collapsed ? 'lg:hidden' : ''
                  }`}
                >
                  {item.label}
                </span>
                {item.key === 'vendas' ? (
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${
                      vendasAberto ? 'rotate-180' : ''
                    } ${collapsed ? 'lg:hidden' : ''}`}
                  />
                ) : null}
                {badge > 0 ? (
                  <span
                    className={`rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${
                      collapsed ? 'lg:hidden' : ''
                    }`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </button>

              {item.key === 'vendas' && vendasAberto ? (
                <div
                  className={`ml-4 mt-1 space-y-1 border-l border-white/10 pl-3 ${
                    collapsed ? 'lg:hidden' : ''
                  }`}
                >
                  {VENDAS_SUBMENU.map((sub) => {
                    const subAtivo =
                      activeKey === 'vendas' && vendaAba === sub.key;

                    return (
                      <button
                        key={sub.key}
                        type="button"
                        onClick={() => {
                          onNavigateVendaAba?.(sub.key);
                          onNavigate('vendas');
                          onCloseMobile?.();
                        }}
                        aria-current={subAtivo ? 'page' : undefined}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium transition-colors ${
                          subAtivo
                            ? 'bg-ml/10 text-ink'
                            : 'text-muted hover:bg-white/[0.05] hover:text-ink'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            subAtivo
                              ? 'bg-ml shadow-[0_0_8px_rgba(255,230,0,0.8)]'
                              : 'bg-white/20'
                          }`}
                        />
                        <sub.icon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            subAtivo ? 'text-ml' : 'text-muted'
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {sub.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Footer Sidebar */}
      <div className="border-t border-line p-3">
        <div
          className={`flex items-center ${
            collapsed ? 'lg:flex-col lg:gap-2' : 'gap-1'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('config');
              onCloseMobile?.();
            }}
            title="Editar perfil"
            className={`flex items-center rounded-xl text-left transition-colors hover:bg-white/[0.055] ${
              collapsed
                ? 'justify-center p-1 lg:flex-none'
                : 'min-w-0 flex-1 gap-3 p-1.5'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-accent via-[#6c7dff] to-cyan text-sm font-bold text-white shadow-[0_12px_30px_-18px_rgba(76,157,255,0.9)]">
              {initials}
            </span>
            <span
              className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}
            >
              <span className="block truncate text-sm font-medium text-ink">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted">
                {cleanName ? 'Gestor Online' : 'Defina seu nome'}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Sair"
            aria-label="Sair"
            className="rounded-xl p-2 transition-colors hover:bg-white/[0.07]"
          >
            <LogOut className="h-4 w-4 text-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
}
