# Social Media MCP

Servidor MCP (Model Context Protocol) que permite ao Claude analisar vídeos, gerar legendas/hashtags por plataforma, publicar no Instagram e TikTok, agendar publicações e consultar métricas — sempre com um humano no controle da aprovação, a menos que o modo AUTO seja explicitamente ligado por conta.

Este documento cobre o que fica fora do código: credenciais externas, deploy e como conectar o Claude. Para entender a arquitetura, comece por `src/lib/mcp/server.ts` (registro de todas as tools) e `src/lib/social-media/` (toda a lógica de negócio).

## Visão geral do fluxo

```
Vídeo (upload manual OU pasta inbox/) 
  → hash SHA-256 (dedup)
  → análise com IA (Claude vision)
  → geração de legenda/hashtags por plataforma
  → publicação criada como PENDING_APPROVAL
  → aprovação humana (Hub UI ou Claude) — ou auto-aprovação, só se AUTO estiver ligado pra aquela conta
  → publicação (imediata ou agendada)
  → sincronização de métricas (10min → 1h → 6h → 24h → 48h → 7d → semanal)
```

Três modos de operação (`social_automation_settings.require_approval` / `auto_publish_enabled`, mais `social_media_accounts.auto_publish_authorized` por conta):
- **MANUAL**: Claude nunca publica sozinho.
- **APPROVAL** (padrão): Claude prepara tudo, um humano aprova antes de publicar.
- **AUTO**: publica sem revisão humana, mas *só* para contas explicitamente autorizadas em `/admin/social-media/hub` (toggle "Publicar automaticamente") **e** com o interruptor geral em `/admin/social-media/automation` ligado. Qualquer uma das duas chaves desligada = nada publica sozinho.

## Variáveis de ambiente

Nenhuma é exclusiva do Social Media MCP — todas já existem no projeto por outros motivos, mas passam a ser necessárias para este recurso funcionar de ponta a ponta:

| Variável | Já usada antes? | Novo motivo |
|---|---|---|
| `META_APP_ID`, `META_APP_SECRET` | Sim (HUB de leitura) | O app do Meta precisa do escopo `instagram_content_publish` aprovado (veja abaixo) |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Sim (HUB de leitura) | O app do TikTok precisa do produto Content Posting API + auditoria (veja abaixo) |
| `ANTHROPIC_API_KEY` | Sim (tradução, eBay, product-create) | Também usada para analisar vídeos (visão) e gerar legendas/hashtags |
| `CRON_SECRET` | Sim (outros crons) | Agora também protege os 3 crons novos (agendamento, métricas, pasta automática) |
| `NEXT_PUBLIC_APP_URL` | Sim (redirects OAuth) | Usada para montar as URLs de metadata OAuth do próprio MCP (`/.well-known/...`) — se estiver errada ou ausente, a descoberta OAuth do MCP quebra silenciosamente |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Sim | Sem novidade — usadas por todo o projeto |
| `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID` | Não — só para o HUB (Zernio) | Só necessárias se você optar pelo caminho Zernio em vez de (ou além de) esperar a aprovação nativa — veja a seção abaixo |

Não há nenhum segredo de assinatura próprio do MCP: os tokens OAuth do MCP são armazenados como hash SHA-256 no banco (`mcp_oauth_tokens`), não como JWT assinado.

## Credenciais de plataforma — o que fazer agora

**Comece isso o quanto antes** — os dois processos abaixo têm prazo de análise de dias a semanas e não dependem de mais nada estar pronto no código.

### Instagram (Meta App Review)

