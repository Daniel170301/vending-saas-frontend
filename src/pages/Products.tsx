import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { Camera, ImagePlus, Package, Plus, AlertTriangle, Tag, Download, FileSpreadsheet, FileText, ShoppingCart, Minus, X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Product = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  unit_cost: number;
  sale_price: number;
  stock_warehouse: number;
  min_stock: number;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  unit_type: string | null;
  // --- NUEVOS DATOS DE POSTGRESQL Y LA MÁQUINA ---
  machine_id?: string;
  codigo_motor?: string;
  nombre_producto?: string;
  precio?: number;
  stock?: number;
  capacidad?: number;
};

type Category = { id: string; name: string; parent_id: string | null };

const UNIT_TYPES = ["unidad", "caja", "paquete", "docena", "kilo", "gramo", "litro", "ml", "metro"];
const PAYMENT_METHODS = ["Efectivo", "Yape", "Plin", "Transferencia bancaria", "Vending", "Tarjeta", "Otro"];

type Employee = { id: string; name: string };

const emptyForm = {
  name: "",
  category: "",
  subcategory: "",
  unit_cost: "",
  sale_price: "",
  stock_warehouse: "",
  min_stock: "",
  sku: "",
  barcode: "",
  image_url: "",
  unit_type: "unidad",
  codigo_motor: "",
  capacidad: "10",
};

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const action = searchParams.get("action"); // "sale" | "expense" | null

  const slotTarget = searchParams.get("slot"); // Leemos a qué resorte irá

  // Capturamos la MAC dinámica de la URL
const macActual = searchParams.get("mac");
const [machinesList, setMachinesList] = useState([]); // Lista de máquinas para el selector
  // Agregamos "machine_output" a los modos posibles
const mode: "sale" | "expense" | "browse" | "machine_output" = 
  action === "sale" ? "sale" : 
  action === "expense" ? "expense" : 
  action === "machine_output" ? "machine_output" : "browse";

  const [list, setList] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [catDialog, setCatDialog] = useState<{ open: boolean; parent_id: string | null; name: string }>({ open: false, parent_id: null, name: "" });
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Cart for sale mode: { productId: qty }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();
  // Expense dialog
// Expense dialog (Gasto original)
const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; product: Product | null; qty: string; cost: string }>({
  open: false, product: null, qty: "1", cost: "",
});
  const [machineOutputDialog, setMachineOutputDialog] = useState<{ open: boolean; product: Product | null; qty: string; sale_price: string }>({
    open: false, product: null, qty: "1", sale_price: "",
  });
  
  // Employees + checkout dialog (sale & expense)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"sale" | "expense">("sale");
  const [meta, setMeta] = useState({ concept: "", customer: "", payment_method: "Efectivo", employee_id: "" });


// 1. Función para traer tus máquinas desde PostgreSQL
const loadMachines = async () => {
  // Verificamos que el usuario ya esté disponible
  if (!user?.email) return; 

  try {
    const apiUrl = import.meta.env.VITE_API_URL;
    
    // Enviamos el correo dinámico a tu backend Node.js
    const res = await fetch(`${apiUrl}/machines?user=${user.email}`);
    const data = await res.json();
    
    console.log("Respuesta de máquinas:", data); 
    
    if (Array.isArray(data)) {
      setMachinesList(data);
    } else {
      setMachinesList(data.maquinas || data.data || []);
    }
  } catch (error) {
    console.error("Error al cargar máquinas:", error);
  }
};

