import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2, CheckSquare, Columns3, GripVertical, Image as ImageIcon, Download, Loader2 } from 'lucide-react';
import BookingModal from '@/components/admin/BookingModal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { parseLocalDate, formatShortDate, formatUsDate } from '@/lib/date-utils';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_COLOR, type BookingStatus } from '@/lib/booking-status';
import { isInteractiveClickTarget } from '@/lib/utils';
import { downloadRentalAgreementPdf } from '@/lib/rental-agreement-pdf';
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

type CarOption = { id: string; name: string | null; make: string | null; model: string | null; year: number | null; image_url: string | null; daily_rate: string | null; min_driver_age: number };

type BookingRow = {
  id: string;
  car_id: string;
  status: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  daily_rate: number;
  estimated_total: number;
  customer_name: string | null;
  customer_email: string | null;
  driver_full_name: string;
  driver_date_of_birth: string;
  driver_license_number: string;
  driver_license_state: string;
  driver_license_expiration: string;
  rental_agreement_signed_at: string | null;
  rental_agreement_signature_path: string | null;
  rental_agreement_version: string | null;
  created_at: string;
};

type ColumnDef = {
  id: string;
  label: string;
  headerClassName?: string;
  render: (booking: BookingRow, car: CarOption | undefined) => React.ReactNode;
};

function statusBadge(status: string) {
  const s = (BOOKING_STATUS_LABEL[status as BookingStatus] && status) as BookingStatus | undefined;
  const label = s ? BOOKING_STATUS_LABEL[s] : status;
  const color = s ? BOOKING_STATUS_COLOR[s] : { fg: '#64748b', bg: '#eef1f6', border: '#64748b59' };
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: color.fg, backgroundColor: color.bg, borderColor: color.border }}
    >
      {label}
    </span>
  );
}

const EMPTY_BOOKING: Record<string, unknown> = {};

