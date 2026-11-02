import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completarAtributosMl,
  derivarAtributosMl,
  normalizarFichaMl
} from '../src/services/iaService.js';

// Formato que o frontend recebe de /api/mercadolivre/cadastro/categorias/:id
// e repassa em `fichaMl` para /api/ia/completar-ficha.
const fichaBruta = {
  categoryId: 'MLB1234',
  atributos: [
    { id: 'BRAND', name: 'Marca', value_type: 'string', tags: { required: true } },
    {
      id: 'CAR_AND_VAN_MODEL',
      name: 'Modelo',
      tags: { required: true }
    },
    { id: 'YEAR', name: 'Ano', value_type: 'number', tags: { required: true } },
    {
      id: 'POSITION',
      name: 'Posição',
      values: [
        { name: 'Direita' },
        { name: 'Esquerda' },
        { name: 'Dianteira Direita' }
      ],
      tags: { required: true }
    },
    {
      id: 'ITEM_CONDITION',
      name: 'Condição',
      values: [{ name: 'Novo' }, { name: 'Usado' }],
      tags: { read_only: true }
    },
    { id: 'SELLER_SKU', name: 'SKU', tags: { read_only: true } },
    { id: 'NOT_OFFERED', name: 'Não oferecido', tags: { read_only: false } }
  ],
  saleTerms: [{ id: 'WARRANTY_TIME', name: 'Garantia', tags: { required: true } }]
};

test('normaliza a ficha e descarta campos sem id', () => {
  const ficha = normalizarFichaMl({
    ...fichaBruta,
    atributos: [...fichaBruta.atributos, { name: 'Sem id' }]
  });

  assert.equal(ficha.categoryId, 'MLB1234');
  assert.equal(ficha.atributos.length, fichaBruta.atributos.length);
  assert.deepEqual(ficha.atributos[3].values, [
    'Direita',
    'Esquerda',
    'Dianteira Direita'
  ]);
  assert.equal(ficha.termos[0].id, 'WARRANTY_TIME');
  assert.equal(normalizarFichaMl(null), null);
  assert.equal(normalizarFichaMl({ atributos: [], saleTerms: [] }), null);
});

test('valida o que a IA devolve contra as opções e o read_only da categoria', () => {
  const ficha = normalizarFichaMl(fichaBruta);
  const atributos = completarAtributosMl(ficha, {
    BRAND: '  Fiat ',
    'CAR_AND_VAN_MODEL': 'Uno',
    // Opção inexistente: o ML recusaria, então sai do resultado.
    POSITION: 'Lateral',
    // read_only nunca é enviado pelo vendedor.
    ITEM_CONDITION: 'Usado',
    SELLER_SKU: '1748',
    // Id que a categoria nem tem.
    INVENTADO: 'qualquer coisa'
  });

  assert.deepEqual(atributos, { BRAND: 'Fiat', 'CAR_AND_VAN_MODEL': 'Uno' });
});

test('aceita a posição quando o texto contém uma opção válida e a chave é o nome do campo', () => {
  const ficha = normalizarFichaMl(fichaBruta);
  const atributos = completarAtributosMl(ficha, [
    { id: 'POSITION', value: 'Peça do lado esquerdo' },
    { value: 'Modelo Uno', name: 'CAR_AND_VAN_MODEL' }
  ]);

  assert.equal(atributos.POSITION, 'Esquerda');
  // Atributo sem lista de opções aceita texto livre, como a ficha do ML manda.
  assert.equal(atributos['CAR_AND_VAN_MODEL'], 'Modelo Uno');
});

test('deriva marca, modelo, ano, posição e garantia dos campos base', () => {
  const ficha = normalizarFichaMl(fichaBruta);
  const derivados = derivarAtributosMl(
    {
      titulo: 'Retrovisor Uno 2014',
      nome: 'Retrovisor',
      condicao: 'usado',
      marca: 'Fiat',
      modelo: 'Uno',
      ano: '2014',
      carro: 'Fiat Uno 2010-2016 lado direito',
      garantia: '90 dias'
    },
    ficha
  );

  assert.equal(derivados.BRAND, 'Fiat');
  assert.equal(derivados.CAR_AND_VAN_MODEL, 'Uno');
  assert.equal(derivados.YEAR, '2014');
  assert.equal(derivados.POSITION, 'Direita');
});

test('não deriva ITEM_CONDITION nem SELLER_SKU, que são read_only', () => {
  const ficha = normalizarFichaMl(fichaBruta);
  const derivados = derivarAtributosMl(
    { nome: 'Farol', condicao: 'novo', sku: '1748', marca: 'Fiat' },
    ficha
  );

  assert.equal(derivados.ITEM_CONDITION, undefined);
  assert.equal(derivados.SELLER_SKU, undefined);
});

test('o atributo já preenchido pela IA vence a derivação', () => {
  const ficha = normalizarFichaMl(fichaBruta);
  const derivados = derivarAtributosMl(
    {
      nome: 'Retrovisor lado direito',
      marca: 'Fiat',
      atributos_ml: { POSITION: 'Dianteira Direita' }
    },
    ficha
  );

  assert.equal(derivados.BRAND, 'Fiat');
  assert.equal(derivados.POSITION, undefined);
});

test('sem ficha não deriva nada, para não enviar ids inventados', () => {
  assert.deepEqual(derivarAtributosMl({ marca: 'Fiat' }, null), {});
  assert.deepEqual(completarAtributosMl(null, { BRAND: 'Fiat' }), {});
});
