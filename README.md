# Sistema Desmonte

Painel interno para desmonte de veículos, gestão de estoque de peças usadas e operação no Mercado Livre.

## Estrutura

```
DESMONTEOS2/
├── backend/
│   ├── src/
│   │   ├── middleware/    # Autenticação opcional por API_TOKEN
│   │   ├── processors/    # Processamento de lotes, ZIPs e agrupamentos
│   │   ├── routes/        # API: lotes, vendas, atendimento, relatórios, ML e proprietário
│   │   ├── services/      # Dashboard, vendas, relatórios, IA, ML e imagens de peças
│   │   ├── utils/         # Categorias de peças e regras de classificação
│   │   └── database.js    # Conexão, schema e migrações SQLite
│   ├── .env.example
│   ├── package.json
│   └── server.js          # API Express + SQLite
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/ # Gráfico, estoque, ranking e sugestões
│   │   │   ├── Onboarding.tsx
│   │   │   ├── PecaDetalheModal.tsx
│   │   │   └── ReclamacaoDetalheModal.tsx
│   │   ├── config/        # Categorias, atributos, chaves locais e helpers do ML
│   │   ├── pages/         # NF-e, atendimento, relatórios, marketplaces, nova peça e configurações
│   │   ├── services/      # Cliente da API de lotes (loteService)
│   │   ├── utils/         # Saudação, frases motivacionais e iniciais
│   │   ├── App.tsx        # Dashboard, onboarding, navegação e logout
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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O painel sobe em `http://localhost:3000`. O Vite encaminha chamadas para `/api` e `/uploads` ao backend na porta `3001`.

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

- **Primeiro acesso**: tela de boas-vindas exibida uma única vez, em tela cheia, para perguntar como o usuário gostaria de ser chamado. O nome fica salvo no navegador e a empresa assume automaticamente `Mercadão de Peças`, que pode ser alterada depois. Usuários que já têm nome salvo não passam pelo onboarding novamente.
- **Dashboard**: saudação personalizada, vendas do dia, perguntas, reclamações e anúncios a revisar. O bloco de desempenho alterna entre **Hoje**, **7**, **15** e **30 dias**. Também mostra estoque do Mercado Livre, ranking por categoria e sugestões de melhoria.
- **Nova peça**: página de orientação com abertura manual do cadastro. O formulário não abre sozinho ao navegar.
- **Estoque**: lista todos os anúncios cadastrados, com busca, filtros por status e categoria, edição da ficha completa e exclusão. Clicar em uma peça abre a **ficha completa** com anúncio, aplicação, ficha técnica, peso, medidas, descrição, fotos, preço e estoque. Cada peça é um anúncio individual.
- **Vendas**: aba acima do Estoque com pedidos do Mercado Livre, título, SKU, ID, comprador (incluindo o apelido da conta quando o nome não está disponível), status, valores, detalhes e chat para consultar e responder ao comprador. Cada venda pode ficar fora da fila, disponível para hoje, agendada para uma data ou marcada como enviada ao financeiro.
- **Atendimento**: perguntas sem resposta e reclamações abertas do Mercado Livre. Cada pergunta mostra a foto do anúncio, permite gerar uma **sugestão de resposta com IA** e responder. A ficha do anúncio abre as fotos do Mercado Livre em carrossel. Clicar em uma reclamação abre o **detalhe completo** no padrão visual do Mercado Livre, com comprador, CPF, endereço, telefone, produtos, valores e histórico do caso.
- **NF-e**: mostra apenas vendas disponíveis ou agendadas para o dia, com uma mensagem por venda contendo peça, comprador, CPF, endereço e preço total. Permite enviar individualmente, enviar em lote (uma conversa a cada 3 segundos) e copiar as mensagens. Ao abrir o WhatsApp, a venda é marcada como enviada.
- **Relatórios**: período **Hoje**, **7**, **15** ou **30 dias** com faturamento, vendas, ticket médio, itens, clientes, evolução diária, estoque, formas de pagamento e ranking de produtos. Os indicadores abrem detalhes próprios; previsões de liberação aparecem quando informadas pela API do Mercado Livre, sem estimar datas ausentes. Exporta CSV e gera impressão/PDF.
- **Marketplaces**: conexão OAuth com o Mercado Livre, credenciais do aplicativo, sincronização por recurso (anúncios, pedidos, perguntas, reclamações e reputação), histórico de execuções e painel de reputação real. Também exibe a Redirect URI e a URL do webhook para copiar.
- **Configurações**: nome de exibição e, com o acesso do proprietário desbloqueado por PIN, nome da empresa (`Mercadão de Peças` por padrão, exibido abaixo de `DESMONTE OS`) e WhatsApp do financeiro. Também permite criar, alterar e sair do acesso do proprietário.
- **Sair**: disponível no rodapé do menu. Volta para a tela de boas-vindas, limpa o nome e a conclusão do onboarding, mantém empresa e WhatsApp e bloqueia o acesso do proprietário.
- **Importar lote**: envia fotos/ZIPs, agrupa por SKU do nome do arquivo e abre o editor de grupos.
- **Análise com IA**, **Editor de anúncios** e **Fila de aprovação** continuam como placeholders.

