import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Save, Trash2, CheckSquare, Plus, Columns3, GripVertical } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLocalDate, formatShortDate } from '@/lib/date-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClientForm } from '@/components/ClientForm';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableHeader } from '@/components/table/SortableHeader';
import { ColumnViewButtons } from '@/components/table/ColumnViewButtons';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import { SalesChannelBadge } from '@/components/SalesChannelBadge';

const amazonLogo = '/images/sales-channels/Amazon.png';
const ebayLogo = '/images/sales-channels/Ebay.png';
const etsyLogo = '/images/sales-channels/Etsy.png';
const tiktokLogo = '/images/sales-channels/TikTok.png';
const zelleLogo = '/images/sales-channels/Zelle.png';
const whatsappLogo = '/images/sales-channels/Whatsapp.png';
const cosmeticMpLogo = '/images/sales-channels/Vertex_Rental_Cars.png';

const ORIGEM_OPTIONS = [
  { value: 'all', label: 'Todas as Origens', icon: null },
  { value: 'Presencial', label: 'Presencial', icon: null },
  { value: 'Amazon', label: 'Amazon', icon: <img src={amazonLogo} alt="Amazon" className="h-5 w-5 object-contain" /> },
  { value: 'eBay', label: 'eBay', icon: <img src={ebayLogo} alt="eBay" className="h-5 w-5 object-contain" /> },
  { value: 'Etsy', label: 'Etsy', icon: <img src={etsyLogo} alt="Etsy" className="h-5 w-5 object-contain" /> },
  { value: 'TikTok', label: 'TikTok', icon: <img src={tiktokLogo} alt="TikTok" className="h-5 w-5 object-contain" /> },
  { value: 'Vertex Rental Cars', label: 'Cosmetic MP', icon: <img src={cosmeticMpLogo} alt="Vertex Rental Cars" className="h-5 w-5 object-contain" /> },
  { value: 'Credit Card', label: 'Credit Card', icon: null },
  { value: 'Zelle', label: 'Zelle', icon: <img src={zelleLogo} alt="Zelle" className="h-5 w-5 object-contain" /> },
  { value: 'Online', label: 'Online', icon: null },
  { value: 'WhatsApp', label: 'WhatsApp', icon: <img src={whatsappLogo} alt="WhatsApp" className="h-5 w-5 object-contain" /> },
  { value: 'Newsletter', label: 'Newsletter', icon: null },
  { value: 'Outro', label: 'Outro', icon: null },
];

interface ClientWithOrders {
  id: string;
  nome_razao: string;
  telefone: string | null;
  email: string | null;
  endereco_cidade: string | null;
  totalProdutosVendidos: number;
  valorTotalVendido: number;
  lastOrderDate: string | null;
  // Sales channel of the client's earliest order — where they originally came from,
  // not necessarily where their most recent purchase happened.
  origemChannel: string | null;
}

type SortOption =
  | 'nome_asc'
  | 'nome_desc'
  | 'valor_desc'
  | 'valor_asc'
  | 'qtd_desc'
  | 'qtd_asc'
  | 'data_desc'
  | 'data_asc';

type ColumnDef = {
  id: string;
  label: string;
  headerClassName?: string;
  render: (client: ClientWithOrders) => React.ReactNode;
};

