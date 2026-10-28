import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sugerirCategoriaMl } from './utils/categorias.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PECAS_UPLOADS = path.resolve(__dirname, '../uploads/pecas');

const PECAS_DEMO = [
  {
    nome: 'Motor 1.0 Flex Completo',
    sku: 'SKU D001',
    carro: 'Gol 2020',
    descricao:
      'Motor 1.0 flex completo, retirado de veículo com 48 mil km, revisado e testado. Acompanha nota fiscal, garantia de 90 dias e nota de procedência do desmonte.',
    categoria: 'Motor e Componentes',
    marca: 'Volkswagen',
    modelo: 'Gol',
    ano: '2020',
    condicao: 'usado',
    numero_oem: '030103021',
    garantia: '90 dias',
    peso_kg: 92,
    comprimento_cm: 80,
    largura_cm: 70,
    altura_cm: 75,
    atributos: {
      combustivel: 'Flex',
      cilindrada: '1.0',
      cambio: 'Manual',
      numero_cilindros: '3'
    },
    ml_titulo: 'Motor 1.0 Flex Gol G6 2020 Completo com Nota',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 2850,
    ml_ativo: 1,
    fotos: 3,
    tipo_foto: 'motor'
  },
  {
    nome: 'Parachoque Dianteiro Original',
    sku: 'SKU D002',
    carro: 'Onix 2021',
    descricao:
      'Parachoque dianteiro original na cor prata, com suporte para farol de milha e sensores de estacionamento. Peça sem trincas, pronta para pintura ou instalação.',
    categoria: 'Parachoques',
    marca: 'Chevrolet',
    modelo: 'Onix',
    ano: '2021',
    condicao: 'usado',
    numero_oem: '52123456',
    garantia: '90 dias',
    peso_kg: 4.5,
    comprimento_cm: 140,
    largura_cm: 45,
    altura_cm: 45,
    atributos: {
      posicao: 'Dianteiro',
      cor: 'Prata',
      sensores: 'Sim',
      farol_milha: 'Sim'
    },
    ml_titulo: 'Parachoque Dianteiro Onix 2021 Original Prata',
    tipo_anuncio: 'clássico',
    quantidade: 2,
    preco: 420,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'parachoque'
  },
  {
    nome: 'Radiador HB20 1.6',
    sku: 'SKU D003',
    carro: 'HB20 2019',
    descricao:
      'Radiador para Hyundai HB20 1.6 2019, colmeia em alumínio revisada e testada em bancada. Encaixe original, sem vazamentos e com garantia de 6 meses.',
    categoria: 'Radiadores e Arrefecimento',
    marca: 'Hyundai',
    modelo: 'HB20',
    ano: '2019',
    condicao: 'usado',
    numero_oem: '253101R000',
    garantia: '6 meses',
    peso_kg: 3.2,
    comprimento_cm: 60,
    largura_cm: 40,
    altura_cm: 15,
    atributos: {
      material: 'Alumínio',
      transmissao: 'Manual',
      ventoinha: 'Não'
    },
    ml_titulo: 'Radiador HB20 1.6 2019 Original Testado',
    tipo_anuncio: 'clássico',
    quantidade: 3,
    preco: 480,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'radiador'
  },
  {
    nome: 'Bateria Moura 60Ah',
    sku: 'SKU D004',
    carro: 'Fox 2018',
    descricao:
      'Bateria Moura 12V 60Ah selada, livre de manutenção, com 12 meses de garantia. Ideal para Fox, Polo e outros modelos com bateria de 60Ah.',
    categoria: 'Baterias',
    marca: 'Moura',
    modelo: 'M60GD',
    ano: '2018',
    condicao: 'novo',
    numero_oem: 'M60GD',
    garantia: '12 meses',
    peso_kg: 15,
    comprimento_cm: 24,
    largura_cm: 17,
    altura_cm: 19,
    atributos: {
      amperagem: '60Ah',
      tensao: '12V',
      tecnologia: 'Chumbo-ácido'
    },
    ml_titulo: 'Bateria Moura 60Ah 12V Nova com Garantia',
    tipo_anuncio: 'premium',
    quantidade: 5,
    preco: 329.9,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'bateria'
  },
  {
    nome: 'Farol Dianteiro Direito',
    sku: 'SKU D005',
    carro: 'Celta 2015',
    descricao:
      'Farol dianteiro direito original, lente cristal, com encaixe para lâmpada H4. Peça revisada, sem infiltração e com todas as travas intactas.',
    categoria: 'Faróis e Lanternas',
    marca: 'Chevrolet',
    modelo: 'Celta',
    ano: '2015',
    condicao: 'usado',
    numero_oem: '93328030',
    garantia: '90 dias',
    peso_kg: 2.1,
    comprimento_cm: 55,
    largura_cm: 30,
    altura_cm: 30,
    atributos: {
      lado: 'Direito',
      tipo_lampada: 'H4',
      lente: 'Cristal',
      regulagem: 'Manual'
    },
    ml_titulo: 'Farol Dianteiro Direito Celta 2015 Original',
    tipo_anuncio: 'clássico',
    quantidade: 2,
    preco: 249.9,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'farol'
  },
  {
    nome: 'Retrovisor Elétrico Esquerdo',
    sku: 'SKU D006',
    carro: 'Corolla 2020',
    descricao:
      'Retrovisor elétrico esquerdo para Toyota Corolla 2020, com capa preta, espelho e motor de acionamento inclusos. Testado e funcionando perfeitamente.',
    categoria: 'Retrovisores',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: '2020',
    condicao: 'usado',
    numero_oem: '87940-02420',
    garantia: '90 dias',
    peso_kg: 1.4,
    comprimento_cm: 35,
    largura_cm: 25,
    altura_cm: 20,
    atributos: {
      lado: 'Esquerdo',
      acionamento: 'Elétrico',
      cor: 'Preta',
      aquecimento: 'Sim'
    },
    ml_titulo: 'Retrovisor Elétrico Esquerdo Corolla 2020 Preto',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 389,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'retrovisor'
  },
  {
    nome: 'Roda Liga Leve Aro 15',
    sku: 'SKU D007',
    carro: 'Polo 2019',
    descricao:
      'Roda de liga leve aro 15 original Volkswagen, sem empenos e com pequenas marcas de uso. Valor referente a uma unidade, sem pneu incluso.',
    categoria: 'Rodas e Pneus',
    marca: 'Volkswagen',
    modelo: 'Polo',
    ano: '2019',
    condicao: 'usado',
    numero_oem: '2G0601025',
    garantia: '90 dias',
    peso_kg: 8,
    comprimento_cm: 42,
    largura_cm: 42,
    altura_cm: 22,
    atributos: {
      medida: '185/65 R15',
      aro: '15',
      material: 'Liga leve',
      pneu_incluso: 'Não'
    },
    ml_titulo: 'Roda Liga Leve Aro 15 Polo 2019 Original',
    tipo_anuncio: 'clássico',
    quantidade: 4,
    preco: 450,
    ml_ativo: 1,
    fotos: 2,
    tipo_foto: 'roda'
  },
  {
    nome: 'Kit Suspensão Dianteira',
    sku: 'SKU D008',
    carro: 'Civic 2018',
    descricao:
      'Kit de suspensão dianteira para Honda Civic G10 2018, com amortecedores, molas e batentes. Peças revisadas, sem vazamentos e com garantia de 90 dias.',
    categoria: 'Suspensão e Direção',
    marca: 'Honda',
    modelo: 'Civic',
    ano: '2018',
    condicao: 'usado',
    numero_oem: '51601-TBA',
    garantia: '90 dias',
    peso_kg: 22,
    comprimento_cm: 70,
    largura_cm: 40,
    altura_cm: 30,
    atributos: {
      posicao: 'Dianteira',
      tipo: 'Amortecedor',
      lado: 'Par'
    },
    ml_titulo: 'Kit Suspensão Dianteira Civic G10 2018',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 1200,
    ml_ativo: 1,
    fotos: 1,
    tipo_foto: 'suspensao'
  },
  {
    nome: 'Alternador 90A',
    sku: 'SKU D009',
    carro: 'Saveiro 2016',
    descricao:
      'Alternador 90A para Volkswagen Saveiro 2016, revisado com escovas e rolamentos novos. Testado em bancada, acompanha garantia de 6 meses.',
    categoria: 'Elétrica',
    marca: 'Volkswagen',
    modelo: 'Saveiro',
    ano: '2016',
    condicao: 'usado',
    numero_oem: '06B903023',
    garantia: '6 meses',
    peso_kg: 6.5,
    comprimento_cm: 30,
    largura_cm: 25,
    altura_cm: 25,
    atributos: {
      tipo: 'Alternador',
      tensao: '12V',
      conectores: '2 pinos'
    },
    ml_titulo: 'Alternador 90A Saveiro 2016 Revisado',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 550,
    ml_ativo: 1,
    fotos: 1,
    tipo_foto: 'eletrica'
  },
  {
    nome: 'Lanterna Traseira Esquerda',
    sku: 'SKU D010',
    carro: 'HB20 2020',
    descricao:
      'Lanterna traseira esquerda para Hyundai HB20 2020, lente original sem trincas e com chicote incluso. Produto testado e pronto para envio.',
    categoria: 'Faróis e Lanternas',
    marca: 'Hyundai',
    modelo: 'HB20',
    ano: '2020',
    condicao: 'usado',
    numero_oem: '92401-H6000',
    garantia: '90 dias',
    peso_kg: 1.8,
    comprimento_cm: 45,
    largura_cm: 25,
    altura_cm: 20,
    atributos: {
      lado: 'Esquerdo',
      tipo_lampada: 'LED',
      lente: 'Original',
      regulagem: 'Manual'
    },
    ml_titulo: 'Lanterna Traseira Esquerda HB20 2020 Original',
    tipo_anuncio: 'clássico',
    quantidade: 0,
    preco: 189.9,
    ml_ativo: 1,
    fotos: 1,
    tipo_foto: 'lanterna'
  },
  {
    nome: 'Parachoque Traseiro',
    sku: 'SKU D011',
    carro: 'Sandero 2019',
    descricao:
      'Parachoque traseiro para Renault Sandero 2019 na cor branca, com marcas leves de uso. Sem trincas e com suportes originais.',
    categoria: 'Parachoques',
    marca: 'Renault',
    modelo: 'Sandero',
    ano: '2019',
    condicao: 'usado',
    numero_oem: '850160027R',
    garantia: '90 dias',
    peso_kg: 4,
    comprimento_cm: 135,
    largura_cm: 45,
    altura_cm: 40,
    atributos: {
      posicao: 'Traseiro',
      cor: 'Branca',
      sensores: 'Não',
      farol_milha: 'Não'
    },
    ml_titulo: 'Parachoque Traseiro Sandero 2019 Branco',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 300,
    ml_ativo: 1,
    fotos: 0,
    tipo_foto: 'parachoque'
  },
  {
    nome: 'Bomba de Combustível',
    sku: 'SKU D012',
    carro: 'Uno 2014',
    descricao: 'Bomba de combustível usada.',
    categoria: 'Motor e Componentes',
    marca: 'Fiat',
    modelo: 'Uno',
    ano: '2014',
    condicao: 'usado',
    numero_oem: '51803006',
    garantia: '90 dias',
    peso_kg: 0,
    comprimento_cm: 0,
    largura_cm: 0,
    altura_cm: 0,
    atributos: {
      combustivel: 'Flex',
      cilindrada: '1.0',
      cambio: 'Manual',
      numero_cilindros: '4'
    },
    ml_titulo: 'Bomba de Combustível Uno 2014',
    tipo_anuncio: 'clássico',
    quantidade: 2,
    preco: 220,
    ml_ativo: 1,
    fotos: 1,
    tipo_foto: 'motor'
  },
  {
    nome: 'Câmbio Manual 5 Marchas',
    sku: 'SKU D013',
    carro: 'Gol 2015',
    descricao:
      'Câmbio manual de 5 marchas para Volkswagen Gol 2015, revisado e testado. Acompanha garantia de 90 dias e nota de procedência.',
    categoria: 'Transmissão',
    marca: 'Volkswagen',
    modelo: 'Gol',
    ano: '2015',
    condicao: 'usado',
    numero_oem: '02T301103',
    garantia: '90 dias',
    peso_kg: 38,
    comprimento_cm: 60,
    largura_cm: 45,
    altura_cm: 40,
    atributos: {
      tipo: 'Câmbio',
      cambio: 'Manual',
      tracao: 'Dianteira'
    },
    ml_titulo: 'Câmbio Manual 5 Marchas Gol 2015 Revisado',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 1500,
    ml_ativo: 0,
    fotos: 1,
    tipo_foto: 'transmissao'
  },
  {
    nome: 'Porta Dianteira Direita',
    sku: 'SKU D014',
    carro: 'Fiesta 2016',
    descricao:
      'Porta dianteira direita para Ford Fiesta 2016, com vidro e maçaneta inclusos. Peça na cor vermelha, com pequenas marcas de uso.',
    categoria: 'Portas e Capôs',
    marca: 'Ford',
    modelo: 'Fiesta',
    ano: '2016',
    condicao: 'usado',
    numero_oem: 'D2BZ5420124',
    garantia: '90 dias',
    peso_kg: 18,
    comprimento_cm: 110,
    largura_cm: 90,
    altura_cm: 25,
    atributos: {
      posicao: 'Dianteira direita',
      cor: 'Com pintura',
      vidro: 'Sim',
      macaneta: 'Sim'
    },
    ml_titulo: 'Porta Dianteira Direita Fiesta 2016 Completa',
    tipo_anuncio: 'clássico',
    quantidade: 1,
    preco: 750,
    ml_ativo: 0,
    fotos: 2,
    tipo_foto: 'porta'
  },
  {
    nome: 'Pastilha de Freio Dianteira',
    sku: 'SKU D015',
    carro: 'Compass 2020',
    descricao:
      'Jogo de pastilhas de freio dianteiras para Jeep Compass 2020, produto novo na embalagem, com garantia de 6 meses. Aplicação confirmada pelo OEM.',
    categoria: 'Freios',
    marca: 'Jeep',
    modelo: 'Compass',
    ano: '2020',
    condicao: 'novo',
    numero_oem: '68230095AA',
    garantia: '6 meses',
    peso_kg: 1.9,
    comprimento_cm: 25,
    largura_cm: 15,
    altura_cm: 8,
    atributos: {
      posicao: 'Dianteiro',
      tipo: 'Pastilha',
      diametro: '305 mm'
    },
    ml_titulo: 'Pastilha de Freio Dianteira Compass 2020 Nova',
    tipo_anuncio: 'premium',
    quantidade: 6,
    preco: 180,
    ml_ativo: 1,
    fotos: 1,
    tipo_foto: 'pastilha'
  }
];