## Cadastro de peças

O cadastro segue o padrão de ficha do Mercado Livre, em etapas:

1. Anúncio e identificação: nome, título de até 60 caracteres, categoria, categoria ML, SKU e tipo de anúncio.
2. Compatibilidade: veículo, marca, modelo, ano, condição, garantia e código OEM.
3. Ficha técnica da categoria: campos específicos de retrovisores, faróis, parachoques, motor, suspensão, freios, rodas, arrefecimento, elétrica, interior, vidros, escapamento, transmissão e baterias.
4. Preço, estoque, peso e medidas.
5. Descrição.
6. Fotos: até 20 por peça, com capa para o anúncio.

O SKU é sugerido com a inicial do nome configurado em Configurações. Exemplo: para `Gabriel`, a sugestão é `SKU G001`. A categoria pode ser detectada automaticamente por palavras-chave do nome, descrição e aplicação.

## Configurações locais

Os dados abaixo ficam apenas no navegador (`localStorage`):

| Chave | Uso |
|---|---|
| `desmonte.userName` | Saudação e inicial do SKU sugerido |
| `desmonte.companyName` | Nome exibido abaixo de `DESMONTE OS`; padrão `Mercadão de Peças` |
| `desmonte.financeWhatsApp` | Número que recebe o resumo da NF-e |
| `desmonte.onboardingCompleted` | Marca que o primeiro acesso já foi concluído |

A sessão do proprietário fica em `sessionStorage`:

| Chave | Uso |
|---|---|
| `desmonte.ownerToken` | Token temporário devolvido pelo backend após o PIN correto |

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
ML_REDIRECT_URI=http://localhost:3001/api/mercadolivre/oauth/callback
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

### 3. Conectar e sincronizar

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

O webhook habilita a atualização automática das vendas e reclamações e, com o sistema aberto, os alertas correspondentes no sino e na tela. Sem webhook, sincronize pedidos pela aba **Vendas** e vendas/reclamações pela tela **Marketplaces**.

Cadastre no aplicativo do Mercado Livre a URL:

```
https://sua-url-publica/api/mercadolivre/webhook
```

Se `ML_WEBHOOK_SECRET` estiver definido, use `?secret=...` ou o header `x-ml-webhook-secret`. Os tópicos tratados disparam sincronizações em segundo plano: `items` (anúncios), `orders`/`orders_v2` (pedidos), `questions` (perguntas) e `claims` (reclamações). O webhook sempre responde rápido; erros de sincronização ficam registrados em `ml_sincronizacoes`.

### Limitações da integração

