import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import {
  Boxes, Coins, MapPin, Pencil, Plus, Trash2, LayoutGrid, Minus, Package, Eye,
  FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Spring = {
  id: string;
  label: string;
  capacity: number;            // capacidad máxima
  product_id: string | null;   // producto asignado
  sale_price: number;          // precio de venta en este slot
  current_qty: number;         // unidades actualmente cargadas
};
type Tray = { id: string; label: string; springs: Spring[] };
type Layout = { trays: Tray[] };

type Machine = {
  id: string; name: string; code: string; location: string | null;
  coin_base: number; coin_current: number; active: boolean;
  layout: Layout | null;
  brand: string | null; model: string | null; plate: string | null;
  coin_brand: string | null; coin_plate: string | null;
  bill_enabled: boolean; bill_brand: string | null; bill_model: string | null; bill_plate: string | null;
};

type Product = {
  id: string;
  name: string;
  // ... (tus campos antiguos)
  machine_id?: string;
  codigo_motor?: string;
  nombre_producto?: string;
  precio?: number;
  stock?: number;
  capacidad?: number;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const newSpring = (i: number): Spring => ({
  id: uid(), label: `R${i + 1}`, capacity: 8,
  product_id: null, sale_price: 0, current_qty: 0,
});
const newTray = (i: number, springsCount = 6): Tray => ({
  id: uid(),
  label: `Bandeja ${String.fromCharCode(65 + i)}`,
  springs: Array.from({ length: springsCount }, (_, j) => newSpring(j)),
});
const defaultLayout = (): Layout => ({ trays: Array.from({ length: 4 }, (_, i) => newTray(i, 6)) });

// Migra layouts antiguos (sin campos de producto) a la nueva forma
const normalize = (l: Layout | null | undefined): Layout => {
  if (!l || !Array.isArray(l.trays)) return defaultLayout();
  return {
    trays: l.trays.map((t) => ({
      id: t.id || uid(),
      label: t.label || "Bandeja",
      springs: (t.springs || []).map((s: any) => ({
        id: s.id || uid(),
        label: s.label || "R",
        capacity: Number(s.capacity) || 0,
        product_id: s.product_id ?? null,
        sale_price: Number(s.sale_price) || 0,
        current_qty: Number(s.current_qty) || 0,
      })),
    })),
  };
};
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const Machines = () => {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [productosModal, setProductosModal] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", location: "", coin_base: "",
    brand: "", model: "", plate: "",
    coin_brand: "", coin_plate: "",
    bill_enabled: false, bill_brand: "", bill_model: "", bill_plate: "",
  });
  const [layout, setLayout] = useState<Layout>(defaultLayout());
  const [tab, setTab] = useState<"data" | "layout">("data");
  const [selected, setSelected] = useState<{ trayId: string; springId: string } | null>(null);
  const [viewing, setViewing] = useState<Machine | null>(null);
  const [debtByMachine, setDebtByMachine] = useState<Record<string, { count: number; total: number }>>({});
  const [salesTodayByMachine, setSalesTodayByMachine] = useState<Record<string, { revenue: number; profit: number; units: number }>>({});
// 2. LA FUNCIÓN PARA CARGAR LA LISTA PRINCIPAL
  const load = async () => {
    if (!user?.email) return;
    try {
      const userIdentifier = user.email;
      const res = await fetch(`${apiUrl}/machines?user=${userIdentifier}`);
      const data = await res.json(); 
      
      if (res.ok) {
const formattedMachines = data.map((m: any) => ({
          id: m.id,
          name: m.name, 
          code: m.code || m.id, // Usamos su código real
          location: m.location || "",
          coin_base: m.coin_base || 0,
          coin_current: m.coin_current || 0,
          active: m.status === 'online',
          layout: null, 
          // Conectamos los datos de las marcas y modelos
          brand: m.brand || "", 
          model: m.model || "", 
          plate: m.plate || "",
          coin_brand: m.coin_brand || "", 
          coin_plate: m.coin_plate || "",
          bill_enabled: !!m.bill_enabled, 
          bill_brand: m.bill_brand || "", 
          bill_model: m.bill_model || "", 
          bill_plate: m.bill_plate || ""
        }));
        setList(formattedMachines);
      }
    } catch (error) {
      console.error("Error cargando máquinas:", error);
    }
  };

  // 3. EL INTERRUPTOR QUE DIBUJA LAS MÁQUINAS EN PANTALLA
  useEffect(() => {
    if (user?.email) {
      load();
    }
  }, [user]);

  // 4. EL INTERRUPTOR QUE DIBUJA LOS PRODUCTOS EN EL OJITO
  useEffect(() => {
    if (viewing) {
      const macMaquina = viewing.code; 
      
      const descargarInventarioMaquina = async () => {
        try {
          const res = await fetch(`${apiUrl}/inventario/${macMaquina}`);
          const data = await res.json();
          
          if (Array.isArray(data)) {
            setProductosModal(data);
          } else if (data.inventario) {
            setProductosModal(data.inventario);
          } else {
            setProductosModal([]);
          }
        } catch (error) {
          console.error("Error al obtener inventario del modal:", error);
          setProductosModal([]);
        }
      };

      descargarInventarioMaquina();
    } else {
      setProductosModal([]);
    }
  }, [viewing]);
// Efecto que se dispara cada vez que abres o cierras el ojito de una máquina
// Efecto que se dispara cada vez que abres o cierras el ojito de una máquina
  useEffect(() => {
    if (viewing) {
      // Usamos el código de la máquina que seleccionaste
      const macMaquina = viewing.code || "D4-8A-FC-A5-26-A8"; 
      
      const descargarInventarioMaquina = async () => {
        try {
          const res = await fetch(`${apiUrl}/inventario/${macMaquina}`);
          const data = await res.json();
          
          // Agregamos un espía temporal por si acaso
          console.log("Datos que llegaron al ojito:", data); 
          
          // Si el backend envía la lista directamente (lo más seguro)
          if (Array.isArray(data)) {
            setProductosModal(data);
          } 
          // Si el backend lo envía envuelto en { success: true, inventario: [...] }
          else if (data.inventario) {
            setProductosModal(data.inventario);
          } else {
            setProductosModal([]);
          }
        } catch (error) {
          console.error("Error al obtener inventario del modal:", error);
          setProductosModal([]);
        }
      };

      descargarInventarioMaquina();
    } else {
      // Si cerramos el ojito, limpiamos la lista
      setProductosModal([]);
    }
  }, [viewing]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "", code: "", location: "", coin_base: "",
      brand: "", model: "", plate: "",
      coin_brand: "", coin_plate: "",
      bill_enabled: false, bill_brand: "", bill_model: "", bill_plate: "",
    });
    setLayout(defaultLayout());
    setTab("data");
    setOpen(true);
  };
  const openEdit = (m: Machine) => {
    setEditing(m);
    setForm({
      name: m.name, code: m.code, location: m.location || "", coin_base: String(m.coin_base),
      brand: m.brand || "", model: m.model || "", plate: m.plate || "",
      coin_brand: m.coin_brand || "", coin_plate: m.coin_plate || "",
      bill_enabled: !!m.bill_enabled,
      bill_brand: m.bill_brand || "", bill_model: m.bill_model || "", bill_plate: m.bill_plate || "",
    });
    setLayout(normalize(m.layout));
    setTab("data");
    setOpen(true);
  };

