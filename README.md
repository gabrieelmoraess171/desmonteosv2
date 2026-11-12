# Sistema Desmonte

Painel interno para desmonte de veículos, gestão de estoque de peças usadas e operação no Mercado Livre.

O projeto está em desenvolvimento, com frontend em React + TypeScript + Vite e backend em Node.js + Express + SQLite. As funcionalidades descritas abaixo estão implementadas no código; a operação com o Mercado Livre depende das credenciais, permissões do aplicativo e validação dos fluxos com uma conta conectada.

## Estrutura

```
DESMONTEOS2/
├── backend/
│   ├── src/
│   │   ├── middleware/    # Autenticação opcional por API_TOKEN
│   │   ├── processors/    # Processamento de lotes, ZIPs e agrupamentos
│   │   ├── routes/        # API: lotes, vendas, atendimento, relatórios, ML e proprietário
│   │   ├── services/      # Dashboard, vendas, envios, XML de NF-e, relatórios, IA, ML e imagens
│   │   ├── utils/         # Categorias de peças e regras de classificação
│   │   └── database.js    # Conexão, schema e migrações SQLite
│   ├── storage/          # XMLs de NF-e e arquivos temporários de importação
│   ├── .env.example
│   ├── package.json
│   └── server.js          # API Express + SQLite
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/ # Gráfico, estoque, ranking e sugestões
│   │   │   ├── Login.tsx       # Formulário de login local de demonstração
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── PecaDetalheModal.tsx
│   │   │   └── ReclamacaoDetalheModal.tsx
│   │   ├── config/        # Categorias, atributos, chaves locais e helpers do ML
│   │   ├── hooks/         # useAuth e provedor da sessão local
│   │   ├── pages/         # NF-e, atendimento, relatórios, marketplaces, nova peça e configurações
│   │   ├── services/      # Cliente da API de lotes (loteService)
│   │   ├── types/         # Tipos da operação de vendas e envios
│   │   ├── utils/         # Saudação, frases motivacionais e iniciais
│   │   ├── App.tsx        # Dashboard, navegação e logout
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── shared/
│   └── types.ts           # Tipos compartilhados
└── README.md
```

## Requisitos

- Node.js 18 ou superior
- npm

## Como rodar

### Backend

```bash
cd backend
npm install
npm run dev
```

A API sobe em `http://localhost:3001`.

Para configurar as integrações, copie [backend/.env.example](./backend/.env.example) para `backend/.env` e preencha as variáveis necessárias. O painel pode usar dados locais sem uma conta do Mercado Livre conectada.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O painel sobe em `http://localhost:3000`. O Vite encaminha chamadas para `/api` e `/uploads` ao backend na porta `3001`.

Para verificar os tipos e gerar o build do frontend:

```bash
cd frontend
npm run build
```

O build verifica TypeScript e empacotamento. Os testes de regressão do backend cobrem classificação de despachos, pedidos a combinar e atualização dos envios, com banco temporário e API simulada:

```bash
cd backend
npm test
```

Os fluxos com a API real precisam de validação funcional separada.

## Dados de demonstração

O projeto tem um seed completo para testar o painel sem depender da integração real com o Mercado Livre. Ele cria:

- 15 peças com fichas técnicas completas e fotos de demonstração (incluindo peças sem foto, sem estoque e pausadas).
- 45 vendas espalhadas pelos últimos 30 dias, com 7 pedidos do Mercado Livre hoje (NF-e), uma venda manual e uma cancelada.
- 10 perguntas, sendo 8 pendentes.
- 6 reclamações, sendo 5 abertas e 1 resolvida.

Para recriar a demonstração:

```bash
cd backend
npm run seed:demo
```

Com a API rodando, também é possível resetar pelo endpoint:

```bash
curl -X POST http://localhost:3001/api/seed
```

O seed é destrutivo: ele substitui peças, vendas, perguntas, reclamações e as fotos em `backend/uploads/pecas/`. Use apenas em ambiente de desenvolvimento.

## Telas

