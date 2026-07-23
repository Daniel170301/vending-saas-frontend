import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ShoppingCart, Wallet, Package, Receipt, ArrowLeft, CalendarIcon,
  TrendingUp, TrendingDown, Printer, Pencil, Trash2, FileText, X, Coffee,
  Clock, CheckCircle2, History,
} from "lucide-react";
import { VendingRestockDialog } from "@/components/vending/VendingRestockDialog";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, isSameDay, isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year" | "custom";
const PAYMENT_METHODS = ["Efectivo", "Yape", "Plin", "Transferencia bancaria", "Vending", "Tarjeta", "Otro"];

type Tx = {
  id: string;
  number: number;
  kind: "sale" | "expense";
  concept: string | null;
  customer: string | null;
  customer_company?: string | null;
  payment_method: string | null;
  employee_id: string | null;
  employee_name: string | null;
  subtotal: number;
  total: number;
  total_cost: number;
  profit: number;
  occurred_at: string;
};

type LineItem = {
  id: string;
  product_id: string | null;
  quantity: number;
  unit: number; // unit_price for sales, unit_cost for purchases
  cost: number; // unit_cost for sales (for profit), 0 for purchases
  total: number;
  product_name: string;
};

type Employee = { id: string; name: string };

const Movements = () => {
  const navigate = useNavigate();
  const [saleDialog, setSaleDialog] = useState(false);
  const [step, setStep] = useState<"choose" | "free">("choose");
  const [free, setFree] = useState({ concept: "", customer: "", customer_company: "", payment_method: "Efectivo", employee_id: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [vendingOpen, setVendingOpen] = useState(false);
  const [debts, setDebts] = useState<any[]>([]);
  const [debtBusy, setDebtBusy] = useState<string | null>(null);
  const [settleGroup, setSettleGroup] = useState<{ machine: any; date: string; rows: any[] } | null>(null);
  const [settleQty, setSettleQty] = useState<Record<string, string>>({});
  const [settleAddCoin, setSettleAddCoin] = useState<boolean>(false);

  const [period, setPeriod] = useState<Period>("day");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [popOpen, setPopOpen] = useState(false);
  const [view, setView] = useState<"all" | "sale" | "expense" | "debt">("all");
  const [dayAnchor, setDayAnchor] = useState<Date>(new Date());     // día (modo diario)
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date());   // cualquier día dentro de la semana activa
  const [monthAnchor, setMonthAnchor] = useState<Date>(new Date()); // 1er día del mes activo
  const [yearAnchor, setYearAnchor] = useState<Date>(new Date());   // 1er día del mes activo dentro del año

  const [txs, setTxs] = useState<Tx[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [activeTx, setActiveTx] = useState<Tx | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ concept: "", customer: "", payment_method: "Efectivo", employee_id: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Movimientos · Kymez App"; }, []);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "day") return { from: startOfDay(dayAnchor), to: endOfDay(dayAnchor) };
    if (period === "week") return { from: startOfWeek(weekAnchor, { weekStartsOn: 1 }), to: endOfWeek(weekAnchor, { weekStartsOn: 1 }) };
    if (period === "month") return { from: startOfMonth(monthAnchor), to: endOfMonth(monthAnchor) };
    if (period === "year") return { from: startOfYear(yearAnchor), to: endOfYear(yearAnchor) };
    return {
      from: customRange.from ? startOfDay(customRange.from) : startOfDay(now),
      to: customRange.to ? endOfDay(customRange.to) : endOfDay(now),
    };
  }, [period, customRange, dayAnchor, weekAnchor, monthAnchor, yearAnchor]);

  // Sub-iconos por periodo
  const dayStrip = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); arr.push(d);
    }
    return arr;
  }, []);

  // (los strips de semana/mes/año se calculan inline más abajo)

  const loadData = async () => {
    const [{ data: t }, { data: e }, { data: d, error: dErr }] = await Promise.all([
      (supabase as any).from("transactions").select("*")
        .gte("occurred_at", range.from.toISOString())
        .lte("occurred_at", range.to.toISOString())
        .order("occurred_at", { ascending: false }),
      (supabase as any).from("employees").select("id, name").eq("active", true).order("name"),
      (supabase as any).from("vending_consumptions")
        .select("*")
        .eq("status", "pending")
        .order("consumed_at", { ascending: false }),
    ]);
    if (dErr) console.error("debts load error", dErr);
    setTxs((t as any) || []);
    setEmployees((e as any) || []);

    // Hidratar nombres de máquina/producto sin depender de FKs en PostgREST
    const debtRows = (d as any[]) || [];
    if (debtRows.length) {
      const machineIds = Array.from(new Set(debtRows.map((r) => r.machine_id).filter(Boolean)));
      const productIds = Array.from(new Set(debtRows.map((r) => r.product_id).filter(Boolean)));
      const [{ data: ms }, { data: ps }] = await Promise.all([
        machineIds.length
          ? (supabase as any).from("machines").select("id, name, code").in("id", machineIds)
          : Promise.resolve({ data: [] }),
        productIds.length
          ? (supabase as any).from("products").select("id, name, unit_cost").in("id", productIds)
          : Promise.resolve({ data: [] }),
      ]);
      const mMap = new Map((ms || []).map((x: any) => [x.id, x]));
      const pMap = new Map((ps || []).map((x: any) => [x.id, x]));
      setDebts(debtRows.map((r) => ({ ...r, machines: mMap.get(r.machine_id) || null, products: pMap.get(r.product_id) || null })));
    } else {
      setDebts([]);
    }
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [range.from.getTime(), range.to.getTime()]);

  // Realtime debts
  useEffect(() => {
    const ch = supabase
      .channel("mov-vc")
      .on("postgres_changes", { event: "*", schema: "public", table: "vending_consumptions" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const settleDebt = async (d: any, opts?: { addToCoin?: boolean }) => {
    const addToCoin = opts?.addToCoin ?? true;
    if (!confirm(`Convertir consumo de ${fmtMoney(d.total)} en venta efectiva?`)) return;
    setDebtBusy(d.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cost = Number(d.products?.unit_cost || 0);
      const qty = Number(d.quantity || 1);
      const price = Number(d.unit_price || 0);
      const total = Number(d.total || qty * price);
      const profit = total - cost * qty;

      const { data: tx, error: txErr } = await (supabase as any).from("transactions").insert({
        user_id: user.id, kind: "sale",
        concept: `Vending ${d.machines?.name || ""} · ${d.slot_code || ""}`.trim(),
        customer: d.customer_name || null,
        payment_method: "Vending",
        subtotal: total, total, total_cost: cost * qty, profit,
      }).select("id").single();
      if (txErr || !tx) return toast.error(txErr?.message || "Error");

      const { data: sale, error } = await supabase.from("sales").insert({
        user_id: user.id, transaction_id: tx.id, machine_id: d.machine_id, product_id: d.product_id,
        quantity: qty, unit_price: price, unit_cost: cost, total, source: "vending",
      }).select("id").single();
      if (error) return toast.error(error.message);

      await supabase.from("vending_consumptions").update({ status: "settled", sale_id: sale.id }).eq("id", d.id);

      if (addToCoin) {
        const { data: mach } = await supabase.from("machines").select("coin_current").eq("id", d.machine_id).single();
        await supabase.from("machines").update({ coin_current: Number((mach as any)?.coin_current || 0) + total }).eq("id", d.machine_id);
      }

      toast.success("Venta efectiva registrada");
      loadData();
    } finally { setDebtBusy(null); }
  };

  // Liquidar grupo (máquina+día) con cantidades manuales reales vendidas
  const saveSettleGroup = async () => {
    if (!settleGroup) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const effectiveLines = settleGroup.rows
        .map((r: any) => {
          const soldQty = Math.max(0, Math.min(Number(settleQty[r.id] ?? r.quantity) || 0, Number(r.quantity)));
          return { row: r, soldQty };
        });
      const soldLines = effectiveLines.filter((x) => x.soldQty > 0);

      if (soldLines.length === 0) {
        toast.info("No se registraron ventas; la deuda queda pendiente");
        setSettleGroup(null);
        loadData();
        return;
      }

      const totalRevenue = soldLines.reduce((a, x) => a + x.soldQty * Number(x.row.unit_price || 0), 0);
      const totalCost = soldLines.reduce((a, x) => a + x.soldQty * Number(x.row.products?.unit_cost || 0), 0);
      const profit = totalRevenue - totalCost;

      // 1) crear UNA transacción agregada por máquina+día
      const { data: tx, error: txErr } = await (supabase as any).from("transactions").insert({
        user_id: user.id, kind: "sale",
        concept: `Vending ${settleGroup.machine?.name || ""} · ${format(new Date(settleGroup.date + "T00:00:00"), "dd/MM/yyyy")}`,
        payment_method: "Vending",
        subtotal: totalRevenue, total: totalRevenue, total_cost: totalCost, profit,
        occurred_at: new Date(settleGroup.date + "T12:00:00").toISOString(),
      }).select("id").single();
      if (txErr || !tx) return toast.error(txErr?.message || "Error");

      // 2) crear sales por línea
      const salesRows = soldLines.map((x) => ({
        user_id: user.id, transaction_id: tx.id, machine_id: x.row.machine_id, product_id: x.row.product_id,
        quantity: x.soldQty, unit_price: Number(x.row.unit_price || 0),
        unit_cost: Number(x.row.products?.unit_cost || 0),
        total: x.soldQty * Number(x.row.unit_price || 0),
        source: "vending", sold_at: new Date(settleGroup.date + "T12:00:00").toISOString(),
      }));
      const { error: sErr } = await supabase.from("sales").insert(salesRows);
      if (sErr) return toast.error(sErr.message);

      // 3) cerrar solo lo vendido; lo no vendido queda como deuda pendiente en la máquina
      for (const x of effectiveLines) {
        const originalQty = Number(x.row.quantity || 0);
        if (x.soldQty <= 0) continue;
        if (x.soldQty >= originalQty) {
          await supabase.from("vending_consumptions").update({ status: "settled" }).eq("id", x.row.id);
        } else {
          const remaining = originalQty - x.soldQty;
          await supabase.from("vending_consumptions").update({
            quantity: remaining,
            total: remaining * Number(x.row.unit_price || 0),
          }).eq("id", x.row.id);
        }
      }

      // 4) descontar del stock visual de la máquina únicamente lo vendido
      const { data: machineFresh } = await supabase.from("machines").select("layout").eq("id", settleGroup.machine.id).single();
      const soldBySlot = soldLines.reduce((map, x) => {
        const code = String(x.row.slot_code || "");
        map.set(code, (map.get(code) || 0) + x.soldQty);
        return map;
      }, new Map<string, number>());
      const layout = (machineFresh as any)?.layout;
      if (layout?.trays && soldBySlot.size > 0) {
        const updatedLayout = {
          ...layout,
          trays: layout.trays.map((tray: any) => ({
            ...tray,
            springs: (tray.springs || []).map((spring: any) => {
              const sold = soldBySlot.get(String(spring.label || "")) || 0;
              return sold ? { ...spring, current_qty: Math.max(0, Number(spring.current_qty || 0) - sold) } : spring;
            }),
          })),
        };
        await supabase.from("machines").update({ layout: updatedLayout as any }).eq("id", settleGroup.machine.id);
      }

      // 5) opcionalmente sumar al monedero
      if (settleAddCoin) {
        const { data: mach } = await supabase.from("machines").select("coin_current").eq("id", settleGroup.machine.id).single();
        await supabase.from("machines").update({ coin_current: Number((mach as any)?.coin_current || 0) + totalRevenue }).eq("id", settleGroup.machine.id);
      }

      toast.success(`Liquidado ${fmtMoney(totalRevenue)} · lo pendiente queda en deuda`);
      setSettleGroup(null);
      loadData();
    } finally { setBusy(false); }
  };


  const cancelDebt = async (d: any) => {
    if (!confirm("¿Anular este consumo?")) return;
    setDebtBusy(d.id);
    try {
      await supabase.from("vending_consumptions").update({ status: "cancelled" }).eq("id", d.id);
      toast.success("Consumo anulado");
      loadData();
    } finally { setDebtBusy(null); }
  };

  const sales = useMemo(() => txs.filter((t) => t.kind === "sale"), [txs]);
  const expenses = useMemo(() => txs.filter((t) => t.kind === "expense"), [txs]);

  const totals = useMemo(() => {
    const ingresos = sales.reduce((a, r) => a + Number(r.total || 0), 0);
    const gastos = expenses.reduce((a, r) => a + Number(r.total || 0), 0);
    const ganancia = sales.reduce((a, r) => a + Number(r.profit || 0), 0);
    return { ingresos, gastos, balance: ingresos - gastos, ganancia };
  }, [sales, expenses]);

  const periodLabel = useMemo(() => {
    if (period === "day") return isToday(dayAnchor) ? "Hoy" : format(dayAnchor, "dd 'de' MMMM", { locale: es });
    if (period === "week") {
      const s = startOfWeek(weekAnchor, { weekStartsOn: 1 });
      const e = endOfWeek(weekAnchor, { weekStartsOn: 1 });
      return `${format(s, "dd MMM", { locale: es })} – ${format(e, "dd MMM", { locale: es })}`;
    }
    if (period === "month") return format(monthAnchor, "MMMM yyyy", { locale: es });
    if (period === "year") return format(yearAnchor, "yyyy");
    if (customRange.from && customRange.to) return `${format(customRange.from, "dd MMM", { locale: es })} – ${format(customRange.to, "dd MMM", { locale: es })}`;
    return "Personalizado";
  }, [period, customRange, dayAnchor, weekAnchor, monthAnchor, yearAnchor]);

  const openSale = () => {
    setStep("choose");
    setFree({ concept: "", customer: "", customer_company: "", payment_method: "Efectivo", employee_id: "", amount: "" });
    setSaleDialog(true);
  };

  const saveFree = async () => {
    const concept = free.concept.trim();
    const amount = parseFloat(free.amount);
    if (!concept) return toast.error("Ingresa un concepto");
    if (!amount || amount <= 0) return toast.error("Ingresa un monto válido");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employee = employees.find((e) => e.id === free.employee_id);
      const { data: tx, error: txErr } = await (supabase as any).from("transactions").insert({
        user_id: user.id, kind: "sale", concept, customer: free.customer.trim() || null,
        customer_company: free.customer_company.trim() || null,
        payment_method: free.payment_method, employee_id: free.employee_id || null,
        employee_name: employee?.name || null, subtotal: amount, total: amount, total_cost: 0, profit: amount,
      }).select("id").single();
      if (txErr || !tx) { toast.error(txErr?.message || "Error"); return; }
      const { error } = await supabase.from("sales").insert({
        user_id: user.id, transaction_id: tx.id, concept, quantity: 1,
        unit_price: amount, unit_cost: 0, total: amount, source: "free",
      } as any);
      if (error) return toast.error(error.message);
      toast.success("Venta libre registrada");
      setSaleDialog(false);
      loadData();
    } finally { setSaving(false); }
  };

  // ===== Open receipt =====
  const openReceipt = async (tx: Tx) => {
    setActiveTx(tx);
    setEditing(false);
    setEditForm({
      concept: tx.concept || "", customer: tx.customer || "",
      payment_method: tx.payment_method || "Efectivo", employee_id: tx.employee_id || "",
    });
    if (tx.kind === "sale") {
      const { data } = await (supabase as any).from("sales")
        .select("id, product_id, quantity, unit_price, unit_cost, total, concept, products(name)")
        .eq("transaction_id", tx.id);
      setItems((data || []).map((s: any) => ({
        id: s.id, product_id: s.product_id, quantity: s.quantity,
        unit: Number(s.unit_price), cost: Number(s.unit_cost), total: Number(s.total),
        product_name: s.products?.name || s.concept || "Venta libre",
      })));
    } else {
      const { data } = await (supabase as any).from("purchases")
        .select("id, product_id, quantity, unit_cost, total, products(name)")
        .eq("transaction_id", tx.id);
      setItems((data || []).map((p: any) => ({
        id: p.id, product_id: p.product_id, quantity: p.quantity,
        unit: Number(p.unit_cost), cost: 0, total: Number(p.total),
        product_name: p.products?.name || "Compra",
      })));
    }
  };

  const saveEdit = async () => {
    if (!activeTx) return;
    setBusy(true);
    try {
      const employee = employees.find((e) => e.id === editForm.employee_id);
      const { error } = await (supabase as any).from("transactions").update({
        concept: editForm.concept.trim() || null,
        customer: editForm.customer.trim() || null,
        payment_method: editForm.payment_method || null,
        employee_id: editForm.employee_id || null,
        employee_name: employee?.name || null,
      }).eq("id", activeTx.id);
      if (error) return toast.error(error.message);
      toast.success("Comprobante actualizado");
      setEditing(false);
      loadData();
      openReceipt({ ...activeTx, ...editForm, employee_name: employee?.name || null } as any);
    } finally { setBusy(false); }
  };

  const deleteTx = async () => {
    if (!activeTx) return;
    if (!confirm(`¿Eliminar ${activeTx.kind === "sale" ? "venta" : "gasto"} #${activeTx.number}? Se devolverán los productos al inventario.`)) return;
    setBusy(true);
    try {
      // Reverse stock
      for (const it of items) {
        if (!it.product_id) continue;
        const { data: prod } = await supabase.from("products").select("stock_warehouse").eq("id", it.product_id).single();
        if (!prod) continue;
        const cur = Number((prod as any).stock_warehouse || 0);
        const newStock = activeTx.kind === "sale" ? cur + it.quantity : Math.max(0, cur - it.quantity);
        await supabase.from("products").update({ stock_warehouse: newStock }).eq("id", it.product_id);
      }
      // Delete line items
      if (activeTx.kind === "sale") {
        await supabase.from("sales").delete().eq("transaction_id", activeTx.id);
      } else {
        await supabase.from("purchases").delete().eq("transaction_id", activeTx.id);
      }
      await (supabase as any).from("transactions").delete().eq("id", activeTx.id);
      toast.success(activeTx.kind === "sale" ? "Venta eliminada · stock restaurado" : "Gasto eliminado · stock revertido");
      setActiveTx(null);
      loadData();
    } finally { setBusy(false); }
  };

  const printReceipt = async () => {
    if (!activeTx) return;
    const w = window.open("", "_blank", "width=380,height=700");
    if (!w) return;
    const tx = activeTx;
    const isSale = tx.kind === "sale";
    const dateStr = format(new Date(tx.occurred_at), "dd/MM/yyyy HH:mm");
    // Cargar empresa para encabezado
    const { data: { user } } = await supabase.auth.getUser();
    let company: any = null;
    if (user) {
      const { data } = await (supabase as any).from("company_profile").select("*").eq("user_id", user.id).maybeSingle();
      company = data;
    }
    const brandName = company?.business_name || "Kymez App";
    const escape = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
    const headerHtml = `
      <h2>${escape(brandName)}</h2>
      ${company?.legal_name ? `<div class="small">${escape(company.legal_name)}</div>` : ""}
      ${company?.doc_number ? `<div class="small">${escape(company.doc_type || "")} ${escape(company.doc_number)}</div>` : ""}
      ${company?.address ? `<div class="small">${escape(company.address)}</div>` : ""}
      ${company?.phone ? `<div class="small">Tel: ${escape(company.phone)}</div>` : ""}
    `;
    const rowsHtml = items.map((it) => `
      <div class="row"><span>${escape(it.product_name)}</span></div>
      <div class="row sub"><span>${it.quantity} × ${it.unit.toFixed(2)}</span><span>${it.total.toFixed(2)}</span></div>
    `).join("");
    w.document.write(`
      <html><head><title>Comprobante #${tx.number}</title>
      <style>
        body{font-family:ui-monospace,monospace;padding:14px;color:#000;width:300px}
        h2{text-align:center;margin:0 0 4px;font-size:14px}
        .small{text-align:center;font-size:11px;color:#555;margin-bottom:2px}
        hr{border:none;border-top:1px dashed #999;margin:6px 0}
        .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
        .row.sub{color:#555;font-size:11px;padding-left:6px}
        .total{font-size:15px;font-weight:bold;margin-top:6px}
        .meta{font-size:11px;margin:2px 0}
        .foot{text-align:center;font-size:10px;color:#666;margin-top:12px}
        .title{text-align:center;font-size:12px;font-weight:bold;margin:6px 0 2px}
      </style></head><body>
      ${headerHtml}
      <hr/>
      <div class="title">${isSale ? "COMPROBANTE DE VENTA" : "COMPROBANTE DE GASTO"}</div>
      <div class="small">N° ${String(tx.number).padStart(6, "0")} · ${dateStr}</div>
      <hr/>
      ${tx.concept ? `<div class="meta"><b>Concepto:</b> ${escape(tx.concept)}</div>` : ""}
      ${tx.customer ? `<div class="meta"><b>${isSale ? "Cliente" : "Proveedor"}:</b> ${escape(tx.customer)}</div>` : ""}
      ${(tx as any).customer_company ? `<div class="meta"><b>Empresa:</b> ${escape((tx as any).customer_company)}</div>` : ""}
      ${tx.payment_method ? `<div class="meta"><b>Pago:</b> ${escape(tx.payment_method)}</div>` : ""}
      ${tx.employee_name ? `<div class="meta"><b>Empleado:</b> ${escape(tx.employee_name)}</div>` : ""}
      <hr/>
      ${rowsHtml}
      <hr/>
      <div class="row"><span>Items</span><span>${items.length}</span></div>
      <div class="row"><span>Subtotal</span><span>${Number(tx.subtotal).toFixed(2)}</span></div>
      ${isSale ? `<div class="row"><span>Ganancia</span><span>${Number(tx.profit).toFixed(2)}</span></div>` : ""}
      <div class="row total"><span>TOTAL</span><span>${Number(tx.total).toFixed(2)}</span></div>
      <div class="foot">¡Gracias!<br/>${escape(brandName)}</div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>
    `);
    w.document.close();
  };

  const PeriodBtn = ({ k, label }: { k: Period; label: string }) => (
    <button onClick={() => setPeriod(k)}
      className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap",
        period === k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border")}>
      {label}
    </button>
  );

  const VerticalDate = ({ d }: { d: string }) => {
    const dt = new Date(d);
    return (
      <div className="flex flex-col items-center justify-center bg-muted rounded-lg px-2 py-1 min-w-[42px]">
        <span className="text-[10px] uppercase text-muted-foreground leading-none">{format(dt, "MMM", { locale: es })}</span>
        <span className="text-lg font-bold leading-none mt-0.5">{format(dt, "dd")}</span>
        <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{format(dt, "HH:mm")}</span>
      </div>
    );
  };

  const TxRow = ({ tx, kind }: { tx: Tx; kind: "sale" | "expense" }) => (
    <button onClick={() => openReceipt(tx)}
      className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition text-left">
      <VerticalDate d={tx.occurred_at} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          #{String(tx.number).padStart(4, "0")} · {tx.concept || (kind === "sale" ? (tx.customer || "Venta") : (tx.customer || "Compra"))}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {tx.payment_method || "—"} {tx.employee_name ? `· ${tx.employee_name}` : ""}
        </div>
      </div>
      <div className={cn("font-semibold text-sm", kind === "sale" ? "text-emerald-500" : "text-red-500")}>
        {fmtMoney(tx.total)}
      </div>
    </button>
  );

  return (
    <div className="container py-6">
      <PageHeader title="Movimientos" description="Balance, ventas y gastos" />

      {/* Balance */}
      <Card className="p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground">Balance · {periodLabel}</div>
            <div className={cn("text-2xl font-bold", totals.balance >= 0 ? "text-emerald-500" : "text-red-500")}>
              {fmtMoney(totals.balance)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Ganancia ventas: <span className="text-emerald-500 font-medium">{fmtMoney(totals.ganancia)}</span></div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end"><TrendingUp className="h-3 w-3 text-emerald-500" /> Ingresos</div>
              <div className="text-emerald-500 font-semibold">{fmtMoney(totals.ingresos)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end"><TrendingDown className="h-3 w-3 text-red-500" /> Gastos</div>
              <div className="text-red-500 font-semibold">{fmtMoney(totals.gastos)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          <PeriodBtn k="day" label="Diario" />
          <PeriodBtn k="week" label="Semanal" />
          <PeriodBtn k="month" label="Mensual" />
          <PeriodBtn k="year" label="Anual" />
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1 whitespace-nowrap",
                period === "custom" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border")}>
                <CalendarIcon className="h-3 w-3" /> Personalizado
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" selected={{ from: customRange.from, to: customRange.to }}
                onSelect={(r: any) => {
                  setCustomRange(r || {});
                  if (r?.from && r?.to) { setPeriod("custom"); setPopOpen(false); }
                }}
                className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Sub-iconos según periodo */}
      {period === "day" && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {dayStrip.map((d) => {
            const active = isSameDay(d, dayAnchor);
            const today = isToday(d);
            return (
              <button key={d.toISOString()} onClick={() => setDayAnchor(d)}
                className={cn("shrink-0 flex flex-col items-center justify-center rounded-xl border px-3 py-1.5 min-w-[54px] transition",
                  active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card hover:bg-muted border-border")}>
                <CalendarIcon className={cn("h-3 w-3 mb-0.5", active ? "opacity-90" : "opacity-50")} />
                <span className={cn("text-[10px] uppercase leading-none", active ? "opacity-90" : "text-muted-foreground")}>
                  {format(d, "EEE", { locale: es })}
                </span>
                <span className="text-sm font-bold leading-none mt-0.5">{format(d, "dd/MM")}</span>
                {today && !active && <span className="text-[9px] text-emerald-500 mt-0.5">hoy</span>}
              </button>
            );
          })}
        </div>
      )}

      {period === "week" && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {(() => {
            const weeks: Date[] = [];
            for (let i = 4; i >= -1; i--) {
              const d = new Date(weekAnchor);
              d.setDate(d.getDate() - i * 7);
              weeks.push(startOfWeek(d, { weekStartsOn: 1 }));
            }
            return weeks.map((ws) => {
              const we = endOfWeek(ws, { weekStartsOn: 1 });
              const active = isSameDay(ws, startOfWeek(weekAnchor, { weekStartsOn: 1 }));
              const isCurrent = isSameDay(ws, startOfWeek(new Date(), { weekStartsOn: 1 }));
              return (
                <button key={ws.toISOString()} onClick={() => setWeekAnchor(ws)}
                  className={cn("shrink-0 flex flex-col items-center justify-center rounded-xl border px-3 py-1.5 min-w-[120px] transition",
                    active ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isCurrent ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-muted border-border")}>
                  <span className={cn("text-[10px] uppercase leading-none", active ? "opacity-90" : "text-muted-foreground")}>Semana</span>
                  <span className="text-xs font-bold leading-tight mt-0.5 whitespace-nowrap">
                    {format(ws, "dd/MM")} – {format(we, "dd/MM")}
                  </span>
                  {isCurrent && !active && <span className="text-[9px] text-emerald-500 mt-0.5">actual</span>}
                </button>
              );
            });
          })()}
        </div>
      )}

      {period === "month" && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {Array.from({ length: 12 }, (_, i) => new Date(monthAnchor.getFullYear(), i, 1)).map((d) => {
            const active = d.getMonth() === monthAnchor.getMonth() && d.getFullYear() === monthAnchor.getFullYear();
            const isCurrent = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
            return (
              <button key={d.toISOString()} onClick={() => setMonthAnchor(d)}
                className={cn("shrink-0 flex flex-col items-center justify-center rounded-xl border px-3 py-1.5 min-w-[88px] transition",
                  active ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : isCurrent ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-muted border-border")}>
                <span className="text-sm font-bold leading-none capitalize">{format(d, "MMMM", { locale: es })}</span>
                <span className={cn("text-[10px] leading-none mt-0.5", active ? "opacity-90" : "text-muted-foreground")}>{d.getFullYear()}</span>
              </button>
            );
          })}
        </div>
      )}

      {period === "year" && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {(() => {
            const currentY = new Date().getFullYear();
            const years: number[] = [];
            for (let i = 5; i >= -1; i--) years.push(currentY - i);
            return years.map((y) => {
              const active = y === yearAnchor.getFullYear();
              const isCurrent = y === currentY;
              return (
                <button key={y} onClick={() => setYearAnchor(new Date(y, 0, 1))}
                  className={cn("shrink-0 flex flex-col items-center justify-center rounded-xl border px-4 py-2 min-w-[80px] transition",
                    active ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isCurrent ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-muted border-border")}>
                  <span className="text-lg font-bold leading-none">{y}</span>
                  {isCurrent && !active && <span className="text-[9px] text-emerald-500 mt-0.5">actual</span>}
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Acciones / filtros */}
      <div className="grid gap-2 grid-cols-3 mb-4">
        <Card
          onClick={() => setView(view === "sale" ? "all" : "sale")}
          className={cn(
            "relative p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer transition min-h-[110px]",
            view === "sale" ? "ring-2 ring-emerald-500 bg-emerald-500/5" : "hover:bg-muted/40",
          )}
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="font-semibold text-sm leading-tight">Ventas</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{sales.length} · {fmtMoney(totals.ingresos)}</div>
          <Button
            size="icon"
            className="absolute top-1.5 right-1.5 h-6 w-6 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={(e) => { e.stopPropagation(); openSale(); }}
            title="Nueva venta"
          >
            +
          </Button>
        </Card>

        <Card
          onClick={() => setView(view === "expense" ? "all" : "expense")}
          className={cn(
            "relative p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer transition min-h-[110px]",
            view === "expense" ? "ring-2 ring-red-500 bg-red-500/5" : "hover:bg-muted/40",
          )}
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/15 ring-1 ring-red-500/40">
            <ShoppingCart className="h-5 w-5 text-red-500" />
          </div>
          <div className="font-semibold text-sm leading-tight">Gastos</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{expenses.length} · {fmtMoney(totals.gastos)}</div>
          <Button
            size="icon"
            className="absolute top-1.5 right-1.5 h-6 w-6 bg-red-500 hover:bg-red-600 text-white"
            onClick={(e) => { e.stopPropagation(); navigate("/app/products?action=expense"); }}
            title="Nuevo gasto"
          >
            +
          </Button>
        </Card>

        <Card
          onClick={() => setView(view === "debt" ? "all" : "debt")}
          className={cn(
            "relative p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer transition min-h-[110px]",
            view === "debt" ? "ring-2 ring-amber-500 bg-amber-500/5" : "hover:bg-muted/40",
          )}
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500/15 ring-1 ring-amber-500/40">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="font-semibold text-sm leading-tight">Deuda</div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            {debts.length} · {fmtMoney(debts.reduce((a, d) => a + Number(d.total || 0), 0))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1.5 right-1.5 h-6 w-6 text-amber-600 hover:bg-amber-500/10"
            onClick={(e) => { e.stopPropagation(); navigate("/app/movements/history"); }}
            title="Ver historial completo"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </Card>
      </div>

      {/* Deuda · agrupada por máquina + día */}
      {(view === "all" || view === "debt") && debts.length > 0 && (
        <Card className="p-3 mb-3 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Deuda · pendientes vending (por máquina y día)
            </h3>
            <span className="text-xs text-amber-600 font-semibold">
              {debts.length} · {fmtMoney(debts.reduce((a, d) => a + Number(d.total || 0), 0))}
            </span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {(() => {
              // Agrupar por máquina y dentro los días pendientes
              const machineGroups = new Map<string, { machine: any; days: Map<string, { machine: any; date: string; rows: any[]; total: number; units: number }>; total: number; units: number }>();
              for (const d of debts) {
                const day = format(new Date(d.consumed_at), "yyyy-MM-dd");
                const key = d.machine_id || "machine";
                if (!machineGroups.has(key)) {
                  machineGroups.set(key, { machine: d.machines || { id: d.machine_id, name: "Máquina" }, days: new Map(), total: 0, units: 0 });
                }
                const mg = machineGroups.get(key)!;
                if (!mg.days.has(day)) mg.days.set(day, { machine: mg.machine, date: day, rows: [], total: 0, units: 0 });
                const g = mg.days.get(day)!;
                g.rows.push(d);
                g.total += Number(d.total || 0);
                g.units += Number(d.quantity || 0);
                mg.total += Number(d.total || 0);
                mg.units += Number(d.quantity || 0);
              }
              const arr = Array.from(machineGroups.values()).sort((a, b) => (a.machine?.name || "").localeCompare(b.machine?.name || ""));
              return arr.map((mg) => (
                <div key={mg.machine.id || mg.machine.name} className="rounded-lg border bg-background overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-amber-500/10 border-b">
                    <Coffee className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{mg.machine?.name || "Máquina"}</div>
                      <div className="text-[11px] text-muted-foreground">{mg.days.size} día(s) · {mg.units} unidades pendientes</div>
                    </div>
                    <div className="font-bold text-sm text-amber-600">{fmtMoney(mg.total)}</div>
                  </div>
                  <div className="divide-y">
                    {Array.from(mg.days.values()).sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
                      <div key={`${mg.machine.id || mg.machine.name}__${g.date}`} className="flex items-center gap-2 p-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{format(new Date(g.date + "T00:00:00"), "dd/MM/yyyy")}</div>
                          <div className="text-[11px] text-muted-foreground">{g.rows.length} registros · {g.units} unidades pendientes</div>
                        </div>
                        <div className="font-bold text-sm text-amber-600">{fmtMoney(g.total)}</div>
                        <Button size="sm" className="h-7 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => {
                            setSettleGroup(g);
                            const init: Record<string, string> = {};
                            g.rows.forEach((r: any) => { init[r.id] = String(r.quantity); });
                            setSettleQty(init);
                            setSettleAddCoin(false);
                          }}
                          title="Liquidar venta del día (manual)">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Liquidar día
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </Card>
      )}
      {view === "debt" && debts.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground mb-3">Sin deudas pendientes</Card>
      )}

      {/* Listas — filtradas por 'view' */}
      <div className={cn("grid gap-3", view === "all" ? "md:grid-cols-2" : "grid-cols-1")}>
        {(view === "all" || view === "sale") && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-500" /> Ventas</h3>
              <span className="text-xs text-muted-foreground">{sales.length}</span>
            </div>
            <div className={cn("space-y-2 overflow-y-auto", view === "sale" ? "max-h-[60vh]" : "max-h-[420px]")}>
              {sales.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sin ventas en el período</div>}
              {sales.map((t) => <TxRow key={t.id} tx={t} kind="sale" />)}
            </div>
          </Card>
        )}
        {(view === "all" || view === "expense") && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-red-500" /> Gastos</h3>
              <span className="text-xs text-muted-foreground">{expenses.length}</span>
            </div>
            <div className={cn("space-y-2 overflow-y-auto", view === "expense" ? "max-h-[60vh]" : "max-h-[420px]")}>
              {expenses.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sin gastos en el período</div>}
              {expenses.map((t) => <TxRow key={t.id} tx={t} kind="expense" />)}
            </div>
          </Card>
        )}
      </div>

      {/* Diálogo Nueva venta */}
      <Dialog open={saleDialog} onOpenChange={setSaleDialog}>
        <DialogContent>
          {step === "choose" ? (
            <>
              <DialogHeader>
                <DialogTitle>Nueva venta</DialogTitle>
                <DialogDescription>Elige el tipo de venta a registrar</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3 pt-2">
                <button onClick={() => { setSaleDialog(false); navigate("/app/products?action=sale"); }}
                  className="rounded-xl border bg-card p-5 text-left hover:border-emerald-500 hover:shadow-md transition">
                  <Package className="h-7 w-7 text-emerald-500 mb-2" />
                  <div className="font-semibold">Venta de productos</div>
                  <div className="text-xs text-muted-foreground mt-1">Selecciona del catálogo</div>
                </button>
                <button onClick={() => { setSaleDialog(false); setVendingOpen(true); }}
                  className="rounded-xl border bg-card p-5 text-left hover:border-amber-500 hover:shadow-md transition">
                  <Coffee className="h-7 w-7 text-amber-500 mb-2" />
                  <div className="font-semibold">Vending machine</div>
                  <div className="text-xs text-muted-foreground mt-1">Recargar productos en máquina</div>
                </button>
                <button onClick={() => setStep("free")}
                  className="rounded-xl border bg-card p-5 text-left hover:border-emerald-500 hover:shadow-md transition">
                  <Receipt className="h-7 w-7 text-emerald-500 mb-2" />
                  <div className="font-semibold">Venta libre</div>
                  <div className="text-xs text-muted-foreground mt-1">Concepto y monto</div>
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStep("choose")}><ArrowLeft className="h-4 w-4" /></Button>
                  <DialogTitle>Venta libre</DialogTitle>
                </div>
                <DialogDescription>Registra una venta sin producto del catálogo</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Concepto</Label><Input value={free.concept} onChange={(e) => setFree({ ...free, concept: e.target.value })} placeholder="Ej: Servicio, propina" autoFocus /></div>
                <div><Label>Cliente</Label><Input value={free.customer} onChange={(e) => setFree({ ...free, customer: e.target.value })} placeholder="Opcional" /></div>
                <div><Label>Empresa / Tienda del cliente</Label><Input value={free.customer_company} onChange={(e) => setFree({ ...free, customer_company: e.target.value })} placeholder="Aparecerá en el comprobante (opcional)" /></div>
                <div>
                  <Label>Método de pago</Label>
                  <Select value={free.payment_method} onValueChange={(v) => setFree({ ...free, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Empleado</Label>
                  {employees.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-2 rounded border">
                      Sin empleados. <button className="text-primary underline" onClick={() => { setSaleDialog(false); navigate("/app/employees"); }}>Crear uno</button>
                    </div>
                  ) : (
                    <Select value={free.employee_id} onValueChange={(v) => setFree({ ...free, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div><Label>Monto (S/)</Label><Input type="number" step="0.01" value={free.amount} onChange={(e) => setFree({ ...free, amount: e.target.value })} placeholder="0.00" /></div>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={saveFree} disabled={saving}>
                  {saving ? "Guardando…" : "Registrar venta libre"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Comprobante */}
      <Dialog open={!!activeTx} onOpenChange={(o) => !o && setActiveTx(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {activeTx && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {activeTx.kind === "sale" ? "Venta" : "Gasto"} #{String(activeTx.number).padStart(6, "0")}
                    </DialogTitle>
                    <DialogDescription>{format(new Date(activeTx.occurred_at), "dd 'de' MMMM yyyy · HH:mm", { locale: es })}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {!editing ? (
                <div className="space-y-1 text-sm border-y py-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Concepto</span><span className="font-medium">{activeTx.concept || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{activeTx.kind === "sale" ? "Cliente" : "Proveedor"}</span><span>{activeTx.customer || "—"}</span></div>
                  {(activeTx as any).customer_company && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span>{(activeTx as any).customer_company}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Método de pago</span><span>{activeTx.payment_method || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Empleado</span><span>{activeTx.employee_name || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{items.length}</span></div>
                  {activeTx.kind === "sale" && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ganancia</span><span className="text-emerald-500 font-medium">{fmtMoney(activeTx.profit)}</span></div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 border-y py-3">
                  <div><Label>Concepto</Label><Input value={editForm.concept} onChange={(e) => setEditForm({ ...editForm, concept: e.target.value })} /></div>
                  <div><Label>{activeTx.kind === "sale" ? "Cliente" : "Proveedor"}</Label><Input value={editForm.customer} onChange={(e) => setEditForm({ ...editForm, customer: e.target.value })} /></div>
                  <div>
                    <Label>Método de pago</Label>
                    <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Empleado</Label>
                    <Select value={editForm.employee_id} onValueChange={(v) => setEditForm({ ...editForm, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground font-semibold uppercase">Productos</div>
                {items.length === 0 && <div className="text-xs text-muted-foreground italic">Sin items</div>}
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 text-sm border-b last:border-0 pb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{it.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">{it.quantity} × {fmtMoney(it.unit)}</div>
                    </div>
                    <div className="font-semibold">{fmtMoney(it.total)}</div>
                  </div>
                ))}
              </div>

              <div className={cn("flex justify-between text-lg font-bold pt-2 border-t",
                activeTx.kind === "sale" ? "text-emerald-500" : "text-red-500")}>
                <span>TOTAL</span><span>{fmtMoney(activeTx.total)}</span>
              </div>

              <DialogFooter className="!justify-between gap-2 flex-wrap">
                {!editing ? (
                  <>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={deleteTx} disabled={busy}>
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                      </Button>
                    </div>
                    <Button size="sm" onClick={printReceipt}>
                      <Printer className="h-4 w-4 mr-1" /> Imprimir
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4 mr-1" />Cancelar
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={busy}>
                      {busy ? "Guardando…" : "Guardar cambios"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <VendingRestockDialog open={vendingOpen} onOpenChange={setVendingOpen} onDone={loadData} />

      {/* Diálogo: Liquidar venta diaria por máquina (manual) */}
      <Dialog open={!!settleGroup} onOpenChange={(o) => !o && setSettleGroup(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          {settleGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Liquidar venta del día
                </DialogTitle>
                <DialogDescription>
                  {settleGroup.machine?.name} · {format(new Date(settleGroup.date + "T00:00:00"), "dd 'de' MMMM yyyy", { locale: es })}
                </DialogDescription>
              </DialogHeader>

              <div className="text-[11px] text-muted-foreground bg-muted/50 border rounded p-2">
                Indica cuántas unidades se vendieron realmente en cada slot (lo que el operador verificó al visitar la máquina). Las que no se vendieron permanecerán en la máquina.
              </div>

              <div className="space-y-1.5 border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
                {settleGroup.rows.map((r: any) => {
                  const cargado = Number(r.quantity);
                  const vendido = Number(settleQty[r.id] ?? r.quantity) || 0;
                  const ingreso = vendido * Number(r.unit_price || 0);
                  return (
                    <div key={r.id} className="p-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          <span className="font-mono text-xs text-muted-foreground mr-1">{r.slot_code}</span>
                          {r.products?.name || "Producto"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Cargado: {cargado} · {fmtMoney(r.unit_price)} c/u
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={cargado}
                          value={settleQty[r.id] ?? ""}
                          onChange={(e) => setSettleQty((p) => ({ ...p, [r.id]: e.target.value }))}
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-[10px] text-muted-foreground">/{cargado}</span>
                      </div>
                      <div className="w-20 text-right text-sm font-semibold">{fmtMoney(ingreso)}</div>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const totalRev = settleGroup.rows.reduce((a: number, r: any) => {
                  const v = Math.min(Number(settleQty[r.id] ?? r.quantity) || 0, Number(r.quantity));
                  return a + v * Number(r.unit_price || 0);
                }, 0);
                const totalCost = settleGroup.rows.reduce((a: number, r: any) => {
                  const v = Math.min(Number(settleQty[r.id] ?? r.quantity) || 0, Number(r.quantity));
                  return a + v * Number(r.products?.unit_cost || 0);
                }, 0);
                return (
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground uppercase">Ingresos</div><div className="font-bold text-emerald-500">{fmtMoney(totalRev)}</div></div>
                    <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground uppercase">Costo</div><div className="font-bold">{fmtMoney(totalCost)}</div></div>
                    <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground uppercase">Ganancia</div><div className="font-bold text-emerald-500">{fmtMoney(totalRev - totalCost)}</div></div>
                  </div>
                );
              })()}

              <label className="flex items-center gap-2 text-xs cursor-pointer select-none p-2 rounded border hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={settleAddCoin}
                  onChange={(e) => setSettleAddCoin(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Sumar este ingreso al monedero (caja) de la máquina</span>
              </label>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSettleGroup(null)} disabled={busy}>Cancelar</Button>
                <Button onClick={saveSettleGroup} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  {busy ? "Liquidando…" : "Confirmar venta del día"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Movements;