export default function Clients() {
  const [clients, setClients] = useState<ClientWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedClients, setEditedClients] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('nome_asc');
  const [origemFilter, setOrigemFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchClientsWithOrders();
  }, []);

  const fetchClientsWithOrders = async () => {
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, nome_razao, telefone, email, endereco_cidade, canal_principal')
        .order('nome_razao');

      if (clientsError) throw clientsError;

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          client_id,
          canal,
          total,
          data_pedido,
          order_items (
            quantidade
          )
        `);

      if (ordersError) throw ordersError;

      const clientTotals: Record<string, { produtos: number; valor: number; lastDate: string | null; firstDate: string | null; origemChannel: string | null }> = {};

      ordersData?.forEach(order => {
        if (order.client_id) {
          if (!clientTotals[order.client_id]) {
            clientTotals[order.client_id] = { produtos: 0, valor: 0, lastDate: null, firstDate: null, origemChannel: null };
          }

          const totalQuantity = order.order_items?.reduce(
            (sum: number, item: any) => sum + (item.quantidade || 0), 0
          ) || 0;

          clientTotals[order.client_id].produtos += totalQuantity;
          clientTotals[order.client_id].valor += parseFloat(String(order.total || 0));

          if (!clientTotals[order.client_id].lastDate || order.data_pedido > clientTotals[order.client_id].lastDate!) {
            clientTotals[order.client_id].lastDate = order.data_pedido;
          }

          // "Origem" is the channel of the client's earliest order — where they first came from.
          if (!clientTotals[order.client_id].firstDate || order.data_pedido < clientTotals[order.client_id].firstDate!) {
            clientTotals[order.client_id].firstDate = order.data_pedido;
            clientTotals[order.client_id].origemChannel = order.canal;
          }
        }
      });

      const clientsWithOrders: ClientWithOrders[] = (clientsData || []).map(client => ({
        id: client.id,
        nome_razao: client.nome_razao,
        telefone: client.telefone,
        email: client.email,
        endereco_cidade: client.endereco_cidade,
        totalProdutosVendidos: clientTotals[client.id]?.produtos || 0,
        valorTotalVendido: clientTotals[client.id]?.valor || 0,
        lastOrderDate: clientTotals[client.id]?.lastDate || null,
        // Clients with no orders yet (e.g. newsletter-only signups) fall back to their
        // registered canal_principal so "Origem" still shows something meaningful.
        origemChannel: clientTotals[client.id]?.origemChannel || client.canal_principal || null,
      }));

      setClients(clientsWithOrders);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedClients = useMemo(() => {
    let result = clients.filter((client) => {
      return client.nome_razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.telefone && client.telefone.includes(searchTerm));
    });

    if (origemFilter !== 'all') {
      result = result.filter((client) => client.origemChannel === origemFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'nome_asc': return a.nome_razao.localeCompare(b.nome_razao);
        case 'nome_desc': return b.nome_razao.localeCompare(a.nome_razao);
        case 'valor_desc': return b.valorTotalVendido - a.valorTotalVendido;
        case 'valor_asc': return a.valorTotalVendido - b.valorTotalVendido;
        case 'qtd_desc': return b.totalProdutosVendidos - a.totalProdutosVendidos;
        case 'qtd_asc': return a.totalProdutosVendidos - b.totalProdutosVendidos;
        case 'data_desc':
          if (!a.lastOrderDate && !b.lastOrderDate) return 0;
          if (!a.lastOrderDate) return 1;
          if (!b.lastOrderDate) return -1;
          return b.lastOrderDate.localeCompare(a.lastOrderDate);
        case 'data_asc':
          if (!a.lastOrderDate && !b.lastOrderDate) return 0;
          if (!a.lastOrderDate) return 1;
          if (!b.lastOrderDate) return -1;
          return a.lastOrderDate.localeCompare(b.lastOrderDate);
        default: return 0;
      }
    });

    return result;
  }, [clients, searchTerm, sortOption, origemFilter]);

  const handleCellEdit = (clientId: string, field: string, value: string) => {
    setEditedClients(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedClients).length === 0) {
      toast({ title: "Nenhuma alteração", description: "Não há clientes para salvar.", variant: "default" });
      return;
    }

    setSaving(true);
    try {
      const updates = Object.entries(editedClients).map(([id, changes]) => ({ id, ...changes }));

      for (const update of updates) {
        const { error } = await supabase.from('clients').update(update).eq('id', update.id);
        if (error) throw error;
      }

      toast({ title: "Sucesso!", description: `${updates.length} cliente(s) atualizado(s) com sucesso.` });
      setEditedClients({});
      fetchClientsWithOrders();
    } catch (error) {
      console.error('Error saving clients:', error);
      toast({ title: "Erro ao salvar", description: "Ocorreu um erro ao salvar os clientes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) newSet.delete(clientId);
      else newSet.add(clientId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedClients.size === 0) return;

    setSaving(true);
    try {
      const clientsToDelete = Array.from(selectedClients);

      for (const clientId of clientsToDelete) {
        const { data: orders, error: ordersQueryError } = await supabase
          .from('orders').select('id').eq('client_id', clientId);
        if (ordersQueryError) throw ordersQueryError;

        if (orders && orders.length > 0) {
          const orderIds = orders.map(o => o.id);
          const { error: itemsError } = await supabase.from('order_items').delete().in('order_id', orderIds);
          if (itemsError) throw itemsError;

          const { error: ordersError } = await supabase.from('orders').delete().eq('client_id', clientId);
          if (ordersError) throw ordersError;
        }

        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (error) throw error;
      }

      toast({ title: "Sucesso!", description: `${clientsToDelete.length} cliente(s) e seus pedidos excluídos com sucesso.` });
      setSelectedClients(new Set());
      setSelectionMode(false);
      fetchClientsWithOrders();
    } catch (error) {
      console.error('Error deleting clients:', error);
      toast({ title: "Erro ao excluir", description: "Ocorreu um erro ao excluir os clientes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderEditableCell = (client: ClientWithOrders, field: keyof ClientWithOrders, value: string | null) => {
    if (!isAdmin) {
      return <span>{value || '-'}</span>;
    }
    const currentValue = editedClients[client.id]?.[field] ?? value ?? '';
    return (
      <Input
        value={currentValue}
        onChange={(e) => handleCellEdit(client.id, field, e.target.value)}
        className="w-full"
      />
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  // ===== Column definitions =====
  const columns: ColumnDef[] = useMemo(() => [
    {
      id: 'nome_razao', label: 'Nome do Cliente',
      render: (client) => <TableCell className="font-medium">{renderEditableCell(client, 'nome_razao', client.nome_razao)}</TableCell>,
    },
    {
      id: 'telefone', label: 'Contato',
      render: (client) => <TableCell>{renderEditableCell(client, 'telefone', client.telefone)}</TableCell>,
    },
    {
      id: 'email', label: 'Email',
      render: (client) => <TableCell>{renderEditableCell(client, 'email', client.email)}</TableCell>,
    },
    {
      id: 'qtd', label: 'Produtos Vendidos', headerClassName: 'text-right',
      render: (client) => <TableCell className="text-right font-medium">{client.totalProdutosVendidos}</TableCell>,
    },
    {
      id: 'valor', label: 'Valor Vendido', headerClassName: 'text-right',
      render: (client) => <TableCell className="text-right font-medium text-green-600">{formatCurrency(client.valorTotalVendido)}</TableCell>,
    },
    {
      id: 'data', label: 'Data da Venda',
      render: (client) => <TableCell>{client.lastOrderDate ? formatShortDate(parseLocalDate(client.lastOrderDate)) : '-'}</TableCell>,
    },
    {
      id: 'localizacao', label: 'Localização',
      render: (client) => <TableCell>{renderEditableCell(client, 'endereco_cidade', client.endereco_cidade)}</TableCell>,
    },
    {
      id: 'origem', label: 'Origem',
      render: (client) => (
        <TableCell className="text-center">
          {client.origemChannel ? <SalesChannelBadge canal={client.origemChannel} /> : '-'}
        </TableCell>
      ),
    },
  ], [editedClients, isAdmin]);

  const defaultOrder = useMemo(() => columns.map(c => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('clients', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map(c => [c.id, c]));
    return visibleOrderedIds.map(id => map.get(id)).filter((c): c is ColumnDef => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground font-bold">
            Gerencie sua base de clientes {isAdmin && '(Admin)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={handleSaveAll}
              disabled={saving || Object.keys(editedClients).length === 0}
              variant="default"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : `Salvar${Object.keys(editedClients).length > 0 ? ` (${Object.keys(editedClients).length})` : ''}`}
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => {
                if (selectionMode && selectedClients.size > 0) {
                  handleDeleteSelected();
                } else {
                  setSelectionMode(!selectionMode);
                  setSelectedClients(new Set());
                }
              }}
              variant={selectionMode && selectedClients.size > 0 ? "destructive" : "outline"}
              disabled={saving}
            >
              {selectionMode && selectedClients.size > 0 ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir ({selectedClients.size})
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Selecionar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="sticky top-[73px] z-10 bg-background border-b">
          <CardTitle>Lista de Clientes</CardTitle>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
                <SelectItem value="nome_desc">Nome (Z-A)</SelectItem>
                <SelectItem value="valor_desc">Valor Vendido (Maior para menor)</SelectItem>
                <SelectItem value="valor_asc">Valor Vendido (Menor para maior)</SelectItem>
                <SelectItem value="qtd_desc">Qtd. Produtos (Maior para menor)</SelectItem>
                <SelectItem value="qtd_asc">Qtd. Produtos (Menor para maior)</SelectItem>
                <SelectItem value="data_desc">Data da venda (Mais recente)</SelectItem>
                <SelectItem value="data_asc">Data da venda (Mais antiga)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto w-56 bg-popover">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={columnVisibility[col.id] !== false}
                    onCheckedChange={(checked) =>
                      setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ColumnViewButtons isDirty={isDirty} onSave={saveView} onReset={reset} />
          </div>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Dica: arraste o ícone <GripVertical className="inline h-3 w-3" /> ao lado de cada coluna para reordenar.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full max-h-[calc(100vh-320px)] overflow-x-scroll overflow-y-auto border-t scrollbar-always">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-20 shadow-sm">
                  <TableRow className="border-b-2">
                    {selectionMode && isAdmin && <TableHead className="w-[50px] bg-card"></TableHead>}
                    <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedColumns.map(col => (
                        <SortableHeader key={col.id} id={col.id} className={col.headerClassName}>
                          <span>{col.label}</span>
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedClients.map((client) => (
                    <TableRow key={client.id}>
                      {selectionMode && isAdmin && (
                        <TableCell>
                          <Checkbox
                            checked={selectedClients.has(client.id)}
                            onCheckedChange={() => toggleSelection(client.id)}
                          />
                        </TableCell>
                      )}
                      {orderedColumns.map(col => (
                        <React.Fragment key={col.id}>
                          {col.render(client)}
                        </React.Fragment>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSuccess={() => {
              setIsFormOpen(false);
              fetchClientsWithOrders();
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
