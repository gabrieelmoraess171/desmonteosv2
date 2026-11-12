export type GreetingKey = 'morning' | 'afternoon' | 'night';

export interface GreetingPeriod {
  key: GreetingKey;
  label: 'Bom dia' | 'Boa tarde' | 'Boa noite';
  emoji: string;
  emojiLabel: string;
}

const HEADLINES: Record<GreetingKey, readonly string[]> = {
  morning: [
    'Bom dia, {name}! ☀️',
    'Tenha um excelente dia hoje, {name}.',
    'Uma ótima manhã para você, {name}!',
    'Que seu dia comece bem, {name}.',
    'Bom dia, {name}! Vamos começar com calma e foco.',
    'Um novo dia, novas oportunidades, {name}.',
  ],
  afternoon: [
    'Boa tarde, {name}! 🌤️',
    'Espero que sua tarde esteja indo bem, {name}.',
    'Uma excelente tarde para você, {name}!',
    'Ainda temos uma boa tarde pela frente, {name}.',
    'Que o restante do seu dia seja produtivo, {name}.',
    'Boa tarde, {name}! Vamos seguir no seu ritmo.',
  ],
  night: [
    'Boa noite, {name}! 🌙',
    'Boa noite, {name}. Espero que seu dia tenha sido bom.',
    'Que sua noite seja tranquila, {name}.',
    'Uma excelente noite para você, {name}!',
    'Boa noite, {name}! Vamos fechar o dia com tudo em ordem.',
    'Espero que você tenha tido um bom dia, {name}.',
  ],
};

const PHRASES: Record<GreetingKey, readonly string[]> = {
  morning: [
    'Comece pelo que é mais importante. Um passo de cada vez.',
    'Organizar a manhã ajuda a deixar o resto do dia mais leve.',
    'Cada peça bem cadastrada abre uma nova oportunidade.',
    'Seu próximo bom resultado pode começar nesta manhã.',
    'Foco nos detalhes e disposição para um novo dia.',
    'Há tempo para fazer bem feito. Escolha a primeira prioridade.',
  ],
  afternoon: [
    'Uma pausa e uma prioridade de cada vez ajudam a manter o ritmo.',
    'Aproveite a tarde para avançar no que faz diferença.',
    'Pequenos avanços também fazem um dia produtivo.',
    'O cuidado com cada anúncio faz diferença no resultado.',
    'Continue de onde parou. O importante é seguir com atenção.',
    'Organização e constância ajudam a fechar bem o dia.',
  ],
  night: [
    'Confira as pendências com calma e deixe o próximo dia encaminhado.',
    'Reconheça o que avançou hoje. Amanhã é uma nova oportunidade.',
    'Fechar o dia com tudo organizado deixa a próxima manhã mais leve.',
    'Cuide dos últimos detalhes e reserve um tempo para descansar.',
    'Um passo de cada vez também leva longe. Você já avançou hoje.',
    'Aproveite este momento para revisar as prioridades de amanhã.',
  ],
};

const memory = new Map<string, string>();

function readHistory(key: string): string | undefined {
  try { return window.localStorage.getItem(key) || undefined; }
  catch { return memory.get(key); }
}

function writeHistory(key: string, value: string) {
  memory.set(key, value);
  try { window.localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

// Cada opção sai uma vez por ciclo; ao recomeçar, evita repetir a última.
function pickFromCycle(key: string, values: readonly string[]): string {
  let saved: { remaining?: string[]; last?: string } = {};
  try { saved = JSON.parse(readHistory(key) || '{}'); } catch { /* Restart a damaged cycle. */ }
  let remaining = Array.isArray(saved.remaining)
    ? saved.remaining.filter((value) => values.includes(value))
    : [];
  if (!remaining.length) remaining = [...values];
  const candidates = remaining.filter((value) => value !== saved.last);
  const choices = candidates.length ? candidates : remaining;
  const next = choices[Math.floor(Math.random() * choices.length)];
  writeHistory(key, JSON.stringify({ last: next, remaining: remaining.filter((value) => value !== next) }));
  return next;
}

export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo',
  }).format(date));
  if (hour >= 5 && hour < 12) return { key: 'morning', label: 'Bom dia', emoji: '☀️', emojiLabel: 'sol' };
  if (hour >= 12 && hour < 18) return { key: 'afternoon', label: 'Boa tarde', emoji: '🌤️', emojiLabel: 'sol entre nuvens' };
  return { key: 'night', label: 'Boa noite', emoji: '🌙', emojiLabel: 'lua' };
}

export function pickGreeting(name: string, date: Date = new Date()) {
  const period = getGreetingPeriod(date);
  return {
    period: period.key,
    headline: pickFromCycle(`desmonte.greeting.v2.${period.key}`, HEADLINES[period.key])
      .replace('{name}', name.trim() || 'bem-vindo'),
    phrase: pickFromCycle(`desmonte.phrase.v2.${period.key}`, PHRASES[period.key]),
  };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
