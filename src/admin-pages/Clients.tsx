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

const CLIENT_TYPE_BADGE: Record<string, string> = {
  Individual: 'bg-gray-100 text-gray-700',
  Corporate: 'bg-blue-100 text-blue-700',
  'Insurance Replacement': 'bg-purple-100 text-purple-700',
};

const ORIGEM_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'Website', label: 'Website' },
  { value: 'Phone', label: 'Phone' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Repeat Customer', label: 'Repeat Customer' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Insurance Referral', label: 'Insurance Referral' },
  { value: 'Other', label: 'Other' },
];

const LICENSE_STATUS: Record<'valid' | 'expiring' | 'expired' | 'none', { label: string; className: string }> = {
  valid: { label: 'Valid', className: 'bg-green-100 text-green-700' },
  expiring: { label: 'Expiring soon', className: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-700' },
  none: { label: 'On file: none', className: 'bg-gray-100 text-gray-500' },
};

function licenseStatus(expiration: string | null): keyof typeof LICENSE_STATUS {
  if (!expiration) return 'none';
  const exp = parseLocalDate(expiration).getTime();
  const now = Date.now();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  if (exp < now) return 'expired';
  if (exp - now < sixtyDays) return 'expiring';
  return 'valid';
}

interface ClientWithBookings {
  id: string;
  nome_razao: string;
  tipo: string;
  telefone: string | null;
  email: string | null;
  endereco_cidade: string | null;
  license_expiration: string | null;
  totalRentals: number;
  totalSpent: number;
  lastRentalDate: string | null;
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
  render: (client: ClientWithBookings) => React.ReactNode;
};

export default function Clients() {
  const [clients, setClients] = useState<ClientWithBookings[]>([]);
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
    fetchClientsWithBookings();
  }, []);

  const fetchClientsWithBookings = async () => {
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, nome_razao, tipo, telefone, email, endereco_cidade, canal_principal, license_expiration')
        .order('nome_razao');

      if (clientsError) throw clientsError;

      // Bookings aren't linked to a client by id (the checkout flow doesn't require an
      // account) — matched by email instead, same as the storefront upserts a client
      // record when a trip is requested.
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('customer_email, status, pickup_date, estimated_total')
        .neq('status', 'cancelled');

      if (bookingsError) throw bookingsError;

      const totalsByEmail: Record<string, { rentals: number; spent: number; lastDate: string | null }> = {};
      bookingsData?.forEach((b) => {
        const key = (b.customer_email || '').trim().toLowerCase();
        if (!key) return;
        if (!totalsByEmail[key]) totalsByEmail[key] = { rentals: 0, spent: 0, lastDate: null };
        totalsByEmail[key].rentals += 1;
        totalsByEmail[key].spent += parseFloat(String(b.estimated_total || 0));
        if (!totalsByEmail[key].lastDate || b.pickup_date > totalsByEmail[key].lastDate!) {
          totalsByEmail[key].lastDate = b.pickup_date;
        }
      });

      const clientsWithBookings: ClientWithBookings[] = (clientsData || []).map((client) => {
        const key = (client.email || '').trim().toLowerCase();
        const totals = totalsByEmail[key];
        return {
          id: client.id,
          nome_razao: client.nome_razao,
          tipo: client.tipo,
          telefone: client.telefone,
          email: client.email,
          endereco_cidade: client.endereco_cidade,
          license_expiration: client.license_expiration,
          totalRentals: totals?.rentals || 0,
          totalSpent: totals?.spent || 0,
          lastRentalDate: totals?.lastDate || null,
          origemChannel: client.canal_principal,
        };
      });

      setClients(clientsWithBookings);
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
        case 'valor_desc': return b.totalSpent - a.totalSpent;
        case 'valor_asc': return a.totalSpent - b.totalSpent;
        case 'qtd_desc': return b.totalRentals - a.totalRentals;
        case 'qtd_asc': return a.totalRentals - b.totalRentals;
        case 'data_desc':
          if (!a.lastRentalDate && !b.lastRentalDate) return 0;
          if (!a.lastRentalDate) return 1;
          if (!b.lastRentalDate) return -1;
          return b.lastRentalDate.localeCompare(a.lastRentalDate);
        case 'data_asc':
          if (!a.lastRentalDate && !b.lastRentalDate) return 0;
          if (!a.lastRentalDate) return 1;
          if (!b.lastRentalDate) return -1;
          return a.lastRentalDate.localeCompare(b.lastRentalDate);
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
      fetchClientsWithBookings();
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
        // A client may still carry legacy orders from the old order-management flow —
        // clean those up too so the delete doesn't leave orphaned rows.
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

      toast({ title: "Sucesso!", description: `${clientsToDelete.length} cliente(s) excluído(s) com sucesso.` });
      setSelectedClients(new Set());
      setSelectionMode(false);
      fetchClientsWithBookings();
    } catch (error) {
      console.error('Error deleting clients:', error);
      toast({ title: "Erro ao excluir", description: "Ocorreu um erro ao excluir os clientes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderEditableCell = (client: ClientWithBookings, field: keyof ClientWithBookings, value: string | null) => {
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
      id: 'nome_razao', label: 'Client Name',
      render: (client) => <TableCell className="font-medium">{renderEditableCell(client, 'nome_razao', client.nome_razao)}</TableCell>,
    },
    {
      id: 'tipo', label: 'Type',
      render: (client) => (
        <TableCell>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CLIENT_TYPE_BADGE[client.tipo] || 'bg-gray-100 text-gray-700'}`}>
            {client.tipo}
          </span>
        </TableCell>
      ),
    },
    {
      id: 'telefone', label: 'Contact',
      render: (client) => <TableCell>{renderEditableCell(client, 'telefone', client.telefone)}</TableCell>,
    },
    {
      id: 'email', label: 'Email',
      render: (client) => <TableCell>{renderEditableCell(client, 'email', client.email)}</TableCell>,
    },
    {
      id: 'license', label: "License",
      render: (client) => {
        const status = LICENSE_STATUS[licenseStatus(client.license_expiration)];
        return (
          <TableCell>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
          </TableCell>
        );
      },
    },
    {
      id: 'qtd', label: 'Total Rentals', headerClassName: 'text-right',
      render: (client) => <TableCell className="text-right font-medium">{client.totalRentals}</TableCell>,
    },
    {
      id: 'valor', label: 'Total Spent', headerClassName: 'text-right',
      render: (client) => <TableCell className="text-right font-medium text-green-600">{formatCurrency(client.totalSpent)}</TableCell>,
    },
    {
      id: 'data', label: 'Last Rental',
      render: (client) => <TableCell>{client.lastRentalDate ? formatShortDate(parseLocalDate(client.lastRentalDate)) : '-'}</TableCell>,
    },
    {
      id: 'localizacao', label: 'Location',
      render: (client) => <TableCell>{renderEditableCell(client, 'endereco_cidade', client.endereco_cidade)}</TableCell>,
    },
    {
      id: 'origem', label: 'Source',
      render: (client) => <TableCell>{client.origemChannel || '-'}</TableCell>,
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
            Locatários e contas corporativas {isAdmin && '(Admin)'}
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
                <SelectItem value="valor_desc">Valor Gasto (Maior para menor)</SelectItem>
                <SelectItem value="valor_asc">Valor Gasto (Menor para maior)</SelectItem>
                <SelectItem value="qtd_desc">Locações (Maior para menor)</SelectItem>
                <SelectItem value="qtd_asc">Locações (Menor para maior)</SelectItem>
                <SelectItem value="data_desc">Última locação (Mais recente)</SelectItem>
                <SelectItem value="data_asc">Última locação (Mais antiga)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
              fetchClientsWithBookings();
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
