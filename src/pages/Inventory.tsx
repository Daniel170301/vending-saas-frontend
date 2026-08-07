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
import { Package, Plus, Download, Search, Camera, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { BarcodeScanner } from "@/components/BarcodeScanner"; // Ajusta la ruta según dónde lo guardastes
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx"; // NUEVO: Librería para Excel

// NUEVO: Se agregaron los campos faltantes de la BD
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
// Función para convertir la imagen a texto (Base64)
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => { resolve(fileReader.result as string); };
    fileReader.onerror = (error) => { reject(error); };
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
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm] = useState<AlmacenProduct>(emptyForm);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // NUEVO: Estado para búsqueda


const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Opcional: Validar el tamaño del archivo (ejemplo: máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen es muy grande. Máximo 2MB.");
        return;
      }
      try {
        const base64 = await convertToBase64(file);
        setForm({ ...form, image_url: base64 });
      } catch (error) {
        toast.error("Error al procesar la imagen");
      }
    }
  };

  // NUEVO: Extraer categorías únicas para el selector
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
    document.title = isMachineOutputMode ? `Asignar a Resorte ${slotTarget}` : "Inventario | Kymez App";
    loadInventory();
  }, [isMachineOutputMode]);

  // NUEVO: Filtrado de productos por búsqueda
  const filteredList = list.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  );

  // NUEVO: Cálculos para los indicadores de la cabecera
  const totalProducts = list.length;
  const totalCost = list.reduce((acc, item) => acc + ((Number(item.stock_warehouse) || 0) * (Number(item.unit_cost) || 0)), 0);
  const totalSaleValue = list.reduce((acc, item) => acc + ((Number(item.stock_warehouse) || 0) * (Number(item.sale_price) || 0)), 0);

  // NUEVO: Cálculo de porcentaje de ganancia dinámico
  const calculateProfitMargin = (cost: number, sale: number) => {
    if (cost <= 0 || sale <= 0) return 0;
    return (((sale - cost) / cost) * 100).toFixed(2);
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
      setOpen(true);
    }
  };

  const confirmAssignment = async () => {
    // ... (Tu lógica original de confirmAssignment se mantiene exactamente igual) ...
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString();
    const hora = ahora.toLocaleTimeString().replace(/:/g, '-');
    // ... (Tu lógica original de PDF se mantiene) ...
    doc.save(`KymazApp_Almacen_${fecha.replace(/\//g, '-')}_${hora}.pdf`);
  };

  // NUEVO: Descarga en Excel
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
              <Button className="bg-primary text-primary-foreground" onClick={() => { setForm(emptyForm); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
              </Button>
            </div>
          )
        }
      />

      {/* NUEVO: Tarjetas de Resumen y Buscador */}
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

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando inventario...</div>
      ) : filteredList.length === 0 ? (
        <Card className="p-12 text-center mt-6">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron productos.</p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((p, index) => (
            <Card
              key={p.id || index}
              onClick={() => handleProductClick(p)}
              className="p-4 flex flex-col justify-between transition-all cursor-pointer hover:border-primary hover:shadow-md"
            >
              <div className="flex gap-4">
                {/* NUEVO: Visualización de miniatura de imagen */}
                <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center shrink-0 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mb-1">{p.category || "Sin categoría"}</p>
                  {p.barcode && <p className="text-[10px] bg-slate-100 px-2 py-0.5 rounded inline-block">CB: {p.barcode}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mt-4 border-t pt-3">
                <div>
                  <span className="block text-muted-foreground text-xs">Stock Bodega</span>
                  {/* NUEVO: Alerta visual si está por debajo del stock mínimo */}
                  <span className={`font-bold ${p.stock_warehouse <= p.min_stock ? 'text-red-500' : ''}`}>
                    {p.stock_warehouse} {p.unit_type || 'un.'}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-xs">Precio Base</span>
                  <span className="font-bold text-emerald-600">{fmtMoney(p.sale_price)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para Nuevo/Editar Producto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Producto" : "Añadir Nuevo Producto al Almacén"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del producto</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Galletas Oreo" />
              </div>
              {/* NUEVO: Input para código de barras con opción de cámara */}
              <div>
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Ej. 7501000..." />
                  <Button 
                    variant="outline" 
                    type="button" 
                    onClick={() => setShowScanner(true)} // AQUI ESTÁ EL CAMBIO
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* NUEVO: Selector/Input de Categoría combinado */}
              <div>
                <Label>Categoría</Label>
                <div className="flex flex-col gap-2">
                  <Input 
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
                <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
              </div>
            </div>

            {/* NUEVO: URL de Imagen */}
<div>
              <Label>Fotografía del Producto</Label>
              <div className="flex items-center gap-4 mt-2">
                {/* Cuadro de previsualización de la imagen */}
                <div className="w-24 h-24 border rounded-md flex items-center justify-center bg-slate-100 overflow-hidden shrink-0 border-dashed border-slate-300">
                  {form.image_url ? (
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  {/* Botón que activa la cámara en el celular o archivos en PC */}
                  <Label 
                    htmlFor="camera-upload" 
                    className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm text-center flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="w-4 h-4" /> 
                    {form.image_url ? "Cambiar Foto" : "Tomar Foto / Galería"}
                  </Label>
                  
                  {/* Input oculto que hace la magia de HTML5 */}
                  <Input 
                    id="camera-upload" 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                  
                  {/* Botón para eliminar la imagen si ya hay una */}
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
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border">
              <div>
                <Label>Costo Unitario (S/)</Label>
                <Input type="number" step="0.01" value={form.unit_cost || ""} onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Precio de Venta (S/)</Label>
                <Input type="number" step="0.01" value={form.sale_price || ""} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} />
              </div>
              {/* NUEVO: Calculadora de margen */}
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
                <Input type="number" value={form.stock_warehouse || ""} onChange={(e) => setForm({ ...form, stock_warehouse: parseInt(e.target.value) || 0 })} />
              </div>
              {/* NUEVO: Input para Stock Mínimo */}
              <div>
                <Label>Stock Mínimo</Label>
                <Input type="number" value={form.min_stock || ""} onChange={(e) => setForm({ ...form, min_stock: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Capacidad resorte</Label>
                <Input type="number" value={form.capacidad || ""} onChange={(e) => setForm({ ...form, capacidad: parseInt(e.target.value) || 10 })} />
              </div>
              <div>
                <Label>Tipo unidad</Label>
                <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={processing}>{processing ? "Guardando..." : "Guardar Producto"}</Button>
          </DialogFooter>
        </DialogContent>

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
                  // Cuando escanea exitosamente, actualizamos el formulario y cerramos la cámara
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

      </Dialog>
    </div>
    
  );
};

export default Inventory;