const ENDERECOS_DEMO = [
  'Rua das Peças, 120 - Centro - Belo Horizonte/MG - CEP: 30110-000',
  'Avenida Brasil, 455 - Jardim América - São Paulo/SP - CEP: 01430-000',
  'Rua Santa Inês, 316 - Vila Arens - Jundiaí/SP - CEP: 13206-510',
  'Rua das Palmeiras, 88 - Boa Vista - Curitiba/PR - CEP: 82560-000',
  'Avenida Atlântica, 1020 - Copacabana - Rio de Janeiro/RJ - CEP: 22010-000',
  'Rua dos Andradas, 750 - Centro Histórico - Porto Alegre/RS - CEP: 90020-000'
];

const VENDAS_DEMO = [
  // Vendas de hoje (Mercado Livre) — alimentam o dashboard e a NF-e.
  { quando: { minutosAtras: 40 }, itens: [['SKU D002', 1]], cliente: 'Oficina Silva ME', email: 'financeiro@oficinasilva.com.br', fone: '(11) 98765-4321', cpf: '12.345.678/0001-90', pagamento: 'PIX', status: 'concluida' },
  { quando: { minutosAtras: 80 }, itens: [['SKU D004', 1]], cliente: 'Marcos Pereira', email: 'marcos.pereira@email.com', fone: '(31) 99876-5432', cpf: '123.456.789-01', pagamento: 'Cartão de crédito', status: 'enviada' },
  { quando: { minutosAtras: 135 }, itens: [['SKU D003', 1]], cliente: 'Auto Center BH', email: 'compras@autocenterbh.com.br', fone: '(31) 3222-1100', cpf: '98.765.432/0001-10', pagamento: 'PIX', status: 'entregue' },
  { quando: { minutosAtras: 200 }, itens: [['SKU D005', 1]], cliente: 'Ana Souza', email: 'ana.souza@email.com', fone: '(21) 99123-4567', cpf: '987.654.321-00', pagamento: 'Boleto', status: 'concluida' },
  { quando: { minutosAtras: 280 }, itens: [['SKU D006', 1], ['SKU D007', 1]], cliente: 'Carlos Lima', email: 'carlos.lima@email.com', fone: '(41) 98888-7777', cpf: '456.789.123-45', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { minutosAtras: 360 }, itens: [['SKU D015', 2]], cliente: 'JR Motores', email: 'contato@jrmotores.com.br', fone: '(11) 95555-2222', cpf: '11.222.333/0001-44', pagamento: 'PIX', status: 'enviada' },
  { quando: { minutosAtras: 440 }, itens: [['SKU D001', 1]], cliente: 'JR Motores', email: 'contato@jrmotores.com.br', fone: '(11) 95555-2222', cpf: '11.222.333/0001-44', pagamento: 'PIX', status: 'concluida' },
  // Venda manual de hoje — aparece no dashboard, mas não entra na NF-e do ML.
  { quando: { minutosAtras: 520 }, plataforma: 'Manual', itens: [['SKU D014', 1]], cliente: 'Fernanda Alves', email: 'fernanda.alves@email.com', fone: '(19) 97777-8888', cpf: '321.654.987-00', pagamento: 'Dinheiro', status: 'concluida' },
  // Venda cancelada de hoje — não deve entrar nos totais nem na NF-e.
  { quando: { minutosAtras: 610 }, itens: [['SKU D010', 1]], cliente: 'Comprador ML', email: 'comprador@email.com', fone: '(11) 90000-0000', cpf: '', pagamento: 'PIX', status: 'cancelada' },

  // Histórico dos últimos 30 dias.
  { quando: { diasAtras: 1, hora: 9, minuto: 20 }, itens: [['SKU D009', 1]], cliente: 'Oficina Central', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 1, hora: 13, minuto: 45 }, itens: [['SKU D013', 1]], cliente: 'Auto Peças Vitória', pagamento: 'Boleto', status: 'entregue' },
  { quando: { diasAtras: 1, hora: 17, minuto: 10 }, itens: [['SKU D011', 1]], cliente: 'Renato Gomes', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 2, hora: 10, minuto: 5 }, itens: [['SKU D008', 1]], cliente: 'Honda Center SP', pagamento: 'PIX', status: 'entregue' },
  { quando: { diasAtras: 2, hora: 16, minuto: 30 }, itens: [['SKU D003', 1]], cliente: 'Marcelo Dias', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 2, hora: 18, minuto: 15 }, itens: [['SKU D010', 1]], cliente: 'Comprador cancelou', pagamento: 'PIX', status: 'cancelada' },
  { quando: { diasAtras: 3, hora: 8, minuto: 40 }, itens: [['SKU D001', 1]], cliente: 'JR Motores', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 3, hora: 11, minuto: 55 }, itens: [['SKU D005', 1]], cliente: 'Paulo Henrique', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 3, hora: 15, minuto: 20 }, itens: [['SKU D004', 1]], cliente: 'Vanessa Rocha', pagamento: 'Cartão de débito', status: 'enviada' },
  { quando: { diasAtras: 4, hora: 14, minuto: 10 }, itens: [['SKU D002', 1]], cliente: 'Auto Center BH', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 5, hora: 9, minuto: 30 }, itens: [['SKU D007', 2]], cliente: 'Rodas & Cia', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 5, hora: 16, minuto: 50 }, itens: [['SKU D015', 2]], cliente: 'JR Motores', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 5, hora: 18, minuto: 5 }, plataforma: 'Manual', itens: [['SKU D014', 1]], cliente: 'Luiz Fernando', pagamento: 'Dinheiro', status: 'concluida' },
  { quando: { diasAtras: 6, hora: 10, minuto: 15 }, itens: [['SKU D006', 1]], cliente: 'Toyota Peças BH', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 6, hora: 15, minuto: 35 }, itens: [['SKU D009', 1]], cliente: 'Eletro Car', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 7, hora: 12, minuto: 20 }, itens: [['SKU D004', 1]], cliente: 'Sandra Regina', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 8, hora: 9, minuto: 5 }, itens: [['SKU D003', 1]], cliente: 'Auto Frio', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 8, hora: 14, minuto: 45 }, itens: [['SKU D005', 1]], cliente: 'Gilberto Nunes', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 9, hora: 11, minuto: 30 }, itens: [['SKU D002', 1]], cliente: 'Oficina Silva ME', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 10, hora: 8, minuto: 50 }, itens: [['SKU D001', 1]], cliente: 'JR Motores', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 10, hora: 17, minuto: 25 }, itens: [['SKU D010', 1]], cliente: 'Ricardo Alves', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 11, hora: 13, minuto: 10 }, itens: [['SKU D008', 1]], cliente: 'Honda Center SP', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 12, hora: 10, minuto: 40 }, itens: [['SKU D007', 1]], cliente: 'Bruno Martins', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 13, hora: 9, minuto: 15 }, itens: [['SKU D004', 1]], cliente: 'Marcos Pereira', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 13, hora: 15, minuto: 55 }, itens: [['SKU D015', 2]], cliente: 'JR Motores', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 14, hora: 12, minuto: 5 }, itens: [['SKU D005', 1]], cliente: 'Ana Souza', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 15, hora: 8, minuto: 35 }, itens: [['SKU D003', 1]], cliente: 'Auto Frio', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 15, hora: 16, minuto: 20 }, itens: [['SKU D002', 1]], cliente: 'Oficina Silva ME', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 17, hora: 11, minuto: 50 }, itens: [['SKU D006', 1]], cliente: 'Toyota Peças BH', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 19, hora: 9, minuto: 45 }, itens: [['SKU D001', 1]], cliente: 'JR Motores', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 19, hora: 14, minuto: 30 }, itens: [['SKU D009', 1]], cliente: 'Eletro Car', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 21, hora: 10, minuto: 25 }, itens: [['SKU D004', 1]], cliente: 'Sandra Regina', pagamento: 'Cartão de crédito', status: 'concluida' },
  { quando: { diasAtras: 24, hora: 8, minuto: 15 }, itens: [['SKU D008', 1]], cliente: 'Honda Center SP', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 24, hora: 13, minuto: 35 }, itens: [['SKU D007', 2]], cliente: 'Rodas & Cia', pagamento: 'Boleto', status: 'concluida' },
  { quando: { diasAtras: 27, hora: 11, minuto: 5 }, itens: [['SKU D005', 1]], cliente: 'Paulo Henrique', pagamento: 'PIX', status: 'concluida' },
  { quando: { diasAtras: 29, hora: 16, minuto: 40 }, itens: [['SKU D003', 1]], cliente: 'Marcelo Dias', pagamento: 'Cartão de crédito', status: 'concluida' }
];

