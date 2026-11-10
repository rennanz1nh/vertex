import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/lib/admin-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Save, Maximize2, Trash2, CheckSquare, Upload, Image as ImageIcon, Columns3, GripVertical, Store, Download } from 'lucide-react';
import CarModal from '@/components/admin/CarModal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { isInteractiveClickTarget } from '@/lib/utils';
import { getRibbonClassName } from '@/lib/ribbon';
import { MobilePageHeader, MobileSearch, ChipRow, Chip, ChipSelect, MobileList, MobileRow, RowAvatar, RowBadge, MobileFab } from '@/components/admin-v2/mobile';

type CarColumn = {
  id: string;
  field: string;
  label: string;
  cellClassName?: string;
  isLongText?: boolean;
  expandable?: boolean;
  newPlaceholder?: string;
  isCurrency?: boolean;
};

// Blank car (no `id`) passed to CarModal to open it in "create" mode.
const EMPTY_CAR: Record<string, unknown> = {
  name: '', make: '', model: '', year: '', color: '', vin: '', license_plate: '',
  mileage: '', transmission: '', fuel_type: '', seats: '', doors: '', pickup_city: '',
  min_driver_age: '18', features: [], daily_rate: '', description: '', image_url: '',
  ribbon_text: '', ribbon_color: ''
};

const CATEGORY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'big-van', label: 'Big Van' },
  { value: 'luxe', label: 'Luxe' },
  { value: 'sport', label: 'Sport' },
  { value: 'clearance', label: 'Special Offers' },
];

// The fields the phone list reads from a `products` row.
type MobileCar = {
  id: string;
  name?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  license_plate?: string | null;
  pickup_city?: string | null;
  image_url?: string | null;
  store_visible?: boolean | null;
  ribbon_text?: string | null;
  ribbon_color?: string | null;
  daily_rate?: string | number | null;
};

const formatRate = (value: unknown) => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
};

