export const DEFAULT_COMPANY_NAME = 'Mercadão de Peças';

export const STORAGE_KEYS = {
  authUser: 'desmonte.authUser',
  userName: 'desmonte.userName',
  companyName: 'desmonte.companyName',
  financeWhatsApp: 'desmonte.financeWhatsApp',
  onboardingCompleted: 'desmonte.onboardingCompleted',
  lastSeenVendaId: 'desmonte.lastSeenVendaId',
  lastSeenReclamacaoId: 'desmonte.lastSeenReclamacaoId',
  lastSeenPerguntaId: 'desmonte.lastSeenPerguntaId',
} as const;

export const SESSION_KEYS = {
  ownerToken: 'desmonte.ownerToken',
} as const;

export const OWNER_HEADER = 'x-owner-token';
