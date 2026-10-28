export interface GreetingPeriod {
  label: 'Bom dia' | 'Boa tarde' | 'Boa noite';
  emoji: string;
  emojiLabel: string;
}

export const MOTIVATIONAL_PHRASES = [
  'Grandes resultados começam com pequenos passos dados todos os dias.',
  'O melhor momento para organizar a operação é agora.',
  'Cada peça cadastrada é uma nova oportunidade de negócio.',
  'Foco no que faz o negócio crescer e o resto se encaixa.',
  'A consistência vence o talento quando o talento descansa.',
  'Hoje é um ótimo dia para superar o ontem.',
  'Quem cuida dos detalhes constrói resultados sólidos.',
  'Seu esforço de hoje é o faturamento de amanhã.',
  'Não espere o momento perfeito. Faça o momento funcionar.',
  'Um passo de cada vez também leva longe.',
  'Organização é o primeiro passo para escalar.',
  'A excelência está nos pequenos gestos repetidos.',
  'Transforme desafios em aprendizado e aprendizado em resultado.',
  'Vendas acontecem quando a operação está pronta.',
  'Faça simples, faça bem feito, faça acontecer.',
  'O sucesso é a soma de pequenas atitudes diárias.',
  'Energia positiva atrai boas oportunidades.',
  'Comece onde você está. Use o que você tem. Faça o que você pode.',
  'A melhor estratégia é aquela que sai do papel.',
  'Seu próximo grande resultado pode começar hoje.',
] as const;

export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      label: 'Bom dia',
      emoji: '☀️',
      emojiLabel: 'sol',
    };
  }

  if (hour >= 12 && hour < 18) {
    return {
      label: 'Boa tarde',
      emoji: '🌤️',
      emojiLabel: 'sol entre nuvens',
    };
  }

  return {
    label: 'Boa noite',
    emoji: '🌙',
    emojiLabel: 'lua',
  };
}

export function pickMotivationalPhrase(exclude?: string): string {
  let next = '';

  do {
    next =
      MOTIVATIONAL_PHRASES[
        Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)
      ];
  } while (next === exclude);

  return next;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
