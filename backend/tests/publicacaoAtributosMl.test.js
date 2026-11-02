import test from 'node:test';
import assert from 'node:assert/strict';
import { completarPublicacao } from '../src/services/mlCadastroService.js';
import {
  completarAtributosMl,
  derivarAtributosMl,
  normalizarFichaMl
} from '../src/services/iaService.js';

// Percorre o caminho real de uma peça cadastrada pela tela nova:
// ficha oficial -> atributos da IA + derivados -> JSON salvo -> publicação.
const fichaFrontend = {
  categoryId: 'MLB1234',
  atributos: [
    { id: 'BRAND', name: 'Marca', value_type: 'string', tags: { required: true } },
    { id: 'CAR_AND_VAN_MODEL', name: 'Modelo', tags: { required: true } },
    { id: 'YEAR', name: 'Ano', value_type: 'number', tags: { required: true } },
    {
      id: 'POSITION',
      name: 'Posição',
      tags: { required: true },
      values: ['Direita', 'Esquerda']
    },
    {
      id: 'ITEM_CONDITION',
      name: 'Condição',
      tags: { read_only: true },
      values: ['Novo', 'Usado']
    },
    { id: 'SELLER_SKU', name: 'SKU', tags: { read_only: true } }
  ],
  saleTerms: [{ id: 'WARRANTY_TIME', name: 'Garantia', tags: { required: true } }]
};

const fichaPublicacao = {
  categoria: { settings: { max_pictures_per_item: 20 }, children_categories: [] },
  atributos: fichaFrontend.atributos.map((campo) => ({
    id: campo.id,
    name: campo.name,
    tags: campo.tags,
    values: (campo.values || []).map((name) => ({ id: `id-${name}`, name }))
  })),
  termos: [{ id: 'WARRANTY_TIME' }]
};

test('a peça que a tela nova produz passa na validação de publicação', () => {
  const ficha = normalizarFichaMl(fichaFrontend);

  // 1. A IA lê a foto e devolve o que conseguiu comprovar.
  const daIa = completarAtributosMl(ficha, {
    POSITION: 'esquerda',
    // Fora das opções: o ML recusaria, então precisa ser descartado aqui.
    BRAND: '',
    ITEM_CONDITION: 'Usado'
  });

  // 2. Marca, modelo e ano vêm dos campos base do formulário.
  const derivados = derivarAtributosMl(
    {
      titulo: 'Retrovisor Uno 2014',
      nome: 'Retrovisor',
      condicao: 'usado',
      marca: 'Fiat',
      modelo: 'Uno',
      ano: '2014',
      carro: 'Fiat Uno lado esquerdo',
      garantia: '90 dias',
      atributos_ml: daIa
    },
    ficha
  );
  const atributos = { ...daIa, ...derivados };

  assert.deepEqual(atributos, {
    POSITION: 'Esquerda',
    BRAND: 'Fiat',
    CAR_AND_VAN_MODEL: 'Uno',
    YEAR: '2014'
  });

  // 3. O modal salva esses atributos como JSON no campo `atributos` da peça.
  const peca = {
    atributos: JSON.stringify(atributos),
    condicao: 'usado',
    garantia: '90 dias'
  };

  // 4. A publicação converte o mapa em corpo do anúncio e valida.
  const corpo = completarPublicacao(
    {
      title: 'Retrovisor Uno 2014',
      condition: 'used',
      pictures: ['https://imagens.test/foto.jpg'],
      attributes: Object.entries(JSON.parse(peca.atributos)).map(
        ([id, value_name]) => ({ id, value_name })
      )
    },
    peca,
    fichaPublicacao,
    {}
  );

  const porId = Object.fromEntries(
    corpo.attributes.map((atributo) => [atributo.id, atributo])
  );
  // Marca é texto livre na categoria: vai como value_name, sem value_id.
  assert.equal(porId.BRAND.value_name, 'Fiat');
  assert.equal(porId.POSITION.value_name, 'Esquerda');
  assert.equal(porId.ITEM_CONDITION.value_id, '2230581');
  assert.ok(corpo.sale_terms.some((termo) => termo.id === 'WARRANTY_TIME'));
});

test('sem a derivação a publicação quebra, e é por isso que ela existe', () => {
  const soIa = completarAtributosMl(normalizarFichaMl(fichaFrontend), {
    POSITION: 'Direita'
  });

  assert.throws(
    () =>
      completarPublicacao(
        {
          title: 'Retrovisor',
          condition: 'used',
          pictures: [],
          attributes: Object.entries(soIa).map(([id, value_name]) => ({
            id,
            value_name
          }))
        },
        {},
        fichaPublicacao,
        {}
      ),
    /Preencha os atributos obrigatórios/
  );
});