export default function Cars() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [makes, setMakes] = useState<string[]>([]);
  const [editedCars, setEditedCars] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [viewCar, setViewCar] = useState<any>(null);

  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setCars(data || []);

      const uniqueMakes = [...new Set(data?.map((c: any) => c.make).filter(Boolean))] as string[];
      setMakes(uniqueMakes.sort());
    } catch (error) {
      console.error('Error fetching cars:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCars = cars.filter((car: any) => {
    const hasEssentialData = car.name || car.make || car.model || car.vin;
    if (!hasEssentialData) return false;

    const matchesSearch =
      (car.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (car.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (car.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (car.vin || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (car.license_plate || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMake = !makeFilter || makeFilter === 'all' || car.make === makeFilter;
    const matchesCategory =
      !categoryFilter || categoryFilter === 'all' ||
      (Array.isArray(car.store_categories) && car.store_categories.includes(categoryFilter));

    return matchesSearch && matchesMake && matchesCategory;
  });

  const handleCellEdit = (carId: string, field: string, value: string) => {
    setEditedCars(prev => ({
      ...prev,
      [carId]: {
        ...(prev[carId] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedCars).length === 0) {
      toast({ title: "Nenhuma alteração", description: "Não há carros para salvar.", variant: "default" });
      return;
    }

    setSaving(true);
    try {
      const updates = Object.entries(editedCars).map(([id, changes]) => ({ id, ...changes }));
      for (const update of updates) {
        const { error } = await supabase.from('products').update(update).eq('id', update.id);
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: `${updates.length} carro(s) atualizado(s) com sucesso.` });
      setEditedCars({});
      fetchCars();
    } catch (error) {
      console.error('Error saving cars:', error);
      toast({ title: "Erro ao salvar", description: "Ocorreu um erro ao salvar os carros.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (carId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carId", carId);

      const res = await authedFetch("/api/admin/cars/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro no upload");

      const { error: updateError } = await supabase.from('products').update({ image_url: json.url }).eq('id', carId);
      if (updateError) throw updateError;

      toast({ title: "Sucesso!", description: "Imagem enviada com sucesso." });
      fetchCars();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: "Erro no upload", description: error instanceof Error ? error.message : "Ocorreu um erro ao enviar a imagem.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportFields = [
      'name', 'make', 'model', 'year', 'color', 'vin', 'license_plate', 'mileage',
      'transmission', 'fuel_type', 'seats', 'doors', 'pickup_city', 'min_driver_age',
      'daily_rate', 'discounted_daily_rate', 'description', 'image_url',
      'ribbon_text', 'ribbon_color',
    ];

    const rows = (filteredCars as any[]).map(c =>
      Object.fromEntries(exportFields.map(f => [f, c[f] ?? '']))
    );

    const ws = XLSX.utils.json_to_sheet(rows, { header: exportFields });

    ws['!cols'] = exportFields.map(f =>
      f === 'name' || f === 'description' ? { wch: 40 } : { wch: 20 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carros');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `carros_${date}.xlsx`);
  };

  const toggleSelection = (carId: string) => {
    setSelectedCars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(carId)) newSet.delete(carId);
      else newSet.add(carId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCars.size === 0) return;
    setSaving(true);
    try {
      const carsToDelete = Array.from(selectedCars);
      for (const carId of carsToDelete) {
        const { error } = await supabase.from('products').delete().eq('id', carId);
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: `${carsToDelete.length} carro(s) excluído(s) com sucesso.` });
      setSelectedCars(new Set());
      setSelectionMode(false);
      fetchCars();
    } catch (error) {
      console.error('Error deleting cars:', error);
      toast({ title: "Erro ao excluir", description: "Ocorreu um erro ao excluir os carros.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleColumnExpand = (columnName: string) => {
    setExpandedColumns(prev => ({ ...prev, [columnName]: !prev[columnName] }));
  };

  const getColumnWidth = (columnName: string) => {
    if (expandedColumns[columnName]) return 'min-w-[400px]';
    if (columnName === 'description') return 'min-w-[200px] max-w-[200px]';
    if (columnName === 'name') return 'min-w-[200px]';
    return '';
  };

  const renderEditableCell = (car: any, field: string, value: string, isCurrency?: boolean) => {
    if (!isAdmin) {
      return <span>{value || '-'}</span>;
    }
    const currentValue = editedCars[car.id]?.[field] ?? value ?? '';
    const isLongText = field === 'description';
    if (isLongText) {
      return (
        <Textarea
          value={currentValue}
          onChange={(e) => handleCellEdit(car.id, field, e.target.value)}
          className="min-h-[60px] w-full"
        />
      );
    }
    if (isCurrency) {
      return (
        <CurrencyInput
          value={currentValue}
          onChange={(e) => handleCellEdit(car.id, field, e.target.value)}
          className="w-full"
        />
      );
    }
    return (
      <Input
        value={currentValue}
        onChange={(e) => handleCellEdit(car.id, field, e.target.value)}
        className="w-full"
      />
    );
  };

  const renderRibbonCell = (car: any) => {
    const text = car.ribbon_text;
    if (!text) return <span className="text-muted-foreground text-xs">-</span>;
    return (
      <span
        className={`inline-block text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${getRibbonClassName(car.ribbon_color)}`}
      >
        {text}
      </span>
    );
  };

  // ===== Column definitions (excluding image column which stays fixed left) =====
  const columns: CarColumn[] = useMemo(() => [
    { id: 'name', field: 'name', label: 'Nome', newPlaceholder: 'Nome' },
    { id: 'make', field: 'make', label: 'Marca', cellClassName: 'font-medium', newPlaceholder: 'Marca' },
    { id: 'model', field: 'model', label: 'Modelo', newPlaceholder: 'Modelo' },
    { id: 'year', field: 'year', label: 'Ano', newPlaceholder: 'Ano' },
    { id: 'color', field: 'color', label: 'Cor', newPlaceholder: 'Cor' },
    { id: 'vin', field: 'vin', label: 'VIN', newPlaceholder: 'VIN' },
    { id: 'license_plate', field: 'license_plate', label: 'Placa', newPlaceholder: 'Placa' },
    { id: 'mileage', field: 'mileage', label: 'Quilometragem', newPlaceholder: 'Quilometragem' },
    { id: 'transmission', field: 'transmission', label: 'Câmbio', newPlaceholder: 'Câmbio' },
    { id: 'fuel_type', field: 'fuel_type', label: 'Combustível', newPlaceholder: 'Combustível' },
    { id: 'seats', field: 'seats', label: 'Assentos', newPlaceholder: 'Assentos' },
    { id: 'doors', field: 'doors', label: 'Portas', newPlaceholder: 'Portas' },
    { id: 'pickup_city', field: 'pickup_city', label: 'Cidade de retirada', newPlaceholder: 'Cidade' },
    { id: 'fita', field: 'ribbon_text', label: 'Fita', newPlaceholder: 'Texto da fita' },
    { id: 'daily_rate', field: 'daily_rate', label: 'Diária', newPlaceholder: '0.00', isCurrency: true },
    { id: 'description', field: 'description', label: 'Descrição', isLongText: true, expandable: true, newPlaceholder: 'Descrição' },
  ], []);

  const defaultOrder = useMemo(() => columns.map(c => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('cars', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map(c => [c.id, c]));
    return visibleOrderedIds.map(id => map.get(id)).filter((c): c is CarColumn => !!c);
  }, [columns, visibleOrderedIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const totalCols = orderedColumns.length + 2 /* actions + image */ + (selectionMode && isAdmin ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Phones: sticky title, search and filter chips, then one row per car */}
      <MobilePageHeader
        title="Carros"
        count={filteredCars.length}
        actions={[
          { label: 'Exportar Excel', icon: <Download className="h-4 w-4" />, onSelect: handleExport },
          ...(isAdmin ? [{ label: 'Selecionar para excluir', icon: <CheckSquare className="h-4 w-4" />, onSelect: () => { setSelectionMode(true); setSelectedCars(new Set()); } }] : []),
        ]}
      >
        {selectionMode && isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="flex-1 text-sm font-medium">{selectedCars.size} selecionado(s)</span>
            <Button size="sm" variant="destructive" disabled={saving || selectedCars.size === 0} onClick={handleDeleteSelected}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectionMode(false); setSelectedCars(new Set()); }}>
              Cancelar
            </Button>
          </div>
        )}
        <MobileSearch value={searchTerm} onChange={setSearchTerm} placeholder="Nome, marca, modelo, VIN ou placa" />
        <ChipRow>
          <Chip on={!makeFilter && !categoryFilter} onClick={() => { setMakeFilter(''); setCategoryFilter(''); }}>Todos</Chip>
          <ChipSelect
            value={makeFilter || 'all'}
            onChange={(v) => setMakeFilter(v === 'all' ? '' : v)}
            defaultValue="all"
            options={[{ value: 'all', label: 'Marca' }, ...makes.map((m) => ({ value: m, label: m }))]}
          />
          {CATEGORY_OPTIONS.map((c) => (
            <Chip key={c.value} on={categoryFilter === c.value} onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)}>
              {c.label}
            </Chip>
          ))}
        </ChipRow>
      </MobilePageHeader>

      <MobileList isEmpty={filteredCars.length === 0} empty="Nenhum carro encontrado">
        {(filteredCars as unknown as MobileCar[]).map((car) => {
          const carName = car.name || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Carro';
          const selectable = selectionMode && isAdmin;
          const meta = [car.year, car.license_plate, car.pickup_city].filter(Boolean).join(' · ');
          return (
            <MobileRow
              key={car.id}
              selected={selectable && selectedCars.has(car.id)}
              onClick={() => (selectable ? toggleSelection(car.id) : setViewCar(car))}
              leading={
                <>
                  {selectable && <Checkbox checked={selectedCars.has(car.id)} className="pointer-events-none" aria-hidden />}
                  <RowAvatar name={carName} src={car.image_url} square />
                </>
              }
              title={carName}
              meta={meta || undefined}
              badges={
                car.store_visible || car.ribbon_text || editedCars[car.id] ? (
                  <>
                    {car.store_visible && <RowBadge tone="green">Na loja</RowBadge>}
                    {car.ribbon_text && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${getRibbonClassName(car.ribbon_color)}`}>{car.ribbon_text}</span>
                    )}
                    {editedCars[car.id] && <RowBadge tone="amber">Não salvo</RowBadge>}
                  </>
                ) : undefined
              }
              trailing={formatRate(car.daily_rate)}
              trailingSub={car.daily_rate ? <span className="text-[10px] text-muted-foreground">/dia</span> : undefined}
            />
          );
        })}
      </MobileList>
      {!selectionMode && <MobileFab onClick={() => setViewCar(EMPTY_CAR)} />}

      <div className="sticky top-0 z-20 bg-background pb-4 border-b flex flex-wrap justify-between items-center gap-4 max-md:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carros</h1>
          <p className="text-muted-foreground font-bold">
            Gerencie sua frota de carros {isAdmin && '(Admin)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || Object.keys(editedCars).length === 0}
            variant="default"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : `Salvar${Object.keys(editedCars).length > 0 ? ` (${Object.keys(editedCars).length})` : ''}`}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => {
                if (selectionMode && selectedCars.size > 0) {
                  handleDeleteSelected();
                } else {
                  setSelectionMode(!selectionMode);
                  setSelectedCars(new Set());
                }
              }}
              variant={selectionMode && selectedCars.size > 0 ? "destructive" : "outline"}
              disabled={saving}
            >
              {selectionMode && selectedCars.size > 0 ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir ({selectedCars.size})
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Selecionar
                </>
              )}
            </Button>
          )}
          <Button onClick={() => setViewCar(EMPTY_CAR)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Carro
          </Button>
        </div>
      </div>

      <Card className="max-md:hidden">
        <CardHeader className="sticky top-[73px] z-10 bg-background border-b">
          <CardTitle>Lista de Carros</CardTitle>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input
                placeholder="Buscar por nome, marca, modelo, VIN ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={makeFilter || 'all'} onValueChange={(value) => setMakeFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as marcas</SelectItem>
                  {makes.map((make) => (
                    <SelectItem key={make} value={make}>{make}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter || 'all'} onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="big-van">Big Van</SelectItem>
                  <SelectItem value="luxe">Luxe</SelectItem>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="clearance">Special Offers</SelectItem>
                </SelectContent>
              </Select>
              {(makeFilter || categoryFilter) && (
                <Button
                  variant="ghost"
                  onClick={() => { setMakeFilter(''); setCategoryFilter(''); }}
                >
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
                <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto w-64 bg-popover">
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
          </div>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Dica: arraste o ícone <GripVertical className="inline h-3 w-3" /> ao lado de cada coluna para reordenar.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <div className="overflow-x-scroll overflow-y-auto max-h-[calc(100vh-380px)] w-full scrollbar-always">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 border-b shadow-sm">
                    <TableRow>
                      {selectionMode && isAdmin && <TableHead className="w-[50px] bg-card"></TableHead>}
                      <TableHead className="w-[56px] bg-card"></TableHead>
                      <TableHead className="w-[80px] bg-card">Imagem</TableHead>
                      <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        {orderedColumns.map(col => (
                          <SortableHeader key={col.id} id={col.id}>
                            {col.expandable ? (
                              <div className="flex items-center gap-2">
                                <span>{col.label}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleColumnExpand(col.field)}
                                >
                                  <Maximize2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span>{col.label}</span>
                            )}
                          </SortableHeader>
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCars.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={totalCols} className="text-center text-muted-foreground font-bold">
                          Nenhum carro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCars.map((car: any) => (
                        <TableRow
                          key={car.id}
                          className={`cursor-pointer ${editedCars[car.id] ? 'bg-accent/50' : ''}`}
                          onClick={(e) => { if (!isInteractiveClickTarget(e)) setViewCar(car); }}
                        >
                          {selectionMode && isAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedCars.has(car.id)}
                                onCheckedChange={() => toggleSelection(car.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {car.store_visible && (
                                <Store className="h-6 w-6 text-green-600" aria-label="Na loja" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="relative w-16 h-16 rounded overflow-hidden bg-muted flex items-center justify-center">
                              {car.image_url ? (
                                <img
                                  src={car.image_url}
                                  alt={car.name || 'Carro'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-muted-foreground font-bold" />
                              )}
                              {isAdmin && (
                                <label className="absolute inset-0 cursor-pointer bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Upload className="h-5 w-5 text-white" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageUpload(car.id, file);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </TableCell>
                          {orderedColumns.map(col => (
                            <TableCell key={col.id} className={`${col.cellClassName || ''} ${col.expandable ? getColumnWidth(col.field) : col.field === 'name' ? getColumnWidth('name') : ''}`}>
                              {col.id === 'fita' ? renderRibbonCell(car) : renderEditableCell(car, col.field, car[col.field], col.isCurrency)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </div>
        </CardContent>
      </Card>

      <CarModal
        car={viewCar}
        open={!!viewCar}
        onClose={() => setViewCar(null)}
        onChanged={fetchCars}
      />
    </div>
  );
}