export default function Bookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [viewBooking, setViewBooking] = useState<Record<string, unknown> | null>(null);
  const [downloadingAgreementId, setDownloadingAgreementId] = useState<string | null>(null);

  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const handleDownloadAgreement = useCallback(async (booking: BookingRow, car: CarOption | undefined) => {
    if (!booking.rental_agreement_signature_path) return;
    setDownloadingAgreementId(booking.id);
    try {
      const { data, error } = await supabase.storage
        .from('vertex-rental-agreements')
        .createSignedUrl(booking.rental_agreement_signature_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('Não foi possível gerar o link da assinatura.');
      await downloadRentalAgreementPdf({
        bookingId: booking.id,
        carName: car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : 'Vehicle',
        pickupDate: formatUsDate(booking.pickup_date),
        pickupTime: booking.pickup_time,
        returnDate: formatUsDate(booking.return_date),
        returnTime: booking.return_time,
        driverFullName: booking.driver_full_name,
        driverDateOfBirth: formatUsDate(booking.driver_date_of_birth),
        driverLicenseNumber: booking.driver_license_number,
        driverLicenseState: booking.driver_license_state,
        driverLicenseExpiration: formatUsDate(booking.driver_license_expiration),
        signedAt: booking.rental_agreement_signed_at ? new Date(booking.rental_agreement_signed_at).toLocaleString('en-US') : '',
        agreementVersion: booking.rental_agreement_version,
        signatureUrl: data.signedUrl,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar PDF', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setDownloadingAgreementId(null);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [{ data: bookingsData, error: bookingsError }, { data: carsData, error: carsError }] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, make, model, year, image_url, daily_rate, min_driver_age'),
      ]);

      if (bookingsError) throw bookingsError;
      if (carsError) throw carsError;

      setBookings((bookingsData || []) as BookingRow[]);
      setCars((carsData || []) as CarOption[]);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const carsById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const car = carsById.get(booking.car_id);
      const carLabel = car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : '';
      const matchesSearch =
        (booking.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (booking.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        carLabel.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, carsById, searchTerm, statusFilter]);

  const toggleSelection = (bookingId: string) => {
    setSelectedBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) newSet.delete(bookingId);
      else newSet.add(bookingId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedBookings.size === 0) return;
    setSaving(true);
    try {
      const idsToDelete = Array.from(selectedBookings);
      const { error } = await supabase.from('bookings').delete().in('id', idsToDelete);
      if (error) throw error;
      toast({ title: 'Sucesso!', description: `${idsToDelete.length} reserva(s) excluída(s) com sucesso.` });
      setSelectedBookings(new Set());
      setSelectionMode(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting bookings:', error);
      toast({ title: 'Erro ao excluir', description: 'Ocorreu um erro ao excluir as reservas.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

  // ===== Column definitions =====
  const columns: ColumnDef[] = useMemo(() => [
    {
      id: 'car', label: 'Carro',
      render: (booking, car) => (
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {car?.image_url ? (
                <img src={car.image_url} alt={car.name || 'Carro'} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="font-medium">{car ? (car.name || [car.year, car.make, car.model].filter(Boolean).join(' ')) : '—'}</span>
          </div>
        </TableCell>
      ),
    },
    {
      id: 'customer', label: 'Cliente',
      render: (booking) => (
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{booking.customer_name || '—'}</span>
            <span className="text-xs text-muted-foreground">{booking.customer_email || '—'}</span>
          </div>
        </TableCell>
      ),
    },
    {
      id: 'dates', label: 'Datas',
      render: (booking) => (
        <TableCell>
          {booking.pickup_date ? formatShortDate(parseLocalDate(booking.pickup_date)) : '—'}
          {' → '}
          {booking.return_date ? formatShortDate(parseLocalDate(booking.return_date)) : '—'}
        </TableCell>
      ),
    },
    {
      id: 'status', label: 'Status',
      render: (booking) => <TableCell>{statusBadge(booking.status)}</TableCell>,
    },
    {
      id: 'daily_rate', label: 'Diária', headerClassName: 'text-right',
      render: (booking) => <TableCell className="text-right">{formatCurrency(Number(booking.daily_rate))}</TableCell>,
    },
    {
      id: 'total', label: 'Total', headerClassName: 'text-right',
      render: (booking) => <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(booking.estimated_total))}</TableCell>,
    },
    {
      id: 'created_at', label: 'Criado em',
      render: (booking) => <TableCell>{booking.created_at ? formatShortDate(new Date(booking.created_at)) : '—'}</TableCell>,
    },
    {
      id: 'agreement', label: 'Contrato', headerClassName: 'text-center',
      render: (booking, car) => (
        <TableCell className="text-center">
          {booking.rental_agreement_signed_at && booking.rental_agreement_signature_path ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={downloadingAgreementId === booking.id}
              onClick={() => handleDownloadAgreement(booking, car)}
              title="Baixar Rental Agreement assinado"
            >
              {downloadingAgreementId === booking.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
      ),
    },
  ], [downloadingAgreementId, handleDownloadAgreement]);

  const defaultOrder = useMemo(() => columns.map((c) => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('bookings', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.id, c]));
    return visibleOrderedIds.map((id) => map.get(id)).filter((c): c is ColumnDef => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const totalCols = orderedColumns.length + (selectionMode && isAdmin ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
          <p className="text-muted-foreground font-bold">
            Histórico completo de reservas e aluguéis {isAdmin && '(Admin)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                if (selectionMode && selectedBookings.size > 0) {
                  handleDeleteSelected();
                } else {
                  setSelectionMode(!selectionMode);
                  setSelectedBookings(new Set());
                }
              }}
              variant={selectionMode && selectedBookings.size > 0 ? 'destructive' : 'outline'}
              disabled={saving}
            >
              {selectionMode && selectedBookings.size > 0 ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir ({selectedBookings.size})
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Selecionar
                </>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setViewBooking(EMPTY_BOOKING)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Reserva
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="sticky top-[73px] z-10 bg-background border-b">
          <CardTitle>Lista de Reservas</CardTitle>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input
                placeholder="Buscar por cliente, email ou carro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>{BOOKING_STATUS_LABEL[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusFilter !== 'all' && (
                <Button variant="ghost" onClick={() => setStatusFilter('all')}>
                  Limpar Filtros
                </Button>
              )}

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
                  {columns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={columnVisibility[col.id] !== false}
                      onCheckedChange={(checked) =>
                        setColumnVisibility((prev) => ({ ...prev, [col.id]: !!checked }))
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
                    <SortableContext items={orderedColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedColumns.map((col) => (
                        <SortableHeader key={col.id} id={col.id} className={col.headerClassName}>
                          <span>{col.label}</span>
                        </SortableHeader>
                      ))}
                    </SortableContext>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={totalCols || 1} className="text-center text-muted-foreground font-bold">
                        Nenhuma reserva encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer"
                        onClick={(e) => { if (!isInteractiveClickTarget(e)) setViewBooking(booking); }}
                      >
                        {selectionMode && isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selectedBookings.has(booking.id)}
                              onCheckedChange={() => toggleSelection(booking.id)}
                            />
                          </TableCell>
                        )}
                        {orderedColumns.map((col) => (
                          <React.Fragment key={col.id}>
                            {col.render(booking, carsById.get(booking.car_id))}
                          </React.Fragment>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <BookingModal
        booking={viewBooking}
        cars={cars}
        open={!!viewBooking}
        onClose={() => setViewBooking(null)}
        onChanged={fetchData}
      />
    </div>
  );
}