const PERGUNTAS_DEMO = [
  { sku: 'SKU D003', pergunta: 'Esse radiador serve no HB20 1.6 2019?', quando: { minutosAtras: 25 } },
  { sku: 'SKU D004', pergunta: 'Vocês entregam em Belo Horizonte?', quando: { minutosAtras: 90 } },
  { sku: 'SKU D001', pergunta: 'O motor acompanha nota fiscal e garantia?', quando: { minutosAtras: 180 } },
  { sku: 'SKU D002', pergunta: 'Faz instalação em São Paulo?', quando: { minutosAtras: 300 } },
  { sku: 'SKU D005', pergunta: 'O farol é original de fábrica ou paralelo?', quando: { diasAtras: 1, hora: 10, minuto: 30 } },
  { sku: 'SKU D006', pergunta: 'Vem com o espelho e a capa inclusos?', quando: { diasAtras: 2, hora: 15, minuto: 10 } },
  { sku: 'SKU D007', pergunta: 'A roda é aro 15 original Volkswagen? Aceita troca?', quando: { diasAtras: 3, hora: 9, minuto: 45 } },
  { sku: 'SKU D008', pergunta: 'Serve no Civic G10 2018 EXL?', quando: { diasAtras: 4, hora: 14, minuto: 20 } },
  {
    sku: 'SKU D004',
    pergunta: 'Qual a data de fabricação da bateria?',
    quando: { diasAtras: 5, hora: 11, minuto: 15 },
    respondida: 1,
    resposta: 'Boa tarde! A bateria é de fabricação 09/2026 e acompanha 12 meses de garantia.'
  },
  {
    sku: 'SKU D015',
    pergunta: 'É o par dianteiro completo?',
    quando: { diasAtras: 6, hora: 16, minuto: 5 },
    respondida: 1,
    resposta: 'Sim, é o jogo com as quatro pastilhas para o eixo dianteiro.'
  }
];

