import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";
import {
  Boxes, Coins, MapPin, Pencil, Plus, Trash2, LayoutGrid, Package, Eye,
  FileSpreadsheet, FileText, Banknote
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Spring = {
  id: string;
  label: string;
  capacity: number;
  product_id: string | null;
  sale_price: number;
  current_qty: number;
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

const defaultLayout = (): Layout => ({ trays: Array.from({ length: 6 }, (_, i) => newTray(i, 6)) });

const normalize = (l: Layout | null | undefined): Layout => {
  if (!l || !Array.isArray(l.trays)) return defaultLayout();
  const bandejas = l.trays.map((t: any, index: number) => ({
    id: t.id || uid(),
    label: t.label || `Bandeja ${String.fromCharCode(65 + index)}`,
    springs: (t.springs || []).map((s: any, sIndex: number) => ({
      id: s.id || uid(),
      label: s.label || `R${sIndex + 1}`,
      capacity: Number(s.capacity) || 0,
      product_id: s.product_id ?? null,
      sale_price: Number(s.sale_price) || 0,
      current_qty: Number(s.current_qty) || 0,
    })),
  }));
  while (bandejas.length < 6) {
    bandejas.push(newTray(bandejas.length, 6));
  }
  return { trays: bandejas };
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
    coin_enabled: false,
    coin_brand: "", coin_plate: "",
    bill_enabled: false, bill_brand: "", bill_model: "", bill_plate: ""
  });
  const [layout, setLayout] = useState<Layout>(defaultLayout());
  const [tab, setTab] = useState<"data" | "layout">("data");
  const [viewing, setViewing] = useState<Machine | null>(null);
  const [debtByMachine, setDebtByMachine] = useState<Record<string, { count: number; total: number }>>({});
  const [salesTodayByMachine, setSalesTodayByMachine] = useState<Record<string, { revenue: number; profit: number; units: number }>>({});

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
          code: m.code || m.id,
          location: m.location || "",
          coin_base: m.coin_base || 0,
          coin_current: m.coin_current || 0,
          active: m.status === 'online',
          layout: null,
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

  useEffect(() => {
    if (user?.email) {
      load();
    }
  }, [user]);

  useEffect(() => {
    if (viewing) {
      const macMaquina = viewing.code || "D4-8A-FC-A5-26-A8";
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

  const openNew = () => {
    setEditing(null);
    setForm({
      // Generamos un codigo interno oculto, la MAC real la administras en DBeaver
      name: "", code: Math.random().toString(16).slice(2, 14).toUpperCase(), location: "", coin_base: "",
      brand: "", model: "", plate: "",
      coin_enabled: false, coin_brand: "", coin_plate: "",
      bill_enabled: false, bill_brand: "", bill_model: "", bill_plate: ""
    });
    setLayout(defaultLayout());
    setTab("data");
    setOpen(true);
  };

  const openEdit = (m: Machine) => {
    setEditing(m);
    setForm({
      name: m.name, code: m.code, location: m.location || "",
      coin_base: String(m.coin_base),
      brand: m.brand || "", model: m.model || "", plate: m.plate || "",
      coin_brand: m.coin_brand || "", coin_plate: m.coin_plate || "",
      coin_enabled: !!m.coin_brand || !!m.coin_plate || Number(m.coin_base) > 0,
      bill_enabled: !!m.bill_enabled,
      bill_brand: m.bill_brand || "", bill_model: m.bill_model || "", bill_plate: m.bill_plate || "",
    });
    setLayout(normalize(m.layout));
    setTab("data");
    setOpen(true);
  };

  const save = async () => {
    try {
      // 1. VALIDACIÓN ESTRICTA (Sin pedir el código MAC)
      if (!form.name.trim() || !form.location.trim() || !form.brand.trim() || !form.model.trim() || !form.plate.trim()) {
        return toast.error("Los campos Nombre, Ubicación, Marca, Modelo y Matrícula son obligatorios.");
      }

      const currentUserEmail = user?.email;
      if (!currentUserEmail) {
        return toast.error("Error: No se detectó tu sesión. Intenta recargar la página.");
      }

      const base = form.coin_enabled ? (parseFloat(form.coin_base) || 0) : 0;

      const payload = {
        machine_id: form.code.trim(),
        name: form.name.trim(),
        code: form.code.trim(),
        location: form.location.trim() || null,
        coin_base: base,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        plate: form.plate.trim() || null,
        coin_brand: form.coin_enabled ? (form.coin_brand.trim() || null) : null,
        coin_plate: form.coin_enabled ? (form.coin_plate.trim() || null) : null,
        bill_enabled: !!form.bill_enabled,
        bill_brand: form.bill_enabled ? (form.bill_brand.trim() || null) : null,
        bill_model: form.bill_enabled ? (form.bill_model.trim() || null) : null,
        bill_plate: form.bill_enabled ? (form.bill_plate.trim() || null) : null,
        layout: layout,
        user_email: currentUserEmail
      };

      const url = editing ? `${apiUrl}/machines/${editing.id || editing.code}` : `${apiUrl}/machines`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("El servidor no pudo guardar los cambios");
      }

      toast.success(editing ? "Máquina actualizada correctamente" : "Máquina creada exitosamente");
      setOpen(false);
      load();
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
    { coinCurrent: 0, coinBase: 0, todayRevenue: 0, todayProfit: 0, todayUnits: 0 }
  );

  const exportRows = () => list.map((m) => {
    const s = salesTodayByMachine[m.id] || { revenue: 0, profit: 0, units: 0 };
    const d = debtByMachine[m.id] || { count: 0, total: 0 };
    return {
      Codigo: m.code, Nombre: m.name, Marca: m.brand || "", Modelo: m.model || "",
      Matricula: m.plate || "", Ubicacion: m.location || "",
      Monedero_Marca: m.coin_brand || "", Monedero_Matricula: m.coin_plate || "",
      Base: Number(m.coin_base || 0), Monedero_Actual: Number(m.coin_current || 0),
      Billetero: m.bill_enabled ? "Si" : "No", Billetero_Marca: m.bill_brand || "",
      Billetero_Modelo: m.bill_model || "", Billetero_Matricula: m.bill_plate || "",
      Ventas_Hoy: s.revenue, Ganancia_Hoy: s.profit, Unidades_Hoy: s.units, Deuda_Pendiente: d.total,
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
    doc.text("Reporte de máquinas " + new Date().toLocaleDateString(), 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Monedero actual total: S/ ${fmtMoney(totalsLive.coinCurrent)} | Ventas hoy: S/ ${fmtMoney(totalsLive.todayRevenue)} | Ganancia hoy: S/ ${fmtMoney(totalsLive.todayProfit)}`,
      14, 20
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

  const fetchMachineDetail = async (m: Machine) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [{ data: sales }, { data: debts }] = await Promise.all([
      (supabase as any).from("sales")
        .select("id, sold_at, quantity, unit_price, unit_cost, total, concept, products (name)")
        .eq("machine_id", m.id)
        .gte("sold_at", start.toISOString()).lte("sold_at", end.toISOString())
        .order("sold_at", { ascending: false }),
      (supabase as any).from("vending_consumptions")
        .select("id, consumed_at, quantity, unit_price, total, status, customer_name, slot_code, products (name)")
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
      Nombre: m.name, Marca: m.brand || "", Modelo: m.model || "",
      Matricula: m.plate || "", Ubicacion: m.location || "",
      Monedero_Marca: m.coin_brand || "", Monedero_Matricula: m.coin_plate || "",
      Monedero_Base: Number(m.coin_base || 0), Monedero_Actual: Number(m.coin_current || 0),
      Billetero: m.bill_enabled ? "Si" : "No", Billetero_Marca: m.bill_brand || "",
      Billetero_Modelo: m.bill_model || "", Billetero_Matricula: m.bill_plate || "",
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Información");
    
    // Omitimos inventario local viejo del excel para no causar confusiones
    const salesRows: any[] = (sales as any[]).map((s) => ({
      Fecha: new Date(s.sold_at).toLocaleString(),
      Producto: s.products?.name || s.concept || "-",
      Cantidad: Number(s.quantity || 0),
      Precio_unit: Number(s.unit_price || 0),
      Costo_unit: Number(s.unit_cost || 0),
      Total: Number(s.total || 0),
      Ganancia: Number(s.total || 0) - (Number(s.unit_cost || 0) * Number(s.quantity || 0)),
    }));
    const totalRev = salesRows.reduce((a, r) => a + r.Total, 0);
    const totalProf = salesRows.reduce((a, r) => a + r.Ganancia, 0);
    salesRows.push({ Fecha: "TOTAL", Producto: "", Cantidad: salesRows.reduce((a, r) => a + r.Cantidad, 0), Precio_unit: "", Costo_unit: "", Total: totalRev, Ganancia: totalProf });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows.length ? salesRows : [{ Fecha: "Sin ventas hoy" }]), "Ventas hoy");

    const debtRows: any[] = (debts as any[]).map((d) => ({
      Fecha: new Date(d.consumed_at).toLocaleString(),
      Producto: d.products?.name || "-",
      Slot: d.slot_code || "", Cliente: d.customer_name || "",
      Cantidad: Number(d.quantity || 0), Precio_unit: Number(d.unit_price || 0), Total: Number(d.total || 0),
    }));
    const totalDebt = debtRows.reduce((a, r) => a + r.Total, 0);
    if (debtRows.length) debtRows.push({ Fecha: "TOTAL", Producto: "", Slot: "", Cliente: "", Cantidad: debtRows.reduce((a, r) => a + r.Cantidad, 0), Precio_unit: "", Total: totalDebt });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtRows.length ? debtRows : [{ Fecha: "Sin deudas" }]), "Deudas pendientes");

    XLSX.writeFile(wb, `maquina_${m.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel descargado");
  };

  const downloadMachinePDF = async (m: Machine) => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { sales, debts } = await fetchMachineDetail(m);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Reporte máquina ${m.name}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`${[m.brand, m.model].filter(Boolean).join(" ") || "-"}`, 14, 20);
    if (m.location) doc.text(`Ubicación: ${m.location}`, 14, 25);
    doc.text(
      `Monedero base: S/ ${fmtMoney(m.coin_base)} | Actual: S/ ${fmtMoney(m.coin_current)} | Billetero: ${m.bill_enabled ? "Si" : "No"}`,
      14, 30
    );

    const salesBody = (sales as any[]).map((s) => [
      new Date(s.sold_at).toLocaleString(),
      s.products?.name || s.concept || "-",
      String(s.quantity),
      Number(s.unit_price || 0).toFixed(2),
      Number(s.total || 0).toFixed(2),
      (Number(s.total || 0) - (Number(s.unit_cost || 0) * Number(s.quantity || 0))).toFixed(2),
    ]);
    const totalRev = (sales as any[]).reduce((a, s) => a + Number(s.total || 0), 0);
    const totalProf = (sales as any[]).reduce((a, s) => a + (Number(s.total || 0) - (Number(s.unit_cost || 0) * Number(s.quantity || 0))), 0);
    const totalUnits = (sales as any[]).reduce((a, s) => a + Number(s.quantity || 0), 0);

    autoTable(doc, {
      startY: 36,
      head: [["Ventas de hoy"]], body: [[""]], theme: "plain",
      styles: { fontSize: 11, fontStyle: "bold", textColor: [16, 100, 80] },
    });
    autoTable(doc, {
      head: [["Fecha", "Producto", "Cant.", "P. Unit", "Total", "Ganancia"]],
      body: salesBody.length ? salesBody : [["-", "Sin ventas hoy", "", "", "", ""]],
      foot: salesBody.length ? [["", "TOTAL", String(totalUnits), "", totalRev.toFixed(2), totalProf.toFixed(2)]] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 100, 80] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    const debtBody = (debts as any[]).map((d) => [
      new Date(d.consumed_at).toLocaleString(), d.products?.name || "-",
      d.slot_code || "", d.customer_name || "", String(d.quantity), Number(d.total || 0).toFixed(2),
    ]);
    const totalDebt = (debts as any[]).reduce((a, d) => a + Number(d.total || 0), 0);
    const totalDebtUnits = (debts as any[]).reduce((a, d) => a + Number(d.quantity || 0), 0);

    autoTable(doc, {
      head: [["Deudas pendientes"]], body: [[""]], theme: "plain",
      styles: { fontSize: 11, fontStyle: "bold", textColor: [180, 100, 0] },
    });
    autoTable(doc, {
      head: [["Fecha", "Producto", "Slot", "Cliente", "Cant.", "Total"]],
      body: debtBody.length ? debtBody : [["-", "Sin deudas", "", "", "", ""]],
      foot: debtBody.length ? [["", "TOTAL", "", "", String(totalDebtUnits), totalDebt.toFixed(2)]] : undefined,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 130, 0] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    doc.save(`maquina_${m.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF descargado");
  };

  return (
    <div className="container py-8">
      <PageHeader title="Máquinas" description="Tus máquinas expendedoras y su monedero base" actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadXLSX} disabled={!list.length}>
            <FileSpreadsheet className="h-4 w-4 mx-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPDF} disabled={!list.length}>
            <FileText className="h-4 w-4 mx-1" />PDF
          </Button>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mx-1" />Nueva máquina</Button>
        </div>
      } />

      {list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3 text-accent" />Monedero total (live) </div>
            <div className="font-bold text-lg text-primary"> S/ {fmtMoney(totalsLive.coinCurrent)} </div>
            <div className="text-[10px] text-muted-foreground">Base: S/ {fmtMoney(totalsLive.coinBase)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ventas hoy (máquinas) </div>
            <div className="font-bold text-lg text-emerald-500">S/ {fmtMoney(totalsLive.todayRevenue)}</div>
            <div className="text-[10px] text-muted-foreground">{totalsLive.todayUnits} unidades</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ganancia hoy (máquinas) </div>
            <div className="font-bold text-lg text-amber-500">S/ {fmtMoney(totalsLive.todayProfit)}</div>
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
        <Card className="p-12 text-center mt-6">
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
                    {/* MAC OCULTA AQUÍ TAMBIÉN */}
                    <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                    {(m.brand || m.model) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[m.brand, m.model].filter(Boolean).join(" ")}
                        {m.plate ? ` - S/N ${m.plate}` : ""}
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
                    <p className="font-semibold text-xs">S/ {fmtMoney(m.coin_base)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3 text-accent" />Actual</p>
                    <p className="font-semibold text-xs text-primary">S/ {fmtMoney(m.coin_current)}</p>
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
                        <p className="font-semibold text-xs text-emerald-500">S/ {fmtMoney(s.revenue)} ({s.units} un)</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Ganancia hoy</p>
                        <p className="font-semibold text-xs text-amber-500">S/ {fmtMoney(s.profit)}</p>
                      </div>
                    </div>
                  );
                })()}

                {slots > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> {assigned}/{slots} resortes con producto
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Crear/Editar Máquina */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader> <DialogTitle>{editing ? "Editar máquina" : "Nueva máquina"}</DialogTitle></DialogHeader>

          {tab === "data" && (
            <div className="space-y-5">
              {/* Identificación */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary">Identificación</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nombre *</Label>
                    <Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Oficina principal" />
                  </div>
                  <div>
                    <Label>Ubicación *</Label>
                    <Input value={form.location} maxLength={160} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej: Piso 1" />
                  </div>
                </div>
              </div>

              {/* Máquina */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary">Datos de la máquina</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><Label>Marca *</Label><Input value={form.brand} maxLength={60} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ej: Vendimax" /></div>
                  <div><Label>Modelo *</Label><Input value={form.model} maxLength={60} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ej: V-450" /></div>
                  <div><Label>Matrícula / Serie *</Label><Input value={form.plate} maxLength={60} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="N° de serie" /></div>
                </div>
              </div>

              {/* Monedero */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-primary flex items-center gap-1">
                    <Coins className="h-4 w-4" /> Monedero
                  </h4>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.coin_enabled}
                      onChange={(e) => setForm({ ...form, coin_enabled: e.target.checked })}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    {form.coin_enabled ? "La máquina tiene monedero" : "Añadir monedero"}
                  </label>
                </div>
                {form.coin_enabled && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Marca del monedero</Label>
                      <Input value={form.coin_brand} maxLength={60} onChange={(e) => setForm({ ...form, coin_brand: e.target.value })} placeholder="Ej: NRI" />
                    </div>
                    <div>
                      <Label>Matrícula del monedero</Label>
                      <Input value={form.coin_plate} maxLength={60} onChange={(e) => setForm({ ...form, coin_plate: e.target.value })} placeholder="N° de serie" />
                    </div>
                    <div>
                      <Label>Base en dinero</Label>
                      <Input type="number" value={form.coin_base} onChange={(e) => setForm({ ...form, coin_base: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                )}
              </div>

              {/* Billetero */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-primary flex items-center gap-1">
                    <Banknote className="h-4 w-4" /> Billetero
                  </h4>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bill_enabled}
                      onChange={(e) => setForm({ ...form, bill_enabled: e.target.checked })}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    {form.bill_enabled ? "La máquina tiene billetero" : "Añadir billetero"}
                  </label>
                </div>
                {form.bill_enabled && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Marca</Label>
                      <Input value={form.bill_brand} maxLength={60} onChange={(e) => setForm({ ...form, bill_brand: e.target.value })} placeholder="Ej: ICT" />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input value={form.bill_model} maxLength={60} onChange={(e) => setForm({ ...form, bill_model: e.target.value })} placeholder="Ej: BL-700" />
                    </div>
                    <div>
                      <Label>Matrícula / Serie</Label>
                      <Input value={form.bill_plate} maxLength={60} onChange={(e) => setForm({ ...form, bill_plate: e.target.value })} placeholder="N° de serie" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <Button variant="hero" className="w-full mt-4" onClick={save}>Guardar máquina</Button>
        </DialogContent>
      </Dialog>

      {/* Visor de máquina (solo lectura y ajuste de resortes) */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {viewing?.name}
            </DialogTitle>
          </DialogHeader>
          
          {viewing && (() => {
            const totalBandejas = 6;
            const slotsConfigurados = productosModal.length;
            const capReal = productosModal.reduce((suma, p) => suma + (Number(p.capacidad) || 10), 0);
            const loaded = productosModal.reduce((suma, p) => suma + (Number(p.stock) || 0), 0);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Card className="p-2"><p className="text-muted-foreground">Bandejas</p><p className="font-bold text-base">{totalBandejas}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Resortes</p><p className="font-bold text-base">{slotsConfigurados}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Capacidad</p><p className="font-bold text-base">{capReal}</p></Card>
                  <Card className="p-2"><p className="text-muted-foreground">Cargado</p><p className="font-bold text-base">{loaded}</p></Card>
                </div>

                {viewing.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{viewing.location}</p>
                )}

                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-1">Máquina</p>
                    {/* MAC ELIMINADA VISUALMENTE AQUÍ */}
                    <div className="mb-1">
                      <span className="font-semibold">{viewing.brand} {viewing.model}</span>
                    </div>
                    {viewing.plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.plate}</p>}
                  </Card>
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1"><Coins className="h-3 w-3" />Monedero</p>
                    <p className="font-semibold">{viewing.coin_brand || "-"}</p>
                    {viewing.coin_plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.coin_plate}</p>}
                    <p className="text-[10px]">Base: S/ {fmtMoney(viewing.coin_base)} Actual: <b className="text-primary">S/ {fmtMoney(viewing.coin_current)}</b></p>
                  </Card>
                  <Card className="p-2">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Billetero</p>
                    {viewing.bill_enabled ? (
                      <>
                        <p className="font-semibold">{[viewing.bill_brand, viewing.bill_model].filter(Boolean).join(" ") || "Sí"}</p>
                        {viewing.bill_plate && <p className="text-[10px] text-muted-foreground">S/N: {viewing.bill_plate}</p>}
                      </>
                    ) : (
                      <p className="font-semibold text-muted-foreground">No tiene</p>
                    )}
                  </Card>
                </div>

                {/* --- CONSTRUCTOR DE BANDEJAS DINÁMICO --- */}
                <div className="space-y-6 mt-6">
                  {[1, 2, 3, 4, 5, 6].map((numBandeja) => {
                    
                    // Solo listamos los resortes que realmente existen en el backend
                    const resortesDeBandeja = productosModal
                      .filter(p => p.codigo_motor && String(p.codigo_motor).startsWith(String(numBandeja)))
                      .sort((a, b) => Number(a.codigo_motor) - Number(b.codigo_motor));

                    return (
                      <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                          <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
                          <span className="text-sm text-muted-foreground">#{numBandeja} · {resortesDeBandeja.length} resortes</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          
                          {/* Resortes existentes */}
                          {resortesDeBandeja.map((producto) => {
                            const codigoMotor = producto.codigo_motor;
                            return (
                              <div
                                key={`${codigoMotor}-${producto.capacidad ?? 10}`}
                                className="border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] relative hover:bg-accent/50 transition-colors"
                              >
                                {/* AQUI ESTÁ LA MAGIA VISUAL DE LA M (M10, M11) */}
                                <span className="absolute top-2 text-xs font-bold text-emerald-600">
                                  M{codigoMotor}
                               </span>
                                
                                <div className="flex flex-col items-center justify-center w-full mt-2">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    Capacidad
                                  </span>
                                  <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <input
                                      id={`cap-input-${codigoMotor}`}
                                      type="number"
                                      min="1"
                                      className="w-14 h-9 text-center text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      defaultValue={producto.capacidad ?? 10}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          document.getElementById(`btn-save-${codigoMotor}`)?.click();
                                        }
                                      }}
                                    />
                                    <button
                                      id={`btn-save-${codigoMotor}`}
                                      type="button"
                                      title="Guardar capacidad"
                                      className="flex items-center justify-center w-9 h-9 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-200 shadow-sm"
                                      onClick={async () => {
                                        const inputEl = document.getElementById(`cap-input-${codigoMotor}`) as HTMLInputElement;
                                        if (!inputEl) return;
                                        const nuevaCapacidad = parseInt(inputEl.value, 10);
                                        if (isNaN(nuevaCapacidad) || nuevaCapacidad < 1) return;
                                        
                                        const macDetectada = (viewing as any).code || (viewing as any).id;
                                        try {
                                          const payload = {
                                            machine_id: macDetectada,
                                            codigo_motor: codigoMotor, // Se manda "10", no "M10"
                                            nombre_producto: producto.nombre_producto || "",
                                            precio: Number(producto.precio) || 0,
                                            stock: Number(producto.stock) || 0,
                                            capacidad: nuevaCapacidad
                                          };
                                          const res = await fetch(`${apiUrl}/inventario/actualizar`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                          });
                                          const data = await res.json();
                                          if (data.success) {
                                            toast.success(`Capacidad de M${codigoMotor} guardada`);
                                            setProductosModal((prev) =>
                                              prev.map((p) => p.codigo_motor === codigoMotor ? { ...p, capacidad: nuevaCapacidad } : p)
                                            );
                                          } else {
                                            toast.error("Error al actualizar la capacidad");
                                          }
                                        } catch (error) {
                                          toast.error("Error conectando con el servidor");
                                        }
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3H19a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.8" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3" /></svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Botón Añadir Resorte (Conexión Directa al Backend) */}
                          <button
                            type="button"
                            onClick={async () => {
                              // Calcular qué número de motor sigue (ej. 10, 11 -> 12)
                              let nextPos = 0;
                              if (resortesDeBandeja.length > 0) {
                                const ultimos = resortesDeBandeja.map(p => Number(String(p.codigo_motor).slice(-1)));
                                nextPos = Math.max(...ultimos) + 1;
                              }
                              
                              if (nextPos > 9) {
                                toast.error("Máximo de 10 resortes alcanzado en esta bandeja");
                                return;
                              }

                              const nuevoCodigo = `${numBandeja}${nextPos}`; // Ejemplo: "10"
                              const macDetectada = viewing.code || viewing.id;

                              try {
                                const payload = {
                                  machine_id: macDetectada,
                                  codigo_motor: nuevoCodigo, // Mandamos "10"
                                  nombre_producto: "",
                                  precio: 0,
                                  stock: 0,
                                  capacidad: 10
                                };
                                const res = await fetch(`${apiUrl}/inventario/actualizar`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(payload)
                                });
                                const data = await res.json();
                                if (data.success) {
                                  toast.success(`Resorte M${nuevoCodigo} añadido al Planograma`);
                                  // Lo inyectamos en la vista instantáneamente
                                
                                  setProductosModal(prev => [...prev, { ...payload, id: Math.random().toString(), name: "Vacío" }]);
                                } else {
                                  toast.error("Error al añadir resorte en la Base de Datos");
                                }
                              } catch (error) {
                                toast.error("Error conectando con el servidor");
                              }
                            }}
                            className="border-2 border-dashed border-emerald-300 rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] cursor-pointer hover:bg-emerald-50 transition-colors w-full"
                          >
                            <Plus className="h-6 w-6 text-emerald-500 mb-1" />
                            <span className="text-xs font-medium text-emerald-700 text-center leading-tight">Añadir<br/>Resorte</span>
                          </button>

                        </div>
                      </div>
                    );
                  })}
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