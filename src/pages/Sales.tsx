import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { Plus, Wallet, Boxes, Pencil, CheckCircle2, Trash2, Coffee, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Spring = { id: string; label: string; capacity: number; product_id: string | null; sale_price: number; current_qty: number };
type Tray = { id: string; label: string; springs: Spring[] };
type Layout = { trays: Tray[] };
type Machine = { id: string; name: string; code: string; coin_current: number; layout: Layout | null };

const normalize = (l: any): Layout => {
  if (!l || !Array.isArray(l.trays)) return { trays: [] };
  return {
    trays: l.trays.map((t: any) => ({
      id: t.id, label: t.label || "Bandeja",
      springs: (t.springs || []).map((s: any) => ({
        id: s.id, label: s.label || "R", capacity: Number(s.capacity) || 10,
        product_id: s.product_id ?? null, sale_price: Number(s.sale_price) || 0,
        current_qty: Number(s.current_qty) || 0,
      })),
    })),
  };
};

const Sales = () => {
  const [list, setList] = useState<any[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  
  // dialogs
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [vendingOpen, setVendingOpen] = useState(false);
  const [form, setForm] = useState({ machine_id: "", product_id: "", quantity: "1", unit_price: "" });
  
  // vending flow
  const [vMachine, setVMachine] = useState<Machine | null>(null);
  const [vSlot, setVSlot] = useState<{ tray: Tray; spring: Spring } | null>(null);
  const [vForm, setVForm] = useState({ quantity: "1", unit_price: "", customer_id: "", customer_name: "", notes: "" });

const load = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const fetchUrl = apiUrl.endsWith('/api') 
        ? `${apiUrl}/ventas/historial` 
        : `${apiUrl}/api/ventas/historial`;

      console.log("1. Frontend buscando ventas en:", fetchUrl);

      const res = await fetch(fetchUrl);
      const hwData = await res.json();
      
      console.log("2. Respuesta cruda del servidor:", hwData);

      // ¡Aquí está el filtro de seguridad!
      // Si recibes un objeto que tiene "today" o "profit" (Dashboard), 
      // lo ignoramos porque no es una lista de ventas.
      if (hwData && hwData.ventas && Array.isArray(hwData.ventas)) {
        const hwSales = hwData.ventas.map((v: any) => ({
          id: `hw-${v.id}`,
          sold_at: v.fecha,
          machines: { name: v.machine_id }, 
          products: { name: v.nombre_producto },
          quantity: 1,
          unit_price: Number(v.precio),
          total: Number(v.precio),
          source: "Yape/IoT",
          customer_name: v.nombre_cliente 
        }));
        
        hwSales.sort((a: any, b: any) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());
        setList(hwSales);
      } else {
        console.warn("⚠️ El servidor respondió pero no es la lista de ventas. Revisa salesController.js");
        setList([]);
      }
    } catch (err) {
      console.error("3. Error en el puente:", err);
    }
  };



  // ¡IMPORTANTE! 
  // Borra o comenta el useEffect de Supabase Realtime que tenías aquí abajo.
  // Ese código que decía `supabase.channel("sales-vc")` es el culpable 
  // de los errores de WebSocket en tu consola.



  
  // ===== Manual sale =====
  const saveManual = async () => {
    if (!form.machine_id || !form.product_id || !form.unit_price) return toast.error("Completa los campos");
    const qty = parseInt(form.quantity) || 1;
    const price = parseFloat(form.unit_price);
    const prod = products.find((p) => p.id === form.product_id);
    const cost = prod?.unit_cost || 0;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("sales").insert({
      user_id: user.id, machine_id: form.machine_id, product_id: form.product_id,
      quantity: qty, unit_price: price, unit_cost: cost, total: qty * price, source: "manual",
    });
    if (error) return toast.error(error.message);

    const { data: mach } = await supabase.from("machines").select("coin_current").eq("id", form.machine_id).single();
    await supabase.from("machines").update({ coin_current: Number(mach?.coin_current || 0) + qty * price }).eq("id", form.machine_id);

    toast.success("Venta registrada");
    setManualOpen(false);
    setForm({ machine_id: "", product_id: "", quantity: "1", unit_price: "" });
    load();
  };

  // ===== Vending consumption flow =====
  const openVending = () => {
    setPickerOpen(false);
    setVMachine(null); setVSlot(null);
    setVendingOpen(true);
  };

  const pickSlot = (tray: Tray, spring: Spring) => {
    setVSlot({ tray, spring });
    setVForm({
      quantity: "1",
      unit_price: String(spring.sale_price || products.find((p) => p.id === spring.product_id)?.sale_price || ""),
      customer_id: "", customer_name: "", notes: "",
    });
  };

  const saveConsumption = async () => {
    if (!vMachine || !vSlot) return;
    const qty = parseInt(vForm.quantity) || 1;
    const price = parseFloat(vForm.unit_price) || 0;
    if (price <= 0) return toast.error("Indica un precio");
    if (!vSlot.spring.product_id) return toast.error("Este resorte no tiene producto asignado");
    if (qty > vSlot.spring.current_qty) return toast.error(`Solo hay ${vSlot.spring.current_qty} unid. cargadas`);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const customer = customers.find((c) => c.id === vForm.customer_id);
    const { error } = await supabase.from("vending_consumptions").insert({
      user_id: user.id,
      machine_id: vMachine.id,
      slot_code: vSlot.spring.label,
      product_id: vSlot.spring.product_id,
      quantity: qty,
      unit_price: price,
      total: qty * price,
      status: "pending",
      customer_id: customer?.id || null,
      customer_name: customer?.name || vForm.customer_name || null,
      notes: vForm.notes || null,
    });
    if (error) return toast.error(error.message);

    // Reduce stock in machine layout (consumption decreases current_qty)
    const lay = normalize(vMachine.layout);
    const newLayout = {
      trays: lay.trays.map((t) => t.id !== vSlot.tray.id ? t : ({
        ...t,
        springs: t.springs.map((s) => s.id !== vSlot.spring.id ? s : ({ ...s, current_qty: Math.max(0, s.current_qty - qty) })),
      })),
    };
    await supabase.from("machines").update({ layout: newLayout as any }).eq("id", vMachine.id);

    toast.success("Consumo registrado en deuda");
    setVSlot(null);
    // refresh selected machine layout
    const { data: m } = await supabase.from("machines").select("id, name, code, coin_current, layout").eq("id", vMachine.id).single();
    if (m) setVMachine(m as any);
    load();
  };

  // ===== Convert debt → sale =====
  const settleDebt = async (d: any) => {
    if (!confirm(`Convertir consumo de ${fmtMoney(d.total)} en venta efectiva?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cost = d.products?.unit_cost || 0;

    const { data: sale, error } = await supabase.from("sales").insert({
      user_id: user.id, machine_id: d.machine_id, product_id: d.product_id,
      quantity: d.quantity, unit_price: d.unit_price, unit_cost: cost,
      total: d.total, source: "vending",
    }).select("id").single();
    if (error) return toast.error(error.message);

    await supabase.from("vending_consumptions").update({
      status: "settled", sale_id: sale.id,
    }).eq("id", d.id);

    const { data: mach } = await supabase.from("machines").select("coin_current").eq("id", d.machine_id).single();
    await supabase.from("machines").update({ coin_current: Number(mach?.coin_current || 0) + Number(d.total) }).eq("id", d.machine_id);

    toast.success("Venta efectiva registrada");
    load();
  };

  const cancelDebt = async (d: any) => {
    if (!confirm("¿Anular este consumo? Se devolverá el stock al slot.")) return;
    // restore stock
    const { data: m } = await supabase.from("machines").select("layout").eq("id", d.machine_id).single();
    if (m) {
      const lay = normalize((m as any).layout);
      const newLayout = {
        trays: lay.trays.map((t) => ({
          ...t,
          springs: t.springs.map((s) => s.label === d.slot_code && s.product_id === d.product_id
            ? { ...s, current_qty: Math.min(s.capacity, s.current_qty + d.quantity) }
            : s),
        })),
      };
      await supabase.from("machines").update({ layout: newLayout as any }).eq("id", d.machine_id);
    }
    await supabase.from("vending_consumptions").update({ status: "cancelled" }).eq("id", d.id);
    toast.success("Consumo anulado");
    load();
  };

  const totalDebt = useMemo(() => debts.reduce((a, d) => a + Number(d.total || 0), 0), [debts]);
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name || "";

  return (
    <div className="container py-8">
      <PageHeader title="Ventas" description="Registro manual, consumos vending y deuda" actions={
        <Button variant="hero" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva venta</Button>
      } />

      <Card className="mb-6">
        {list.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Sin ventas todavía</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Máquina</TableHead><TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Fuente</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.sold_at), "dd/MM HH:mm")}</TableCell>
                  <TableCell>{r.machines?.name}</TableCell>
                  <TableCell className="font-medium">{r.products?.name || "—"}</TableCell>
                  <TableCell className="text-right">{fmtNumber(r.quantity)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.unit_price)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(r.total)}</TableCell>
                  <TableCell><Badge variant={r.source === "iot" ? "default" : r.source === "vending" ? "outline" : "secondary"}>{r.source}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Deuda - Consumos pendientes */}
      <Card>
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Coffee className="h-5 w-5 text-accent" /> Deuda · consumos pendientes
            </h3>
            <p className="text-xs text-muted-foreground">Lo que los clientes han consumido en máquina y aún no se cobra</p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">{debts.length} pend. · {fmtMoney(totalDebt)}</Badge>
        </div>
        {debts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sin consumos pendientes</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Hora</TableHead><TableHead>Máquina</TableHead><TableHead>Slot</TableHead>
              <TableHead>Producto</TableHead><TableHead>Cliente</TableHead>
              <TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {debts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(d.consumed_at), "dd/MM HH:mm")}</TableCell>
                  <TableCell>{d.machines?.name}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{d.slot_code}</Badge></TableCell>
                  <TableCell>{d.products?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{d.customer_name || "—"}</TableCell>
                  <TableCell className="text-right">{d.quantity}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(d.total)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="hero" onClick={() => settleDebt(d)} className="mr-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Cobrar
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => cancelDebt(d)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* PICKER: tipo de venta */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>¿Qué tipo de venta?</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setPickerOpen(false); setManualOpen(true); }}
              className="p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition flex flex-col items-center gap-2"
            >
              <Pencil className="h-8 w-8 text-primary" />
              <span className="font-semibold">Venta manual</span>
              <span className="text-[11px] text-muted-foreground text-center">Registro directo de cualquier producto</span>
            </button>
            <button
              onClick={openVending}
              className="p-5 rounded-xl border-2 border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10 transition flex flex-col items-center gap-2"
            >
              <Boxes className="h-8 w-8 text-accent" />
              <span className="font-semibold">Vending</span>
              <span className="text-[11px] text-muted-foreground text-center">Tocar el slot consumido en la máquina</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MANUAL */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva venta manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Máquina</Label>
              <Select value={form.machine_id} onValueChange={(v) => setForm({ ...form, machine_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><Label>Precio venta</Label><Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
            </div>
            <Button variant="hero" className="w-full" onClick={saveManual}>Registrar venta</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VENDING */}
      <Dialog open={vendingOpen} onOpenChange={(o) => { setVendingOpen(o); if (!o) { setVMachine(null); setVSlot(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {vMachine && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setVMachine(null); setVSlot(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {vMachine ? `${vMachine.name}` : "Elige una máquina"}
              {vMachine && <Badge variant="secondary" className="text-xs">{vMachine.code}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {!vMachine && (
            <div className="grid sm:grid-cols-2 gap-3">
              {machines.length === 0 && <p className="text-sm text-muted-foreground">No hay máquinas registradas.</p>}
              {machines.map((m) => {
                const lay = normalize(m.layout);
                const slots = lay.trays.reduce((a, t) => a + t.springs.length, 0);
                const loaded = lay.trays.reduce((a, t) => a + t.springs.reduce((b, s) => b + s.current_qty, 0), 0);
                return (
                  <button key={m.id} onClick={() => setVMachine(m)}
                    className="p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition text-left">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">{m.code}</Badge>
                      <Boxes className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">{m.name}</h4>
                    <p className="text-xs text-muted-foreground">{lay.trays.length} bandejas · {slots} resortes · {loaded} unid. cargadas</p>
                  </button>
                );
              })}
            </div>
          )}

          {vMachine && !vSlot && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Toca el resorte que el cliente consumió:</p>
              {normalize(vMachine.layout).trays.map((tray) => (
                <Card key={tray.id} className="p-3 bg-muted/30">
                  <h4 className="font-semibold text-sm mb-2">{tray.label}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tray.springs.map((s, si) => {
                      const slotCode = s.label || `R${si + 1}`;
                      const fillPct = s.capacity > 0 ? Math.min(100, (s.current_qty / s.capacity) * 100) : 0;
                      const isFull = s.current_qty >= s.capacity && s.capacity > 0;
                      const isLow = s.product_id && s.current_qty <= Math.max(1, Math.floor(s.capacity * 0.2));
                      const disabled = !s.product_id || s.current_qty <= 0;
                      return (
                        <button key={s.id} disabled={disabled}
                          onClick={() => pickSlot(tray, s)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-lg bg-background border w-[68px] transition",
                            disabled ? "opacity-50 cursor-not-allowed border-dashed" :
                            "border-primary/40 hover:border-primary hover:ring-2 hover:ring-primary/30",
                          )}
                          title={s.product_id ? productName(s.product_id) : `${slotCode} sin producto`}
                        >
                          <div className="text-[10px] text-primary font-mono font-bold">{slotCode}</div>
                          <div className="h-10 w-8 rounded border-2 border-dashed border-primary/40 bg-primary/5 flex items-end justify-center p-0.5 overflow-hidden">
                            <div className={cn("w-full rounded-sm",
                              s.product_id ? (isFull ? "bg-emerald-500" : isLow ? "bg-red-500" : "bg-primary") : "bg-muted-foreground/20")}
                              style={{ height: `${fillPct}%` }} />
                          </div>
                          <div className="text-[10px] font-semibold leading-none">
                            {s.product_id ? `${s.current_qty}/${s.capacity}` : `cap ${s.capacity}`}
                          </div>
                          {s.product_id && (
                            <div className="text-[9px] text-primary leading-none truncate w-full text-center">
                              {productName(s.product_id).slice(0, 8)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {vMachine && vSlot && (
            <Card className="p-4 border-primary/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-mono">{vSlot.spring.label}</Badge>
                  <span className="font-semibold">{productName(vSlot.spring.product_id)}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setVSlot(null)}>Cambiar slot</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Disponible: <b>{vSlot.spring.current_qty}</b> / {vSlot.spring.capacity}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cantidad</Label>
                  <Input type="number" min={1} max={vSlot.spring.current_qty}
                    value={vForm.quantity} onChange={(e) => setVForm({ ...vForm, quantity: e.target.value })} />
                </div>
                <div>
                  <Label>Precio unitario</Label>
                  <Input type="number" value={vForm.unit_price}
                    onChange={(e) => setVForm({ ...vForm, unit_price: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Cliente (opcional)</Label>
                  <Select value={vForm.customer_id} onValueChange={(v) => setVForm({ ...vForm, customer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Notas</Label>
                  <Input value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <Button variant="hero" className="w-full mt-4" onClick={saveConsumption}>
                <Plus className="h-4 w-4 mr-1" /> Registrar consumo (queda como deuda)
              </Button>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
