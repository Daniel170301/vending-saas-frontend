import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
// NUEVO: Importamos el icono del lápiz (Pencil)
import { Package, Plus, Download, Search, Camera, FileSpreadsheet, Image as ImageIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type AlmacenProduct = {
  id?: number;
  name: string;
  category: string;
  subcategory: string;
  unit_cost: number;
  sale_price: number;
  stock_warehouse: number;
  min_stock: number;
  capacidad: number;
  unit_type: string;
  barcode: string;
  image_url: string;
};

const emptyForm: AlmacenProduct = {
  name: "",
  category: "",
  subcategory: "",
  unit_cost: 0,
  sale_price: 0,
  stock_warehouse: 0,
  min_stock: 0,
  capacidad: 10,
  unit_type: "unidad",
  barcode: "",
  image_url: "",
};

const UNIT_TYPES = ["unidad", "caja", "paquete", "docena", "kilo", "litro", "ml"];

const compressImage = (file: File, maxWidth = 600, maxHeight = 600, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const Inventory = () => {
  const [list, setList] = useState<AlmacenProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const action = searchParams.get("action");
  const slotTarget = searchParams.get("slot");
  const macTarget = searchParams.get("mac");
  const isMachineOutputMode = action === "machine_output" && slotTarget && macTarget;
  
  const [open, setOpen] = useState(false);
  // NUEVO: Estado para saber si estamos editando o solo viendo
  const [isEditingMode, setIsEditingMode] = useState(false); 
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm] = useState<AlmacenProduct>(emptyForm);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const existingCategories = useMemo(() => {
    const cats = list.map(p => p.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [list]);

  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    product: AlmacenProduct | null;
    qty: string;
    custom_price: string;
  }>({
    open: false,
    product: null,
    qty: "1",
    custom_price: "",
  });

  const loadInventory = async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user) return;
      const userId = user.id || user.userId;
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/productos-almacen?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        setList(data.productos || []);
      }
    } catch (err) {
      toast.error("Error al cargar el inventario del almacén");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = isMachineOutputMode ? `Asignar a Resorte ${slotTarget}` : "Inventario | Inventaxo";
    loadInventory();
  }, [isMachineOutputMode]);

  const filteredList = list.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  );

  const totalProducts = list.length;
  const totalCost = list.reduce((acc, item) => acc + ((Number(item.stock_warehouse) || 0) * (Number(item.unit_cost) || 0)), 0);
  const totalSaleValue = list.reduce((acc, item) => acc + ((Number(item.stock_warehouse) || 0) * (Number(item.sale_price) || 0)), 0);

  const calculateProfitMargin = (cost: number, sale: number) => {
    if (cost <= 0 || sale <= 0) return 0;
    return (((sale - cost) / cost) * 100).toFixed(2);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        toast.info("Procesando y comprimiendo imagen...");
        const base64Compressed = await compressImage(file);
        setForm({ ...form, image_url: base64Compressed });
        toast.success("Imagen adjuntada correctamente");
      } catch (error) {
        toast.error("Error al procesar la imagen");
      }
    }
  };

  const saveProduct = async () => {
    if (!form.name.trim()) return toast.error("El nombre es requerido");
    if (form.sale_price <= 0) return toast.error("El precio debe ser mayor a 0");
    setProcessing(true);
    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user) {
        toast.error("Sesión no válida");
        return;
      }
      const payload = { ...form, id_dueno: user.id || user.userId };
      const apiUrl = import.meta.env.VITE_API_URL;
      const isEditing = !!form.id;
      const url = isEditing ? `${apiUrl}/productos-almacen/${form.id}` : `${apiUrl}/productos-almacen`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEditing ? "Producto actualizado" : "Producto creado exitosamente");
        setOpen(false);
        setForm(emptyForm);
        loadInventory();
      } else {
        toast.error(data.message || "Error al guardar el producto");
      }
    } catch (error) {
      toast.error("Error de conexión con el servidor");
    } finally {
      setProcessing(false);
    }
  };

  const handleProductClick = (product: AlmacenProduct) => {
    if (isMachineOutputMode) {
      setAssignDialog({
        open: true,
        product,
        qty: "1",
        custom_price: String(product.sale_price || 0)
      });
    } else {
      setForm(product);
      // NUEVO: Si abrimos un producto existente, entra en MODO VISTA (no edición)
      setIsEditingMode(false);
      setOpen(true);
    }
  };

  const confirmAssignment = async () => {
    const p = assignDialog.product;
    if (!p || !slotTarget || !macTarget) return;
    const qty = parseInt(assignDialog.qty) || 0;
    const price = parseFloat(assignDialog.custom_price) || 0;
    if (qty <= 0 || qty > p.stock_warehouse) {
      return toast.error(`Cantidad inválida. Tienes ${p.stock_warehouse} disponibles.`);
    }
    setProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const newWarehouseStock = p.stock_warehouse - qty;
      const updateStockRes = await fetch(`${apiUrl}/productos-almacen/${p.id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          stock_warehouse: newWarehouseStock
        })
      });
      if (!updateStockRes.ok) throw new Error("Error actualizando stock en bodega");

      const payload = {
        machine_id: macTarget,
        codigo_motor: slotTarget,
        nombre_producto: p.name,
        precio: price,
        stock: qty,
        capacidad: p.capacidad || 10,
      };
      const res = await fetch(`${apiUrl}/inventario/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Producto asignado y stock actualizado!");
        setAssignDialog({ open: false, product: null, qty: "1", custom_price: "" });
        navigate(`/app/products?mac=${macTarget}`);
      } else {
        toast.error(data.message || "Error al asignar producto");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    // ... (Mantén tu código de PDF exactamente igual) ...
    const doc = new jsPDF();
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString();
    const hora = ahora.toLocaleTimeString().replace(/:/g, '-');
    
    const totalUnidades = list.reduce((acc, item) => acc + (Number(item.stock_warehouse) || 0), 0);
    const valorTotalInventario = list.reduce((acc, item) => acc + ((Number(item.stock_warehouse) || 0) * (Number(item.sale_price) || 0)), 0);
    const totalReferencias = list.length;
    
    doc.setFontSize(22);
    doc.setTextColor(4, 120, 87);
    doc.text("Inventario de Almacén", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Inventaxo - Generado el: ${fecha} a las ${ahora.toLocaleTimeString()}`, 14, 30);
    
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Resumen: ${totalReferencias} Productos | ${totalUnidades} unidades | Capital: S/ ${valorTotalInventario.toFixed(2)}`, 14, 40);
    
    const tableColumn = ["Producto", "Categoria", "Stock", "Precio Base", "Valor Total"];
    const tableRows = list.map((item) => {
      const stock = Number(item.stock_warehouse) || 0;
      const precio = Number(item.sale_price) || 0;
      return [
        item.name || "N/A",
        item.category || "-",
        `${stock} un.`,
        `S/ ${precio.toFixed(2)}`,
        `S/ ${(stock * precio).toFixed(2)}`
      ];
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [4, 120, 87] },
      styles: { fontSize: 9, cellPadding: 4 },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      columnStyles: { 4: { fontStyle: 'bold', textColor: [4, 120, 87] } }
    });
    
    doc.save(`Inventaxo_Almacen_${fecha.replace(/\//g, '-')}_${hora}.pdf`);
  };

  const handleDownloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(list.map(p => ({
      ID: p.id,
      Nombre: p.name,
      Categoría: p.category,
      Subcategoría: p.subcategory,
      Código_Barras: p.barcode,
      Costo_Unitario: p.unit_cost,
      Precio_Venta: p.sale_price,
      Stock_Disponible: p.stock_warehouse,
      Stock_Mínimo: p.min_stock,
      Valor_Inventario_Costo: p.stock_warehouse * p.unit_cost,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `Inventario_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="container py-8 pb-32">
      <PageHeader
        title={isMachineOutputMode ? `Asignar a Resorte ${slotTarget}` : "Inventario de Almacén"}
        description={isMachineOutputMode 
          ? "Selecciona un producto de tu almacén para enviarlo a la bandeja." 
          : "Gestiona los productos, stock general y precios base."}
        actions={
          !isMachineOutputMode && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleDownloadExcel} className="text-blue-700 border-blue-700 hover:bg-blue-50">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} className="text-emerald-700 border-emerald-700 hover:bg-emerald-50">
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              {/* NUEVO: Al crear producto, activamos el modo edición por defecto */}
              <Button className="bg-primary text-primary-foreground" onClick={() => { setForm(emptyForm); setIsEditingMode(true); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
              </Button>
            </div>
          )
        }
      />

      {/* Tarjetas Superiores */}
      {!isMachineOutputMode && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-slate-50">
              <p className="text-sm text-muted-foreground">Productos en Representación</p>
              <p className="text-2xl font-bold">{totalProducts} ítems</p>
            </Card>
            <Card className="p-4 bg-slate-50">
              <p className="text-sm text-muted-foreground">Costo Total de Inventario</p>
              <p className="text-2xl font-bold text-red-600">{fmtMoney(totalCost)}</p>
            </Card>
            <Card className="p-4 bg-slate-50">
              <p className="text-sm text-muted-foreground">Valor Venta Estimado</p>
              <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totalSaleValue)}</p>
            </Card>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar producto por nombre o código de barras..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </div>
      )}

{/* Lista de Productos */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando inventario...</div>
      ) : filteredList.length === 0 ? (
        <Card className="p-12 text-center mt-6">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron productos.</p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((p, index) => {
            const stock = Number(p.stock_warehouse) || 0;
            const min = Number(p.min_stock) || 0;
            
            // FÓRMULA DE LAS 3 ZONAS
            const maxRecomendado = min * 3;
            let borderColor = "border-slate-200";
            let indicatorColor = "bg-slate-500";
            let fillPercentage = 0;
            let statusLabel = "";

            if (min === 0) {
              // Caso especial: Si no configuró stock mínimo, solo avisamos si está en cero
              if (stock <= 0) {
                borderColor = "border-red-400"; indicatorColor = "bg-red-500"; fillPercentage = 0; statusLabel = "Sin stock";
              } else {
                borderColor = "border-emerald-400"; indicatorColor = "bg-emerald-500"; fillPercentage = 100; statusLabel = "Normal";
              }
            } else {
              // La barra de progreso se llena en base al máximo recomendado (SM * 3)
              fillPercentage = Math.min(100, (stock / maxRecomendado) * 100);

              if (stock <= min) {
                // 1. ZONA DE ALERTA (Poca cantidad)
                borderColor = "border-red-400";
                indicatorColor = "bg-red-500";
                statusLabel = "Comprar";
              } else if (stock <= maxRecomendado) {
                // 2. ZONA SEGURA (Operación normal)
                borderColor = "border-emerald-400";
                indicatorColor = "bg-emerald-500";
                statusLabel = "Normal";
              } else {
                // 3. ZONA DE MÁXIMO (Exceso)
                borderColor = "border-blue-400";
                indicatorColor = "bg-blue-500";
                statusLabel = "Exceso";
              }
            }

            return (
              <Card
                key={p.id || index}
                onClick={() => handleProductClick(p)}
                className={`p-4 flex flex-col justify-between transition-all cursor-pointer hover:shadow-md border-2 ${borderColor} bg-white relative overflow-hidden`}
              >
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center shrink-0 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.category || "Sin categoría"}</p>
                    {p.barcode && <p className="text-[10px] bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">CB: {p.barcode}</p>}
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                  <div>
                    <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Precio Venta</span>
                    <span className="font-bold text-slate-700">{fmtMoney(p.sale_price)}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                      Stock / Mín (<span className={`font-bold ${
                        statusLabel === 'Comprar' ? 'text-red-500' : 
                        statusLabel === 'Exceso' ? 'text-blue-500' : 
                        'text-emerald-500'
                      }`}>{statusLabel}</span>)
                    </span>
                    <span className={`font-bold text-lg ${
                      stock <= min ? 'text-red-500' : 
                      stock > maxRecomendado ? 'text-blue-600' : 
                      'text-emerald-600'
                    }`}>
                      {stock} <span className="text-muted-foreground text-xs font-normal">/ {min}</span>
                    </span>
                  </div>
                </div>

                {/* BARRA DE PROGRESO */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                  <div 
                    className={`h-full ${indicatorColor} transition-all duration-500 ease-in-out`} 
                    style={{ width: `${fillPercentage}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL PRINCIPAL (Vista y Edición) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* NUEVO: Header con el botón de editar integrado */}
          <DialogHeader className="flex flex-row items-center gap-4 pr-6">
            <DialogTitle className="flex-1 text-xl">
              {!form.id ? "Añadir Nuevo Producto" : (isEditingMode ? "Editar Producto" : "Detalles del Producto")}
            </DialogTitle>
            {/* El botón de editar solo aparece si el producto ya existe y no estamos editándolo */}
            {form.id && !isEditingMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingMode(true)}
                className="h-8 gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del producto</Label>
                {/* NUEVO: Todos los inputs tienen el atributo disabled={!isEditingMode} */}
                <Input disabled={!isEditingMode} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Galletas Oreo" />
              </div>
              <div>
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input disabled={!isEditingMode} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Ej. 7501000..." />
                  {/* El botón de escáner solo se muestra si estamos editando */}
                  {isEditingMode && (
                    <Button variant="outline" type="button" onClick={() => setShowScanner(true)}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    disabled={!isEditingMode}
                    value={form.category} 
                    onChange={(e) => setForm({ ...form, category: e.target.value })} 
                    placeholder="Escribe o selecciona..." 
                    list="category-options"
                  />
                  <datalist id="category-options">
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <Label>Subcategoría</Label>
                <Input disabled={!isEditingMode} value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
              </div>
            </div>

            {/* SECCIÓN DE FOTOGRAFÍA */}
            <div>
              <Label>Fotografía del Producto</Label>
              <div className="flex items-center gap-4 mt-2">
                <div className="w-24 h-24 border rounded-md flex items-center justify-center bg-slate-100 overflow-hidden shrink-0 border-dashed border-slate-300">
                  {form.image_url ? (
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                
                {/* Los botones de subir foto solo se muestran si estamos en modo edición */}
                {isEditingMode && (
                  <div className="flex flex-col gap-2">
                    <Label 
                      htmlFor="camera-upload" 
                      className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm text-center flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                    >
                      <Camera className="w-4 h-4" /> 
                      {form.image_url ? "Cambiar Foto" : "Tomar Foto / Galería"}
                    </Label>
                    <Input 
                      id="camera-upload" 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={handleImageChange}
                    />
                    {form.image_url && (
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => setForm({...form, image_url: ""})}
                        className="text-red-500 border-red-200 hover:bg-red-50"
                      >
                        Quitar imagen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border">
              <div>
                <Label>Costo Unitario (S/)</Label>
                <Input disabled={!isEditingMode} type="number" step="0.01" value={form.unit_cost || ""} onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Precio de Venta (S/)</Label>
                <Input disabled={!isEditingMode} type="number" step="0.01" value={form.sale_price || ""} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex flex-col justify-center">
                <Label>Ganancia Estimada</Label>
                <div className="text-lg font-bold text-emerald-600 mt-1">
                  {calculateProfitMargin(form.unit_cost, form.sale_price)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Stock Actual</Label>
                <Input disabled={!isEditingMode} type="number" value={form.stock_warehouse || ""} onChange={(e) => setForm({ ...form, stock_warehouse: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Stock Mínimo</Label>
                <Input disabled={!isEditingMode} type="number" value={form.min_stock || ""} onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Capacidad resorte</Label>
                <Input disabled={!isEditingMode} type="number" value={form.capacidad || ""} onChange={(e) => setForm({ ...form, capacidad: parseInt(e.target.value) || 10 })} />
              </div>
              <div>
                <Label>Tipo unidad</Label>
                <Select disabled={!isEditingMode} value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* NUEVO: Los botones del final cambian según el modo */}
          <DialogFooter>
            {!isEditingMode ? (
              <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={saveProduct} disabled={processing}>{processing ? "Guardando..." : "Guardar Producto"}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para el Escáner de Código de Barras */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear Código de Barras</DialogTitle>
            <DialogDescription>Apunta la cámara al código de barras del producto.</DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {showScanner && (
              <BarcodeScanner 
                onScanSuccess={(text) => {
                  setForm({ ...form, barcode: text });
                  setShowScanner(false);
                  toast.success("Código escaneado correctamente");
                }} 
              />
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScanner(false)}>
              Cerrar Cámara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Asignación a Máquina (Original) */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => { if (!o) setAssignDialog({ open: false, product: null, qty: "1", custom_price: "" }) }}>
        {/* ... */}
      </Dialog>
    </div>
  );
};

export default Inventory;