- Publicar novos anúncios pelo sistema ainda não está implementado; a sincronização cria/atualiza peças a partir de anúncios existentes.
- A listagem de anúncios usa paginação por `scroll` (`search_type=scan`) porque a API do Mercado Livre limita o `offset` a 1000; contas com mais de mil anúncios são sincronizadas por completo.
- A edição de anúncio cobre preço, quantidade, título e status. Descrição, fotos, categoria e atributos ainda são editados apenas localmente.
- O endpoint de reclamações pode variar conforme o aplicativo e o país; a sincronização é tolerante a falhas e não bloqueia os demais recursos.
- OAuth e webhook exigem URL pública HTTPS. Redirect URI com `localhost`/`127.0.0.1` é recusada pelo ML (403 do CloudFront); use um túnel (cloudflared/ngrok) e cadastre a URL pública no aplicativo.
- A integração não tem login multiusuário: qualquer pessoa com acesso ao painel pode conectar/desconectar a conta. Proteja o painel e o backend na rede.

## Proprietário e PIN

O nome da empresa e o WhatsApp financeiro são restritos ao proprietário:

1. Na primeira vez, o proprietário cria um PIN numérico de 4 a 8 dígitos em **Configurações**.
2. O PIN é armazenado como hash `scrypt` com salt na tabela `configuracoes` (`owner_pin_hash`); nunca é salvo em texto puro nem enviado ao frontend.
3. O backend devolve um token de sessão válido por 12 horas, enviado pelo cabeçalho `x-owner-token`.
4. Após 6 tentativas erradas em 5 minutos, o acesso é bloqueado temporariamente.
5. O PIN pode ser alterado informando o PIN atual. **Sair** remove a sessão e o token do navegador.

Não há login multiusuário nem perfis de membros: o controle é local e single-owner. Se o PIN for perdido, pare o backend e remova a linha `owner_pin_hash` da tabela `configuracoes` no SQLite; ao abrir Configurações novamente, será possível criar um novo PIN.

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
| POST | `/api/mercadolivre/config` | Salva Client ID, Client Secret, Redirect URI e Site |
| GET | `/api/mercadolivre/oauth/iniciar` | Devolve a URL de autorização; `?redirect=1` redireciona direto |
| GET | `/api/mercadolivre/oauth/callback` | Recebe o código, valida o `state`, troca por tokens e volta ao frontend |
| POST | `/api/mercadolivre/desconectar` | Remove a conta e o cache de reputação; mantém os dados importados |
| POST | `/api/mercadolivre/sincronizar` | Sincroniza todos os recursos ou os informados em `recursos`/`recurso` |
| GET | `/api/mercadolivre/reputacao` | Reputação real (cache); `?atualizar=1` força nova consulta |
| POST | `/api/mercadolivre/pecas/:id/atualizar-anuncio` | Envia preço, quantidade, título e status de uma peça vinculada |
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

As demais rotas continuam sem autenticação de funcionário. O PIN do proprietário protege apenas a edição do nome da empresa e do WhatsApp financeiro; ele não substitui o `API_TOKEN` nem cria usuários.

## Estado atual