const RECLAMACOES_DEMO = [
  {
    sku: 'SKU D001',
    pedido_id: '2000012345607',
    motivo: 'Produto com avaria',
    descricao: 'Cliente relatou amassado na tampa de válvulas do motor.',
    status: 'aberta',
    quando: { minutosAtras: 55 }
  },
  {
    sku: 'SKU D007',
    pedido_id: '2000012345605',
    motivo: 'Arranhões não informados',
    descricao: 'Cliente alega marcas profundas na roda que não apareciam nas fotos.',
    status: 'aberta',
    quando: { minutosAtras: 210 }
  },
  {
    sku: 'SKU D002',
    pedido_id: '2000012345610',
    motivo: 'Produto diferente do anunciado',
    descricao: 'Cliente recebeu parachoque na cor preta, mas o anúncio era prata.',
    status: 'em_analise',
    quando: { diasAtras: 1, hora: 11, minuto: 40 }
  },
  {
    sku: 'SKU D004',
    pedido_id: '2000012345602',
    motivo: 'Atraso na entrega',
    descricao: 'Transportadora atrasou e o cliente abriu reclamação no Mercado Livre.',
    status: 'aberta',
    quando: { diasAtras: 2, hora: 9, minuto: 20 }
  },
  {
    sku: 'SKU D005',
    pedido_id: '2000012345604',
    motivo: 'Peça não funciona',
    descricao: 'Cliente informa que a lâmpada do farol não acende após a instalação.',
    status: 'aberta',
    quando: { diasAtras: 2, hora: 17, minuto: 5 }
  },
  {
    sku: 'SKU D003',
    pedido_id: '2000012345614',
    motivo: 'Vazamento no radiador',
    descricao: 'Cliente relatou vazamento após a instalação. Reembolso enviado.',
    status: 'resolvida',
    quando: { diasAtras: 3, hora: 13, minuto: 30 },
    resolvido_em: { diasAtras: 1, hora: 10, minuto: 0 }
  }
];

