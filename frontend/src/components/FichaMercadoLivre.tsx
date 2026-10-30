import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Search } from 'lucide-react';

export interface ConfigAnuncioMl {
  compatibilities?: Array<{ attributes: Record<string, string>; note?: string; positions?: Array<{ value_id: string; value_name: string }> }>;
  family_name?: string;
  sale_terms?: Record<string, string>;
  shipping?: { mode?: string; free_shipping?: boolean; local_pick_up?: boolean };
  catalog_product_id?: string;
  official_store_id?: string;
}
interface CampoMl {
  id: string; name: string; value_type?: string; value_max_length?: number;
  tags?: Record<string, boolean>;
  values?: Array<{ id: string; name: string }>;
  allowed_units?: Array<{ id: string; name: string }>;
}
interface FichaMl {
  categoria: { id: string; name: string; path_from_root?: Array<{ id: string; name: string }>; children_categories?: Array<{ id: string; name: string }>; settings?: { max_pictures_per_item?: number; max_title_length?: number } };
  atributos: CampoMl[]; termos: CampoMl[];
}

function Campo({ campo, valor, onChange }: { campo: CampoMl; valor: string; onChange: (valor: string) => void }) {
  const requerido = campo.tags?.required || campo.tags?.new_required;
  return <label className="block min-w-0 text-xs">
    <span className="mb-1 flex flex-wrap items-center gap-1 font-medium">{campo.name}
      {requerido && <span className="text-warning">*</span>}
      {campo.tags?.conditional_required && <span className="text-[10px] text-muted">condicional</span>}
    </span>
    <input value={valor} onChange={(event) => onChange(event.target.value)}
      list={`ml-opcoes-${campo.id}`} disabled={campo.tags?.read_only || campo.tags?.fixed && campo.values?.length === 1}
      maxLength={campo.value_max_length || 255} aria-required={Boolean(campo.tags?.required)}
      placeholder={campo.value_type === 'number_unit' ? `Número e unidade (${campo.allowed_units?.map((unit) => unit.name).join(', ') || 'conforme a categoria'})` : 'Selecione ou digite'}
      className="w-full rounded-lg border border-line bg-primary px-2.5 py-2 text-xs disabled:opacity-60" />
    <datalist id={`ml-opcoes-${campo.id}`}>{campo.values?.map((opcao) => <option key={opcao.id} value={opcao.name} />)}
      {campo.tags?.allow_na && <option value="-1">Não se aplica</option>}
    </datalist>
    {campo.tags?.new_required && !campo.tags.required && <span className="text-[10px] text-muted">Obrigatório para produtos novos.</span>}
  </label>;
}

