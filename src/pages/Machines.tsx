import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import {
  Boxes, Coins, MapPin, Pencil, Plus, Trash2, LayoutGrid,
  Package, Eye, FileSpreadsheet, FileText, Banknote
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  id: string;
  name: string;
  code: string;
  location: string | null;
  coin_base: number;
  coin_current: number;
  active: boolean;
  layout: Layout | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
  coin_brand: string | null;
  coin_plate: string | null;
  bill_enabled: boolean;
  bill_brand: string | null;
  bill_model: string | null;
  bill_plate: string | null;
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
  id: uid(),
  label: `R${i + 1}`,
  capacity: 8,
  product_id: null,
  sale_price: 0,
  current_qty: 0,
});

const newTray = (i: number, springsCount = 6): Tray => ({
  id: uid(),
  label: `Bandeja ${String.fromCharCode(65 + i)}`,
  springs: Array.from({ length: springsCount }, (_, j) => newSpring(j)),
});

const defaultLayout = (): Layout => ({
  trays: Array.from({ length: 4 }, (_, i) => newTray(i, 6))
});

const normalize = (l: Layout | null | undefined): Layout => {
  if (!l || !l.trays || !Array.isArray(l.trays)) return defaultLayout();
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
  const [list, setList] = useState<Machine[]>([]);
  const [productosModal, setProductosModal] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  
  const [form, setForm] = useState({
    name: "", code: "", location: "", coin_base: "",
    brand: "", model: "", plate: "",
    coin_enabled: false, coin_brand: "", coin_plate: "",
    bill_enabled: false, bill_brand: "", bill_model: "", bill_plate: ""
  });
  
  const [layout, setLayout] = useState<Layout>(defaultLayout());
  const [tab, setTab] = useState<"data" | "layout">("data");
  const [viewing, setViewing] = useState<Machine | null>(null);
  const [debtByMachine, setDebtByMachine] = useState<Record<string, { count: number; total: number }>>({});
  const [salesTodayByMachine, setSalesTodayByMachine] = useState<Record<string, { revenue: number; profit: number; units: number }>>({});

  // 1. CARGAR LISTA PRINCIPAL
  const load = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`${apiUrl}/machines?user=${user.email}`);
      const data = await res.json();
      if (res.ok) {
        const formatted = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          code: m.code || m.id,
          location: m.location || "",
          coin_base: Number(m.coin_base) || 0,
          coin_current: Number(m.coin_current) || 0,
          active: m.status === 'online',
          layout: m.layout,
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
        setList(formatted);
      }
    } catch (error) {
      console.error("Error cargando máquinas:", error);
    }
  };

  useEffect(() => {
    if (user?.email) load();
  }, [user]);

  // 2. DESCARGAR INVENTARIO AL ABRIR EL OJITO (UNIFICADO)
  useEffect(() => {
    if (!viewing) {
      setProductosModal([]);
      return;
    }
    const descargarInventario = async () => {
      try {
        const macMaquina = viewing.code || "D4-8A-FC-A5-26-A8";
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
    descargarInventario();
  }, [viewing]);

  // 3. FUNCIÓN DEDICADA PARA GUARDAR LA CAPACIDAD MANUALMENTE
  const ejecutarGuardarCapacidad = async (codigoMotor: string, nuevaCapacidad: number, producto: any) => {
    if (isNaN(nuevaCapacidad) || nuevaCapacidad < 1) {
      toast.error("Capacidad no válida");
      return;
    }
    const macDetectada = (viewing as any).code || (viewing as any).machine_id || (viewing as any).id;
    
    try {
      const payload = {
        machine_id: macDetectada,
        codigo_motor: codigoMotor,
        nombre_producto: producto?.nombre_producto || "",
        precio: Number(producto?.precio) || 0,
        stock: Number(producto?.stock) || 0,
        capacidad: nuevaCapacidad
      };

      const res = await fetch(`${apiUrl}/inventario/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Capacidad de R${codigoMotor} guardada`);
        setProductosModal(prev => prev.map(p => p.codigo_motor === codigoMotor ? { ...p, capacidad: nuevaCapacidad } : p));
      } else {
        toast.error(data.message || "Error al actualizar");
      }
    } catch (error) {
      console.error("Error en fetch:", error);
      toast.error("Error de conexión");
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "", code: "", location: "", coin_base: "",
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
      bill_brand: m.bill_brand || "", bill_model: m.bill_model || "", bill_plate: m.bill_plate || ""
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
      if (!user?.email) return toast.error("Sesión no detectada");

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
        coin_brand: form.coin_enabled ? form.coin_brand.trim() : null,
        coin_plate: form.coin_enabled ? form.coin_plate.trim() : null,
        bill_enabled: !!form.bill_enabled,
        bill_brand: form.bill_enabled ? form.bill_brand.trim() : null,
        bill_model: form.bill_enabled ? form.bill_model.trim() : null,
        bill_plate: form.bill_enabled ? form.bill_plate.trim() : null,
        layout: layout,
        user_email: user.email
      };

      const url = editing ? `${apiUrl}/machines/${editing.id || editing.code}` : `${apiUrl}/machines`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error en servidor");
      toast.success(editing ? "Máquina actualizada" : "Máquina creada");
      setOpen(false);
      load();
    } catch (error: any) {
      toast.error(error.message || "Error al conectar con servidor");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta máquina?")) return;
    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  const totalsLive = list.reduce((acc, m) => {
    const s = salesTodayByMachine[m.id] || { revenue: 0, profit: 0, units: 0 };
    acc.coinCurrent += Number(m.coin_current || 0);
    acc.coinBase += Number(m.coin_base || 0);
    acc.todayRevenue += s.revenue;
    acc.todayProfit += s.profit;
    acc.todayUnits += s.units;
    return acc;
  }, { coinCurrent: 0, coinBase: 0, todayRevenue: 0, todayProfit: 0, todayUnits: 0 });

  return (
    <div className="container py-8">
      <PageHeader title="Máquinas" description="Tus máquinas expendedoras y monederos" actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {}} disabled={!list.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => {}} disabled={!list.length}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva máquina</Button>
        </div>
      } />

      {list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3 text-accent" />Monedero total (live)
            </div>
            <div className="font-bold text-lg text-primary">{fmtMoney(totalsLive.coinCurrent)}</div>
            <div className="text-[10px] text-muted-foreground">Base: {fmtMoney(totalsLive.coinBase)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ventas hoy</div>
            <div className="font-bold text-lg text-emerald-500">{fmtMoney(totalsLive.todayRevenue)}</div>
            <div className="text-[10px] text-muted-foreground">{totalsLive.todayUnits} unidades</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Ganancia hoy</div>
            <div className="font-bold text-lg text-amber-500">{fmtMoney(totalsLive.todayProfit)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">Máquinas activas</div>
            <div className="font-bold text-lg">
              {list.filter(m => m.active).length} / {list.length}
            </div>
          </Card>
        </div>
      )}

      {list.length === 0 ? (
        <Card className="p-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tienes máquinas registradas</p>
          <Button variant="hero" className="mt-4" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />Agregar la primera
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => {
            const lay = normalize(m.layout);
            const slots = lay.trays.reduce((a, t) => a + t.springs.length, 0);
            return (
              <Card key={m.id} className="p-5 gradient-card hover:shadow-soft transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="secondary" className="mb-2 text-xs">{m.code}</Badge>
                    <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                    {m.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />{m.location}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setViewing(m)}><Eye className="h-4 w-4 text-primary" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL CONFIGURACIÓN MÁQUINA */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar máquina" : "Nueva máquina"}</DialogTitle></DialogHeader>
          {tab === "data" && (
            <div className="space-y-5">
              <div>
                <h4 className="font-semibold text-sm mb-2 text-primary">Identificación</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nombre *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Sede Principal" />
                  </div>
                  <div>
                    <Label>Código *</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ej: D4-8A..." />
                  </div>
                </div>
              </div>
              <Button variant="hero" className="w-full mt-4" onClick={save}>Guardar máquina</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DEL OJITO: DETALLE RESORTES (SOLO LECTURA + CAPACIDAD EDITABLE MANUAL) */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> {viewing?.name}
            </DialogTitle>
          </DialogHeader>
          
          {viewing && (
            <div className="space-y-6 mt-6">
              {[1, 2, 3, 4, 5, 6].map((numBandeja) => (
                <div key={numBandeja} className="bg-card rounded-2xl border shadow-sm p-5">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="font-bold text-lg text-primary-deep">Bandeja {numBandeja}</h3>
                    <span className="text-sm text-muted-foreground"># {numBandeja} · 6 resortes</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[0, 1, 2, 3, 4, 5].map((posicion) => {
                      const codigoMotor = `${numBandeja}${posicion}`;
                      const producto = productosModal.find((p) => p.codigo_motor === codigoMotor);
                      
                      return (
                        <div key={codigoMotor} className="border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center min-h-[130px] relative bg-white hover:bg-accent/5 transition-colors">
                          <span className="absolute top-2 text-xs font-bold text-emerald-600">R{codigoMotor}</span>
                          
                          <div className="flex flex-col items-center justify-center w-full mt-5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Capacidad</span>
                            <input
                              id={`input-cap-${codigoMotor}`}
                              type="number"
                              min="1"
                              className="w-14 h-8 text-center text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              defaultValue={producto?.capacidad ?? 10}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  ejecutarGuardarCapacidad(codigoMotor, parseInt(e.currentTarget.value, 10), producto);
                                }
                              }}
                            />
                            
                            {/* ¡NUEVO BOTÓN DE GUARDADO MANUAL! */}
                            <button
                              onClick={() => {
                                const inputEl = document.getElementById(`input-cap-${codigoMotor}`) as HTMLInputElement;
                                if (inputEl) {
                                  ejecutarGuardarCapacidad(codigoMotor, parseInt(inputEl.value, 10), producto);
                                }
                              }}
                              className="mt-2 w-full py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-all active:scale-95 shadow-sm"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Machines;