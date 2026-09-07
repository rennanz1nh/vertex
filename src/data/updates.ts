// Changelog shown on /admin/settings/updates. Newest entry first.
//
// Convention: add a new entry (or append to the current one) every time we commit + push
// a set of user-facing changes — this is the single source of truth for the version number
// shown in the sidebar footer (see AppSidebar.tsx) and in package.json.

export type UpdateSection = {
  category: string;
  items: string[];
};

export type UpdateEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  sections: UpdateSection[];
};

export const UPDATES: UpdateEntry[] = [
  {
    version: "1.17",
    date: "2026-08-15",
    sections: [
      {
        category: "Pedidos",
        items: [
          "Botão \"Marcar como Enviado\" renomeado para \"Marcar como Entregue\" e agora leva o pedido direto para o status Entregue (antes ia para Enviado) — passa a aparecer também em pedidos novos (ainda não salvos), não só em pedidos já existentes",
          "27 pedidos manuais lançados retroativamente (cartão de crédito/Zelle/dinheiro presencial) marcados como Entregue, por se tratarem de vendas antigas",
        ],
      },
    ],
  },
  {
    version: "1.16",
    date: "2026-08-14",
    sections: [
      {
        category: "Pedidos",
        items: [
          "Novo checkbox \"6.5% FL\" ao lado do campo TAX no formulário de pedido: marca e o imposto da Flórida (6,5% do subtotal dos produtos) é preenchido automaticamente, recalculando se os produtos mudarem; desmarque para digitar manualmente",
          "Corrigido: o imposto (TAX) digitado em pedidos manuais era zerado ao salvar — um gatilho do banco recalculava o campo a partir dos itens (sempre 0) e apagava o valor. Agora o imposto informado é preservado e o total não soma o TAX (imposto é apenas informativo, para recolhimento)",
        ],
      },
    ],
  },
  {
    version: "1.15",
    date: "2026-08-01",
    sections: [
      {
        category: "eBay",
        items: [
          "Reconexão do eBay agora volta para a página de onde foi iniciada, em vez de sempre ir para Pedidos",
          "Nova gestão completa de campanhas: encerrar, excluir, pausar/retomar, editar orçamento, adicionar produto, editar taxa de lance e pausar/ativar produto individual dentro de uma campanha",
          "Lance sugerido pelo eBay (Recommendation API) ao criar uma nova campanha",
          "Campanhas de Custo por Venda (CPS) agora mostram os produtos elegíveis reais da conta quando não há restrição de regras",
          "Corrigido: relatório de performance de campanhas mostrando todas as métricas zeradas (comparação incorreta de datas e valores de moeda não interpretados)",
        ],
      },
      {
        category: "Google",
        items: [
          'Nova página "Google Merchant Center": problemas da conta, resumo agregado de status dos produtos e promoções configuradas',
          "Google Cloud Console ganhou 3 novas abas: Tráfego (GA4, dados reais de sessões/usuários/conversões/receita), Faturamento (status da conta e orçamentos) e Acessos/IAM (quem tem permissão no projeto)",
          "Aba BigQuery agora também permite rodar uma consulta real (compras por dia) sobre os dados exportados do GA4, além do status do link",
          "Corrigida falha de segurança: as novas rotas de Google Cloud (Tráfego, IAM, Faturamento, BigQuery) respondiam sem exigir login",
        ],
      },
      {
        category: "Pedidos & Shipping's",
        items: [
          "País do pedido agora é um campo selecionável (antes só mostrava a bandeira, sem poder corrigir)",
          'Novo botão "Marcar como Enviado" dentro do pedido, para atualizar o status com um clique',
          "Bandeira de país corrigida em todos os pedidos que estavam salvos com o nome do país por extenso em vez do código",
          "Pedidos cancelados agora aparecem com a linha em cinza na listagem, para diferenciar rapidamente dos demais",
        ],
      },
      {
        category: "Loja Online",
        items: [
          "Corrigido: o ícone do canal de venda (eBay, Amazon, etc.) mudava de fundo ao passar o mouse por cima",
        ],
      },
    ],
  },
  {
    version: "1.10",
    date: "2026-07-24",
    sections: [
      {
        category: "Configurações",
        items: [
          'Nova aba "Banners" em Configurações: banners de imagem ou vídeo para a home ou qualquer categoria, exibidos na página ou em popup (por página ou em todas), com link, texto sobreposto e fita decorativa em qualquer canto opcionais',
        ],
      },
      {
        category: "Loja Online",
        items: [
          "Favicon corrigido: a folha do ícone do site agora aparece amarela (cor de marca), em vez de preta por engano",
        ],
      },
    ],
  },
  {
    version: "1.08",
    date: "2026-07-18",
    sections: [
      {
        category: "Loja Online",
        items: [
          "Fundo das fotos de produto trocado de cinza-azulado para branco puro, em toda a loja: grid de produtos, carrossel de liquidação, página de produto (foto principal e miniaturas), carrinho, gaveta de carrinho, checkout, página de confirmação/recibo e resultados de busca",
        ],
      },
    ],
  },
  {
    version: "1.07",
    date: "2026-07-18",
    sections: [
      {
        category: "Loja Online",
        items: [
          'Novo "Preço Promocional" nos produtos: quando preenchido e menor que o Valor de venda, a loja mostra o preço original riscado e o promocional em destaque — e é esse valor que é realmente cobrado no checkout',
          "Segurança no Checkout: o preço agora é sempre recalculado no servidor a partir do Supabase (nome, imagem e preço nunca mais vêm do que o cliente envia), impedindo forjar um preço menor ou finalizar a compra de um produto que não está publicado na loja",
        ],
      },
      {
        category: "Mensagens (Chat)",
        items: [
          'Novo chat ao vivo na loja: bolha "Fale Conosco" flutuante em todas as páginas da loja, sem necessidade de login para o visitante',
          'Nova caixa de entrada no admin ("Mensagens", no menu lateral) para responder as conversas, com contador de não lidas em tempo real e notificação por celular (ntfy) a cada nova mensagem, com link direto para a conversa',
        ],
      },
      {
        category: "Produtos",
        items: [
          "Cifrão ($) fixo e não editável em todos os campos de valor financeiro do projeto (Valor de venda, Preço Promocional, Custo, Frete, campos de Pedido, ajustes de preço do eBay/Amazon)",
          "Modal de edição de produto: Lucro e Margem ocultos na seção de Preços — mostra apenas Valor de venda e Preço Promocional, lado a lado, no mesmo tamanho",
        ],
      },
    ],
  },
  {
    version: "1.06",
    date: "2026-07-16",
    sections: [
      {
        category: "Produtos",
        items: [
          'Novo campo "Fita" (faixa colorida sobre a foto do produto, ex: "Best Seller\'s"), com seletor de cor e texto configurável no admin, e exibida na loja e na listagem de produtos',
          "Reorganizado o modal de edição de produto: Fotos primeiro, depois Informações Básicas, Loja Online, Preços, Custos e Frete, Descrição e Drive Link por último",
          "Preços agora em um único card: Online sempre visível, Salão/Cabeleireira e Revendedor ocultos por padrão com botão para mostrar",
          "Tags de categoria da Loja Online agora em preto/branco",
        ],
      },
      {
        category: "Dashboard",
        items: [
          "Logos das plataformas de venda adicionados em Receita por Canal",
          "Gráficos mensais agora com degradê preto (mês mais recente) → cinza claro (mais antigo), igual aos relatórios do eBay",
          "Filtro rápido de período no Dashboard: Hoje, Ontem, 7/30/90 dias, Esse Ano, Last Year, Tempo Todo",
          "Produtos Mais Vendidos ganhou filtro de período próprio (7/30/90 dias, Tempo Todo), independente do filtro geral",
        ],
      },
      {
        category: "Pedidos & Shipping's",
        items: [
          'Unificado "Reconectar eBay" e "Sincronizar eBay" em um único botão — reconecta automaticamente só quando necessário',
          'Corrigido bug que impedia pedidos cancelados no eBay de aparecerem como "Cancelado" (apareciam como "Pronto para Envio")',
          "Ícones de etiqueta trocados pelos novos ícones personalizados (pendente/comprada)",
          "Etiquetas de envio agora geradas em formato 4x6 (etiquetadora térmica)",
          "Novo Packing Slip: gera PDF com produtos, preços, impostos, frete, total, logo da plataforma de venda e logo da transportadora — tudo em inglês",
          'Unificado o fluxo de "Buy Label": o mesmo componente é usado tanto na página de Pedidos quanto na de Shipping\'s, incluindo um segundo botão no topo do editar pedido',
        ],
      },
    ],
  },
];

/** Current app version — always the newest changelog entry. Shown in the sidebar footer. */
export const CURRENT_VERSION = UPDATES[0]?.version ?? "1.05";
