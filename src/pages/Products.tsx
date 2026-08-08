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
import { Search, ArrowLeft, Camera, ImagePlus, Package, Plus, AlertTriangle, Tag, Download, FileSpreadsheet, FileText, ShoppingCart, Minus, X, Wallet } from "lucide-react";import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const [machinesList, setMachinesList] = useState([]); 

console.log("Máquinas que llegaron a React:", machinesList);
  const [machineSearch, setMachineSearch] = useState(""); // NUEVO: Buscador de máquinas
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
  // Estados para el resumen financiero del Planograma
  const [allSales, setAllSales] = useState([]);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

const loadSales = async () => {
    try {
      // 1. Buscamos quién es el usuario logueado (Idéntico a tu Sales.tsx)
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user) return;
      
      const userId = user.id || user.userId;
      const apiUrl = import.meta.env.VITE_API_URL || "";
      
      // 2. Armamos la URL exacta de tu historial de ventas
      const baseUrl = apiUrl.replace(/\/api$/, '') + '/api/ventas/historial';
      const fetchUrl = `${baseUrl}?user_id=${userId}`;
      
      const res = await fetch(fetchUrl);
      const hwData = await res.json();
      
      if (hwData && Array.isArray(hwData.ventas)) {
        // Guardamos los datos crudos del servidor en nuestro estado
        setAllSales(hwData.ventas);
      }
    } catch (error) {
      console.error("Error al cargar ventas en planograma:", error);
    }
  };
// Estado para editar un resorte que ya tiene producto
  const [slotEditDialog, setSlotEditDialog] = useState({
    open: false,
    slot: "",
    product: null as any,
    newStock: ""
  });

  // NUEVOS ESTADOS PARA EL MODAL PROFESIONAL
  const [reabastecerQty, setReabastecerQty] = useState("1");
  const [mixtoForm, setMixtoForm] = useState({ name: "", price: "", qty: "" });

  // FUNCION 1: REABASTECER (Suma a la máquina)
// FUNCION 1: REABASTECER (Suma a la máquina)
  const handleReabastecer = async () => {
    const { slot, product } = slotEditDialog;
    if (!product || !macActual) return;
    
    const qtyToAdd = parseInt(reabastecerQty) || 0;
    if (qtyToAdd <= 0) return toast.error("Ingresa una cantidad válida mayor a 0");

    const capacidadMaxima = product.capacidad || 10;
    const nuevoStockMaquina = (Number(product.stock) || 0) + qtyToAdd;

    // NUEVO: Freno matemático inteligente
    if (nuevoStockMaquina > capacidadMaxima) {
      const espacioDisponible = capacidadMaxima - (Number(product.stock) || 0);
      return toast.error(`¡Advertencia! Solo queda espacio para ${espacioDisponible} unidades (Capacidad máx: ${capacidadMaxima}).`);
    }

    setProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const nuevoStockMaquina = (Number(product.stock) || 0) + qtyToAdd;

      const payload = {
        machine_id: macActual,
        codigo_motor: slot,
        nombre_producto: product.nombre_producto,
        precio: product.precio,
        stock: nuevoStockMaquina,
        capacidad: product.capacidad || 10
      };

      const res = await fetch(`${apiUrl}/inventario/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(`Se agregaron ${qtyToAdd} unidades al resorte`);
        setSlotEditDialog({ open: false, slot: "", product: null, newStock: "" });
        setReabastecerQty("1");
        load();
      } else {
        toast.error(data.message || "Error al actualizar stock");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  // FUNCION 2: GUARDAR SURTIDO MIXTO
  const handleMixto = async () => {
    const { slot } = slotEditDialog;
    if (!macActual || !slot) return;

    const price = parseFloat(mixtoForm.price) || 0;
    const qty = parseInt(mixtoForm.qty) || 0;

    if (!mixtoForm.name.trim() || price <= 0 || qty <= 0) {
      return toast.error("Completa todos los datos del surtido correctamente");
    }

    setProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const payload = {
        machine_id: macActual,
        codigo_motor: slot,
        nombre_producto: mixtoForm.name.trim(),
        precio: price,
        stock: qty,
        capacidad: 10 // Capacidad estándar
      };

      const res = await fetch(`${apiUrl}/inventario/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success("Surtido Mixto asignado al resorte");
        setSlotEditDialog({ open: false, slot: "", product: null, newStock: "" });
        setMixtoForm({ name: "", price: "", qty: "" });
        load();
      } else {
        toast.error(data.message || "Error al crear surtido");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setProcessing(false);
    }
  };
  // NUEVO: Función para vaciar la ventana y redirigir al inventario
  const handleChangeProduct = () => {
    const { slot } = slotEditDialog;
    setSlotEditDialog({ open: false, slot: "", product: null, newStock: "" });
    navigate(`/app/inventory?action=machine_output&slot=${slot}&mac=${macActual}`);
  };


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
    if (!user?.email) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      // Usamos comillas invertidas (backticks) y ${} correctamente
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