const PALETAS = {
  motor: ['#0b1220', '#172554', '#3b82f6', '#1d4ed8', '#0ea5e9'],
  parachoque: ['#0b1220', '#2e1065', '#8b5cf6', '#6d28d9', '#a78bfa'],
  radiador: ['#0b1220', '#431407', '#fb923c', '#c2410c', '#fdba74'],
  bateria: ['#0b1220', '#022c22', '#34d399', '#047857', '#6ee7b7'],
  farol: ['#0b1220', '#083344', '#22d3ee', '#0e7490', '#67e8f9'],
  retrovisor: ['#0b1220', '#172554', '#60a5fa', '#1e40af', '#93c5fd'],
  roda: ['#0b1220', '#1e293b', '#94a3b8', '#475569', '#cbd5e1'],
  suspensao: ['#0b1220', '#422006', '#facc15', '#a16207', '#fde047'],
  eletrica: ['#0b1220', '#431407', '#fb923c', '#9a3412', '#fdba74'],
  transmissao: ['#0b1220', '#2e1065', '#a78bfa', '#5b21b6', '#c4b5fd'],
  porta: ['#0b1220', '#042f2e', '#2dd4bf', '#0f766e', '#5eead4'],
  pastilha: ['#0b1220', '#450a0a', '#f87171', '#991b1b', '#fca5a5'],
  lanterna: ['#0b1220', '#450a0a', '#ef4444', '#991b1b', '#fca5a5']
};

function escaparXml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toSqlUtc(data) {
  return data.toISOString().slice(0, 19).replace('T', ' ');
}

function dataQuando(quando = {}) {
  if (Number.isFinite(Number(quando.minutosAtras))) {
    const agora = new Date();
    const inicio = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      0,
      1,
      0,
      0
    );
    const data = new Date(
      Math.max(
        agora.getTime() - Number(quando.minutosAtras) * 60_000,
        inicio.getTime()
      )
    );
    return toSqlUtc(data);
  }

  const data = new Date();
  data.setDate(data.getDate() - Number(quando.diasAtras || 0));
  data.setHours(
    Number(quando.hora ?? 12),
    Number(quando.minuto ?? 0),
    0,
    0
  );
  return toSqlUtc(data);
}