1. No [Meta for Developers](https://developers.facebook.com/apps), abra o app já usado pelo HUB (mesmo `META_APP_ID`/`META_APP_SECRET`).
2. Adicione o produto **Instagram Graph API**, se ainda não estiver.
3. Solicite o escopo **`instagram_content_publish`** em App Review — é necessário justificar o caso de uso com uma gravação de tela mostrando o fluxo de publicação.
4. A conta do Instagram usada precisa ser **Business ou Creator**, conectada a uma Página do Facebook (mesma exigência que já vale para o HUB de leitura).
5. Depois de aprovado, **reconecte a conta em `/admin/social-media/hub`** — um token emitido antes da aprovação não ganha o escopo novo retroativamente.

### TikTok (Content Posting API)

1. No [TikTok for Developers](https://developers.tiktok.com/apps), abra o app já usado pelo HUB.
2. Adicione o produto **Content Posting API**.
3. Envie o app para **auditoria** (app review). Enquanto não aprovado, a API só permite publicar como **privado** (`SELF_ONLY`) — o adapter já respeita esse limite automaticamente e nunca tenta contornar (ele consulta `creator_info` antes de publicar e recusa se o nível pedido não estiver disponível).
4. Depois de aprovado, **reconecte a conta em `/admin/social-media/hub`**.

⚠️ **Verificação pendente**: os endpoints exatos usados pelos adapters (`src/lib/social-media/platforms/instagram-adapter.ts` e `tiktok-adapter.ts`) foram escritos com base em conhecimento de treino sobre essas APIs — o acesso a `developers.facebook.com` e `developers.tiktok.com` estava bloqueado no ambiente onde este código foi escrito, então não foi possível conferir ao vivo contra a documentação oficial no momento da implementação. Ambos os arquivos têm um comentário no topo detalhando exatamente o que foi/não foi confirmado. **Faça uma publicação de teste real antes de confiar no fluxo em produção.**

## Alternativa: HUB (Zernio)

`/admin/social-media/zernio-hub` é um HUB paralelo ao de cima, conectando Instagram e TikTok através da [Zernio](https://zernio.com) — um serviço que já tem apps próprios aprovados pelo Meta e pelo TikTok, então conectar e publicar funciona sem esperar o App Review/auditoria acima. A troca é: existe uma mensalidade/limite de posts do plano escolhido, e a Zernio guarda os tokens reais do Instagram/TikTok do lado dela, não no nosso banco.

**Como configurar:**

1. Crie uma conta em [zernio.com](https://zernio.com) e um API key em `zernio.com/dashboard/api-keys` — a Zernio já cria um profile **"Default"** junto com a conta.
2. Pegue o `ZERNIO_PROFILE_ID`: `GET https://zernio.com/api/v1/profiles` com `Authorization: Bearer <API_KEY>` devolve a lista de profiles da conta. Use o **`_id`** do profile que você quer usar (não `userId` — esse é o id da conta dona, é o mesmo valor repetido em todos os profiles; quem diferencia um profile do outro é o `_id`).
3. Configure `ZERNIO_API_KEY` e `ZERNIO_PROFILE_ID` na Vercel.
4. Conecte Instagram/TikTok em `/admin/social-media/zernio-hub`. Se você já conectou uma conta direto pelo painel da Zernio antes de configurar isso aqui, ela caiu no profile "Default" — use o `_id` desse profile (`accountUsernames` na resposta do passo 2 mostra o que já está conectado em cada um) em vez de criar um profile novo, senão essa conexão não aparece no nosso HUB.

⚠️ **Verificação pendente (mais forte que a dos adapters nativos)**: `src/lib/social-media/zernio-client.ts` foi escrito a partir de trechos indexados da documentação da Zernio (busca na web) — `docs.zernio.com` estava bloqueado para acesso direto neste ambiente, então a maior parte não foi testada contra uma conta real. Exceção: `GET /v1/profiles` (usado por `listZernioAccounts`) foi confirmado contra uma conta de verdade em 2026-08-17 — foi esse teste real que revelou o erro do `userId` acima, uma doc indexada não teria mostrado isso. O endpoint de conectar (`GET /v1/connect/{platform}`) e o de publicar (`POST /v1/posts`) têm mais confirmação da doc indexada; o de analytics (`GET /v1/analytics/posts`) é inferido por convenção, não confirmado. **Teste o fluxo de conectar uma conta real pelo nosso botão antes de confiar em produção**, e espere ajustar `zernio-client.ts` se o formato real da resposta for diferente.

**Ainda não conectado ao resto do pipeline**: hoje o HUB (Zernio) só cobre conectar/desconectar contas. A fila de aprovação, o agendador e as ferramentas do MCP ainda publicam pelo adapter nativo (`registry.ts`) — ligar os dois é um passo separado, faça sentido pedir isso depois que o fluxo de conexão acima estiver confirmado funcionando com uma conta de verdade.

## Deploy (Vercel)

Três crons novos em `vercel.json`:

| Cron | Frequência | Função |
|---|---|---|
| `/api/cron/social-media-publish-scheduled` | 5 em 5 min | Publica o que estiver agendado e já venceu |
| `/api/cron/social-media-metrics-sync` | 10 em 10 min | Sincroniza métricas conforme o cronograma de recuo |
| `/api/cron/social-media-inbox-watch` | 5 em 5 min | Detecta vídeos novos em `inbox/` e roda o pipeline |

Todos exigem `CRON_SECRET` configurado (mesma variável dos outros crons do projeto).

**Duração de função**: a rota MCP e as rotas de publicação usam `maxDuration = 300` (o polling de processamento do Instagram/TikTok sozinho já pode levar ~60s). Isso exige um plano Vercel que suporte esse limite — no plano Hobby pode ficar mais curto, o que faria publicações lentas precisarem de uma nova tentativa manual.

**Granularidade de cron**: os crons de 5/10 minutos também podem depender do plano Vercel — confirme que o seu suporta essa frequência.

**Binário ffmpeg**: a pasta automática usa `@ffmpeg-installer/ffmpeg` + `@ffprobe-installer/ffprobe` (~140MB combinados) para extrair duração/dimensões/thumbnail de vídeos que chegam sem passar pelo navegador. Testado localmente com um vídeo sintético (funcionou), mas o comportamento do bundle final da Vercel (`@vercel/nft` rastreando os binários corretamente dentro do limite de tamanho de função) não pôde ser verificado de ponta a ponta. **Depois do deploy, solte um vídeo em `inbox/` e confirme que ele aparece com thumbnail em `/admin/social-media/videos`.** Se a extração falhar, o vídeo ainda é registrado (dedup por hash continua funcionando) — só fica sem thumbnail/duração até alguém analisar manualmente.

## Configurando a automação

Em `/admin/social-media/automation`:
- Ligue os toggles que fizerem sentido (análise automática, geração de legenda/hashtags, pasta automática).
- Configure a **conta padrão** por plataforma (Instagram/TikTok) — sem isso, a pasta automática e o `process_video` geram o conteúdo mas não criam a publicação, porque não sabem em qual conta publicar.
- O toggle **"Modo AUTO"** aqui é só a chave geral — cada conta ainda precisa ser autorizada individualmente em `/admin/social-media/hub`.

## Conectando ao Claude

O servidor MCP fica em `https://SEU_DOMINIO/api/mcp`, protegido por OAuth 2.1 (suporta tanto Dynamic Client Registration quanto Client ID Metadata Documents, para compatibilidade com diferentes clientes MCP).

Para adicionar como Custom Connector no Claude:
1. Configurações → Connectors → Add custom connector.
2. URL: `https://SEU_DOMINIO/api/mcp`.
3. O Claude vai redirecionar para a tela de consentimento em `/admin/social-media/mcp-authorize` — faça login com uma conta admin existente e aprove.
4. O token concedido carrega o escopo `mcp:read` (todas as tools de leitura) e, se aprovado, `mcp:write` (tools que criam/alteram dados — analisar vídeo, gerar conteúdo, aprovar, publicar, agendar).

Depois de conectado, tools como `list_videos`, `process_video`, `create_publication`, `publish_publication` e `analyze_content_performance` ficam disponíveis nas conversas com o Claude.

## Testes

```bash
npm test
```

46 testes (Vitest) cobrindo o que é mais arriscado quebrar silenciosamente: a trava atômica que impede publicar o mesmo vídeo duas vezes, os portões do modo AUTO, a recusa do TikTok em contornar a restrição de app não auditado, e o cronograma de sincronização de métricas. Não há testes de integração contra o Supabase real — tudo usa mocks, de propósito, para nenhum `npm test` rodar contra dados de produção.
