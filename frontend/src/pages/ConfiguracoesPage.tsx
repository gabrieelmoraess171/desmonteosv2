import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react';
import axios from 'axios';
import { getGreetingPeriod, getInitials } from '../utils/greeting';
import { DEFAULT_COMPANY_NAME, OWNER_HEADER } from '../config/app';
import { useAuth } from '../hooks/useAuth';

interface ConfiguracoesPageProps {
  userName: string;
  companyName: string;
  financeWhatsApp: string;
  onSaveSettings: (dados: {
    userName: string;
    companyName: string;
    financeWhatsApp: string;
  }) => void;
  onOpenMarketplaces?: () => void;
}

interface StatusMercadoLivreConfig {
  configurado: boolean;
  origemConfiguracao: 'env' | 'banco' | null;
  clientId: string;
  clientSecretConfigurado: boolean;
  redirectUri: string;
  redirectUriLocal?: boolean;
  siteId: string;
  conectado: boolean;
  conta: {
    nickname?: string | null;
    user_id?: string | null;
    site_id?: string | null;
  } | null;
}

const ML_FORM_INICIAL = {
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  siteId: 'MLB',
};

export default function ConfiguracoesPage({
  userName,
  companyName,
  financeWhatsApp,
  onSaveSettings,
  onOpenMarketplaces,
}: ConfiguracoesPageProps) {
  const [name, setName] = useState(userName);
  const [empresa, setEmpresa] = useState(companyName);
  const [whatsapp, setWhatsapp] = useState(financeWhatsApp);
  const [saved, setSaved] = useState(false);
  const { token: ownerToken, logout } = useAuth();
  const [pinAtual, setPinAtual] = useState('');
  const [pinNovo, setPinNovo] = useState('');
  const [pinErro, setPinErro] = useState('');
  const [pinAviso, setPinAviso] = useState('');
  const [pinEnviando, setPinEnviando] = useState(false);
  const [mlStatus, setMlStatus] = useState<StatusMercadoLivreConfig | null>(
    null
  );
  const [mlLoading, setMlLoading] = useState(true);
  const [mlErro, setMlErro] = useState('');
  const [mlAviso, setMlAviso] = useState('');
  const [mlSalvando, setMlSalvando] = useState(false);
  const [mlForm, setMlForm] = useState(ML_FORM_INICIAL);

  const greeting = getGreetingPeriod();
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, 40);
  const cleanEmpresa = empresa.replace(/\s+/g, ' ').trim().slice(0, 60);
  const cleanWhatsapp = whatsapp.trim().slice(0, 30);
  const hasChanges =
    cleanName !== userName.trim() ||
    cleanEmpresa !== companyName.trim() ||
    cleanWhatsapp !== financeWhatsApp.trim();
  const canSave = hasChanges;

  useEffect(() => {
    setName(userName);
    setEmpresa(companyName);
    setWhatsapp(financeWhatsApp);
  }, [userName, companyName, financeWhatsApp]);

  const carregarMercadoLivre = useCallback(async () => {
    setMlLoading(true);
    setMlErro('');

    try {
      const { data } = await axios.get<StatusMercadoLivreConfig>(
        '/api/mercadolivre/status',
        { timeout: 12000 }
      );

      setMlStatus(data);
      setMlForm((atual) => ({
        ...atual,
        clientId: '',
        clientSecret: '',
        redirectUri: data.redirectUri || atual.redirectUri,
        siteId: data.siteId || 'MLB',
      }));
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setMlErro(
          error.response?.data?.error ||
            'Não foi possível consultar a configuração do Mercado Livre.'
        );
      } else {
        setMlErro(
          'Não foi possível consultar a configuração do Mercado Livre.'
        );
      }
    } finally {
      setMlLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarMercadoLivre();
  }, [carregarMercadoLivre]);

  const salvarCredenciaisMercadoLivre = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMlSalvando(true);
    setMlErro('');
    setMlAviso('');

    try {
      await axios.post(
        '/api/mercadolivre/config',
        {
          clientId: mlForm.clientId.trim(),
          clientSecret: mlForm.clientSecret.trim(),
          redirectUri: mlForm.redirectUri.trim(),
          siteId: mlForm.siteId,
        },
        {
          headers: ownerToken ? { [OWNER_HEADER]: ownerToken } : undefined,
          timeout: 15000,
        }
      );

      setMlAviso(
        'Credenciais salvas. Abra Marketplaces e clique em “Conectar conta” para autorizar o acesso.'
      );
      await carregarMercadoLivre();
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setMlErro(
          error.response?.data?.error ||
            'Não foi possível salvar as credenciais do Mercado Livre.'
        );

        if (error.response?.status === 401) {
          void logout();
        }
      } else {
        setMlErro(
          'Não foi possível salvar as credenciais do Mercado Livre.'
        );
      }
    } finally {
      setMlSalvando(false);
    }
  };

  const alterarPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPinErro('');
    setPinAviso('');

    if (!/^\d{4,8}$/.test(pinAtual) || !/^\d{4,8}$/.test(pinNovo)) {
      setPinErro('Os dois PINs precisam ter de 4 a 8 dígitos.');
      return;
    }

    setPinEnviando(true);

    try {
      await axios.post(
        '/api/proprietario/alterar-pin',
        { pin_atual: pinAtual, pin_novo: pinNovo },
        {
          headers: ownerToken ? { [OWNER_HEADER]: ownerToken } : undefined,
          timeout: 15000,
        }
      );

      setPinAtual('');
      setPinNovo('');
      setPinAviso('PIN atualizado. Use o novo PIN no próximo acesso.');
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setPinErro(
          error.response?.data?.error || 'Não foi possível alterar o PIN.'
        );
      } else {
        setPinErro('Não foi possível alterar o PIN.');
      }
    } finally {
      setPinEnviando(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) return;

    onSaveSettings({
      userName: cleanName,
      companyName: cleanEmpresa,
      financeWhatsApp: cleanWhatsapp,
    });
    setSaved(true);
  };

  const handleResetName = () => {
    setName('');
    setEmpresa(companyName);
    setWhatsapp(financeWhatsApp);
    onSaveSettings({
      userName: '',
      companyName,
      financeWhatsApp,
    });
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" />
            Preferências
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
            Deixe o painel com a sua cara
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            Defina seu nome, o nome da empresa exibido no menu e o WhatsApp que
            recebe o fechamento financeiro.
          </p>
        </div>

        <span className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted">
          <MonitorSmartphone className="h-3.5 w-3.5" />
          Salvo neste navegador
        </span>
      </div>

      <section className="glass-panel overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-ink">Trocar o PIN</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              O PIN é a única chave do painel. Ele fica salvo com criptografia no
              servidor e pode ser trocado a qualquer momento.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void alterarPin(event)}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted">PIN atual</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pinAtual}
              onChange={(event) => {
                setPinAtual(event.target.value.replace(/\D/g, '').slice(0, 8));
                setPinErro('');
              }}
              maxLength={8}
              className="mt-1.5 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">Novo PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinNovo}
              onChange={(event) => {
                setPinNovo(event.target.value.replace(/\D/g, '').slice(0, 8));
                setPinErro('');
              }}
              maxLength={8}
              className="mt-1.5 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={pinEnviando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pinEnviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Trocar PIN
          </button>
        </form>

        {(pinErro || pinAviso) && (
          <div
            className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${
              pinErro
                ? 'border-danger/25 bg-dangerSoft text-danger'
                : 'border-success/25 bg-successSoft text-success'
            }`}
          >
            {pinErro || pinAviso}
          </div>
        )}
      </section>

        <section className="glass-panel overflow-hidden rounded-3xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                  mlStatus?.conectado
                  ? 'border-success/25 bg-successSoft text-success'
                  : 'border-warning/25 bg-warningSoft text-warning'
              }`}
            >
              <Store className="h-5 w-5" />
            </span>
            <div>
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                Credenciais do Mercado Livre
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
                Altere o Client ID, o Client Secret e a Redirect URI do
                aplicativo. As alterações valem para a próxima conexão.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    mlStatus?.conectado
                      ? 'border-success/20 bg-successSoft text-success'
                      : mlStatus?.configurado
                        ? 'border-warning/20 bg-warningSoft text-warning'
                        : 'border-danger/20 bg-dangerSoft text-danger'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {mlLoading
                    ? 'Verificando'
                    : mlStatus?.conectado
                      ? 'Conta conectada'
                      : mlStatus?.configurado
                        ? 'Aguardando conexão'
                        : 'Não configurado'}
                </span>

                {mlStatus?.configurado && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-muted">
                    Client ID {mlStatus.clientId || 'salvo'}
                  </span>
                )}

                {mlStatus?.origemConfiguracao === 'env' && (
                  <span className="rounded-full border border-warning/20 bg-warningSoft px-2.5 py-1 text-[10px] font-semibold text-warning">
                    Definidas no .env
                  </span>
                )}
              </div>
            </div>
          </div>

          {onOpenMarketplaces && (
            <button
              type="button"
              onClick={onOpenMarketplaces}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.09] hover:text-ink"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Marketplaces
            </button>
          )}
        </div>

        {(mlErro || mlAviso) && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
              mlErro
                ? 'border-danger/25 bg-dangerSoft text-danger'
                : 'border-success/25 bg-successSoft text-success'
            }`}
          >
            {mlErro || mlAviso}
          </div>
        )}

        {mlLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configuração do Mercado Livre...
          </div>
        ) : (
          <form
            onSubmit={(event) => void salvarCredenciaisMercadoLivre(event)}
            className="mt-5 grid gap-4 lg:grid-cols-2"
          >
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Client ID
              </span>
              <input
                value={mlForm.clientId}
                onChange={(event) => {
                  setMlForm((atual) => ({
                    ...atual,
                    clientId: event.target.value,
                  }));
                  setMlErro('');
                  setMlAviso('');
                }}
                placeholder={
                  mlStatus?.configurado
                    ? `Atual: ${mlStatus.clientId} — deixe em branco para manter`
                    : 'Ex.: 1234567890123456'
                }
                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Client Secret
              </span>
              <input
                type="password"
                value={mlForm.clientSecret}
                onChange={(event) => {
                  setMlForm((atual) => ({
                    ...atual,
                    clientSecret: event.target.value,
                  }));
                  setMlErro('');
                  setMlAviso('');
                }}
                placeholder={
                  mlStatus?.clientSecretConfigurado
                    ? 'Deixe em branco para manter o segredo atual'
                    : 'Cole o Client Secret do aplicativo'
                }
                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Redirect URI
              </span>
              <input
                value={mlForm.redirectUri}
                onChange={(event) => {
                  setMlForm((atual) => ({
                    ...atual,
                    redirectUri: event.target.value,
                  }));
                  setMlErro('');
                  setMlAviso('');
                }}
                placeholder="https://seu-tunel/api/mercadolivre/oauth/callback"
                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
              />
              <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                Precisa ser uma URL HTTPS pública e idêntica à cadastrada no
                aplicativo do Mercado Livre. Endereços com localhost/127.0.0.1
                são recusados pelo ML com erro 403 (CloudFront).
              </span>
            </label>

            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Site
              </span>
              <select
                value={mlForm.siteId}
                onChange={(event) =>
                  setMlForm((atual) => ({
                    ...atual,
                    siteId: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/50"
              >
                <option value="MLB">Brasil (MLB)</option>
                <option value="MLA">Argentina (MLA)</option>
                <option value="MLM">México (MLM)</option>
                <option value="MLC">Chile (MLC)</option>
                <option value="MCO">Colômbia (MCO)</option>
                <option value="MLU">Uruguai (MLU)</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <button
                type="submit"
                disabled={mlSalvando}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mlSalvando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar credenciais
              </button>
              <p className="text-[11px] leading-relaxed text-muted">
                O Client Secret nunca é exibido de volta. Em branco, o valor
                atual é mantido.
              </p>
            </div>

            {mlStatus?.origemConfiguracao === 'env' && (
              <p className="rounded-xl border border-warning/20 bg-warningSoft p-3 text-[11px] leading-relaxed text-warning lg:col-span-2">
                As credenciais atuais vêm do <code>backend/.env</code> e têm
                prioridade sobre o painel. Para usar as credenciais salvas aqui,
                remova <code>ML_CLIENT_ID</code> e <code>ML_CLIENT_SECRET</code>{' '}
                do arquivo e reinicie o backend.
              </p>
            )}
          </form>
        )}
        </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="space-y-6">
          <section className="glass-panel overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-accent via-[#6c7dff] to-cyan text-lg font-bold text-white shadow-[0_18px_40px_-20px_rgba(76,157,255,0.9)]">
                {getInitials(cleanName)}
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  <UserRound className="h-5 w-5 text-accent" />
                  Seu perfil
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {cleanName
                    ? `Você será identificado como ${cleanName}.`
                    : 'Informe seu nome para personalizar a experiência.'}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="nome-exibicao"
                className="block text-sm font-medium text-ink"
              >
                Nome de exibição
              </label>
              <p className="mt-1 text-xs text-muted">
                A inicial do nome também sugere o SKU das novas peças.
              </p>

              <input
                id="nome-exibicao"
                type="text"
                name="nome"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                maxLength={40}
                autoComplete="name"
                placeholder="Ex: Gabriel, Ana, João..."
                className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              />
            </div>

            <div className="mt-6 border-t border-white/10 pt-6">
              <label
                htmlFor="empresa-nome"
                className="flex items-center gap-2 text-sm font-medium text-ink"
              >
                <Building2 className="h-4 w-4 text-cyan" />
                Nome da empresa
              </label>
              <p className="mt-1 text-xs text-muted">
                Aparece logo abaixo de DESMONTE OS, no menu lateral.
              </p>

              <input
                id="empresa-nome"
                type="text"
                name="empresa"
                value={empresa}
                onChange={(event) => {
                  setEmpresa(event.target.value);
                  setSaved(false);
                }}
                maxLength={60}
                placeholder="Ex: Desmonte do Gabriel"
                className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              />
            </div>
          </section>

          <section className="glass-panel overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-success/20 bg-successSoft text-success">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  <Phone className="h-5 w-5 text-success" />
                  WhatsApp do financeiro
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  A aba NF-e usa este número para enviar as mensagens das vendas
                  do dia.
                </p>
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="whatsapp-financeiro"
                className="block text-sm font-medium text-ink"
              >
                Número com DDD
              </label>
              <input
                id="whatsapp-financeiro"
                type="tel"
                name="whatsapp"
                value={whatsapp}
                onChange={(event) => {
                  setWhatsapp(event.target.value);
                  setSaved(false);
                }}
                maxLength={30}
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ex: (31) 99999-9999"
                className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Pode digitar com máscara. O sistema adiciona o código do Brasil
                (+55) automaticamente ao abrir o WhatsApp.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                canSave
                  ? 'bg-accent text-white shadow-[0_14px_36px_-18px_rgba(76,157,255,0.9)] hover:-translate-y-0.5 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/[0.05] text-muted'
              }`}
            >
              <Check className="h-4 w-4" />
              Salvar configurações
            </button>

            {userName && (
              <button
                type="button"
                onClick={handleResetName}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                Remover nome
              </button>
            )}

            {saved && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-sm text-success"
              >
                <BadgeCheck className="h-4 w-4" />
                Configurações atualizadas
              </span>
            )}
          </div>

        </div>

        <section className="glass-panel h-fit rounded-3xl p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Prévia do painel
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#07111f]/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="bg-gradient-to-r from-white via-[#dcecff] to-[#8ec6ff] bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              DESMONTE OS
            </p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              {cleanEmpresa || DEFAULT_COMPANY_NAME}
            </p>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xl font-semibold tracking-[-0.03em] text-ink">
                {greeting.label}
                {cleanName ? `, ${cleanName}` : ''}
                <span
                  className="ml-2 inline-block align-middle"
                  role="img"
                  aria-label={greeting.emojiLabel}
                >
                  {greeting.emoji}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Sua saudação aparece no dashboard e o nome no rodapé do menu.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-muted">
              <MessageCircle className="h-4 w-4 text-success" />
              {cleanWhatsapp || 'WhatsApp do financeiro não configurado'}
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-muted">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent">
                <Building2 className="h-4 w-4" />
              </span>
              <p>
                O nome da empresa fica visível no topo do menu e ajuda a
                identificar a operação.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-success">
                <Phone className="h-4 w-4" />
              </span>
              <p>
                O número do financeiro fica salvo apenas neste navegador e é usado
                na aba NF-e.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-warning">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p>
                Nome da empresa e WhatsApp agora podem ser alterados direto, já
                que o PIN protege a entrada no painel.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-relaxed text-muted">
            As configurações de exibição ficam salvas localmente. Se você acessar
            de outro computador, poderá definir dados diferentes.
          </div>
        </section>
      </form>
    </div>
  );
}
