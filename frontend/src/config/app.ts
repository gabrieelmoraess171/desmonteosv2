export const DEFAULT_COMPANY_NAME = 'Mercadão de Peças';

export const STORAGE_KEYS = {
  userName: 'desmonte.userName',
  companyName: 'desmonte.companyName',
  financeWhatsApp: 'desmonte.financeWhatsApp',
  onboardingCompleted: 'desmonte.onboardingCompleted',
} as const;

export const SESSION_KEYS = {
  ownerToken: 'desmonte.ownerToken',
} as const;

export const OWNER_HEADER = 'x-owner-token';
