# Catálogo de referências para identificação de peças

Status: proposta de integração. Nenhuma API externa contratada ou conectada; busca automática por semelhança de foto ainda não foi instalada ou indexada.

## Fluxo pretendido

1. Reunir as referências já confirmadas do estoque: nome, SKU interno, OEM separado, veículo/lado/anos, fotos de produto e fonte da informação.
2. Incorporar somente imagens e dados de um fornecedor que autorize a integração. O catálogo externo complementa o estoque; não substitui o cadastro confirmado.
3. Indexar as fotos em um processo de servidor, fora do carregamento do site. Uma foto nova busca candidatos no índice, sem reenviar todo o catálogo a cada consulta.
4. Exibir referências com fotos, código e origem lado a lado. O operador confirma o candidato; aparência parecida não confirma encaixe ou aplicação.
5. Quando houver OEM legível, priorizar o código exato e conferir lado/veículo. SKU interno nunca é pesquisado como OEM.
6. Registrar confirmações e correções para melhorar o catálogo próprio. Não preencher compatibilidade ou um código inexistente por estimativa visual.

## Acesso externo

- TecDoc/TecAlliance oferece dados de referência, imagens e aplicações por seus produtos de integração. O acesso web de consulta não equivale a autorização para copiar a base para outro sistema. Confirmar licença, cobertura de carroceria/acabamentos brasileiros, atualizações e credenciais antes de ativar um conector: https://tecalliance.com.br/ e https://www.tecalliance.net/products?solution=catalogue-ecommerce.
- Nyris é um mecanismo de busca visual sobre um catálogo fornecido pelo cliente, não uma base universal pronta. Documentação: https://docs.i.nyris.io/.
- Um modelo de embeddings pode comparar ângulos diferentes, mas ainda é visão computacional/IA. Hashes de arquivo ou de imagem detectam duplicatas e não resolvem a identificação por outro ângulo.

## Validação antes de anunciar reconhecimento automático

Testar pares confirmados do estoque: foto de catálogo e foto de bancada, frente/verso, lados diferentes, peças da mesma família e OEMs distintos, etiqueta sem produto e fotos de medidas. Medir os candidatos corretos e os falsos semelhantes com esses dados, sem transformar uma pontuação de distância em certeza de aplicação. Manter revisão quando a referência não existe ou quando códigos/lados conflitam.

## Correção já aplicada nesta atualização

A leitura em lote mantém SKU interno e numero_oem em campos distintos. Pesquisas externas de código agora exigem numero_oem/part_number explícito e não usam o SKU interno como referência de fabricante. A rotina também preserva todos os grupos reconhecidos, sem truncar silenciosamente após vinte produtos.