// 2. Función para cargar el inventario de la máquina seleccionada
  const load = async () => {
    if (!macActual) {
      setList([]);
      return;
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      // Sin el /api/ y con comillas invertidas (backticks)
      const res = await fetch(`${apiUrl}/inventario/${macActual}`);
      const data = await res.json();
      console.log("Inventario recibido:", data);
      
      if (data && data.inventario && Array.isArray(data.inventario)) {
        setList(data.inventario);
      } else if (Array.isArray(data)) {
        setList(data);
      } else if (data && data.data && Array.isArray(data.data)) {
        setList(data.data);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error("Error cargando inventario:", err);
    }
  };

// 1. PRIMER useEffect: Carga la lista de máquinas en cuanto el usuario esté listo
  useEffect(() => {
    if (user?.email) {
      loadMachines();
      loadSales();
    }
  }, [user?.email]); // <-- Ahora React escuchará y disparará la función cuando detecte al usuario

  useEffect(() => {
    if (macActual) {
      load();
    }
  }, [macActual]); // <-- Se ejecuta cada vez que seleccionas una máquina distint


  
const handleSlotClick = (codigoMotor, productoExistente) => {
    console.log("Clic detectado en resorte:", codigoMotor, "Producto:", productoExistente);
    
    if (!macActual) {
      return toast.error("No hay una máquina seleccionada");
    }
    
    if (productoExistente) {
      // Abre la ventana amigable
      setSlotEditDialog({
        open: true,
        slot: codigoMotor,
        product: productoExistente,
        newStock: productoExistente.stock ? productoExistente.stock.toString() : "0"
      });
    } else {
      // Va al inventario
      navigate(`/app/inventory?action=machine_output&slot=${codigoMotor}&mac=${macActual}`);
    }
  };


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
      machine_id: macActual, 
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
      machine_id: macActual,
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
  // 1. Filtramos las ventas para que solo sean de la máquina que hemos abierto
  const ventasDeEstaMaquina = allSales.filter(
    (v) => String(v.machine_id) === String(macActual)
  );

  // 2. Sumamos los precios de venta
  const totalVentas = ventasDeEstaMaquina.reduce(
    (suma, v) => suma + (Number(v.precio) || 0), 
    0
  );

  // 3. Cantidad vendida (como en tu reporte, cada registro de IoT es 1 unidad)
  const cantidadVendida = ventasDeEstaMaquina.length;

  // 4. Ganancia Total (Replicando la lógica de tu PDF: costo o 60% por defecto)
  const gananciaTotal = ventasDeEstaMaquina.reduce((suma, v) => {
    const precioVenta = Number(v.precio) || 0;
    const costo = Number(v.unit_cost) || (precioVenta * 0.6);
    const ganancia = precioVenta - costo;
    return suma + ganancia;
  }, 0);



return (
    <div className="container py-8 pb-32">
<PageHeader 
        title={headerTitle} 
        description={headerDesc}
        actions={
          mode === "browse" ? (
            <div className="flex gap-2 items-center">
              {/* NUEVO: Botón de volver a la lista de máquinas */}
              {macActual && (
                <Button variant="outline" onClick={() => setSearchParams({})}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver a lista
                </Button>
              )}
              
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
            <Button variant="outline" size="sm" onClick={exitMode} >
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
          )
        }
      />


{mode === "browse" && macActual &&(
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
          {/* 1. Ventas Acumuladas */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="text-xs text-muted-foreground">Ventas Acumuladas</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              S/ {totalVentas.toFixed(2)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {cantidadVendida} productos vendidos
            </div>
          </Card>

          {/* 2. Ganancia Estimada */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="text-xs text-muted-foreground">Ganancia Estimada</div>
            <div className="text-xl font-bold text-blue-600 mt-1">
              S/ {gananciaTotal.toFixed(2)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Margen estimado
            </div>
          </Card>

          {/* 3. Valor Total de Inventario */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="text-xs text-muted-foreground">Valor total</div>
            <div className="text-xl font-bold text-primary mt-1">
              {fmtMoney(totalInventoryValue)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {fmtNumber(totalUnits)} unidades
            </div>
          </Card>

          {/* 4. Referencias / Productos */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="text-xs text-muted-foreground">Referencias</div>
            <div className="text-xl font-bold mt-1">
              {fmtNumber(list.length)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              productos
            </div>
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
          <div className="space-y-6 mt-6">
            {/* BUSCADOR DE MÁQUINAS */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar máquina por nombre..." 
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                className="pl-10 h-11"
              />
            </div>

            {/* CUADRÍCULA DE MÁQUINAS */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {machinesList
                .filter(m => (m.name || m.id).toLowerCase().includes(machineSearch.toLowerCase()))
                .map((m) => {
                  
                  // 1. LÓGICA DINÁMICA DEL DOBLE CANDADO
                  // Leemos la info real que viene de DBeaver/Node
                  const pagoAlDia = m.pago_al_dia !== false; 
                  const macroDroidActivo = m.macrodroid_activo !== false; 
                  
                  // Decidimos el estado
                  let machineStatus = 'en_vivo';
                  if (!pagoAlDia) {
                    machineStatus = 'suspendida';
                  } else if (!macroDroidActivo) {
                    machineStatus = 'averiada';
                  }

                  return (
                    <Card key={m.id} className="p-5 flex flex-col justify-between hover:border-emerald-500 hover:shadow-md transition-all bg-white border-slate-200">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-xl text-slate-800 leading-tight pr-2">{m.name || m.id}</h3>
                          
                          {/* SISTEMA DE ETIQUETAS (BADGES) DE ESTADO */}
                          {machineStatus === 'en_vivo' && (
                            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              En vivo
                            </span>
                          )}
                          {machineStatus === 'suspendida' && (
                            <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Suspendida
                            </span>
                          )}
                          {machineStatus === 'averiada' && (
                            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0">
                              <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                              Offline
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 mb-6">
                          <p className="text-sm text-slate-500 flex items-center gap-2">
                            <span className="font-medium text-slate-700">MAC:</span> {m.id}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID Máquina
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => setSearchParams({ action: action || "", mac: m.id })}
                        className={`w-full h-11 text-white ${
                          machineStatus === 'en_vivo' 
                            ? 'bg-slate-800 hover:bg-slate-900' 
                            : 'bg-slate-400 cursor-not-allowed'
                        }`}
                        disabled={machineStatus === 'suspendida' || machineStatus === 'averiada'} 
                      >
                        {machineStatus === 'suspendida' && "Acceso Bloqueado (Pago)"}
                        {machineStatus === 'averiada' && "Máquina Offline"}
                        {machineStatus === 'en_vivo' && "Abrir Planograma"}
                      </Button>
                    </Card>
                  );
              })}
              
              {machinesList.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl border-slate-200 bg-slate-50">
                  <Package className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <h3 className="text-lg font-medium text-slate-700">No hay máquinas registradas</h3>
                  <p className="text-sm text-slate-500">Vincula tu primera máquina ESP32 a la plataforma.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* AQUÍ SIGUE EL CÓDIGO DE LAS BANDEJAS REALES QUE YA TIENES */}
{/* LEEMOS LAS BANDEJAS REALES DE LA MÁQUINA DESDE LA BASE DE DATOS */}
    {(() => {
     const maquinaSeleccionada = machinesList.find((m) => m.id === macActual);
      //const totalBandejas = maquinaSeleccionada?.layout?.trays?.length || 4;

      const totalBandejas = 6; // <-- ¡ESTA ES LA LÍNEA MÁGICA!
      return Array.from({ length: totalBandejas }, (_, i) => i + 1).map((numBandeja) => (
        <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5">

              {/* Cabecera de la Bandeja */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
                <span className="text-sm text-muted-foreground">#{numBandeja} · 6 resortes</span>
              </div>

{/* LEEMOS Y MOSTRAMOS ÚNICAMENTE LOS RESORTES REALES CONFIGURADOS */}
        {(() => {
          // 1. Agrupamos los resortes reales que tiene esta máquina por su número de bandeja
          const bandejasConResortes: { [key: number]: any[] } = {};
          
          list.forEach((p) => {
            if (p.codigo_motor) {
              const numBandeja = parseInt(String(p.codigo_motor).charAt(0), 10) || 1;
              if (!bandejasConResortes[numBandeja]) {
                bandejasConResortes[numBandeja] = [];
              }
              bandejasConResortes[numBandeja].push(p);
            }
          });

          // 2. Obtenemos solo los números de bandeja que tienen al menos un resorte creado
          const numerosDeBandejas = Object.keys(bandejasConResortes).map(Number).sort((a, b) => a - b);

          if (numerosDeBandejas.length === 0) {
            return (
              <div className="p-12 text-center bg-card rounded-2xl border mt-4">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Esta máquina aún no tiene resortes configurados.</p>
                <p className="text-xs text-muted-foreground mt-1">Ve a la sección de Máquinas y añade los resortes (ej. M11, M13) para verlos aquí.</p>
              </div>
            );
          }

          // 3. Dibujamos dinámicamente solo las bandejas y resortes existentes
          return numerosDeBandejas.map((numBandeja) => {
            // Ordenamos los resortes de menor a mayor (Ej: M11, M13, M15)
            const resortesDeEstaBandeja = bandejasConResortes[numBandeja].sort((a, b) => Number(a.codigo_motor) - Number(b.codigo_motor));

            return (
              <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5 mb-6">
                {/* Cabecera de la Bandeja */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
                  <span className="text-sm text-muted-foreground">#{numBandeja} · {resortesDeEstaBandeja.length} resortes</span>
                </div>

                {/* Cuadrícula dinámica adaptada a la cantidad exacta de resortes */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {resortesDeEstaBandeja.map((producto) => {
                    const codigoMotor = producto.codigo_motor; // Ej: "11", "13", "15"
                    const tieneProductoReal = producto.nombre_producto && producto.nombre_producto.trim() !== "";

                    // Lógica del semáforo visual
                    let bgColor = "bg-card hover:bg-accent/50";
                    let borderColor = "border-dashed border-gray-300";

                    if (tieneProductoReal) {
                      const stock = Number(producto.stock) || 0;
                      const capacidad = Number(producto.capacidad) || 10;
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
                        onClick={() => handleSlotClick(codigoMotor, tieneProductoReal ? producto : null)}
                        className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] relative transition-colors cursor-pointer ${bgColor} ${borderColor}`}
                      >
                        {/* Mostramos la R acompañada del número de motor real (Ej: R11, R13) */}
                        <span className="absolute top-2 left-2 text-xs font-bold text-muted-foreground/70">
                          R{codigoMotor}
                        </span>

                        {tieneProductoReal ? (
                          <div className="flex flex-col items-center mt-2 w-full text-center">
                            <span className="text-xs font-bold line-clamp-2 leading-tight text-gray-800">
                              {producto.nombre_producto}
                            </span>
                            <span className="text-sm font-bold text-primary mt-1">
                              S/ {Number(producto.precio || 0).toFixed(2)}
                            </span>
                            
                            {/* Indicador de Stock vs Capacidad */}
                            <div className="mt-2 w-full px-2">
                              <div className="text-[10px] text-gray-600 mb-1 font-medium flex justify-between">
                                <span>Stock: {Number(producto.stock) || 0}</span>
                                <span>Máx: {Number(producto.capacidad) || 10}</span>
                              </div>
                              <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-gray-200">
                                <div 
                                  className={`h-full ${
                                    ((Number(producto.stock) || 0) / (Number(producto.capacidad) || 10)) <= 0.3 ? 'bg-red-500' : 
                                    ((Number(producto.stock) || 0) / (Number(producto.capacidad) || 10)) <= 0.7 ? 'bg-yellow-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, ((Number(producto.stock) || 0) / (Number(producto.capacidad) || 10)) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center mt-2">
                            <div className="h-8 w-8 rounded border-2 border-dashed border-gray-300 mb-1"></div>
                            <span className="text-[11px] text-muted-foreground">Vacío</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
            </div>
      ));
})()}
        
</div>
      
  )}  {/* Cart bottom bar (sale mode) */}

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
        {/* NUEVO: Modal simplificado para editar stock o cambiar de producto */}
{/* MODAL PROFESIONAL DE GESTIÓN DE RESORTE */}
      <Dialog 
        open={slotEditDialog.open} 
        onOpenChange={(o) => {
          if (!o) setSlotEditDialog({ ...slotEditDialog, open: false });
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Package className="h-6 w-6 opacity-80" />
              Resorte {slotEditDialog.slot}
            </DialogTitle>
            <DialogDescription className="text-emerald-50 mt-1 text-base">
              Producto actual: <strong className="text-white font-bold">{slotEditDialog.product?.nombre_producto || "Vacío"}</strong>
              <span className="ml-2 bg-emerald-500/50 px-2 py-0.5 rounded text-sm">
                Stock: {slotEditDialog.product?.stock || 0}
              </span>
            </DialogDescription>
          </div>

          <div className="p-4">
            <Tabs defaultValue="reabastecer" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100 mb-4">
                <TabsTrigger value="reabastecer">Reabastecer</TabsTrigger>
                <TabsTrigger value="cambiar">Cambiar</TabsTrigger>
                <TabsTrigger value="mixto">Mixto</TabsTrigger>
              </TabsList>

              {/* 1. PESTAÑA DE REABASTECER */}
              <TabsContent value="reabastecer" className="space-y-4 outline-none">
                <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                  <Label className="text-emerald-800 text-sm">¿Cuántas unidades vas a ingresar a la máquina?</Label>
                  <div className="flex items-center gap-4 mt-3">
                    <Input 
                      type="number" 
                      min="1"
                      value={reabastecerQty}
                      onChange={(e) => setReabastecerQty(e.target.value)}
                      className="text-xl font-bold w-24 text-center h-12 border-emerald-200 focus-visible:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-500 leading-tight">
                      Esta cantidad se sumará al resorte y <br/> 
                      el sistema la restará automáticamente <br/> de tu almacén general.
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" onClick={() => setSlotEditDialog({ ...slotEditDialog, open: false })}>Cancelar</Button>
                  <Button onClick={handleReabastecer} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {processing ? "Guardando..." : "Confirmar Reingreso"}
                  </Button>
                </div>
              </TabsContent>

              {/* 2. PESTAÑA DE CAMBIAR PRODUCTO */}
              <TabsContent value="cambiar" className="space-y-4 outline-none">
                <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
                    <Search className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h4 className="font-semibold text-slate-700 mb-1">Buscar en el Inventario</h4>
                  <p className="text-sm text-slate-500 mb-5 px-6">
                    Serás redirigido a tu almacén. Podrás usar la cámara para escanear el nuevo producto o seleccionarlo de la lista.
                  </p>
                  <Button 
                    onClick={handleChangeProduct}
                    className="bg-slate-800 hover:bg-slate-900 text-white w-3/4"
                  >
                    Ir al Almacén
                  </Button>
                </div>
              </TabsContent>

              {/* 3. PESTAÑA DE SURTIDO MIXTO */}
              <TabsContent value="mixto" className="space-y-4 outline-none">
                <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-800 mb-4 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    Crea un surtido cuando pongas varios productos distintos (ej: Morochas y Lentejas) en este mismo resorte.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-amber-900 text-xs">Nombre del Surtido</Label>
                      <Input 
                        value={mixtoForm.name}
                        onChange={(e) => setMixtoForm({...mixtoForm, name: e.target.value})}
                        placeholder="Ej: Snacks Surtidos (Morocha/Lenteja)" 
                        className="border-amber-200 mt-1.5 h-9" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-amber-900 text-xs">Precio Único (S/)</Label>
                        <Input 
                          type="number" 
                          step="0.10" 
                          value={mixtoForm.price}
                          onChange={(e) => setMixtoForm({...mixtoForm, price: e.target.value})}
                          placeholder="1.50" 
                          className="border-amber-200 mt-1.5 h-9" 
                        />
                      </div>
                      <div>
                        <Label className="text-amber-900 text-xs">Cantidad Total</Label>
                        <Input 
                          type="number" 
                          value={mixtoForm.qty}
                          onChange={(e) => setMixtoForm({...mixtoForm, qty: e.target.value})}
                          placeholder="10" 
                          className="border-amber-200 mt-1.5 h-9" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" onClick={() => setSlotEditDialog({ ...slotEditDialog, open: false })}>Cancelar</Button>
                  <Button onClick={handleMixto} disabled={processing} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {processing ? "Guardando..." : "Guardar Surtido"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    
  );
};

export default Products;