- **Login por PIN**: a rota `/login` é a única porta de entrada do painel. No primeiro acesso, o usuário cria um PIN numérico de 4 a 8 dígitos; nas visitas seguintes, entra com ele. O PIN é conferido no backend (`/api/proprietario/entrar`), fica salvo como hash `scrypt` com salt e nunca retorna ao navegador. A sessão é um token aleatório guardado em `sessionStorage` (`desmonte.ownerToken`), revalidado a cada carregamento (válido por 12 horas, renovado a cada uso). Sem sessão válida, as demais rotas redirecionam para `/login`. Após 6 tentativas erradas em 5 minutos, o backend bloqueia novas tentativas temporariamente.
- **Dashboard**: saudação personalizada, vendas do dia, perguntas, reclamações e anúncios a revisar. O bloco de desempenho alterna entre **Hoje**, **7**, **15** e **30 dias**. Também mostra estoque do Mercado Livre, ranking por categoria e sugestões de melhoria.
- **Nova peça**: página de orientação com abertura manual do cadastro. O formulário não abre sozinho ao navegar.
- **Estoque**: lista todos os anúncios cadastrados, com busca, filtros por status e categoria, edição da ficha completa e exclusão. Clicar em uma peça abre a **ficha completa** com anúncio, aplicação, ficha técnica, peso, medidas, descrição, fotos, preço e estoque. Cada peça é um anúncio individual.
- **Vendas**: pedidos e envios do Mercado Livre, com abas separadas para envios de hoje, próximos dias, entregas a combinar, trânsito, finalizadas e canceladas. A conversa do pedido permite enviar mensagens ao comprador; vendas e envios sincronizam automaticamente a cada 5 segundos enquanto a tela está visível, sem sobrepor sincronizações em andamento. Pedidos sem modalidade de envio rastreável ficam em “A combinar com o comprador”. Pedidos com prazo futuro permanecem em “Próximos dias”, mesmo quando a nota ou etiqueta já está liberada; a tela indica quando é possível antecipar o envio. Envie ZIPs de NF-e em lote: o sistema cruza nome completo, CPF e endereço do comprador no XML com os dados fiscais das vendas. Etiquetas só podem ser emitidas quando disponíveis no Mercado Livre; após gerar o PDF, o sistema registra “Etiqueta emitida” e permite reimprimir.
- **Atendimento**: perguntas sem resposta e reclamações abertas do Mercado Livre. Cada pergunta mostra a foto do anúncio, permite gerar uma **sugestão de resposta com IA** e responder. A ficha do anúncio abre as fotos do Mercado Livre em carrossel. Clicar em uma reclamação abre o **detalhe completo** no padrão visual do Mercado Livre, com comprador, CPF, endereço, telefone, produtos, valores e histórico do caso.
- **NF-e**: mostra apenas vendas disponíveis ou agendadas para o dia, com uma mensagem por venda contendo peça, comprador, CPF, endereço e preço total. Permite enviar individualmente, enviar em lote (uma conversa a cada 3 segundos) e copiar as mensagens. Ao abrir o WhatsApp, a venda é marcada como enviada.
- **Relatórios**: período **Hoje**, **7**, **15** ou **30 dias** com faturamento, vendas, ticket médio, itens, clientes, evolução diária, estoque, formas de pagamento e ranking de produtos. Os indicadores abrem detalhes próprios; previsões de liberação aparecem quando informadas pela API do Mercado Livre, sem estimar datas ausentes. Exporta CSV e gera impressão/PDF.
- **Marketplaces**: conexão OAuth com o Mercado Livre, credenciais do aplicativo, sincronização por recurso (anúncios, pedidos, perguntas, reclamações e reputação), histórico de execuções e painel de reputação real. Também exibe a Redirect URI e a URL do webhook para copiar.
- **Configurações**: nome de exibição, nome da empresa (`Mercadão de Peças` por padrão, exibido abaixo de `DESMONTE OS`), WhatsApp do financeiro e credenciais do Mercado Livre. Como o PIN já protege a entrada no painel, todos os campos ficam editáveis. A seção **Trocar o PIN** altera a chave de acesso informando o PIN atual.
- **Logout / Sair**: disponível no header e no rodapé do menu. Após confirmação, encerra o token no backend (`/api/proprietario/sair`), limpa a sessão local e volta para `/login`. Mantém as configurações da empresa e do WhatsApp.
- **Importar lote**: envia fotos/ZIPs, agrupa por SKU do nome do arquivo e abre o editor de grupos.
- **Editor de anúncios** e **Fila de aprovação**: anúncios novos só são publicados depois de aprovados; anúncios existentes recebem as alterações aprovadas. A exclusão de uma peça encerra primeiro o anúncio vinculado no Mercado Livre.

## Cadastro de peças

O cadastro segue o padrão de ficha do Mercado Livre, em etapas:

1. Anúncio e identificação: nome, título de até 60 caracteres, categoria, categoria ML, SKU e tipo de anúncio.
2. Compatibilidade: veículo, marca, modelo, ano, condição, garantia e código OEM.
3. Ficha técnica da categoria: campos específicos de retrovisores, faróis, parachoques, motor, suspensão, freios, rodas, arrefecimento, elétrica, interior, vidros, escapamento, transmissão e baterias.
4. Preço, estoque, peso e medidas.
5. Descrição.
6. Fotos: até 20 por peça, com capa para o anúncio.

O SKU é sugerido com a inicial do nome configurado em Configurações. Exemplo: para `Gabriel`, a sugestão é `SKU G001`. A categoria pode ser detectada automaticamente por palavras-chave do nome, descrição e aplicação.

O formulário tem navegação por cinco etapas, campos compactos e identificação/fotos em duas colunas no desktop. A etapa **Ficha Mercado Livre** busca categorias oficiais e carrega as características, opções, atributos obrigatórios/condicionais, termos de venda e limites de fotos da API. Os campos avançados ficam disponíveis por uma opção de exibição.