function ilustracao(tipo) {
  switch (tipo) {
    case 'farol':
      return `
        <path d="M-210 -70 Q-210 -150 -120 -160 L160 -130 Q220 -120 220 -50 L220 60 Q220 130 150 140 L-140 150 Q-210 140 -210 70 Z" fill="url(#peca)"/>
        <ellipse cx="-35" cy="-15" rx="135" ry="95" fill="#e0f2fe" opacity="0.8"/>
        <ellipse cx="-35" cy="-15" rx="98" ry="68" fill="#ffffff" opacity="0.92"/>
        <circle cx="125" cy="55" r="34" fill="#fbbf24" opacity="0.9"/>
        <path d="M-180 95 Q-40 140 190 95" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.22"/>`;
    case 'parachoque':
      return `
        <path d="M-285 -40 Q-285 -115 -200 -125 L200 -125 Q285 -115 285 -40 L285 85 Q285 135 220 145 L-220 145 Q-285 135 -285 85 Z" fill="url(#peca)"/>
        <rect x="-175" y="-25" width="350" height="85" rx="32" fill="#0f172a" opacity="0.55"/>
        <circle cx="-145" cy="78" r="24" fill="#f8fafc" opacity="0.55"/>
        <circle cx="145" cy="78" r="24" fill="#f8fafc" opacity="0.55"/>
        <path d="M-230 -95 Q-100 -140 230 -95" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.25"/>`;
    case 'motor':
      return `
        <rect x="-190" y="-120" width="380" height="245" rx="34" fill="url(#peca)"/>
        <rect x="-130" y="-195" width="260" height="90" rx="22" fill="#1e293b"/>
        <circle cx="-75" cy="-218" r="30" fill="#475569"/>
        <circle cx="75" cy="-218" r="30" fill="#475569"/>
        <circle cx="135" cy="65" r="62" fill="#0f172a"/>
        <circle cx="135" cy="65" r="34" fill="#64748b"/>
        <rect x="-160" y="20" width="170" height="25" rx="12" fill="#0f172a" opacity="0.6"/>
        <rect x="-160" y="65" width="120" height="18" rx="9" fill="#0f172a" opacity="0.45"/>
        <path d="M-175 -95 L-225 -155 L-190 -175 L-140 -120" fill="#334155"/>
        <circle cx="-45" cy="105" r="16" fill="#f8fafc" opacity="0.3"/>`;
    case 'roda':
      return `
        <circle r="230" fill="#0f172a"/>
        <circle r="205" fill="url(#peca)"/>
        <circle r="72" fill="#0f172a"/>
        <circle r="36" fill="#64748b"/>
        ${Array.from({ length: 5 })
          .map(
            (_, indice) =>
              `<rect x="-18" y="-185" width="36" height="120" rx="14" fill="#e2e8f0" opacity="0.9" transform="rotate(${indice * 72})"/>`
          )
          .join('')}
        <circle r="180" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.2"/>`;
    case 'bateria':
      return `
        <rect x="-190" y="-150" width="380" height="300" rx="28" fill="url(#peca)"/>
        <rect x="-190" y="-150" width="380" height="70" rx="28" fill="#0f172a" opacity="0.35"/>
        <rect x="-125" y="-190" width="70" height="50" rx="10" fill="#f87171"/>
        <rect x="55" y="-190" width="70" height="50" rx="10" fill="#0f172a"/>
        <text x="0" y="35" text-anchor="middle" font-family="Helvetica, Arial" font-size="64" font-weight="700" fill="#ecfdf5" opacity="0.9">60Ah</text>
        <text x="0" y="95" text-anchor="middle" font-family="Helvetica, Arial" font-size="26" fill="#ecfdf5" opacity="0.55">12V • MOURA</text>`;
    case 'radiador':
      return `
        <rect x="-230" y="-160" width="460" height="320" rx="22" fill="url(#peca)"/>
        <rect x="-200" y="-130" width="400" height="260" rx="14" fill="#0f172a" opacity="0.4"/>
        ${Array.from({ length: 8 })
          .map(
            (_, indice) =>
              `<rect x="${-195 + indice * 50}" y="-125" width="14" height="250" rx="7" fill="#f8fafc" opacity="0.35"/>`
          )
          .join('')}
        <rect x="-245" y="-110" width="30" height="220" rx="12" fill="#0f172a" opacity="0.5"/>
        <rect x="215" y="-110" width="30" height="220" rx="12" fill="#0f172a" opacity="0.5"/>`;
    case 'retrovisor':
      return `
        <path d="M-210 -90 Q-210 -180 -120 -185 L120 -185 Q210 -180 210 -90 L210 80 Q210 155 130 160 L-130 160 Q-210 155 -210 80 Z" fill="url(#peca)"/>
        <path d="M-170 -55 Q-170 -130 -105 -135 L105 -135 Q170 -130 170 -55 L170 50 Q170 115 105 120 L-105 120 Q-170 115 -170 50 Z" fill="#dbeafe" opacity="0.9"/>
        <path d="M-140 -25 Q-140 -95 -85 -100 L85 -100 Q140 -95 140 -25 L140 25 Q140 85 85 90 L-85 90 Q-140 85 -140 25 Z" fill="#ffffff" opacity="0.55"/>
        <rect x="185" y="45" width="90" height="34" rx="16" fill="#334155"/>
        <circle cx="260" cy="62" r="20" fill="#0f172a"/>`;
    case 'suspensao':
      return `
        <path d="M0 -230 L0 -190" stroke="#64748b" stroke-width="24" stroke-linecap="round"/>
        <path d="M-95 -190 L95 -190" stroke="#334155" stroke-width="28" stroke-linecap="round"/>
        <path d="M-80 -150 Q80 -120 -80 -80 Q80 -40 -80 0 Q80 40 -80 80 Q80 120 -80 160" fill="none" stroke="url(#peca)" stroke-width="26" stroke-linecap="round"/>
        <rect x="-110" y="160" width="220" height="55" rx="24" fill="#334155"/>
        <circle cx="0" cy="185" r="18" fill="#0f172a"/>
        <path d="M0 -230 L0 -190" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>`;
    case 'eletrica':
      return `
        <rect x="-170" y="-140" width="340" height="280" rx="50" fill="url(#peca)"/>
        <circle cx="0" cy="0" r="105" fill="#0f172a" opacity="0.65"/>
        <circle cx="0" cy="0" r="66" fill="#64748b"/>
        <circle cx="0" cy="0" r="24" fill="#0f172a"/>
        <rect x="-150" y="-180" width="90" height="55" rx="14" fill="#334155"/>
        <path d="M120 -160 L185 -160 L185 -120" fill="none" stroke="#f8fafc" stroke-width="14" stroke-linecap="round"/>`;
    case 'transmissao':
      return `
        <path d="M-230 -90 L-80 -150 L210 -120 L240 80 L90 150 L-220 120 Z" fill="url(#peca)"/>
        <circle cx="-80" cy="20" r="100" fill="#0f172a" opacity="0.55"/>
        <circle cx="-80" cy="20" r="62" fill="#64748b"/>
        <circle cx="130" cy="-40" r="45" fill="#0f172a" opacity="0.6"/>
        <path d="M-180 -100 L-180 -160 L-90 -160" fill="none" stroke="#334155" stroke-width="22" stroke-linecap="round"/>`;
    case 'porta':
      return `
        <path d="M-180 -260 Q-180 -300 -130 -300 L150 -300 Q200 -300 200 -250 L200 260 Q200 300 150 300 L-130 300 Q-180 300 -180 260 Z" fill="url(#peca)"/>
        <path d="M-125 -235 Q-125 -260 -95 -260 L115 -260 Q145 -260 145 -230 L145 -80 Q145 -50 115 -50 L-95 -50 Q-125 -50 -125 -80 Z" fill="#0f172a" opacity="0.55"/>
        <rect x="-130" y="130" width="100" height="22" rx="11" fill="#0f172a" opacity="0.65"/>
        <circle cx="130" cy="140" r="18" fill="#f8fafc" opacity="0.55"/>`;
    case 'pastilha':
      return `
        <path d="M-200 -110 Q-200 -160 -145 -160 L145 -160 Q200 -160 200 -110 L200 90 Q200 140 145 140 L-145 140 Q-200 140 -200 90 Z" fill="url(#peca)"/>
        <rect x="-160" y="-105" width="320" height="80" rx="26" fill="#0f172a" opacity="0.55"/>
        <rect x="-120" y="5" width="240" height="40" rx="18" fill="#f8fafc" opacity="0.35"/>
        <circle cx="-140" cy="-35" r="20" fill="#f8fafc" opacity="0.5"/>
        <circle cx="140" cy="-35" r="20" fill="#f8fafc" opacity="0.5"/>`;
    case 'lanterna':
      return `
        <path d="M-220 -100 Q-220 -160 -150 -165 L120 -180 Q200 -180 220 -110 L220 80 Q210 150 140 155 L-130 165 Q-220 160 -220 95 Z" fill="url(#peca)"/>
        <path d="M-170 -70 Q-170 -120 -110 -125 L100 -135 Q160 -135 170 -80 L170 50 Q160 105 100 110 L-100 120 Q-170 115 -170 60 Z" fill="#fecaca" opacity="0.7"/>
        <path d="M-120 -40 Q-120 -80 -70 -85 L70 -90 Q120 -90 120 -45 L120 20 Q120 65 70 70 L-70 75 Q-120 70 -120 30 Z" fill="#ef4444" opacity="0.75"/>`;
    default:
      return `
        <circle r="190" fill="url(#peca)"/>
        <circle r="120" fill="#0f172a" opacity="0.5"/>
        <circle r="55" fill="#64748b"/>
        ${Array.from({ length: 8 })
          .map(
            (_, indice) =>
              `<rect x="-16" y="-178" width="32" height="55" rx="10" fill="#e2e8f0" opacity="0.65" transform="rotate(${indice * 45})"/>`
          )
          .join('')}`;
  }
}