const load = async () => {
  if (!macActual) {
    setList([]);
    return;
  }
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL;
    const res = await fetch(`${apiUrl}/api/inventario/${macActual}`);
    const data = await res.json();
    
    // Imprimimos el inventario para ver qué llega
    console.log("Inventario recibido:", data);

    // Guardamos la lista sin importar el formato en que venga
    if (Array.isArray(data)) {
      setList(data);
    } else {
      setList(data.inventario || data.data || data.rows || []);
    }
  } catch (err) {
    console.error("Error cargando inventario:", err);
  }
};
// Función que se ejecuta al hacer clic en cualquier resorte
  const handleSlotClick = (codigoMotor, productoExistente) => {
    if (productoExistente) {  
      // Si ya hay una galleta/gaseosa ahí, cargamos sus datos para editar
      setForm({
        ...emptyForm,
        name: productoExistente.nombre_producto || "",
        sale_price: productoExistente.precio ? productoExistente.precio.toString() : "",
        stock_warehouse: productoExistente.stock ? productoExistente.stock.toString() : "",
        capacidad: productoExistente.capacidad ? productoExistente.capacidad.toString() : "10",
        codigo_motor: codigoMotor, // Memoria de qué resorte tocaste
      });
      setOpen(true);
    } else {
      if (!macActual) {
      return toast.error("No hay una máquina seleccionada");
    }
     // Si está vacío, derivamos a la vista de inventario en modo "salida"
    // Pasamos el slot por parámetro para recordarlo
    navigate(`/app/inventory?action=machine_output&slot=${codigoMotor}&mac=${macActual}`);
    }
  };
useEffect(() => {
  document.title = "Planograma · InventaXo";
  if (user?.email) {
    loadMachines();
  }
}, [user]);


  const parentCats = categories.filter((c) => !c.parent_id);
  const selectedParent = parentCats.find((c) => c.name === form.category);
  const subCats = selectedParent ? categories.filter((c) => c.parent_id === selectedParent.id) : [];

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) return toast.error(error.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagen cargada");
    } finally {
      setUploading(false);
    }
  };