Também permite configurar nome da família do produto, garantia, disponibilidade de estoque, modalidade de envio, frete grátis, retirada, produto de catálogo e loja oficial. O ID oficial da categoria fica em `pecas.ml_category_id`; as configurações adicionais são persistidas em `pecas.ml_config` e os atributos em `pecas.atributos`.

Na mesma etapa, é possível informar grupos de veículos compatíveis com marca, modelo, ano, versão, motor, observações e posições de instalação disponíveis para a categoria. Após aprovação, os grupos são adicionados como compatibilidades do vendedor. Compatibilidades gerenciadas pelo catálogo e sugestões de veículos continuam sujeitas às restrições do Mercado Livre e devem ser revisadas no gerenciador da plataforma.

Na publicação, o backend consulta os requisitos, aplica `family_name` nas contas com a tag `user_product_seller`, envia condição, características, garantia e configurações de frete e valida o corpo em `/items/validate` antes de criar o anúncio. A descrição, o vídeo do YouTube e as compatibilidades também fazem parte do fluxo. A validação pode exigir dados adicionais conforme categoria, conta e produto; salvar uma ficha local não significa que o anúncio já foi publicado.

Referências oficiais: [atributos](https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/atributos), [preço por variação e nome de família](https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/preco-variacao) e [compatibilidades de autopeças](https://developers.mercadolivre.com.br/pt_br/compatibilidades-itens-e-produtos-de-autopecas).

Para publicar anúncios com fotos locais em produção, configure `BACKEND_PUBLIC_URL` no backend com o endereço HTTPS público da API. O Mercado Livre precisa acessar as imagens nesse endereço.

## Configurações locais

Os dados abaixo ficam apenas no navegador (`localStorage`):

| Chave | Uso |
|---|---|
| `desmonte.userName` | Saudação e inicial do SKU sugerido |
| `desmonte.companyName` | Nome exibido abaixo de `DESMONTE OS`; padrão `Mercadão de Peças` |
| `desmonte.financeWhatsApp` | Número que recebe o resumo da NF-e |
| `desmonte.onboardingCompleted` | Marca que o primeiro acesso já foi concluído |

A sessão do painel fica em `sessionStorage`:

| Chave | Uso |
|---|---|
| `desmonte.ownerToken` | Token devolvido pelo backend após o PIN correto; expira em 12 horas |

O envio ao financeiro usa um link `wa.me` com a mensagem já preenchida. O número pode ser digitado com máscara; o código do Brasil (`+55`) é adicionado automaticamente.

## Atendimento com IA

A sugestão de resposta é gerada no backend, sem expor chaves ao navegador. O provedor principal é o **FreeLLMAPI** (`FREELLMAPI_URL`, `FREELLMAPI_KEY` e `FREELLMAPI_MODEL`); se ele falhar, o backend tenta o Google Gemini (`GEMINI_KEY` e, opcionalmente, `GEMINI_MODEL`) e, por último, monta uma sugestão local com os dados da peça. O prompt inclui a ficha da peça e a pergunta do comprador, com instruções para não inventar prazos, descontos ou compatibilidade.

Se nenhum provedor estiver configurado, falhar ou não retornar texto, a interface avisa que a IA não respondeu. A sugestão é salva em `perguntas_ml.sugestao_ia` e pode ser editada antes de responder. Perguntas importadas do Mercado Livre têm `ml_question_id` e, ao responder, o texto é enviado primeiro para a API do ML; só depois a pergunta é marcada como respondida localmente.

## Integração com o Mercado Livre

A integração usa OAuth 2.0 e a API oficial do Mercado Livre. Os dados importados alimentam o Dashboard, o Estoque, o Atendimento e os Relatórios. Com o webhook ativo, o sino consulta novas vendas e reclamações periodicamente; as telas de operação atualizam os dados automaticamente enquanto estão abertas.

### 1. Criar o aplicativo

1. Acesse [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br/pt_br/registre-seu-aplicativo) e crie um aplicativo.
2. Cadastre a **Redirect URI** exatamente como aparece em **Marketplaces → Credenciais**. Ela precisa ser uma URL **HTTPS pública**.
3. **Não use `localhost`/`127.0.0.1` na Redirect URI**: o Mercado Livre bloqueia esse host no CloudFront e a página de autorização responde `403 ERROR / Request blocked` antes mesmo de chegar ao sistema. O padrão `http://localhost:3001/api/mercadolivre/oauth/callback` deixou de funcionar.
4. Para rodar localmente, abra um túnel HTTPS para a porta do backend:
   ```bash
   cloudflared tunnel --url http://localhost:3001
   # ou
   ngrok http 3001
   ```
   Cadastre no aplicativo a URL gerada + `/api/mercadolivre/oauth/callback` (ex.: `https://algo-aleatorio.trycloudflare.com/api/mercadolivre/oauth/callback`) e salve a **mesma** URL em Configurações → Redirect URI ou em `ML_REDIRECT_URI`.
5. Copie o **Client ID** e o **Client Secret**.

### 2. Configurar as credenciais

As credenciais podem ser salvas de duas formas:

- No `backend/.env` (tem prioridade):

```env
ML_CLIENT_ID=seu-client-id
ML_CLIENT_SECRET=seu-client-secret
ML_REDIRECT_URI=https://seu-backend-publico/api/mercadolivre/oauth/callback
ML_SITE_ID=MLB
FRONTEND_URL=http://localhost:3000
```

- Pela tela **Marketplaces**, que grava em `configuracoes` (`ml_client_id`, `ml_client_secret`, `ml_redirect_uri`, `ml_site_id`). O Client Secret nunca é devolvido ao navegador; a API só informa se ele está configurado.

Variáveis opcionais:

| Variável | Uso |
|---|---|
| `ML_WEBHOOK_SECRET` | Exige `?secret=` ou o header `x-ml-webhook-secret` no webhook |
| `ML_WEBHOOK_URL` | URL pública exibida em Marketplaces; padrão derivado da requisição |
| `ML_API_BASE` | Troca a base da API; útil para mock local. Padrão `https://api.mercadolibre.com` |
| `ML_AUTH_BASE` | Troca a URL de autorização. Padrão `https://auth.mercadolivre.com.br/authorization` |
| `BACKEND_PUBLIC_URL` | Endereço HTTPS público da API para o Mercado Livre acessar as fotos na publicação de anúncios |

### 3. Conectar e sincronizar

**Deploy no Render:** no serviço do backend, configure `ML_REDIRECT_URI=https://desmonteos-backend.onrender.com/api/mercadolivre/oauth/callback`, `FRONTEND_URL=https://desmonteos.onrender.com` e `BACKEND_PUBLIC_URL=https://desmonteos-backend.onrender.com`. Cadastre exatamente o mesmo callback no aplicativo do Mercado Livre e faça o redeploy. A porta interna `10000` não faz parte da URL pública.

Quando `ML_REDIRECT_URI` não está definida, o backend deriva o callback de `BACKEND_PUBLIC_URL`, `API_PUBLIC_URL` ou `RENDER_EXTERNAL_URL`. Configurações locais antigas são substituídas por essa origem pública quando disponível; callbacks públicos explícitos continuam tendo prioridade. No Render, o retorno do OAuth também usa o frontend publicado quando a configuração anterior aponta para localhost.

1. Clique em **Conectar conta** e autorize o aplicativo no Mercado Livre.
2. O callback valida o `state`, troca o código por tokens e salva a conta em `ml_integracao`. O token é renovado automaticamente antes de expirar.
3. Clique em **Sincronizar tudo** ou sincronize um recurso individual:
   - **Anúncios e estoque**: lista os itens do vendedor e faz upsert em `pecas` por `ml_item_id`; se não houver vínculo, tenta pelo SKU. Anúncios sem peça correspondente são importados como novas peças, com título, preço, quantidade, categoria, atributos, descrição e thumbnail.
   - **Pedidos**: importa os últimos 30 dias em `vendas`, com comprador, endereço, CPF, telefone, itens, `taxa_ml`, `data_venda`, `ml_pack_id` e `ml_status`. A taxa real passa a ser usada nos Relatórios.
   - **Perguntas**: importa perguntas não respondidas e atualiza as já respondidas em `perguntas_ml`.
   - **Reclamações**: consulta mediações/disputas abertas em `/post-purchase/v1/claims/search` e grava em `reclamacoes_ml`.
   - **Reputação**: consulta `/users/{user_id}`, guarda o `seller_reputation` em `ml_reputacao_cache` e exibe o termômetro real no Dashboard e em Marketplaces. Sem cache, o Dashboard usa a estimativa local.

Ao editar uma peça vinculada, o backend envia primeiro para o Mercado Livre as mudanças de **preço**, **quantidade**, **título** e **status** (ativo/pausado). Se o ML recusar, a alteração local não é aplicada, evitando divergência entre o estoque e o anúncio.

### 4. Webhook (opcional)

O webhook dispara sincronizações ao receber eventos e, com o sistema aberto, os alertas correspondentes no sino e na tela. Também existe sincronização periódica no backend com a conta conectada: vendas a cada 60 segundos, perguntas a cada 2 minutos e reclamações a cada 3 minutos. As perguntas têm uma consulta completa a cada 30 minutos. É possível sincronizar manualmente pelas telas **Vendas** e **Marketplaces**.

Cadastre no aplicativo do Mercado Livre a URL:

```
https://sua-url-publica/api/mercadolivre/webhook
```

Se `ML_WEBHOOK_SECRET` estiver definido, use `?secret=...` ou o header `x-ml-webhook-secret`. Os tópicos tratados disparam sincronizações em segundo plano: `items` (anúncios), `orders`/`orders_v2` (pedidos), `questions` (perguntas) e `claims` (reclamações). O webhook sempre responde rápido; erros de sincronização ficam registrados em `ml_sincronizacoes`.

### Limitações da integração

- Novos anúncios habilitados para o Mercado Livre são publicados pela **Fila de aprovação**, com fotos, categoria, atributos e descrição. A publicação depende de uma conta conectada, dados válidos e fotos acessíveis publicamente.
- A listagem de anúncios usa paginação por `scroll` (`search_type=scan`) porque a API do Mercado Livre limita o `offset` a 1000; contas com mais de mil anúncios são sincronizadas por completo.
- A atualização de anúncios vinculados cobre preço, quantidade, título, status e descrição, inclusive pelo fluxo de aprovação. A atualização remota de fotos, categoria e atributos de anúncios existentes ainda não está implementada.
- O endpoint de reclamações pode variar conforme o aplicativo e o país; a sincronização é tolerante a falhas e não bloqueia os demais recursos.
- OAuth e webhook exigem URL pública HTTPS. Redirect URI com `localhost`/`127.0.0.1` é recusada pelo ML (403 do CloudFront); use um túnel (cloudflared/ngrok) e cadastre a URL pública no aplicativo.
- A integração não tem login multiusuário: qualquer pessoa com acesso ao painel pode conectar/desconectar a conta. Proteja o painel e o backend na rede.

## Acesso por PIN

O PIN é a única credencial do painel e protege todas as telas:

1. Na primeira vez, o PIN numérico de 4 a 8 dígitos é criado na própria tela de login (`/api/proprietario/configurar`), que já abre a sessão.
2. O PIN é armazenado como hash `scrypt` com salt na tabela `configuracoes` (`owner_pin_hash`); nunca é salvo em texto puro nem enviado ao frontend.
3. O backend devolve um token de sessão válido por 12 horas, enviado pelo cabeçalho `x-owner-token`.
4. Após 6 tentativas erradas em 5 minutos, o acesso é bloqueado temporariamente.
5. O PIN pode ser alterado em **Configurações → Trocar o PIN**, informando o PIN atual. **Sair** encerra o token no backend e limpa a sessão do navegador.

Não há login multiusuário nem perfis de membros: o controle é local e single-owner. Se o PIN for perdido, pare o backend e remova a linha `owner_pin_hash` da tabela `configuracoes` no SQLite; ao abrir o login novamente, será possível criar um novo PIN.

## NF-e por venda e envio em lote

A aba **NF-e** transforma cada venda do dia em uma mensagem individual:

```
*Peça (1 UNIDADE)*

*Dados do comprador*
*Nome*
...
*CPF*
...
*Endereço*
...
*Preço total dos produtos*
R$ ...
```

- **Enviar no WhatsApp**: abre a conversa do número financeiro com a mensagem da venda.
- **Copiar mensagem**: copia o texto para a área de transferência.
- **Enviar em lote**: pergunta quantas conversas serão abertas e abre uma por vez, com intervalo de 3 segundos.
- O WhatsApp não confirma o envio automaticamente: é preciso tocar em **Enviar** em cada conversa. O navegador também precisa permitir pop-ups para o painel.

O CPF e o endereço são extraídos do payload do Mercado Livre (formatos `identification.number`, `buyer.address` e variações) e persistidos em `vendas.cliente_cpf` e `vendas.cliente_endereco`.

### XML de NF-e e etiquetas na tela Vendas

- A importação recebe até 20 arquivos por requisição, nos formatos XML ou ZIP, com até 20 MB por arquivo. Cada ZIP deve conter apenas um XML de NF-e válido; o XML descompactado tem limite de 10 MB.
- O sistema cruza nome completo, CPF e endereço do destinatário com os dados dos pedidos. Correspondências ambíguas ou arquivos sem correspondência são informados como falhas, sem associação automática ao pedido errado.
- O XML associado é enviado ao Mercado Livre e armazenado em `backend/storage/nfe-xml/`, com download posterior pelo pedido. O sistema importa notas já emitidas; não emite a NF-e fiscal.
- A geração de etiquetas aceita de 1 a 50 envios sincronizados por requisição e depende da disponibilidade informada pelo Mercado Livre. Após obter o PDF, registra a emissão e permite reimpressão.
- **Avisar entrega** aparece apenas em vendas a combinar com o comprador. Após confirmar que o comprador recebeu a peça, envia a conclusão ao endpoint de feedback do Mercado Livre e move a venda para Finalizadas. A API também verifica a modalidade e bloqueia pedidos cancelados.
- Ao terminar os envios de hoje, a tela passa para os próximos envios disponíveis, organizados pelo prazo da API. Isso não altera as datas nem adia pedidos ainda pendentes. `in_packing_list` indica lista de coleta e aguarda confirmação de despacho pelo ML; não é convertido automaticamente em enviado.
- Envios com substatus `dropped_off`, `picked_up` ou `in_hub` aparecem em trânsito, mesmo quando o status principal ainda é `ready_to_ship`. Coleta confirmada não é sinalizada como atraso de despacho.

### Chat do pedido e fotos recebidas

O chat consulta novas mensagens a cada 5 segundos enquanto está visível. Mensagens somente com anexos são mantidas; fotos aparecem na conversa e podem ser abertas ou baixadas. O backend verifica se o anexo pertence ao pedido e acessa o arquivo com o token da integração, sem expor a credencial ao navegador.

As respostas usam `tag=post_sale`, o limite de caracteres informado pela conversa e o destinatário correspondente ao fluxo (comprador ou agente, quando a conversa está no modelo intermediado). Conversas bloqueadas pelo ML continuam mostrando o histórico e informam o motivo do bloqueio; em reclamação/mediação, a resposta deve seguir pelo Atendimento. Referência: [mensageria pós-venda](https://developers.mercadolivre.com.br/mensagens-post-venda).

## Relatórios

`GET /api/relatorios?periodo=hoje|7|15|30` devolve:

- Resumo do período: faturamento, vendas, ticket médio, itens vendidos e clientes, com comparação ao período anterior.
- Série diária de faturamento.
- Estoque atual: peças, unidades e valor.
- Formas de pagamento.
- Ranking de produtos por faturamento.

Vendas canceladas e reembolsadas são excluídas. Datas `YYYY-MM-DD` são interpretadas ao meio-dia local para evitar deslocamento de fuso. A exportação CSV inclui pedido, data, cliente, CPF, endereço, produtos, pagamento, status e valor; a impressão usa estilos próprios para PDF.

## Endpoints disponíveis

### Peças e fotos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/pecas` | Lista peças com capa, contagem de fotos, categoria e status |
| GET | `/api/pecas/:id` | Busca uma peça pelo ID, incluindo atributos e fotos |
| GET | `/api/pecas/proximo-sku?prefixo=G` | Sugere o próximo SKU no formato `SKU G001` |
| POST | `/api/pecas/classificar` | Detecta categoria por palavras-chave (`nome`, `descricao`, `carro`) |
| POST | `/api/pecas` | Cadastra peça via JSON ou `multipart/form-data` com até 20 fotos |
| PUT | `/api/pecas/:id` | Atualiza a ficha da peça; aceita atualização parcial |
| DELETE | `/api/pecas/:id` | Exclui peça sem vendas associadas e remove suas fotos |
| GET | `/api/pecas/:id/imagens` | Lista as fotos de uma peça |
| POST | `/api/pecas/:id/imagens` | Envia novas fotos, respeitando o total de 20 por peça |
| PATCH | `/api/pecas/:id/imagens/:imagemId/principal` | Define a foto de capa do anúncio |
| DELETE | `/api/pecas/:id/imagens/:imagemId` | Remove uma foto da peça |

### Dashboard e vendas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard` | Totais de peças, vendas, faturamento, perguntas, reclamações e anúncios |
| GET | `/api/dashboard/analytics?periodo=hoje\|7\|15\|30` | Série do período, totais, estoque, ranking por categoria e sugestões |
| GET | `/api/dashboard/ml` | Métricas específicas do Mercado Livre (compatibilidade) |
| GET | `/api/vendas` | Lista as últimas 50 vendas com peça, pedido e SKUs dos itens |
| POST | `/api/vendas` | Registra uma venda simples e baixa 1 unidade do estoque |
| POST | `/api/vendas/nova` | Registra venda com cliente/pagamento e valida estoque |
| GET | `/api/vendas/hoje-ml` | Vendas do Mercado Livre do dia para a aba NF-e |
| GET | `/api/vendas/notificacoes` | Consulta notificações de vendas |
| GET | `/api/vendas/envios` | Lista envios persistidos; `periodo` aceita de 1 a 365 dias, padrão 60 |
| POST | `/api/vendas/envios/sincronizar` | Sincroniza envios do Mercado Livre |
| POST | `/api/vendas/envios/etiquetas` | Gera um PDF de etiquetas para 1 a 50 envios sincronizados |
| POST | `/api/vendas/envios/nfe-xml/lote` | Importa XMLs/ZIPs via multipart no campo `files`, associa aos pedidos e envia ao ML; falhas parciais retornam HTTP 207 |
| GET | `/api/vendas/envios/:orderId/nfe-xml` | Baixa o XML armazenado para o pedido |
| POST | `/api/vendas/envios/:orderId/avisar-entrega` | Informa a conclusão de uma entrega a combinar; exige `confirmada: true` |
| GET | `/api/vendas/:id` | Detalhes da venda |
| GET | `/api/vendas/:id/mensagens` | Consulta a conversa do pedido |
| GET | `/api/vendas/:id/mensagens/:mensagemId/anexos/:anexoId` | Exibe anexo pertencente à conversa; `?download=1` solicita download |
| POST | `/api/vendas/:id/mensagens` | Envia `mensagem` ao comprador |
| POST | `/api/vendas/sincronizar` | Sincroniza pedidos do Mercado Livre |
| POST | `/api/vendas/manual` | Cria ou atualiza um pedido com múltiplos itens |
| POST | `/api/vendas/import` | Importa vários pedidos em lote (máx. 500 por requisição) |

### Atendimento

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/atendimento` | Perguntas pendentes, reclamações abertas e resumo |
| GET | `/api/atendimento/reclamacoes/:id` | Detalhe da reclamação com comprador, CPF, endereço, itens, timeline e venda |
| POST | `/api/atendimento/perguntas/:id/sugestao` | Gera e salva uma sugestão de resposta com Gemini ou fallback local |
| PATCH | `/api/atendimento/perguntas/:id/respondida` | Salva a resposta e, se a pergunta for real do ML, envia via `POST /answers` antes de marcar como respondida |
| PATCH | `/api/atendimento/reclamacoes/:id/resolver` | Marca a reclamação como resolvida |

### Mercado Livre

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/mercadolivre/status` | Configuração, conta conectada, contagens, última sincronização e histórico |
| GET | `/api/mercadolivre/cadastro/categorias?busca=roda` | Sugere categorias oficiais; sem busca, lista as categorias raiz |
| GET | `/api/mercadolivre/cadastro/categorias/:id` | Categoria, atributos, termos de venda e posições de instalação, quando disponíveis |
| GET | `/api/mercadolivre/cadastro/veiculos` | Atributos oficiais do domínio de veículos para compatibilidade |
| POST | `/api/mercadolivre/config` | Salva Client ID, Client Secret, Redirect URI e Site; exige sessão do proprietário |
| GET | `/api/mercadolivre/oauth/iniciar` | Devolve a URL de autorização; `?redirect=1` redireciona direto |
| GET | `/api/mercadolivre/oauth/callback` | Recebe o código, valida o `state`, troca por tokens e volta ao frontend |
| POST | `/api/mercadolivre/desconectar` | Remove a conta e o cache de reputação; mantém os dados importados |
| POST | `/api/mercadolivre/sincronizar` | Sincroniza todos os recursos ou os informados em `recursos`/`recurso` |
| GET | `/api/mercadolivre/reputacao` | Reputação real (cache); `?atualizar=1` força nova consulta |
| GET | `/api/mercadolivre/pecas/:id/imagens` | Consulta as imagens do anúncio vinculado |
| POST | `/api/mercadolivre/pecas/:id/atualizar-anuncio` | Envia preço, quantidade, título e status de uma peça vinculada; a descrição é atualizada pelo fluxo de aprovação |
| POST | `/api/mercadolivre/webhook` | Recebe tópicos do ML e agenda sincronizações em segundo plano |

### Relatórios e proprietário

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/relatorios?periodo=hoje\|7\|15\|30` | Resumo, série diária, estoque, pagamentos e ranking do período |
| GET | `/api/proprietario/status` | Informa se o PIN existe e se a sessão atual está autenticada |
| POST | `/api/proprietario/configurar` | Cria o PIN do proprietário na primeira vez e devolve um token |
| POST | `/api/proprietario/entrar` | Valida o PIN e devolve um token de sessão |
| POST | `/api/proprietario/sair` | Encerra a sessão do token enviado |
| POST | `/api/proprietario/alterar-pin` | Troca o PIN mediante PIN atual e sessão válida |

### Aprovação de anúncios

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/aprovacoes` | Lista aprovações |
| POST | `/api/aprovacoes` | Envia alterações para aprovação |
| POST | `/api/aprovacoes/:id/aprovar` | Aprova alterações e publica o novo anúncio no ML quando habilitado, ou atualiza o anúncio vinculado |
| POST | `/api/aprovacoes/:id/rejeitar` | Rejeita a solicitação |

### Lotes

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/lotes` | Cria um lote de importação de fotos |
| POST | `/api/lotes/:id/upload` | Envia fotos/ZIPs e processa os agrupamentos |
| GET | `/api/lotes` | Lista os lotes importados |
| GET | `/api/lotes/:id` | Retorna um lote com produtos e imagens |
| PUT | `/api/lotes/:id/grupos` | Salva a organização dos grupos |
| DELETE | `/api/lotes/:id` | Exclui um lote e seus arquivos |
| POST | `/api/seed` | Recria a demonstração completa com peças, vendas, perguntas e reclamações (destrutivo) |

## Autenticação e acesso do proprietário

Em desenvolvimento, sem `API_TOKEN`, as rotas de vendas ficam abertas. Se você definir `API_TOKEN` no `backend/.env`, as rotas `POST /api/vendas/manual` e `POST /api/vendas/import` passam a exigir:

```http
Authorization: Bearer <token>
```

As demais rotas continuam sem autenticação de funcionário. A sessão do proprietário protege a edição do nome da empresa, do WhatsApp financeiro e o salvamento das credenciais do Mercado Livre; ela não substitui o `API_TOKEN` nem cria usuários. Conectar e desconectar a conta não exigem login de funcionário.

## Estado atual

- Dashboard diário com cards de vendas, perguntas, reclamações e anúncios a revisar, além do gráfico com seletor de período.
- Estoque completo do Mercado Livre: cada peça é tratada como um anúncio individual, com filtros, status, fotos, ficha completa e edição.
- Ranking agrupado por categoria da peça e sugestões calculadas a partir do estoque, qualidade dos anúncios e atendimento.
- Atendimento com foto do anúncio, sugestão de resposta por FreeLLMAPI/Gemini (com fallback local) e detalhe de reclamação no padrão Mercado Livre.
- Integração OAuth real com o Mercado Livre: conexão da conta, renovação de token, sincronização de anúncios/estoque, pedidos, perguntas, reclamações e reputação.
- Anúncios reais vinculados ao estoque por `ml_item_id` ou SKU; pedidos guardam taxa real (`taxa_ml`) e a tela **Marketplaces** mostra status, contagens, histórico e webhook.
- Reputação real do vendedor em cache (`ml_reputacao_cache`), com selo de origem “API Mercado Livre” e fallback para a estimativa local.
- Edição de estoque de peças vinculadas envia preço, quantidade, título e status ao ML antes de atualizar o banco local.
- Publicação de novos anúncios e atualização de descrição pelo fluxo de aprovação; exclusão de peça vinculada encerra primeiro o anúncio no Mercado Livre.
- Gestão de envios com importação de XML/ZIP de NF-e, associação por dados fiscais, envio do XML ao ML e geração/reimpressão de etiquetas.
- Relatórios com período, comparação, série diária, ranking, exportação CSV e impressão/PDF, usando a taxa real do ML quando disponível.
- Vendas separa envios de hoje dos agendados para datas futuras; agendamentos vencidos não entram nos próximos envios e são identificados para reagendamento. O gráfico permite alternar entre bruto, taxa do ML, líquido e cancelamentos.
- O Estoque identifica anúncios vinculados e abre o anúncio no Mercado Livre; os modais de cadastro e reclamação mantêm cabeçalho visível e rolagem própria.
- NF-e com uma mensagem por venda, CPF, endereço, envio individual e envio em lote com intervalo de 3 segundos.
- Painel inteiro protegido por PIN com hash `scrypt`, bloqueio por tentativas e sessão de 12 horas.
- Login por PIN com React Router, hook `useAuth`, sessão em `sessionStorage`, proteção de páginas e logout que encerra o token no backend.
- Datas de vendas, perguntas e reclamações são convertidas para o fuso local do computador; o “hoje” do dashboard, da NF-e e dos relatórios acompanha a data local, não UTC.
- Cadastro completo no padrão Mercado Livre, com campos por categoria, até 20 fotos, peso, medidas, OEM e compatibilidade.
- Fotos das peças ficam em `backend/uploads/pecas/<peca_id>/` (ignorado pelo Git) e são removidas junto com a peça.
- Navegação lateral recolhível com Dashboard, Nova peça, Importar lote, Estoque, Marketplaces, Atendimento, NF-e, Relatórios e Configurações ligados às telas existentes.
- Interface “liquid glass” escura com animações de entrada, transições entre telas e respeito a `prefers-reduced-motion`.
- API com persistência em SQLite (`backend/database.sqlite`), criado e migrado automaticamente na inicialização.
- Sem autenticação de funcionários; o PIN protege a entrada no painel inteiro. O token opcional (`API_TOKEN`) protege as rotas de criação/importação de pedidos manual e em lote.

## Limitações conhecidas

- O envio em lote pelo WhatsApp abre as conversas uma a uma, mas o usuário precisa confirmar cada envio; `wa.me` não permite envio automático.
- O acesso é local e single-owner, sem login multiusuário ou perfis de membros.
- A integração real com o Gemini depende de uma `GEMINI_KEY` válida; sem FreeLLMAPI e sem Gemini, o sistema usa o fallback local.
- A integração com o Mercado Livre exige um aplicativo próprio (Client ID/Secret) e conexão OAuth; sem isso, o painel continua funcionando com os dados locais e a reputação estimada.
- A edição remota de fotos, categoria e atributos de anúncios existentes ainda não está implementada.
- A operação de NF-e importa XMLs já emitidos; não há emissão fiscal própria. Etiquetas e envio de XML dependem da disponibilidade e das permissões da API do Mercado Livre.
- Os testes automatizados atuais cobrem regras de envios; ainda é necessário ampliar a cobertura e validar os fluxos completos com uma conta conectada.
- OAuth e webhook exigem HTTPS público; `localhost`/`127.0.0.1` na Redirect URI retorna 403 do CloudFront — use ngrok/cloudflared para o fluxo completo.
- O painel não tem autenticação multiusuário; quem tiver acesso pode conectar/desconectar a conta do Mercado Livre.

## Próximos passos

1. Validar os fluxos completos de publicação, aprovação, vendas, XML de NF-e e etiquetas com uma conta conectada e adicionar testes automatizados para as regras críticas.
2. Expandir a edição de anúncios existentes no ML para fotos, categoria e atributos, e ampliar os detalhes da venda com timeline de pagamento, envio e mediação.
3. Adicionar autenticação de funcionários, veículos e movimentações de estoque.
4. Trocar a detecção de SKU por nome de arquivo por OCR/IA e vincular os produtos dos lotes ao estoque.
5. Expandir a análise com IA e os relatórios com dados reais e exportações adicionais.