function svgFoto(peca, indice) {
  const paleta = PALETAS[peca.tipo_foto] || PALETAS.motor;
  const [fundo1, fundo2, cor1, cor2, destaque] = paleta;
  const rotacao = indice === 0 ? -5 : 7;
  const nome = escaparXml(peca.nome);
  const sku = escaparXml(peca.sku);
  const carro = escaparXml(peca.carro);
  const categoria = escaparXml(peca.categoria);
  const rotulo = indice === 0 ? 'FRENTE' : indice === 1 ? 'DETALHE' : 'LATERAL';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="${nome}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${fundo1}"/>
      <stop offset="1" stop-color="${fundo2}"/>
    </linearGradient>
    <radialGradient id="luz" cx="50%" cy="34%" r="65%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="peca" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cor1}"/>
      <stop offset="1" stop-color="${cor2}"/>
    </linearGradient>
    <linearGradient id="brilho" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${destaque}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${destaque}" stop-opacity="0"/>
    </linearGradient>
    <filter id="sombra" x="-35%" y="-35%" width="170%" height="170%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect width="900" height="900" fill="url(#bg)"/>
  <rect width="900" height="900" fill="url(#luz)"/>
  <g opacity="0.1" stroke="#ffffff" stroke-width="1">
    <path d="M0 700 L900 700 M0 760 L900 760 M0 820 L900 820"/>
    <path d="M140 700 L40 900 M360 700 L260 900 M580 700 L480 900 M800 700 L700 900"/>
  </g>
  <circle cx="450" cy="390" r="285" fill="url(#brilho)" opacity="0.35"/>
  <g filter="url(#sombra)" transform="translate(450 400) rotate(${rotacao})">
    ${ilustracao(peca.tipo_foto)}
  </g>
  <g>
    <rect x="55" y="755" width="790" height="100" rx="20" fill="#020617" opacity="0.58"/>
    <text x="85" y="798" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#f8fafc">${nome}</text>
    <text x="85" y="830" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#cbd5e1" opacity="0.8">${sku} • ${carro}</text>
    <text x="815" y="812" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="${destaque}" opacity="0.9">${rotulo}</text>
    <text x="815" y="835" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#cbd5e1" opacity="0.55">foto ${indice + 1}</text>
  </g>
  <text x="55" y="65" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="3" fill="#f8fafc" opacity="0.65">${categoria.toUpperCase()}</text>
  <text x="845" y="65" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="${destaque}" opacity="0.8">DEMONSTRAÇÃO</text>
</svg>`;
}

async function gravarFotos(pecasPorSku) {
  await fs.rm(PECAS_UPLOADS, { recursive: true, force: true });
  await fs.mkdir(path.join(PECAS_UPLOADS, '_temp'), { recursive: true });

  for (const peca of pecasPorSku.values()) {
    const total = Number(peca.fotos || 0);
    if (total <= 0) continue;

    const diretorio = path.join(PECAS_UPLOADS, String(peca.id));
    await fs.mkdir(diretorio, { recursive: true });

    for (let indice = 0; indice < total; indice += 1) {
      await fs.writeFile(
        path.join(diretorio, `foto-${indice + 1}.svg`),
        svgFoto(peca, indice),
        'utf8'
      );
    }
  }
}

export async function seedDemo(db) {
  const pecasPorSku = new Map();
  let vendasCriadas = 0;

  await db.exec('BEGIN IMMEDIATE');

  try {
    await db.run('DELETE FROM venda_itens');
    await db.run('DELETE FROM vendas');
    await db.run('DELETE FROM perguntas_ml');
    await db.run('DELETE FROM reclamacoes_ml');
    await db.run('DELETE FROM peca_imagens');
    await db.run('DELETE FROM pecas');

    for (const peca of PECAS_DEMO) {
      const resultado = await db.run(
        `INSERT INTO pecas (
          nome, sku, carro, descricao, categoria, categoria_ml, marca, modelo,
          ano, condicao, numero_oem, garantia, peso_kg, comprimento_cm,
          largura_cm, altura_cm, atributos, ml_titulo, tipo_anuncio,
          quantidade, preco, ml_ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          peca.nome,
          peca.sku,
          peca.carro,
          peca.descricao,
          peca.categoria,
          sugerirCategoriaMl(peca.categoria),
          peca.marca,
          peca.modelo,
          peca.ano,
          peca.condicao,
          peca.numero_oem,
          peca.garantia,
          peca.peso_kg,
          peca.comprimento_cm,
          peca.largura_cm,
          peca.altura_cm,
          JSON.stringify(peca.atributos || {}),
          peca.ml_titulo,
          peca.tipo_anuncio,
          peca.quantidade,
          peca.preco,
          peca.ml_ativo
        ]
      );

      const registro = { ...peca, id: resultado.lastID };
      pecasPorSku.set(peca.sku, registro);

      for (let indice = 0; indice < Number(peca.fotos || 0); indice += 1) {
        await db.run(
          `INSERT INTO peca_imagens (
            peca_id, caminho, nome_arquivo, is_principal, ordem
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            registro.id,
            `/uploads/pecas/${registro.id}/foto-${indice + 1}.svg`,
            `foto-${indice + 1}.svg`,
            indice === 0 ? 1 : 0,
            indice
          ]
        );
      }
    }

    let sequenciaPedido = 1;

    for (const venda of VENDAS_DEMO) {
      const itens = [];

      for (const [sku, quantidade] of venda.itens) {
        const peca = pecasPorSku.get(sku);
        if (!peca) continue;

        itens.push({
          peca,
          sku,
          quantidade: Number(quantidade),
          precoUnitario: Number(peca.preco)
        });
      }

      if (itens.length === 0) continue;

      const valor = Number(
        itens
          .reduce(
            (total, item) => total + item.quantidade * item.precoUnitario,
            0
          )
          .toFixed(2)
      );
      const dataVenda = dataQuando(venda.quando);
      const statusVenda = venda.status || 'concluida';
      const dataRecebimento = ['concluida', 'entregue'].includes(statusVenda)
        ? dataVenda
        : null;
      const orderId = String(2000012345600 + sequenciaPedido);
      sequenciaPedido += 1;

      const resultado = await db.run(
        `INSERT INTO vendas (
          peca_id, order_id, valor, plataforma, cliente, cliente_email,
          cliente_fone, cliente_cpf, cliente_endereco, metodo_pagamento,
          status, data_venda, data_recebimento, last_updated, itens_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itens[0].peca.id,
          orderId,
          valor,
          venda.plataforma || 'Mercado Livre',
          venda.cliente || '',
          venda.email || '',
          venda.fone || '',
          venda.cpf || '',
          venda.endereco ||
            ENDERECOS_DEMO[(sequenciaPedido - 1) % ENDERECOS_DEMO.length],
          venda.pagamento || '',
          statusVenda,
          dataVenda,
          dataRecebimento,
          new Date().toISOString(),
          itens.length
        ]
      );

      for (const item of itens) {
        await db.run(
          `INSERT INTO venda_itens (
            venda_id, sku, descricao, quantidade, preco_unitario
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            resultado.lastID,
            item.sku,
            item.peca.nome,
            item.quantidade,
            item.precoUnitario
          ]
        );
      }

      vendasCriadas += 1;
    }

    let perguntasCriadas = 0;

    for (const pergunta of PERGUNTAS_DEMO) {
      const peca = pecasPorSku.get(pergunta.sku);
      await db.run(
        `INSERT INTO perguntas_ml (
          peca_id, pergunta, resposta, respondida, data_pergunta
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          peca?.id ?? null,
          pergunta.pergunta,
          pergunta.resposta || null,
          pergunta.respondida ? 1 : 0,
          dataQuando(pergunta.quando)
        ]
      );
      perguntasCriadas += 1;
    }

    let reclamacoesCriadas = 0;

    for (const reclamacao of RECLAMACOES_DEMO) {
      const peca = pecasPorSku.get(reclamacao.sku);
      await db.run(
        `INSERT INTO reclamacoes_ml (
          peca_id, pedido_id, motivo, descricao, status, data_reclamacao,
          resolvido_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          peca?.id ?? null,
          reclamacao.pedido_id || null,
          reclamacao.motivo,
          reclamacao.descricao,
          reclamacao.status,
          dataQuando(reclamacao.quando),
          reclamacao.resolvido_em ? dataQuando(reclamacao.resolvido_em) : null
        ]
      );
      reclamacoesCriadas += 1;
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK').catch(() => {});
    throw error;
  }

  await gravarFotos(pecasPorSku);

  return {
    pecas: pecasPorSku.size,
    vendas: vendasCriadas,
    perguntas: PERGUNTAS_DEMO.length,
    reclamacoes: RECLAMACOES_DEMO.length
  };
}
