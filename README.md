# Vertex Rental Cars

Plataforma de aluguel de carros da Vertex Rental Cars.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Banco de dados**: Supabase (produtos, pedidos, perfis admin)
- **Pagamentos**: Stripe Checkout
- **Deploy**: Vercel — branch `dev` (preview/teste) e `claude/vertex-rental-cars-setup-qfvbwx` (produção)
- **Estilo**: Tailwind CSS + shadcn/ui (admin)

## Desenvolvimento local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

Variáveis de ambiente necessárias no `.env.local` (nunca commitar):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NTFY_TOPIC` (opcional — tópico do ntfy.sh para notificações por celular da automação de preço eBay/Amazon; configurável também em `/admin/settings`)
- `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET` (credenciais do app na Amazon SP-API)
- `AMAZON_SANDBOX` (opcional — `"true"` para usar o ambiente sandbox da Amazon)
- `DEEPL_API_KEY` (tradução automática de anúncios na Listings Automation do eBay)
- `SHIPPO_API_KEY` (compra/rastreio de etiquetas de envio — cotação, compra, packing slip e rastreamento na página de Shipping's e no Pedido)
- `ANTHROPIC_API_KEY` (Claude API — tradução, análise de anúncios do eBay, geração de produtos, e agora também análise de vídeo/geração de legendas do Social Media MCP)
- `CRON_SECRET` (protege todos os endpoints `/api/cron/*`, incluindo os 3 do Social Media MCP)
- `NEXT_PUBLIC_APP_URL` (base para redirects OAuth — HUB de redes sociais e metadata OAuth do Social Media MCP)
- `META_APP_ID`, `META_APP_SECRET` (app do Meta — HUB de leitura do Instagram/Facebook, e agora também publicação no Instagram via Social Media MCP, veja `SOCIAL_MEDIA_MCP.md`)
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (app do TikTok — mesmo caso do Meta acima)
- `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID` (opcional — HUB (Zernio) em `/admin/social-media/zernio-hub`, alternativa que conecta Instagram/TikTok sem esperar a aprovação do Meta/TikTok, veja `SOCIAL_MEDIA_MCP.md`)

Veja **`SOCIAL_MEDIA_MCP.md`** para a configuração completa do Social Media MCP (credenciais, deploy, conexão com o Claude).

## Deploy

Só existem dois branches: **`dev`** e **produção** (`claude/vertex-rental-cars-setup-qfvbwx`).

1. Todo trabalho vai para **`dev`**. Cada push gera um preview na Vercel (alias `vertex-rental-cars-dev.vercel.app`, via `.github/workflows/preview.yml`). Preview e produção usam o mesmo banco e as mesmas chaves (Supabase, Stripe…).
2. Depois de testar em `dev`, promova para produção avançando o branch de produção:
   `git push origin dev:claude/vertex-rental-cars-setup-qfvbwx`
   A Vercel publica automaticamente em `vertexrentalcar.com`.

Não crie outros branches. Para deploy manual: `vercel --prod`.

## Versionamento

As versões são marcadas com git tags (`v1.01`, `v1.02`, …) e exibidas no rodapé do painel admin.

---

## Project Progress

### v0.1.0 — 2026-09-07
- Projeto iniciado como fork da base técnica do Cosmetic Marketplace (Next.js + Supabase + Stripe + admin), com branding trocado para Vertex Rental Cars. Estrutura de dados/produtos ainda reflete o domínio original (cosméticos) e precisa ser adaptada para aluguel de carros (veículos, reservas, disponibilidade, etc.)
