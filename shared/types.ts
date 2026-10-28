export interface Part {
  id: number;
  nome: string;
  carro: string;
  quantidade: number;
  preco: number;
}

export interface Sale {
  id: number;
  peca: string;
  valor: number;
  data: string;
  plataforma: string;
}

export interface HealthResponse {
  status: string;
  message: string;
}

export interface ApiError {
  error: string;
  message?: string;
}