export default function FichaMercadoLivre({ categoryId, titulo, atributos, config, onCategoria, onAtributos, onConfig }: {
  categoryId: string; titulo: string; atributos: Record<string, string>; config: ConfigAnuncioMl;
  onCategoria: (id: string, nome: string) => void;
  onAtributos: (atributos: Record<string, string>) => void;
  onConfig: (config: ConfigAnuncioMl) => void;
}) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<Array<{ category_id?: string; category_name?: string; id?: string; name?: string }>>([]);
  const [ficha, setFicha] = useState<FichaMl | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [mostrarAvancados, setMostrarAvancados] = useState(false);
  useEffect(() => {
    setFicha(null);
    if (!categoryId) return;
    const controller = new AbortController();
    setCarregando(true); setErro('');
    axios.get<FichaMl>(`/api/mercadolivre/cadastro/categorias/${categoryId}`, { signal: controller.signal })
      .then(({ data }) => setFicha(data))
      .catch((error) => { if (!controller.signal.aborted) setErro(error.response?.data?.error || 'Não foi possível consultar a ficha oficial.'); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [categoryId]);
  const pesquisar = async (raiz = false) => {
    setCarregando(true); setErro('');
    try {
      const { data } = await axios.get('/api/mercadolivre/cadastro/categorias', { params: raiz ? {} : { busca: busca || titulo } });
      setOpcoes(data);
    } catch (error) { setErro(axios.isAxiosError(error) ? error.response?.data?.error || 'Não foi possível buscar categorias.' : 'Não foi possível buscar categorias.'); }
    finally { setCarregando(false); }
  };
  const campos = (ficha?.atributos || []).filter((campo) => !campo.tags?.read_only && !['ITEM_CONDITION', 'SELLER_SKU'].includes(campo.id));
  const preencher = (campo: CampoMl, valor: string) => onAtributos({ ...atributos, [campo.id]: valor });
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <input value={busca} onChange={(event) => setBusca(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void pesquisar(); } }} placeholder="Busque a categoria pelo nome da peça" className="min-w-0 flex-1 rounded-lg border border-line bg-primary px-3 py-2 text-xs" />
      <button type="button" onClick={() => void pesquisar()} disabled={carregando} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"><Search className="h-3 w-3" />Buscar no ML</button>
      <button type="button" onClick={() => void pesquisar(true)} className="rounded-lg border border-line px-3 py-2 text-xs">Todas as categorias</button>
    </div>
    <div className="flex flex-wrap gap-1.5">{opcoes.map((opcao) => <button key={opcao.category_id || opcao.id} type="button" onClick={() => { onCategoria(opcao.category_id || opcao.id || '', opcao.category_name || opcao.name || ''); setOpcoes([]); }} className="rounded-lg border border-accent/30 bg-accentSoft px-2 py-1.5 text-xs text-accent">{opcao.category_name || opcao.name}</button>)}</div>
    {carregando && <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" />Consultando Mercado Livre…</p>}
    {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
    {ficha && <>
      <div className="rounded-lg border border-accent/20 bg-accentSoft p-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1">{ficha.categoria.path_from_root?.map((item) => <button type="button" key={item.id} onClick={() => onCategoria(item.id, item.name)} className="text-accent hover:underline">{item.name} /</button>)}</div>
        <p className="mt-1 text-muted">{categoryId} · Até {ficha.categoria.settings?.max_pictures_per_item ?? '—'} fotos · {campos.filter((campo) => campo.tags?.required).length} atributos obrigatórios. * Consulte também os campos condicionais.</p>
      </div>
      {!!ficha.categoria.children_categories?.length && <div className="flex flex-wrap gap-2">{ficha.categoria.children_categories.map((categoria) => <button type="button" key={categoria.id} onClick={() => onCategoria(categoria.id, categoria.name)} className="rounded-lg border border-line px-2 py-1 text-xs">{categoria.name}</button>)}</div>}
      <label className="block text-xs font-medium">Nome da família do produto
        <input value={config.family_name || ''} onChange={(event) => onConfig({ ...config, family_name: event.target.value })} placeholder={titulo || 'Nome genérico do produto para o novo modelo de anúncios'} maxLength={ficha.categoria.settings?.max_title_length || 60} className="mt-1 w-full rounded-lg border border-line bg-primary px-2.5 py-2 text-xs" />
        <span className="mt-1 block text-[10px] font-normal text-muted">Usado automaticamente nas contas com o novo modelo de anúncios. Se vazio, usa o título informado.</span>
      </label>
      <input value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="Filtrar características (marca, posição, material…)" className="w-full rounded-lg border border-line bg-primary px-3 py-2 text-xs" />
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={mostrarAvancados} onChange={(event) => setMostrarAvancados(event.target.checked)} />Mostrar também atributos avançados da categoria</label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...campos].sort((a, b) => Number(Boolean(b.tags?.required)) - Number(Boolean(a.tags?.required))).filter((campo) => (!campo.tags?.hidden || mostrarAvancados || campo.tags.required || campo.tags.conditional_required) && campo.name.toLowerCase().includes(filtro.toLowerCase())).map((campo) => <Campo key={campo.id} campo={campo} valor={atributos[campo.id] || (campo.tags?.fixed && campo.values?.length === 1 ? campo.values[0].name : '')} onChange={(valor) => preencher(campo, valor)} />)}</div>
      {!!ficha.termos.length && <><h4 className="border-t border-line pt-3 text-sm font-semibold">Garantia e condições de venda</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ficha.termos.filter((campo) => !campo.tags?.read_only && (mostrarAvancados || campo.tags?.required || ['WARRANTY_TYPE', 'WARRANTY_TIME', 'MANUFACTURING_TIME', 'INVOICE'].includes(campo.id))).map((campo) => <Campo key={campo.id} campo={campo} valor={config.sale_terms?.[campo.id] || ''} onChange={(valor) => onConfig({ ...config, sale_terms: { ...config.sale_terms, [campo.id]: valor } })} />)}</div></>}
    </>}
    <h4 className="border-t border-line pt-3 text-sm font-semibold">Envio e catálogo</h4>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs">Modalidade de envio<select value="not_specified" disabled className="mt-1 w-full rounded-lg border border-line bg-primary p-2 disabled:opacity-70"><option value="not_specified">Por conta do comprador</option></select></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={false} disabled />Frete por conta do comprador</label>
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={false} disabled />Retirada pessoalmente desativada</label>
      <label className="text-xs">Produto do catálogo (opcional)<input value={config.catalog_product_id || ''} onChange={(event) => onConfig({ ...config, catalog_product_id: event.target.value })} placeholder="MLB…" className="mt-1 w-full rounded-lg border border-line bg-primary p-2" /></label>
      <label className="text-xs">Loja oficial (se aplicável)<input value={config.official_store_id || ''} onChange={(event) => onConfig({ ...config, official_store_id: event.target.value })} inputMode="numeric" placeholder="ID da sua loja oficial" className="mt-1 w-full rounded-lg border border-line bg-primary p-2" /></label>
    </div>
    <p className="text-[11px] text-muted">A disponibilidade do frete, catálogo e condições depende da conta e categoria. A aprovação verifica o anúncio na API antes de publicar.</p>
  </div>;
}