const save = async () => {
    try {
      if (!form.name.trim() || !form.code.trim()) {
        return toast.error("El Nombre y el Código son obligatorios");
      }

      // Tomamos el email del usuario de tu sistema de autenticación (el hook que ya usas)
      const currentUserEmail = user?.email; 
      
      if (!currentUserEmail) {
        return toast.error("Error: No se detectó tu sesión. Intenta recargar la página.");
      }

      const base = parseFloat(form.coin_base) || 0;
      
      // Armamos el paquete exactamente con los campos de tu base de datos
      const payload = {
        machine_id: form.code.trim(), // Tu MAC
        name: form.name.trim(), 
        code: form.code.trim(),
        location: form.location.trim() || null, 
        coin_base: base,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        plate: form.plate.trim() || null,
        coin_brand: form.coin_brand.trim() || null,
        coin_plate: form.coin_plate.trim() || null,
        bill_enabled: !!form.bill_enabled,
        bill_brand: form.bill_enabled ? (form.bill_brand.trim() || null) : null,
        bill_model: form.bill_enabled ? (form.bill_model.trim() || null) : null,
        bill_plate: form.bill_enabled ? (form.bill_plate.trim() || null) : null,
        layout: layout,
        user_email: currentUserEmail // Lo enviamos para que Node.js sepa de quién es
      };

      // Si estamos editando, hacemos un PUT a /api/machines/:id, si es nueva hacemos un POST
      const url = editing ? `${apiUrl}/machines/${editing.id || editing.code}` : `${apiUrl}/machines`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("El servidor no pudo guardar los cambios");
      }

      toast.success(editing ? "Máquina actualizada correctamente" : "Máquina creada exitosamente");
      setOpen(false); // Cierra la ventana emergente
      load(); // Recarga la lista pidiendo los datos actualizados a tu backend

    } catch (error: any) {
      console.error("Error al guardar:", error);
      toast.error(error.message || "Ocurrió un error al conectar con el servidor");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta máquina?")) return;
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada"); load();
  };

  // ===== Layout helpers =====
  const addTray = () =>
    setLayout((l) => ({ trays: [...l.trays, newTray(l.trays.length, 6)] }));
  const removeTray = (id: string) =>
    setLayout((l) => ({ trays: l.trays.filter((t) => t.id !== id) }));
  const setTraySprings = (trayId: string, count: number) =>
    setLayout((l) => ({
      trays: l.trays.map((t) => {
        if (t.id !== trayId) return t;
        const c = Math.max(1, Math.min(20, count));
        const next = [...t.springs];
        if (c > next.length) for (let i = next.length; i < c; i++) next.push(newSpring(i));
        else next.length = c;
        return { ...t, springs: next };
      }),
    }));
  const updateSpring = (trayId: string, springId: string, patch: Partial<Spring>) =>
    setLayout((l) => ({
      trays: l.trays.map((t) => t.id !== trayId ? t : ({
        ...t,
        springs: t.springs.map((s) => s.id !== springId ? s : { ...s, ...patch }),
      })),
    }));
  const updateTray = (trayId: string, patch: Partial<Tray>) =>
    setLayout((l) => ({
      trays: l.trays.map((t) => t.id !== trayId ? t : { ...t, ...patch }),
    }));
  const setAllCaps = (trayId: string, cap: number) =>
    setLayout((l) => ({
      trays: l.trays.map((t) => t.id !== trayId ? t : ({
        ...t, springs: t.springs.map((s) => ({ ...s, capacity: Math.max(0, cap) })),
      })),
    }));

  const totalSlots = layout.trays.reduce((a, t) => a + t.springs.length, 0);
  const totalCap = layout.trays.reduce((a, t) => a + t.springs.reduce((b, s) => b + s.capacity, 0), 0);
  const totalLoaded = layout.trays.reduce((a, t) => a + t.springs.reduce((b, s) => b + s.current_qty, 0), 0);
  const assignedCount = layout.trays.reduce((a, t) => a + t.springs.filter((s) => !!s.product_id).length, 0);

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name || "";

  // Totales en tiempo real (todas las máquinas)
  const totalsLive = list.reduce(
    (acc, m) => {
      const s = salesTodayByMachine[m.id] || { revenue: 0, profit: 0, units: 0 };
      acc.coinCurrent += Number(m.coin_current || 0);
      acc.coinBase += Number(m.coin_base || 0);
      acc.todayRevenue += s.revenue;
      acc.todayProfit += s.profit;
      acc.todayUnits += s.units;
      return acc;
    },
    { coinCurrent: 0, coinBase: 0, todayRevenue: 0, todayProfit: 0, todayUnits: 0 },
  );

  const exportRows = () => list.map((m) => {
    const s = salesTodayByMachine[m.id] || { revenue: 0, profit: 0, units: 0 };
    const d = debtByMachine[m.id] || { count: 0, total: 0 };
    return {
      Codigo: m.code,
      Nombre: m.name,
      Marca: m.brand || "",
      Modelo: m.model || "",
      Matricula: m.plate || "",
      Ubicacion: m.location || "",
      Monedero_Marca: m.coin_brand || "",
      Monedero_Matricula: m.coin_plate || "",
      Base: Number(m.coin_base || 0),
      Monedero_Actual: Number(m.coin_current || 0),
      Billetero: m.bill_enabled ? "Sí" : "No",
      Billetero_Marca: m.bill_brand || "",
      Billetero_Modelo: m.bill_model || "",
      Billetero_Matricula: m.bill_plate || "",
      Ventas_Hoy: s.revenue,
      Ganancia_Hoy: s.profit,
      Unidades_Hoy: s.units,
      Deuda_Pendiente: d.total,
    };
  });

  const downloadXLSX = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Máquinas");
    XLSX.writeFile(wb, `maquinas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Reporte de máquinas — " + new Date().toLocaleDateString(), 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Monedero actual total: ${fmtMoney(totalsLive.coinCurrent)}  ·  Ventas hoy: ${fmtMoney(totalsLive.todayRevenue)}  ·  Ganancia hoy: ${fmtMoney(totalsLive.todayProfit)}`,
      14, 20,
    );
    const rows = exportRows();
    const cols = Object.keys(rows[0] || { Codigo: "" });
    autoTable(doc, {
      startY: 25,
      head: [cols],
      body: rows.map((r: any) => cols.map((c) => {
        const v = r[c];
        return typeof v === "number" ? v.toFixed(2) : String(v ?? "");
      })),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 100, 80] },
    });
    doc.save(`maquinas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ===== Detalle por máquina (sales + deudas + layout) =====
  const fetchMachineDetail = async (m: Machine) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [{ data: sales }, { data: debts }] = await Promise.all([
      (supabase as any).from("sales")
        .select("id, sold_at, quantity, unit_price, unit_cost, total, concept, products(name)")
        .eq("machine_id", m.id)
        .gte("sold_at", start.toISOString()).lte("sold_at", end.toISOString())
        .order("sold_at", { ascending: false }),
      (supabase as any).from("vending_consumptions")
        .select("id, consumed_at, quantity, unit_price, total, status, customer_name, slot_code, products(name)")
        .eq("machine_id", m.id)
        .eq("status", "pending")
        .order("consumed_at", { ascending: false }),
    ]);
    return { sales: sales || [], debts: debts || [] };
  };

  const downloadMachineXLSX = async (m: Machine) => {
    const XLSX = await import("xlsx");
    const { sales, debts } = await fetchMachineDetail(m);
    const wb = XLSX.utils.book_new();

    const info = [{
      Codigo: m.code, Nombre: m.name, Marca: m.brand || "", Modelo: m.model || "",
      Matricula: m.plate || "", Ubicacion: m.location || "",
      Monedero_Marca: m.coin_brand || "", Monedero_Matricula: m.coin_plate || "",
      Monedero_Base: Number(m.coin_base || 0), Monedero_Actual: Number(m.coin_current || 0),
      Billetero: m.bill_enabled ? "Sí" : "No",
      Billetero_Marca: m.bill_brand || "", Billetero_Modelo: m.bill_model || "", Billetero_Matricula: m.bill_plate || "",
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Información");

    const lay = normalize(m.layout);
    const stockRows: any[] = [];
    lay.trays.forEach((t) => t.springs.forEach((s) => {
      stockRows.push({
        Bandeja: t.label, Resorte: s.label,
        Producto: productName(s.product_id) || "—",
        Capacidad: s.capacity, Cargado: s.current_qty,
        Precio: Number(s.sale_price || 0),
      });
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), "Inventario");

    const salesRows: any[] = (sales as any[]).map((s) => ({
      Fecha: new Date(s.sold_at).toLocaleString(),
      Producto: s.products?.name || s.concept || "—",
      Cantidad: Number(s.quantity || 0),
      Precio_unit: Number(s.unit_price || 0),
      Costo_unit: Number(s.unit_cost || 0),
      Total: Number(s.total || 0),
      Ganancia: Number(s.total || 0) - Number(s.unit_cost || 0) * Number(s.quantity || 0),
    }));
    const totalRev = salesRows.reduce((a, r) => a + r.Total, 0);
    const totalProf = salesRows.reduce((a, r) => a + r.Ganancia, 0);
    salesRows.push({ Fecha: "TOTAL", Producto: "", Cantidad: salesRows.reduce((a, r) => a + r.Cantidad, 0), Precio_unit: "", Costo_unit: "", Total: totalRev, Ganancia: totalProf });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows.length ? salesRows : [{ Fecha: "Sin ventas hoy" }]), "Ventas hoy");

    const debtRows: any[] = (debts as any[]).map((d) => ({
      Fecha: new Date(d.consumed_at).toLocaleString(),
      Producto: d.products?.name || "—",
      Slot: d.slot_code || "",
      Cliente: d.customer_name || "",
      Cantidad: Number(d.quantity || 0),
      Precio_unit: Number(d.unit_price || 0),
      Total: Number(d.total || 0),
    }));
    const totalDebt = debtRows.reduce((a, r) => a + r.Total, 0);
    if (debtRows.length) debtRows.push({ Fecha: "TOTAL", Producto: "", Slot: "", Cliente: "", Cantidad: debtRows.reduce((a, r) => a + r.Cantidad, 0), Precio_unit: "", Total: totalDebt });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtRows.length ? debtRows : [{ Fecha: "Sin deudas" }]), "Deudas pendientes");

    XLSX.writeFile(wb, `maquina_${m.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel descargado");
  };

  const downloadMachinePDF = async (m: Machine) => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { sales, debts } = await fetchMachineDetail(m);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Reporte máquina · ${m.name}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Código: ${m.code}  ·  ${[m.brand, m.model].filter(Boolean).join(" · ") || "—"}`, 14, 20);
    if (m.location) doc.text(`Ubicación: ${m.location}`, 14, 25);
    doc.text(
      `Monedero base: ${fmtMoney(m.coin_base)}  ·  Actual: ${fmtMoney(m.coin_current)}  ·  Billetero: ${m.bill_enabled ? "Sí" : "No"}`,
      14, 30,
    );

    const salesBody = (sales as any[]).map((s) => [
      new Date(s.sold_at).toLocaleString(),
      s.products?.name || s.concept || "—",
      String(s.quantity),
      Number(s.unit_price || 0).toFixed(2),
      Number(s.total || 0).toFixed(2),
      (Number(s.total || 0) - Number(s.unit_cost || 0) * Number(s.quantity || 0)).toFixed(2),
    ]);
    const totalRev = (sales as any[]).reduce((a, s) => a + Number(s.total || 0), 0);
    const totalProf = (sales as any[]).reduce((a, s) => a + Number(s.total || 0) - Number(s.unit_cost || 0) * Number(s.quantity || 0), 0);
    const totalUnits = (sales as any[]).reduce((a, s) => a + Number(s.quantity || 0), 0);

    autoTable(doc, {
      startY: 36,
      head: [["Ventas de hoy"]],
      body: [[""]],
      theme: "plain",
      styles: { fontSize: 11, fontStyle: "bold", textColor: [16, 100, 80] },
    });
    autoTable(doc, {
      head: [["Fecha", "Producto", "Cant.", "P. Unit", "Total", "Ganancia"]],
      body: salesBody.length ? salesBody : [["—", "Sin ventas hoy", "", "", "", ""]],
      foot: salesBody.length ? [["", "TOTAL", String(totalUnits), "", totalRev.toFixed(2), totalProf.toFixed(2)]] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 100, 80] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    const debtBody = (debts as any[]).map((d) => [
      new Date(d.consumed_at).toLocaleString(),
      d.products?.name || "—",
      d.slot_code || "",
      d.customer_name || "",
      String(d.quantity),
      Number(d.total || 0).toFixed(2),
    ]);
    const totalDebt = (debts as any[]).reduce((a, d) => a + Number(d.total || 0), 0);
    const totalDebtUnits = (debts as any[]).reduce((a, d) => a + Number(d.quantity || 0), 0);
    autoTable(doc, {
      head: [["Deudas pendientes"]],
      body: [[""]],
      theme: "plain",
      styles: { fontSize: 11, fontStyle: "bold", textColor: [180, 100, 0] },
    });
    autoTable(doc, {
      head: [["Fecha", "Producto", "Slot", "Cliente", "Cant.", "Total"]],
      body: debtBody.length ? debtBody : [["—", "Sin deudas", "", "", "", ""]],
      foot: debtBody.length ? [["", "TOTAL", "", "", String(totalDebtUnits), totalDebt.toFixed(2)]] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 130, 0] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    doc.save(`maquina_${m.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF descargado");
  };

  return (
    <div className="container py-8">
      <PageHeader title="Máquinas" description="Tus máquinas expendedoras y su monedero base" actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadXLSX} disabled={!list.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPDF} disabled={!list.length}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva máquina</Button>
        </div>
      } />

      {/* Resumen en tiempo real */}
      {list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3 text-accent" />Monedero total (live)</div>
            <div className="font-bold text-lg text-primary">{fmtMoney(totalsLive.coinCurrent)}</div>
            <div className="text-[10px] text-muted-foreground">Base: {fmtMoney(totalsLive.coinBase)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ventas hoy (máquinas)</div>
            <div className="font-bold text-lg text-emerald-500">{fmtMoney(totalsLive.todayRevenue)}</div>
            <div className="text-[10px] text-muted-foreground">{totalsLive.todayUnits} unidades</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ganancia hoy (máquinas)</div>
            <div className="font-bold text-lg text-amber-500">{fmtMoney(totalsLive.todayProfit)}</div>
            <div className="text-[10px] text-muted-foreground">Sólo ventas vending</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Máquinas activas</div>
            <div className="font-bold text-lg">{list.filter((m) => m.active).length} / {list.length}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              en vivo
            </div>
          </Card>
        </div>
      )}

      {list.length === 0 ? (
        <Card className="p-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tienes máquinas registradas</p>
          <Button variant="hero" className="mt-4" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Agregar la primera</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => {
            const lay = normalize(m.layout);
            const trays = lay.trays.length;
            const slots = lay.trays.reduce((a, t) => a + t.springs.length, 0);
            const assigned = lay.trays.reduce((a, t) => a + t.springs.filter((s) => !!s.product_id).length, 0);
            return (
              <Card key={m.id} className="p-5 gradient-card hover:shadow-soft transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="secondary" className="mb-2 text-xs">{m.code}</Badge>
                    <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                    {(m.brand || m.model) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[m.brand, m.model].filter(Boolean).join(" · ")}
                        {m.plate ? ` · S/N ${m.plate}` : ""}
                      </p>
                    )}
                    {m.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{m.location}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setViewing(m)} title="Ver máquina"><Eye className="h-4 w-4 text-primary" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => downloadMachineXLSX(m)} title="Descargar Excel"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => downloadMachinePDF(m)} title="Descargar PDF"><FileText className="h-4 w-4 text-red-500" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm pt-3 border-t">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Base</p>
                    <p className="font-semibold text-xs">{fmtMoney(m.coin_base)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3 text-accent" />Actual</p>
                    <p className="font-semibold text-xs text-primary">{fmtMoney(m.coin_current)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><LayoutGrid className="h-3 w-3" />Slots</p>
                    <p className="font-semibold text-xs">{trays}b · {slots}r</p>
                  </div>
                </div>
                {(() => {
                  const s = salesTodayByMachine[m.id];
                  if (!s || s.revenue === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-500/20">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Vendido hoy</p>
                        <p className="font-semibold text-xs text-emerald-500">{fmtMoney(s.revenue)} · {s.units}u</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Ganancia hoy</p>
                        <p className="font-semibold text-xs text-amber-500">{fmtMoney(s.profit)}</p>
                      </div>
                    </div>
                  );
                })()}
                {slots > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> {assigned}/{slots} resortes con producto
                  </div>
                )}
                {debtByMachine[m.id] && debtByMachine[m.id].count > 0 && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-accent/10 border border-accent/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    <span className="text-[11px] font-semibold text-accent-foreground">
                      {debtByMachine[m.id].count} consumos en vivo · {fmtMoney(debtByMachine[m.id].total)}
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar máquina" : "Nueva máquina"}</DialogTitle></DialogHeader>

          {/* Tabs */}
          

          {tab === "data" && (
            <div className="space-y-5">
              {/* Identificación */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary">Identificación</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Nombre *</Label><Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Oficina principal" /></div>
                  <div><Label>Código *</Label><Input value={form.code} maxLength={40} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ej: MX-001" /></div>
                  <div className="sm:col-span-2"><Label>Ubicación</Label><Input value={form.location} maxLength={160} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Opcional" /></div>
                </div>
              </div>

              {/* Máquina */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary">Datos de la máquina</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><Label>Marca</Label><Input value={form.brand} maxLength={60} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ej: Vendimax" /></div>
                  <div><Label>Modelo</Label><Input value={form.model} maxLength={60} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ej: V-450" /></div>
                  <div><Label>Matrícula / Serie</Label><Input value={form.plate} maxLength={60} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="Nº de serie" /></div>
                </div>
              </div>

              {/* Monedero */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary flex items-center gap-1"><Coins className="h-4 w-4" />Monedero</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><Label>Marca del monedero</Label><Input value={form.coin_brand} maxLength={60} onChange={(e) => setForm({ ...form, coin_brand: e.target.value })} placeholder="Ej: NRI" /></div>
                  <div><Label>Matrícula del monedero</Label><Input value={form.coin_plate} maxLength={60} onChange={(e) => setForm({ ...form, coin_plate: e.target.value })} placeholder="Nº de serie" /></div>
                  <div><Label>Base en dinero</Label><Input type="number" value={form.coin_base} onChange={(e) => setForm({ ...form, coin_base: e.target.value })} placeholder="0" /></div>
                </div>
              </div>

              {/* Billetero */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-primary">Billetero</h4>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bill_enabled}
                      onChange={(e) => setForm({ ...form, bill_enabled: e.target.checked })}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    {form.bill_enabled ? "La máquina tiene billetero" : "Sin billetero"}
                  </label>
                </div>
                {form.bill_enabled && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><Label>Marca</Label><Input value={form.bill_brand} maxLength={60} onChange={(e) => setForm({ ...form, bill_brand: e.target.value })} placeholder="Ej: ICT" /></div>
                    <div><Label>Modelo</Label><Input value={form.bill_model} maxLength={60} onChange={(e) => setForm({ ...form, bill_model: e.target.value })} placeholder="Ej: BL-700" /></div>
                    <div><Label>Matrícula / Serie</Label><Input value={form.bill_plate} maxLength={60} onChange={(e) => setForm({ ...form, bill_plate: e.target.value })} placeholder="Nº de serie" /></div>
                  </div>
                )}
              </div>
            </div>
          )}



          <Button variant="hero" className="w-full mt-4" onClick={save}>Guardar máquina</Button>
        </DialogContent>
      </Dialog>

      {/* Visor de máquina (solo lectura) */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {viewing?.name} <Badge variant="secondary" className="text-xs">{viewing?.code}</Badge>
            </DialogTitle>
          </DialogHeader>
          {viewing && (() => {
            const totalBandejas = 6;
            const lay = normalize(viewing.layout);
            const slots = 36;
          // Los resortes configurados son exactamente la cantidad de productos en tu DB
              const assigned = productosModal.length; 
              
              // Sumamos la capacidad real: suma de las capacidades personalizadas + (10 por defecto para los que aún están vacíos)
              const cap = productosModal.reduce((suma, p) => suma + (Number(p.capacidad) || 10), 0) + ((slots - assigned) * 10);
              
              const loaded = productosModal.reduce((suma, p) => suma + (Number(p.stock) || 0), 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Cámbiala para que quede así: */}
                <Card className="p-2"><p className="text-muted-foreground">Bandejas</p><p className="font-bold text-base">{totalBandejas}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Resortes</p><p className="font-bold text-base">{slots}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Capacidad</p><p className="font-bold text-base">{cap}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Cargado</p><p className="font-bold text-base">{loaded}</p></Card>
                </div>
                {viewing.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{viewing.location}</p>
                )}
                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Máquina</p>
                    <p className="font-semibold">{[viewing.brand, viewing.model].filter(Boolean).join(" · ") || "—"}</p>
                    {viewing.plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.plate}</p>}
                  </Card>
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1"><Coins className="h-3 w-3" />Monedero</p>
                    <p className="font-semibold">{viewing.coin_brand || "—"}</p>
                    {viewing.coin_plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.coin_plate}</p>}
                    <p className="text-[10px]">Base: {fmtMoney(viewing.coin_base)} · Actual: <b className="text-primary">{fmtMoney(viewing.coin_current)}</b></p>
                  </Card>
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Billetero</p>
                    {viewing.bill_enabled ? (
                      <>
                        <p className="font-semibold">{[viewing.bill_brand, viewing.bill_model].filter(Boolean).join(" · ") || "Sí"}</p>
                        {viewing.bill_plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.bill_plate}</p>}
                      </>
                    ) : (
                      <p className="font-semibold text-muted-foreground">No tiene</p>
                    )}
                  </Card>
                </div>
{/* --- INICIO DEL NUEVO DISEÑO --- */}
<div className="space-y-6 mt-6">
  {[1, 2, 3, 4, 5, 6].map((numBandeja) => (
    <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5">
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
        <span className="text-sm text-muted-foreground">#{numBandeja} · 6 resortes</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[0, 1, 2, 3, 4, 5].map((posicion) => {
          const codigoMotor = `${numBandeja}${posicion}`; 
          
          // Usamos la variable exclusiva del modal que creamos antes
          const producto = productosModal.find((p) => p.codigo_motor === codigoMotor);

          return (
            <div 
              key={codigoMotor} 
              className="border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] relative hover:bg-accent/50 transition-colors"
            >
              <span className="absolute top-2 text-xs font-bold text-emerald-600">
                R{codigoMotor}
              </span>
              {producto ? (
                <div className="flex flex-col items-center mt-4 w-full text-center">
                  <span className="text-xs font-semibold line-clamp-2 leading-tight">
                    {producto.nombre_producto}
                  </span>
                  <span className="text-sm font-bold text-primary mt-1">
                    S/ {Number(producto.precio).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 bg-muted px-2 py-0.5 rounded-full">
                    Stock: {producto.stock}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center mt-4">
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
{/* --- FIN DEL NUEVO DISEÑO --- */}
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> {assigned}/{slots} resortes con producto asignado
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Machines;
