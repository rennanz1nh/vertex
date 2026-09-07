import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Save, Maximize2, Trash2, CheckSquare, Upload, Image as ImageIcon, Columns3, GripVertical, Store, Download, Package } from 'lucide-react';
import ProductModal from '@/components/admin/ProductModal';
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
import { BoxManagerDialog } from '@/components/shipping/BoxManagerDialog';
import { loadBoxes, type BoxPreset } from '@/lib/shippo-types';
import { authedFetch } from '@/lib/admin-fetch';

type ProductColumn = {
  id: string;
  field: string;
  label: string;
  cellClassName?: string;
  isLongText?: boolean;
  expandable?: boolean;
  newPlaceholder?: string;
  isCurrency?: boolean;
};

// Blank product (no `id`) passed to ProductModal to open it in "create" mode.
const EMPTY_PRODUCT: Record<string, unknown> = {
  'Quantidade no Estoque': '', 'SKU': '', 'ASIN': '', 'UPC': '', 'EAN': '', 'Produto Nome': '', 'Volume': '',
  'Marca': '', 'Linha do produto': '',
  'Valor de venda (Online)': '', 'Lucro sobre produto (Online)': '', 'Margem Lucro (Online)': '',
  'Informacoes dos produtos / descricao': '', 'image_url': '',
  'ribbon_text': '', 'ribbon_color': ''
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [marcaFilter, setMarcaFilter] = useState('');
  const [linhaFilter, setLinhaFilter] = useState('');
  const [marcas, setMarcas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[]>([]);
  const [editedProducts, setEditedProducts] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [showBoxManager, setShowBoxManager] = useState(false);
  const [boxes, setBoxes] = useState<BoxPreset[]>([]);

  const { profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchProducts();
    loadBoxes(authedFetch).then(setBoxes);
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('Produto Nome');

      if (error) throw error;
      setProducts(data || []);

      const uniqueMarcas = [...new Set(data?.map((p: any) => p.Marca).filter(Boolean))] as string[];
      const uniqueLinhas = [...new Set(data?.map((p: any) => p['Linha do produto']).filter(Boolean))] as string[];
      setMarcas(uniqueMarcas.sort());
      setLinhas(uniqueLinhas.sort());
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product: any) => {
    const hasEssentialData = product['Produto Nome'] || product.SKU || product.UPC || product.Marca;
    if (!hasEssentialData) return false;

    const matchesSearch =
      (product['Produto Nome'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.SKU || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.ASIN || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.UPC || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.EAN || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMarca = !marcaFilter || marcaFilter === 'all' || product.Marca === marcaFilter;
    const matchesLinha = !linhaFilter || linhaFilter === 'all' || product['Linha do produto'] === linhaFilter;

    return matchesSearch && matchesMarca && matchesLinha;
  });

  const handleCellEdit = (productId: string, field: string, value: string) => {
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(editedProducts).length === 0) {
      toast({ title: "Nenhuma alteração", description: "Não há produtos para salvar.", variant: "default" });
      return;
    }

    setSaving(true);
    try {
      const updates = Object.entries(editedProducts).map(([id, changes]) => ({ id, ...changes }));
      for (const update of updates) {
        const { error } = await supabase.from('products').update(update).eq('id', update.id);
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: `${updates.length} produto(s) atualizado(s) com sucesso.` });
      setEditedProducts({});
      fetchProducts();
    } catch (error) {
      console.error('Error saving products:', error);
      toast({ title: "Erro ao salvar", description: "Ocorreu um erro ao salvar os produtos.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (productId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('products').update({ image_url: publicUrl }).eq('id', productId);
      if (updateError) throw updateError;

      toast({ title: "Sucesso!", description: "Imagem enviada com sucesso." });
      fetchProducts();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: "Erro ao enviar imagem", description: "Ocorreu um erro ao enviar a imagem.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportFields = [
      'Quantidade no Estoque', 'SKU', 'ASIN', 'UPC', 'EAN', 'Produto Nome', 'Volume', 'Marca',
      'Linha do produto',
      'Valor de venda (Online)', 'Lucro sobre produto (Online)', 'Margem Lucro (Online)',
      'Informacoes dos produtos / descricao', 'image_url',
      'ribbon_text', 'ribbon_color',
    ];

    const rows = (filteredProducts as any[]).map(p =>
      Object.fromEntries(exportFields.map(f => [f, p[f] ?? '']))
    );

    const ws = XLSX.utils.json_to_sheet(rows, { header: exportFields });

    // Column widths
    ws['!cols'] = exportFields.map(f =>
      f === 'Produto Nome' || f === 'Informacoes dos produtos / descricao'
        ? { wch: 40 }
        : { wch: 20 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `produtos_${date}.xlsx`);
  };

  const toggleSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) newSet.delete(productId);
      else newSet.add(productId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.size === 0) return;
    setSaving(true);
    try {
      const productsToDelete = Array.from(selectedProducts);
      for (const productId of productsToDelete) {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: `${productsToDelete.length} produto(s) excluído(s) com sucesso.` });
      setSelectedProducts(new Set());
      setSelectionMode(false);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting products:', error);
      toast({ title: "Erro ao excluir", description: "Ocorreu um erro ao excluir os produtos.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleColumnExpand = (columnName: string) => {
    setExpandedColumns(prev => ({ ...prev, [columnName]: !prev[columnName] }));
  };

  const getColumnWidth = (columnName: string) => {
    if (expandedColumns[columnName]) return 'min-w-[400px]';
    if (columnName === 'Informacoes dos produtos / descricao') return 'min-w-[200px] max-w-[200px]';
    if (columnName === 'Produto Nome') return 'min-w-[200px]';
    return '';
  };

  const renderEditableCell = (product: any, field: string, value: string, isCurrency?: boolean) => {
    if (!isAdmin) {
      return <span>{value || '-'}</span>;
    }
    const currentValue = editedProducts[product.id]?.[field] ?? value ?? '';
    const isLongText = field === 'Informacoes dos produtos / descricao';
    if (isLongText) {
      return (
        <Textarea
          value={currentValue}
          onChange={(e) => handleCellEdit(product.id, field, e.target.value)}
          className="min-h-[60px] w-full"
        />
      );
    }
    if (isCurrency) {
      return (
        <CurrencyInput
          value={currentValue}
          onChange={(e) => handleCellEdit(product.id, field, e.target.value)}
          className="w-full"
        />
      );
    }
    return (
      <Input
        value={currentValue}
        onChange={(e) => handleCellEdit(product.id, field, e.target.value)}
        className="w-full"
      />
    );
  };

  const renderRibbonCell = (product: any) => {
    const text = product.ribbon_text;
    if (!text) return <span className="text-muted-foreground text-xs">-</span>;
    return (
      <span
        className={`inline-block text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${getRibbonClassName(product.ribbon_color)}`}
      >
        {text}
      </span>
    );
  };

  // ===== Column definitions (excluding image column which stays fixed left) =====
  const columns: ProductColumn[] = useMemo(() => [
    { id: 'estoque', field: 'Quantidade no Estoque', label: 'Quantidade no Estoque', newPlaceholder: 'Quantidade' },
    { id: 'sku', field: 'SKU', label: 'SKU', cellClassName: 'font-medium', newPlaceholder: 'SKU' },
    { id: 'asin', field: 'ASIN', label: 'ASIN', newPlaceholder: 'ASIN' },
    { id: 'upc', field: 'UPC', label: 'UPC', newPlaceholder: 'UPC' },
    { id: 'ean', field: 'EAN', label: 'EAN', newPlaceholder: 'EAN' },
    { id: 'nome', field: 'Produto Nome', label: 'Produto Nome', newPlaceholder: 'Nome' },
    { id: 'fita', field: 'ribbon_text', label: 'Fita', newPlaceholder: 'Texto da fita' },
    { id: 'volume', field: 'Volume', label: 'Volume', newPlaceholder: 'Volume' },
    { id: 'marca', field: 'Marca', label: 'Marca', newPlaceholder: 'Marca' },
    { id: 'linha', field: 'Linha do produto', label: 'Linha do produto', newPlaceholder: 'Linha' },
    { id: 'venda_online', field: 'Valor de venda (Online)', label: 'Valor de venda (Online)', newPlaceholder: '0.00', isCurrency: true },
    { id: 'lucro_online', field: 'Lucro sobre produto (Online)', label: 'Lucro sobre produto (Online)', newPlaceholder: '0.00', isCurrency: true },
    { id: 'margem_online', field: 'Margem Lucro (Online)', label: 'Margem Lucro (Online)', newPlaceholder: 'Margem Online' },
    { id: 'descricao', field: 'Informacoes dos produtos / descricao', label: 'Informacoes dos produtos / descricao', isLongText: true, expandable: true, newPlaceholder: 'Descrição' },
  ], []);

  const defaultOrder = useMemo(() => columns.map(c => c.id), [columns]);
  const { columnOrder, columnVisibility, setColumnVisibility, handleDragEnd, reset, saveView, isDirty, visibleOrderedIds } =
    useColumnPreferences('products', defaultOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map(c => [c.id, c]));
    return visibleOrderedIds.map(id => map.get(id)).filter((c): c is ProductColumn => !!c);
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
      <div className="sticky top-0 z-20 bg-background pb-4 border-b flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground font-bold">
            Gerencie seu catálogo de produtos {isAdmin && '(Admin)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          {isAdmin && (
            <Button
              onClick={handleSaveAll}
              disabled={saving || Object.keys(editedProducts).length === 0}
              variant="default"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : `Salvar${Object.keys(editedProducts).length > 0 ? ` (${Object.keys(editedProducts).length})` : ''}`}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowBoxManager(true)} variant="outline">
              <Package className="mr-2 h-4 w-4" />
              Caixas ({boxes.length})
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => {
                if (selectionMode && selectedProducts.size > 0) {
                  handleDeleteSelected();
                } else {
                  setSelectionMode(!selectionMode);
                  setSelectedProducts(new Set());
                }
              }}
              variant={selectionMode && selectedProducts.size > 0 ? "destructive" : "outline"}
              disabled={saving}
            >
              {selectionMode && selectedProducts.size > 0 ? (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir ({selectedProducts.size})
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
            <Button onClick={() => setViewProduct(EMPTY_PRODUCT)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="sticky top-[73px] z-10 bg-background border-b">
          <CardTitle>Lista de Produtos</CardTitle>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground font-bold" />
              <Input
                placeholder="Buscar por nome, SKU, ASIN, UPC ou EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={marcaFilter || 'all'} onValueChange={(value) => setMarcaFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as marcas</SelectItem>
                  {marcas.map((marca) => (
                    <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={linhaFilter || 'all'} onValueChange={(value) => setLinhaFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por linha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as linhas</SelectItem>
                  {linhas.map((linha) => (
                    <SelectItem key={linha} value={linha}>{linha}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(marcaFilter || linhaFilter) && (
                <Button
                  variant="ghost"
                  onClick={() => { setMarcaFilter(''); setLinhaFilter(''); }}
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
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={totalCols} className="text-center text-muted-foreground font-bold">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product: any) => (
                        <TableRow
                          key={product.id}
                          className={`cursor-pointer ${editedProducts[product.id] ? 'bg-accent/50' : ''}`}
                          onClick={(e) => { if (!isInteractiveClickTarget(e)) setViewProduct(product); }}
                        >
                          {selectionMode && isAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedProducts.has(product.id)}
                                onCheckedChange={() => toggleSelection(product.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {product.store_visible && (
                                <Store className="h-6 w-6 text-green-600" aria-label="Na loja" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="relative w-16 h-16 rounded overflow-hidden bg-muted flex items-center justify-center">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product['Produto Nome'] || 'Produto'}
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
                                      if (file) handleImageUpload(product.id, file);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </TableCell>
                          {orderedColumns.map(col => (
                            <TableCell key={col.id} className={`${col.cellClassName || ''} ${col.expandable ? getColumnWidth(col.field) : col.field === 'Produto Nome' ? getColumnWidth('Produto Nome') : ''}`}>
                              {col.id === 'fita' ? renderRibbonCell(product) : renderEditableCell(product, col.field, product[col.field], col.isCurrency)}
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

      <ProductModal
        product={viewProduct}
        open={!!viewProduct}
        onClose={() => setViewProduct(null)}
        onChanged={fetchProducts}
      />
      <BoxManagerDialog open={showBoxManager} onOpenChange={setShowBoxManager} boxes={boxes} onChange={setBoxes} />
    </div>
  );
}