export function CompatibilidadeMl({ config, onConfig, categoryId }: { config: ConfigAnuncioMl; onConfig: (config: ConfigAnuncioMl) => void; categoryId: string }) {
  const [campos, setCampos] = useState<CampoMl[]>([]);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [posicoes, setPosicoes] = useState<Array<{ value_id: string; value_name: string }>>([]);
  useEffect(() => {
    setPosicoes([]);
    if (!aberto || !categoryId) return;
    const controller = new AbortController();
    axios.get(`/api/mercadolivre/cadastro/categorias/${categoryId}`, { signal: controller.signal })
      .then(({ data }) => setPosicoes(data.restricoes?.attributes_values?.find((campo: { attribute_id: string }) => campo.attribute_id === 'POSITION')?.values || []))
      .catch(() => {});
    return () => controller.abort();
  }, [aberto, categoryId]);
  const comuns = ['BRAND', 'CAR_AND_VAN_MODEL', 'YEAR', 'CAR_AND_VAN_SUBMODEL', 'CAR_AND_VAN_ENGINE', 'TRANSMISSION_CONTROL_TYPE', 'BODY_DOORS_NUMBER', 'DRIVE_TYPE'];
  useEffect(() => {
    if (!aberto || campos.length) return;
    const controller = new AbortController();
    axios.get<{ atributos: CampoMl[] }>('/api/mercadolivre/cadastro/veiculos', { signal: controller.signal })
      .then(({ data }) => { setCampos(data.atributos); setErro(''); })
      .catch((error) => { if (!controller.signal.aborted) setErro(error.response?.data?.error || 'Não foi possível carregar os campos de veículos.'); });
    return () => controller.abort();
  }, [aberto, campos.length]);
  const veiculos = config.compatibilities || [];
  const mudar = (indice: number, chave: string, valor: string) => onConfig({ ...config, compatibilities: veiculos.map((veiculo, atual) => atual === indice ? { ...veiculo, attributes: { ...veiculo.attributes, [chave]: valor } } : veiculo) });
  return <details open={aberto} onToggle={(event) => setAberto(event.currentTarget.open)} className="mt-3 rounded-xl border border-line p-3">
    <summary className="cursor-pointer text-sm font-semibold">Veículos compatíveis no Mercado Livre ({veiculos.length})</summary>
    <p className="my-2 text-[11px] text-muted">Informe marca, modelo, ano, versão e motor com precisão. Estes grupos são enviados como compatibilidades do vendedor após a aprovação. As sugestões do catálogo devem ser revisadas no gerenciador do Mercado Livre.</p>
    {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
    <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar outros campos do veículo (combustível, freios…)" className="mb-2 w-full rounded-lg border border-line bg-primary p-2 text-xs" />
    {veiculos.map((veiculo, indice) => <div key={indice} className="mb-3 rounded-lg border border-line p-3">
      <div className="mb-2 flex justify-between text-xs font-semibold"><span>Veículo {indice + 1}</span><button type="button" className="text-danger" onClick={() => onConfig({ ...config, compatibilities: veiculos.filter((_, atual) => atual !== indice) })}>Remover</button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{campos.filter((campo) => !campo.tags?.read_only && (comuns.includes(campo.id) || !!veiculo.attributes[campo.id] || busca && campo.name.toLowerCase().includes(busca.toLowerCase()))).map((campo) => <Campo key={campo.id} campo={campo} valor={veiculo.attributes[campo.id] || ''} onChange={(valor) => mudar(indice, campo.id, valor)} />)}</div>
      {!!posicoes.length && <fieldset className="mt-3"><legend className="mb-2 text-xs font-medium">Posições de instalação válidas para a categoria</legend><div className="flex flex-wrap gap-3">{posicoes.map((posicao) => <label className="flex items-center gap-1.5 text-xs" key={posicao.value_id}><input type="checkbox" checked={Boolean(veiculo.positions?.some((valor) => valor.value_id === posicao.value_id))} onChange={(event) => onConfig({ ...config, compatibilities: veiculos.map((atual, numero) => numero === indice ? { ...atual, positions: event.target.checked ? [...(atual.positions || []), posicao] : atual.positions?.filter((valor) => valor.value_id !== posicao.value_id) } : atual) })} />{posicao.value_name}</label>)}</div></fieldset>}
      <label className="mt-2 block text-xs">Restrições e observações de aplicação<textarea rows={2} maxLength={500} value={veiculo.note || ''} onChange={(event) => onConfig({ ...config, compatibilities: veiculos.map((atual, numero) => numero === indice ? { ...atual, note: event.target.value } : atual) })} className="mt-1 w-full rounded-lg border border-line bg-primary p-2" placeholder="Ex.: somente versão com freio a disco traseiro" /></label>
    </div>)}
    <button type="button" disabled={!campos.length || veiculos.length >= 50} onClick={() => onConfig({ ...config, compatibilities: [...veiculos, { attributes: {} }] })} className="rounded-lg border border-accent/30 px-3 py-2 text-xs text-accent disabled:opacity-50">Adicionar veículo compatível</button>
  </details>;
}