- Dashboard diário com cards de vendas, perguntas, reclamações e anúncios a revisar, além do gráfico com seletor de período.
- Estoque completo do Mercado Livre: cada peça é tratada como um anúncio individual, com filtros, status, fotos, ficha completa e edição.
- Ranking agrupado por categoria da peça e sugestões calculadas a partir do estoque, qualidade dos anúncios e atendimento.
- Atendimento com foto do anúncio, sugestão de resposta por FreeLLMAPI/Gemini (com fallback local) e detalhe de reclamação no padrão Mercado Livre.
- Integração OAuth real com o Mercado Livre: conexão da conta, renovação de token, sincronização de anúncios/estoque, pedidos, perguntas, reclamações e reputação.
- Anúncios reais vinculados ao estoque por `ml_item_id` ou SKU; pedidos guardam taxa real (`taxa_ml`) e a tela **Marketplaces** mostra status, contagens, histórico e webhook.
- Reputação real do vendedor em cache (`ml_reputacao_cache`), com selo de origem “API Mercado Livre” e fallback para a estimativa local.
- Edição de estoque de peças vinculadas envia preço, quantidade, título e status ao ML antes de atualizar o banco local.
- Relatórios com período, comparação, série diária, ranking, exportação CSV e impressão/PDF, usando a taxa real do ML quando disponível.
- Vendas separa envios de hoje dos agendados para datas futuras; agendamentos vencidos não entram nos próximos envios e são identificados para reagendamento. O gráfico permite alternar entre bruto, taxa do ML, líquido e cancelamentos.
- O Estoque identifica anúncios vinculados e abre o anúncio no Mercado Livre; os modais de cadastro e reclamação mantêm cabeçalho visível e rolagem própria.
- NF-e com uma mensagem por venda, CPF, endereço, envio individual e envio em lote com intervalo de 3 segundos.
- Nome da empresa e WhatsApp financeiro protegidos por PIN de proprietário com hash `scrypt` e sessão de 12 horas.
- Onboarding de primeiro acesso e botão **Sair** que retorna à tela de boas-vindas e limpa os dados de sessão.
- Datas de vendas, perguntas e reclamações são convertidas para o fuso local do computador; o “hoje” do dashboard, da NF-e e dos relatórios acompanha a data local, não UTC.
- Cadastro completo no padrão Mercado Livre, com campos por categoria, até 20 fotos, peso, medidas, OEM e compatibilidade.
- Fotos das peças ficam em `backend/uploads/pecas/<peca_id>/` (ignorado pelo Git) e são removidas junto com a peça.
- Navegação lateral recolhível com Dashboard, Nova peça, Importar lote, Estoque, Marketplaces, Atendimento, NF-e, Relatórios e Configurações ligados às telas existentes.
- Interface “liquid glass” escura com animações de entrada, transições entre telas e respeito a `prefers-reduced-motion`.
- API com persistência em SQLite (`backend/database.sqlite`), criado e migrado automaticamente na inicialização.
- Sem autenticação de funcionários; o PIN do proprietário protege apenas nome da empresa e WhatsApp financeiro, e o token opcional (`API_TOKEN`) protege as rotas de criação/importação de pedidos.

## Limitações conhecidas

- O envio em lote pelo WhatsApp abre as conversas uma a uma, mas o usuário precisa confirmar cada envio; `wa.me` não permite envio automático.
- O acesso do proprietário é local e single-owner, sem login multiusuário ou perfis de membros.
- A integração real com o Gemini depende de uma `GEMINI_KEY` válida; sem FreeLLMAPI e sem Gemini, o sistema usa o fallback local.
- A integração com o Mercado Livre exige um aplicativo próprio (Client ID/Secret) e conexão OAuth; sem isso, o painel continua funcionando com os dados locais e a reputação estimada.
- Publicar novos anúncios, editar fotos/descrição no ML e gerenciar envios ainda não estão implementados.
- OAuth e webhook exigem HTTPS público; `localhost`/`127.0.0.1` na Redirect URI retorna 403 do CloudFront — use ngrok/cloudflared para o fluxo completo.
- O painel não tem autenticação multiusuário; quem tiver acesso pode conectar/desconectar a conta do Mercado Livre.

## Próximos passos

1. Publicar novos anúncios e editar fotos, descrição, categoria e atributos diretamente no Mercado Livre.
2. Criar a tela de detalhe da venda com timeline de pagamento, envio e mediação.
3. Adicionar autenticação de funcionários, veículos e movimentações de estoque.
4. Trocar a detecção de SKU por nome de arquivo por OCR/IA e vincular os produtos dos lotes ao estoque.
5. Expandir a análise com IA e os relatórios com dados reais e exportações adicionais.