const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");

    // 1. Leemos tu usuario localmente en lugar de preguntarle a Supabase
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return toast.error("No hay sesión activa");
    
    // 2. Construimos el paquete de datos con todo lo que tu formulario y tu ESP32 necesitan
    const payload = {
      // Datos generales del producto
      name: form.name.trim(),
      category: form.category.trim() || null,
      subcategory: form.subcategory.trim() || null,
      unit_cost: parseFloat(form.unit_cost) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_warehouse: parseInt(form.stock_warehouse) || 0,
      min_stock: parseInt(form.min_stock) || 0,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      image_url: form.image_url || null,
      unit_type: form.unit_type || "unidad",
      
      // Datos clave para tu ruta /actualizar y la comunicación MQTT
      machine_id: "D4-8A-FC-A5-26-A8", 
      codigo_motor: form.codigo_motor,
      nombre_producto: form.name.trim(),
      precio: parseFloat(form.sale_price) || 0,
      stock: parseInt(form.stock_warehouse) || 0,
      capacidad: parseInt(form.capacidad) || 10
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      
      // 3. Enviamos la petición PUT a tu backend en Render
      const res = await fetch(`${apiUrl}/inventario/actualizar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        toast.success("¡Producto guardado y ESP32 actualizada!");
        setOpen(false);
        load();// Omitimos la recarga visual por un momento hasta que migremos la función load() completa
      } else {
        toast.error(data.message || "Error al guardar el producto");
      }
    } catch (error) {
      console.error("Error guardando producto:", error);
      toast.error("Error conectando con el servidor backend");
    }
  };

  const saveCategory = async () => {
    const name = catDialog.name.trim();
    if (!name) return toast.error("Nombre requerido");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("categories").insert({ name, parent_id: catDialog.parent_id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada");
    setCatDialog({ open: false, parent_id: null, name: "" });
    load();
  };

const totalInventoryValue = list.reduce((sum, p) => sum + (Number(p.precio) || 0) * (Number(p.stock) || 0), 0);
const totalUnits = list.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const usedCategories = Array.from(new Set(list.map((p) => p.category).filter(Boolean) as string[]));

  const filtered = activeCat ? list.filter((p) => p.category === activeCat) : list;

  // ===== Cart logic (sale mode) =====
  const addToCart = (p: Product) => {
    setCart((c) => {
      const cur = c[p.id] || 0;
      if (cur + 1 > p.stock_warehouse) {
        toast.error(`Stock insuficiente (${p.stock_warehouse})`);
        return c;
      }
      return { ...c, [p.id]: cur + 1 };
    });
  };
  const removeFromCart = (id: string) => {
    setCart((c) => {
      const cur = c[id] || 0;
      if (cur <= 1) { const { [id]: _, ...rest } = c; return rest; }
      return { ...c, [id]: cur - 1 };
    });
  };
  const clearCart = () => setCart({});

  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const p = list.find((x) => x.id === id)!;
      return { product: p, qty };
    }).filter((x) => x.product);
  }, [cart, list]);

  const cartTotal = cartItems.reduce((s, it) => s + (Number(it.product.sale_price) || 0) * it.qty, 0);
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0);

  // Open meta dialog for sale checkout
  const openCheckout = () => {
    if (cartItems.length === 0) return;
    setCheckoutMode("sale");
    setMeta({ concept: "", customer: "", payment_method: "Efectivo", employee_id: "" });
    setCheckoutOpen(true);
  };

  const confirmCheckoutSale = async () => {
    if (cartItems.length === 0) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const total = cartTotal;
      const totalCost = cartItems.reduce((s, it) => s + (Number(it.product.unit_cost) || 0) * it.qty, 0);
      const employee = employees.find((e) => e.id === meta.employee_id);

      // 1) Create transaction
      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        kind: "sale",
        concept: meta.concept.trim() || null,
        customer: meta.customer.trim() || null,
        payment_method: meta.payment_method || null,
        employee_id: meta.employee_id || null,
        employee_name: employee?.name || null,
        subtotal: total,
        total,
        total_cost: totalCost,
        profit: total - totalCost,
      } as any).select("id").single();
      if (txErr || !tx) { toast.error(txErr?.message || "Error"); return; }

      // 2) Insert sales linked to transaction
      const salesPayload = cartItems.map((it) => ({
        user_id: user.id,
        transaction_id: tx.id,
        product_id: it.product.id,
        quantity: it.qty,
        unit_price: Number(it.product.sale_price) || 0,
        unit_cost: Number(it.product.unit_cost) || 0,
        total: (Number(it.product.sale_price) || 0) * it.qty,
        source: "manual",
      }));
      const { error: salesErr } = await supabase.from("sales").insert(salesPayload);
      if (salesErr) { toast.error(salesErr.message); return; }

      // 3) Decrement stock
      for (const it of cartItems) {
        const newStock = Math.max(0, (it.product.stock_warehouse || 0) - it.qty);
        await supabase.from("products").update({ stock_warehouse: newStock }).eq("id", it.product.id);
      }
      toast.success(`Venta registrada · ${fmtMoney(total)}`);
      clearCart();
      setCheckoutOpen(false);
      setSearchParams({});
      navigate("/app/movements");
    } finally {
      setProcessing(false);
    }
  };

  // ===== Expense logic =====
// ===== Lógica de Gastos (Expense Original) =====
const openExpense = (p: Product) => {
  setExpenseDialog({ open: true, product: p, qty: "1", cost: String(p.unit_cost || "") });
};
const confirmCheckoutExpense = async () => {
  const p = expenseDialog.product;
  if (!p) return;
  const qty = parseInt(expenseDialog.qty) || 0;
  const cost = parseFloat(expenseDialog.cost) || 0;
  
  setProcessing(true);
  try {
    // Leemos el usuario localmente como lo haces en tu función "save" original
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      toast.error("No hay sesión activa");
      return;
    }
    const user = JSON.parse(storedUser); // Asumiendo que guardaste un objeto JSON

    const total = qty * cost;
    const employee = employees.find((e) => e.id === meta.employee_id);
    const newStock = (p.stock_warehouse || 0) + qty;
    
    const payloadGasto = {
      user_id: user.id || user.userId, // Ajusta según la estructura de tu usuario local
      product_id: p.id,
      quantity: qty,
      unit_cost: cost,
      total: total,
      new_stock: newStock,
      concept: meta.concept.trim() || null,
      supplier: meta.customer.trim() || null,
      payment_method: meta.payment_method || null,
      employee_id: meta.employee_id || null,
      employee_name: employee?.name || null,
    };

    const apiUrl = import.meta.env.VITE_API_URL;
    
    // Petición a tu backend para guardar la transacción, la compra y actualizar el stock de una vez
    // (Asegúrate de crear esta ruta en tu servidor Node.js/PostgreSQL)
    const res = await fetch(`${apiUrl}/gastos/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadGasto)
    });

    if (!res.ok) throw new Error("Error al registrar el gasto en el servidor");

    toast.success(`Gasto registrado (+${qty} ${p.unit_type || "unidad"})`);
    setExpenseDialog({ open: false, product: null, qty: "1", cost: "" });
    setCheckoutOpen(false);
    setSearchParams({});
    // navigate("/app/movements"); // Descomenta si tienes esta vista funcionando
    load(); // Recargamos para ver el nuevo stock
  } catch (error) {
    console.error("Error al registrar gasto:", error);
    toast.error("Error conectando con el servidor backend");
  } finally {
    setProcessing(false);
  }
};

  const confirmMachineOutput = async () => {
const p = machineOutputDialog.product;
  if (!p || !slotTarget) return;

  const qty = parseInt(machineOutputDialog.qty) || 0;
  const customSalePrice = parseFloat(machineOutputDialog.sale_price) || 0;

  if (qty <= 0 || qty > (p.stock_warehouse || 0)) {
    return toast.error("Cantidad inválida o stock de almacén insuficiente");
  }

  setProcessing(true);
    try {
const apiUrl = import.meta.env.VITE_API_URL;
    const newWarehouseStock = p.stock_warehouse - qty;

    // 1. Descontar el stock de tu base de datos PostgreSQL principal
    // (Asegúrate de que esta ruta exista en tu backend)
    const updateStockRes = await fetch(`${apiUrl}/productos/actualizar-stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        stock_warehouse: newWarehouseStock
      })
    });
    
    if (!updateStockRes.ok) throw new Error("Error al descontar stock del almacén");

    // 2. Construir el payload para la máquina ESP32
    const payload = {
      machine_id: "D4-8A-FC-A5-26-AB",
      codigo_motor: slotTarget,
      nombre_producto: p.name,
      precio: customSalePrice,
      stock: qty,
      capacidad: p.capacidad || 10
    };

    // 3. Enviar actualización a la máquina
    const res = await fetch(`${apiUrl}/inventario/actualizar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
      toast.success("Producto asignado al resorte y descontado del almacén");
      setMachineOutputDialog({ open: false, product: null, qty: "1", sale_price: "" });
      setSearchParams({}); 
      load(); 
    } else {
      toast.error(data.message || "Error al actualizar la máquina");
    }
  } catch (error) {
    console.error("Error en operación:", error);
    toast.error("Error de conexión con el servidor");
    } finally {
      setProcessing(false);
    }
  };

  const exitMode = () => { clearCart(); setSearchParams({}); };

  const exportExcel = () => {
    const rows = list.map((p) => ({
      Nombre: p.name,
      SKU: p.sku || "",
      "Código de barras": p.barcode || "",
      Categoría: p.category || "",
      Subcategoría: p.subcategory || "",
      "Tipo unidad": p.unit_type || "unidad",
      "Precio compra": Number(p.unit_cost) || 0,
      "Precio venta": Number(p.sale_price) || 0,
      Stock: Number(p.stock_warehouse) || 0,
      "Stock mínimo": Number(p.min_stock) || 0,
      "Valor inventario": (Number(p.unit_cost) || 0) * (Number(p.stock_warehouse) || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `inventario-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel descargado");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Inventario", 14, 18);
    doc.setFontSize(10);
    doc.text(`Valor total: ${fmtMoney(totalInventoryValue)}  ·  Referencias: ${list.length}  ·  Unidades: ${totalUnits}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Nombre", "Categoría", "Unidad", "P. Venta", "Stock", "Valor"]],
      body: list.map((p) => [
        p.name,
        p.category || "—",
        p.unit_type || "unidad",
        fmtMoney(p.sale_price),
        `${fmtNumber(p.stock_warehouse)}`,
        fmtMoney((Number(p.unit_cost) || 0) * (Number(p.stock_warehouse) || 0)),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`inventario-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF descargado");
  };

const headerTitle = mode === "sale" ? "Selecciona productos a vender" : mode === "expense" ? "Selecciona producto a reponer": "Planograma";
const headerDesc = mode === "sale"? "Toca + para añadir al carrito" : mode === "expense" ? "Registra una compra y aumenta stock": "Distribución de productos y resortes por máquina";
  return (
    <div className="container py-8 pb-32">
      <PageHeader title={headerTitle} description={headerDesc} actions={
        mode === "browse" ? (
          <div className="flex gap-2 items-center">
            {/* NUEVO SELECTOR DE MÁQUINAS */}
        <Select 
          value={macActual} 
          onValueChange={(val) => setSearchParams({ action: action || "", mac: val })}
        >
          <SelectTrigger className="w-[250px] bg-white">
            <SelectValue placeholder="Selecciona una máquina..." />
          </SelectTrigger>
          <SelectContent>
            {machinesList.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Tus botones de exportar que ya tenías */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" title="Descargar inventario">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF}>
              <FileText className="h-4 w-4 mr-2" />PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>      
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={exitMode}>
            <X className="h-4 w-4 mr-1" />Cancelar
          </Button>
        )
      } />

      {mode === "browse" && (
        <div className="grid gap-3 grid-cols-2 mb-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Valor total</div>
            <div className="text-xl font-bold text-primary mt-0.5">{fmtMoney(totalInventoryValue)}</div>
            <div className="text-[11px] text-muted-foreground">{fmtNumber(totalUnits)} unidades</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Referencias</div>
            <div className="text-xl font-bold mt-0.5">{fmtNumber(list.length)}</div>
            <div className="text-[11px] text-muted-foreground">productos</div>
          </Card>
        </div>
      )}

      {usedCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
          <button
            onClick={() => setActiveCat(null)}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
              activeCat === null ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
            }`}
          >
            <Tag className="h-3 w-3" />Todas
          </button>
          {usedCategories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c === activeCat ? null : c)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                activeCat === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
              }`}
            >
              <Tag className="h-3 w-3" />{c}
            </button>
          ))}
        </div>
      )}

      {!macActual ? (  
        <Card className="p-12 text-center mt-6">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium text-lg">Por favor, selecciona una máquina arriba</p>
          <p className="text-sm text-muted-foreground mt-1">El planograma se cargará automáticamente.</p>
        </Card>
      ) : (
        <div className="space-y-6 mt-6">
          {[1, 2, 3, 4, 5, 6].map((numBandeja) => (
            <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5">
              
              {/* Cabecera de la Bandeja */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
                <span className="text-sm text-muted-foreground">#{numBandeja} · 6 resortes</span>
              </div>

              {/* Cuadricula de 6 resortes */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[0, 1, 2, 3, 4, 5].map((posicion) => {
                  // Genera: 10, 11, 12... 20, 21...
                  const codigoMotor = `R${numBandeja}${posicion}`;
                  
                  // OJO: Asegúrate de usar 'list' o 'filtered' según como tengas declarado tu estado de productos arriba
                  const producto = list.find((p) => p.codigo_motor === codigoMotor);

                  // Lógica del semáforo visual
                  let bgColor = "bg-card hover:bg-accent/50";
                  let borderColor = "border-dashed border-gray-300";

                  if (producto) {
                    const stock = producto.stock || 0;
                    const capacidad = producto.capacidad || 10;
                    const porcentaje = capacidad > 0 ? (stock / capacidad) : 0;

                    if (porcentaje <= 0.3) {
                      bgColor = "bg-red-50 hover:bg-red-100";
                      borderColor = "border-solid border-red-400";
                    } else if (porcentaje <= 0.7) {
                      bgColor = "bg-yellow-50 hover:bg-yellow-100";
                      borderColor = "border-solid border-yellow-400";
                    } else {
                      bgColor = "bg-emerald-50 hover:bg-emerald-100";
                      borderColor = "border-solid border-emerald-400";
                    }
                  }

                  return (
                    <div
                      key={codigoMotor}
                      onClick={() => handleSlotClick(codigoMotor, producto)}
                      className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] relative transition-colors cursor-pointer ${bgColor} ${borderColor}`}
                    >
                      <span className="absolute top-2 left-2 text-xs font-bold text-muted-foreground/70">
                        R{codigoMotor}
                      </span>
                      
                      {producto ? (
                        <div className="flex flex-col items-center mt-2 w-full text-center">
                          <span className="text-xs font-bold line-clamp-2 leading-tight text-gray-800">
                            {producto.nombre_producto}
                          </span>
                          <span className="text-sm font-bold text-primary mt-1">
                            S/ {Number(producto.precio).toFixed(2)}
                          </span>
                          
                          {/* Indicador de Stock vs Capacidad */}
                          <div className="mt-2 w-full px-2">
                            <div className="text-[10px] text-gray-600 mb-1 font-medium flex justify-between">
                              <span>Stock: {producto.stock}</span>
                              <span>Máx: {producto.capacidad || 10}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-gray-200">
                              <div 
                                className={`h-full ${
                                  (producto.stock / (producto.capacidad || 10)) <= 0.3 ? 'bg-red-500' : 
                                  (producto.stock / (producto.capacidad || 10)) <= 0.7 ? 'bg-yellow-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, ((producto.stock || 0) / (producto.capacidad || 10)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded border-2 border-dashed border-gray-300 mb-1"></div>
                          <span className="text-[11px] text-muted-foreground">Vacío</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    {/* Cart bottom bar (sale mode) */}

      {/* Cart bottom bar (sale mode) */}
      {mode === "sale" && cartCount > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-40 px-3">
          <div className="container max-w-2xl">
            <Card className="p-3 shadow-lg border-emerald-500/40 bg-card flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{cartCount} {cartCount === 1 ? "producto" : "productos"}</div>
                <div className="text-lg font-bold text-emerald-600">{fmtMoney(cartTotal)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearCart}>Limpiar</Button>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={openCheckout}
                disabled={processing}
              >
                <Wallet className="h-4 w-4 mr-1" />
                {processing ? "Cobrando…" : "Cobrar"}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* Expense dialog */}
      <Dialog open={machineOutputDialog.open} onOpenChange={(o) => !o && setMachineOutputDialog({ open: false, product: null, qty: "1", sale_price: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar producto a Resorte #{slotTarget}</DialogTitle>
            <DialogDescription>{machineOutputDialog.product?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cantidad a transferir (Stock en almacén: {machineOutputDialog.product?.stock_warehouse})</Label>
              <Input
                type="number"
                value={machineOutputDialog.qty}
                onChange={(e) => setMachineOutputDialog({ ...machineOutputDialog, qty: e.target.value })}
                max={machineOutputDialog.product?.stock_warehouse}
              />
            </div>
            <div>
              <Label>Precio de Venta en la Máquina (S/)</Label>
              <Input
                type="number"
                step="0.01"
                value={machineOutputDialog.sale_price}
                onChange={(e) => setMachineOutputDialog({ ...machineOutputDialog, sale_price: e.target.value })}
              />
         <p className="text-xs text-muted-foreground mt-1">
          Este precio solo afectará a este resorte específico. Costo de almacén: S/ {machineOutputDialog.product?.unit_cost}
               </p>
          </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMachineOutputDialog({ open: false, product: null, qty: "1", sale_price: "" })}>
                  Cancelar
                </Button>
                <Button 
                  className="bg-primary text-primary-foreground"
                  onClick={confirmMachineOutput} 
                  disabled={processing}
                >
                  {processing ? "Asignando..." : "Asignar a Máquina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Label>Imagen del producto</Label>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                <Button type="button" variant="outline" size="sm" className="mt-1" disabled={uploading} onClick={() => imgInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4 mr-1" />{uploading ? "Subiendo..." : "Cargar imagen"}
                </Button>
              </div>
            </div>

            <div>
              <Label>Nombre del producto</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Código del producto (SKU)</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ej: P-001" />
              </div>
              <div>
                <Label>Código de barras</Label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Escanear o escribir" />
                  <input
                    ref={barcodeInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) toast.info("Foto capturada. Escribe el código de barras.");
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => barcodeInputRef.current?.click()} title="Tomar foto">
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Precio de compra</Label>
                <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
              <div>
                <Label>Precio de venta</Label>
                <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label>Cantidad disponible</Label>
                <Input type="number" value={form.stock_warehouse} onChange={(e) => setForm({ ...form, stock_warehouse: e.target.value })} />
              </div>
              {/* NUEVO CAMPO DE CAPACIDAD */}
                <div>
                  <Label>Capacidad máxima</Label>
                  <Input type="number" value={form.capacidad}
                    onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                  />
                </div>
                {/* ... (tu campo de Tipo de unidad) */}
              <div>
                <Label>Tipo de unidad</Label>
                <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Categoría</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCatDialog({ open: true, parent_id: null, name: "" })}>
                    <Plus className="h-3 w-3 mr-1" />Nueva
                  </Button>
                </div>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {parentCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Subcategoría</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={!selectedParent}
                    onClick={() => selectedParent && setCatDialog({ open: true, parent_id: selectedParent.id, name: "" })}
                  >
                    <Plus className="h-3 w-3 mr-1" />Nueva
                  </Button>
                </div>
                <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })} disabled={!selectedParent}>
                  <SelectTrigger><SelectValue placeholder={selectedParent ? "Seleccionar" : "Elige categoría"} /></SelectTrigger>
                  <SelectContent>
                    {subCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="hero" onClick={save}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={catDialog.open} onOpenChange={(o) => setCatDialog({ ...catDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catDialog.parent_id ? "Nueva subcategoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={catDialog.name}
              onChange={(e) => setCatDialog({ ...catDialog, name: e.target.value })}
              placeholder="Nombre"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCatDialog({ open: false, parent_id: null, name: "" })}>Cancelar</Button>
              <Button onClick={saveCategory}>Crear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout meta dialog (sale & expense) */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{checkoutMode === "sale" ? "Confirmar venta" : "Confirmar gasto"}</DialogTitle>
            <DialogDescription>
              Total: <span className={checkoutMode === "sale" ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                {checkoutMode === "sale"
                  ? fmtMoney(cartTotal)
                  : fmtMoney((parseInt(expenseDialog.qty) || 0) * (parseFloat(expenseDialog.cost) || 0))}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Concepto</Label>
              <Input
                value={meta.concept}
                onChange={(e) => setMeta({ ...meta, concept: e.target.value })}
                placeholder={checkoutMode === "sale" ? "Ej: Venta mostrador" : "Ej: Reposición proveedor"}
              />
            </div>
            <div>
              <Label>{checkoutMode === "sale" ? "Cliente" : "Proveedor"}</Label>
              <Input
                value={meta.customer}
                onChange={(e) => setMeta({ ...meta, customer: e.target.value })}
                placeholder={checkoutMode === "sale" ? "Nombre del cliente (opcional)" : "Nombre del proveedor (opcional)"}
              />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={meta.payment_method} onValueChange={(v) => setMeta({ ...meta, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empleado</Label>
              {employees.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2 rounded border">
                  Sin empleados.{" "}
                  <button className="text-primary underline" onClick={() => { setCheckoutOpen(false); navigate("/app/employees"); }}>
                    Crear uno
                  </button>
                </div>
              ) : (
                <Select value={meta.employee_id} onValueChange={(v) => setMeta({ ...meta, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
            <Button
              className={checkoutMode === "sale" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}
              onClick={checkoutMode === "sale" ? confirmCheckoutSale : confirmCheckoutExpense}
              disabled={processing}
            >
              {processing ? "Guardando…" : checkoutMode === "sale" ? "Cobrar" : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
