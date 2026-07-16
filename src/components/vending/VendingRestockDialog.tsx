import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Coffee, Package, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
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
        id: s.id, label: s.label || "R", capacity: Number(s.capacity) || 0,
        product_id: s.product_id ?? null, sale_price: Number(s.sale_price) || 0,
        current_qty: Number(s.current_qty) || 0,
      })),
    })),
  };
};

type RestockLine = {
  tray_id: string; spring_id: string; slot_code: string;
  product_id: string; product_name: string;
  quantity: number; unit_price: number; unit_cost: number;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}

export const VendingRestockDialog = ({ open, onOpenChange, onDone }: Props) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [slot, setSlot] = useState<{ tray: Tray; spring: Spring } | null>(null);
  const [form, setForm] = useState({ product_id: "", quantity: "1", unit_price: "" });
  const [lines, setLines] = useState<RestockLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ machine: Machine; lines: RestockLine[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMachine(null); setSlot(null); setLines([]); setReceipt(null);
    (async () => {
      const { data: m } = await supabase.from("machines").select("id, name, code, coin_current, layout").eq("active", true).order("name");
      const { data: p } = await supabase.from("products").select("id, name, unit_cost, sale_price, stock_warehouse").order("name");
      setMachines((m as any) || []);
      setProducts(p || []);
    })();
  }, [open]);

  const productName = (id: string) => products.find((p) => p.id === id)?.name || "Producto";

  // efective layout taking into account pending lines (so user sees updated qty in grid)
  const effectiveLayout = useMemo<Layout>(() => {
    if (!machine) return { trays: [] };
    const lay = normalize(machine.layout);
    return {
      trays: lay.trays.map((t) => ({
        ...t,
        springs: t.springs.map((s) => {
          const added = lines.filter((l) => l.spring_id === s.id).reduce((a, l) => a + l.quantity, 0);
          // also overlay pending product/price changes
          const last = [...lines].reverse().find((l) => l.spring_id === s.id);
          return {
            ...s,
            current_qty: s.current_qty + added,
            product_id: last?.product_id ?? s.product_id,
            sale_price: last?.unit_price ?? s.sale_price,
          };
        }),
      })),
    };
  }, [machine, lines]);

  const pickSlot = (tray: Tray, spring: Spring) => {
    setSlot({ tray, spring });
    setForm({
      product_id: spring.product_id || "",
      quantity: "1",
      unit_price: String(spring.sale_price || ""),
    });
  };

  const addLine = () => {
    if (!slot) return;
    if (!form.product_id) return toast.error("Selecciona un producto");
    const qty = parseInt(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    if (qty <= 0) return toast.error("Cantidad inválida");
    if (price <= 0) return toast.error("Precio inválido");

    const eff = effectiveLayout.trays.find((t) => t.id === slot.tray.id)?.springs.find((s) => s.id === slot.spring.id);
    const remaining = (eff?.capacity || 0) - (eff?.current_qty || 0);
    if (qty > remaining) return toast.error(`Capacidad disponible: ${remaining}`);

    const prod = products.find((p) => p.id === form.product_id);
    if (!prod) return;
    const alreadyTaken = lines.filter((l) => l.product_id === form.product_id).reduce((a, l) => a + l.quantity, 0);
    if (qty + alreadyTaken > Number(prod.stock_warehouse || 0)) {
      return toast.error(`Stock almacén insuficiente (${prod.stock_warehouse})`);
    }

    setLines((prev) => [...prev, {
      tray_id: slot.tray.id, spring_id: slot.spring.id, slot_code: slot.spring.label,
      product_id: form.product_id, product_name: prod.name,
      quantity: qty, unit_price: price, unit_cost: Number(prod.unit_cost || 0),
    }]);
    setSlot(null);
    toast.success(`+${qty} en ${slot.spring.label}`);
  };

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const units = lines.reduce((a, l) => a + l.quantity, 0);
    const revenue = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0);
    const cost = lines.reduce((a, l) => a + l.quantity * l.unit_cost, 0);
    return { units, revenue, cost, profit: revenue - cost };
  }, [lines]);

  const saveAll = async () => {
    if (!machine || lines.length === 0) return toast.error("Agrega al menos un producto");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1) Update machine layout (load springs)
      const lay = normalize(machine.layout);
      const newTrays = lay.trays.map((t) => {
        const trayLines = lines.filter((l) => l.tray_id === t.id);
        if (trayLines.length === 0) return t;
        return {
          ...t,
          springs: t.springs.map((s) => {
            const sLines = trayLines.filter((l) => l.spring_id === s.id);
            if (sLines.length === 0) return s;
            const added = sLines.reduce((a, l) => a + l.quantity, 0);
            const last = sLines[sLines.length - 1];
            return {
              ...s,
              product_id: last.product_id,
              sale_price: last.unit_price,
              current_qty: Math.min(s.capacity, s.current_qty + added),
            };
          }),
        };
      });
      const { error: layErr } = await supabase.from("machines").update({ layout: { trays: newTrays } as any }).eq("id", machine.id);
      if (layErr) throw layErr;

      // 2) Decrement warehouse stock per product
      const byProduct = new Map<string, number>();
      for (const l of lines) byProduct.set(l.product_id, (byProduct.get(l.product_id) || 0) + l.quantity);
      for (const [pid, qty] of byProduct.entries()) {
        const { data: prod } = await supabase.from("products").select("stock_warehouse").eq("id", pid).single();
        const cur = Number((prod as any)?.stock_warehouse || 0);
        await supabase.from("products").update({ stock_warehouse: Math.max(0, cur - qty) }).eq("id", pid);
      }

      // 3) Create one pending vending_consumption per line (these are "potential sales" / deuda)
      const rows = lines.map((l) => ({
        user_id: user.id,
        machine_id: machine.id,
        slot_code: l.slot_code,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total: l.quantity * l.unit_price,
        status: "pending",
        notes: "Recarga de máquina",
      }));
      const { error: vcErr } = await supabase.from("vending_consumptions").insert(rows);
      if (vcErr) throw vcErr;

      toast.success("Recarga registrada");
      setReceipt({ machine, lines });
      setLines([]);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Error guardando recarga");
    } finally { setBusy(false); }
  };

  const printReceipt = () => {
    if (!receipt) return;
    const w = window.open("", "_blank", "width=380,height=700");
    if (!w) return;
    const dateStr = new Date().toLocaleString("es-PE");
    const rowsHtml = receipt.lines.map((l) =>
      `<div class="row"><span>${l.slot_code} · ${l.product_name}</span></div>
       <div class="row sub"><span>${l.quantity} × S/ ${l.unit_price.toFixed(2)}</span><span>S/ ${(l.quantity * l.unit_price).toFixed(2)}</span></div>`
    ).join("");
    const units = receipt.lines.reduce((a, l) => a + l.quantity, 0);
    const revenue = receipt.lines.reduce((a, l) => a + l.quantity * l.unit_price, 0);
    const cost = receipt.lines.reduce((a, l) => a + l.quantity * l.unit_cost, 0);
    w.document.write(`
      <html><head><title>Recarga ${receipt.machine.name}</title>
      <style>body{font-family:ui-monospace,monospace;padding:14px;width:300px}
      h2{text-align:center;margin:0 0 4px;font-size:14px}
      .small{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
      hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
      .row.sub{color:#555;font-size:11px;padding-left:6px}
      .total{font-size:14px;font-weight:bold;margin-top:6px}</style></head><body>
      <h2>RECARGA VENDING</h2>
      <div class="small">${receipt.machine.name} (${receipt.machine.code}) · ${dateStr}</div>
      <hr/>${rowsHtml}<hr/>
      <div class="row"><span>Unidades</span><span>${units}</span></div>
      <div class="row"><span>Costo</span><span>S/ ${cost.toFixed(2)}</span></div>
      <div class="row"><span>Venta proyectada</span><span>S/ ${revenue.toFixed(2)}</span></div>
      <div class="row total"><span>GANANCIA EST.</span><span>S/ ${(revenue - cost).toFixed(2)}</span></div>
      <div style="text-align:center;font-size:10px;color:#666;margin-top:12px">Pendiente hasta venta efectiva</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* ===== Receipt step ===== */}
        {receipt ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Recarga registrada</DialogTitle>
              <DialogDescription>{receipt.machine.name} · {receipt.machine.code}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 border-y py-3">
              {receipt.lines.map((l, i) => (
                <div key={i} className="flex items-center text-sm border-b last:border-0 pb-1.5">
                  <div className="flex-1">
                    <div className="font-medium">{l.slot_code} · {l.product_name}</div>
                    <div className="text-[11px] text-muted-foreground">{l.quantity} × {fmtMoney(l.unit_price)}</div>
                  </div>
                  <div className="font-semibold">{fmtMoney(l.quantity * l.unit_price)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Card label="Unidades" value={String(receipt.lines.reduce((a, l) => a + l.quantity, 0))} />
              <Card label="Costo" value={fmtMoney(receipt.lines.reduce((a, l) => a + l.quantity * l.unit_cost, 0))} />
              <Card label="Venta proyectada" value={fmtMoney(receipt.lines.reduce((a, l) => a + l.quantity * l.unit_price, 0))} />
              <Card label="Ganancia estimada" value={fmtMoney(receipt.lines.reduce((a, l) => a + l.quantity * (l.unit_price - l.unit_cost), 0))} accent />
            </div>
            <div className="text-[11px] text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2">
              Esta recarga queda en <b>Deuda · pendientes</b> hasta que el cliente compre en la máquina y pase a venta efectiva.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={printReceipt}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </>
        ) : !machine ? (
          /* ===== Step 1: pick machine ===== */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Recarga vending machine</DialogTitle>
              <DialogDescription>Elige a qué máquina vas a abastecer</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2 pt-2">
              {machines.length === 0 && <div className="text-sm text-muted-foreground col-span-2 text-center py-6">Sin máquinas activas. Crea una en "Máquinas".</div>}
              {machines.map((m) => {
                const lay = normalize(m.layout);
                const cap = lay.trays.reduce((a, t) => a + t.springs.reduce((b, s) => b + s.capacity, 0), 0);
                const loaded = lay.trays.reduce((a, t) => a + t.springs.reduce((b, s) => b + s.current_qty, 0), 0);
                return (
                  <button key={m.id} onClick={() => setMachine(m)}
                    className="text-left rounded-xl border p-4 bg-card hover:border-primary hover:shadow-md transition">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.code}</div>
                    <div className="text-[11px] text-muted-foreground mt-2">Cargado {loaded}/{cap}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* ===== Step 2: machine grid + add lines ===== */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setMachine(null); setSlot(null); setLines([]); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>{machine.name} <span className="text-xs text-muted-foreground font-normal">· {machine.code}</span></DialogTitle>
              </div>
              <DialogDescription>Toca un slot para asignar producto y cantidad a recargar</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {effectiveLayout.trays.map((tray) => (
                <div key={tray.id} className="rounded-lg border p-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">{tray.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tray.springs.map((s) => {
                      const fillPct = s.capacity > 0 ? Math.min(100, (s.current_qty / s.capacity) * 100) : 0;
                      const isFull = s.current_qty >= s.capacity && s.capacity > 0;
                      const remaining = s.capacity - s.current_qty;
                      const hasPending = lines.some((l) => l.spring_id === s.id);
                      return (
                        <button key={s.id} onClick={() => pickSlot(tray, s)} disabled={isFull}
                          className={cn(
                            "relative w-14 h-14 rounded-md border-2 flex flex-col items-center justify-center transition overflow-hidden",
                            hasPending ? "border-emerald-500 bg-emerald-500/5" :
                              s.product_id ? "border-primary/40 hover:border-primary" : "border-dashed hover:border-foreground/30",
                            isFull && "opacity-60 cursor-not-allowed",
                          )}
                          title={`${s.label} · cap ${s.capacity} · libres ${remaining}`}>
                          <div className="absolute inset-x-0 bottom-0 bg-primary/20" style={{ height: `${fillPct}%` }} />
                          <span className="relative text-[10px] font-bold leading-none">{s.label}</span>
                          <span className="relative text-[9px] text-muted-foreground leading-none mt-0.5">{s.current_qty}/{s.capacity}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {effectiveLayout.trays.length === 0 && (
                <div className="text-xs text-center text-muted-foreground py-4">Esta máquina no tiene bandejas configuradas.</div>
              )}
            </div>

            {/* Pending lines list */}
            {lines.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">Líneas a registrar</div>
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono w-10">{l.slot_code}</span>
                    <span className="flex-1 truncate">{l.product_name}</span>
                    <span className="text-muted-foreground">{l.quantity} × {fmtMoney(l.unit_price)}</span>
                    <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-600 px-1">✕</button>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t mt-1">
                  <span>Unidades: <b>{totals.units}</b></span>
                  <span>Ganancia est.: <b className="text-emerald-500">{fmtMoney(totals.profit)}</b></span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={saveAll} disabled={busy || lines.length === 0} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                {busy ? "Guardando…" : `Registrar recarga (${lines.length})`}
              </Button>
            </div>
          </>
        )}

        {/* Slot edit sub-dialog */}
        <Dialog open={!!slot} onOpenChange={(o) => !o && setSlot(null)}>
          <DialogContent className="max-w-sm">
            {slot && (
              <>
                <DialogHeader>
                  <DialogTitle>Slot {slot.spring.label}</DialogTitle>
                  <DialogDescription>Capacidad {slot.spring.capacity} · libres {slot.spring.capacity - slot.spring.current_qty}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Producto del inventario</Label>
                    <Select value={form.product_id} onValueChange={(v) => {
                      const p = products.find((x) => x.id === v);
                      setForm((f) => ({ ...f, product_id: v, unit_price: f.unit_price || String(p?.sale_price || "") }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} <span className="text-muted-foreground">· stock {p.stock_warehouse}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Cantidad</Label>
                      <Input type="number" min={1} value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div>
                      <Label>Precio venta (S/)</Label>
                      <Input type="number" step="0.01" value={form.unit_price}
                        onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={addLine} className="w-full"><Package className="h-4 w-4 mr-1" /> Agregar al slot</Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

const Card = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={cn("rounded-lg border p-2", accent && "border-emerald-500/40 bg-emerald-500/5")}>
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    <div className={cn("font-bold", accent && "text-emerald-500")}>{value}</div>
  </div>
);
