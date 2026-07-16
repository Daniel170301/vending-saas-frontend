import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coffee, Clock, CheckCircle2, XCircle, History } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "settled" | "cancelled";

const MovementsHistory = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => { document.title = "Historial deudas · InventaXo"; }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("vending_consumptions")
      .select("*")
      .order("consumed_at", { ascending: false });
    const list = (data as any[]) || [];
    if (list.length) {
      const machineIds = Array.from(new Set(list.map((r) => r.machine_id).filter(Boolean)));
      const productIds = Array.from(new Set(list.map((r) => r.product_id).filter(Boolean)));
      const [{ data: ms }, { data: ps }] = await Promise.all([
        machineIds.length
          ? (supabase as any).from("machines").select("id, name, code").in("id", machineIds)
          : Promise.resolve({ data: [] }),
        productIds.length
          ? (supabase as any).from("products").select("id, name").in("id", productIds)
          : Promise.resolve({ data: [] }),
      ]);
      const mMap = new Map((ms || []).map((x: any) => [x.id, x]));
      const pMap = new Map((ps || []).map((x: any) => [x.id, x]));
      setRows(list.map((r) => ({ ...r, machines: mMap.get(r.machine_id) || null, products: pMap.get(r.product_id) || null })));
    } else {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("mov-history-vc")
      .on("postgres_changes", { event: "*", schema: "public", table: "vending_consumptions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? rows : rows.filter((r) => r.status === filter),
    [rows, filter],
  );

  const grouped = useMemo(() => {
    const machines = new Map<string, {
      machine: any;
      days: Map<string, {
        date: string;
        rows: any[];
        pending: { qty: number; total: number };
        settled: { qty: number; total: number };
        cancelled: { qty: number; total: number };
      }>;
    }>();
    for (const r of filtered) {
      const key = r.machine_id || "—";
      if (!machines.has(key)) machines.set(key, { machine: r.machines || { id: r.machine_id, name: "Máquina" }, days: new Map() });
      const m = machines.get(key)!;
      const day = format(new Date(r.consumed_at), "yyyy-MM-dd");
      if (!m.days.has(day)) m.days.set(day, {
        date: day, rows: [],
        pending: { qty: 0, total: 0 },
        settled: { qty: 0, total: 0 },
        cancelled: { qty: 0, total: 0 },
      });
      const g = m.days.get(day)!;
      g.rows.push(r);
      const bucket = (g as any)[r.status] || g.pending;
      bucket.qty += Number(r.quantity || 0);
      bucket.total += Number(r.total || 0);
    }
    return Array.from(machines.values()).sort((a, b) =>
      (a.machine?.name || "").localeCompare(b.machine?.name || ""));
  }, [filtered]);

  const totals = useMemo(() => {
    const t = { pending: 0, settled: 0, cancelled: 0 };
    for (const r of rows) t[r.status as keyof typeof t] = (t[r.status as keyof typeof t] || 0) + Number(r.total || 0);
    return t;
  }, [rows]);

  const statusBadge = (s: string) => {
    if (s === "pending") return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-medium">Pendiente</span>;
    if (s === "settled") return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-medium">Liquidado</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Anulado</span>;
  };

  const FilterBtn = ({ k, label, color }: { k: Filter; label: string; color?: string }) => (
    <button
      onClick={() => setFilter(k)}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap",
        filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border",
        color,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="container mx-auto p-3 md:p-6 max-w-5xl">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/movements")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>
      <PageHeader
        title="Historial de deudas"
        description="Pendientes, liquidaciones y anulaciones agrupadas por máquina y día"
      />

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Pendiente</div>
          <div className="text-amber-600 font-bold text-lg">{fmtMoney(totals.pending)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Liquidado</div>
          <div className="text-emerald-600 font-bold text-lg">{fmtMoney(totals.settled)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-muted-foreground" /> Anulado</div>
          <div className="font-bold text-lg">{fmtMoney(totals.cancelled)}</div>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <FilterBtn k="all" label={`Todos (${rows.length})`} />
        <FilterBtn k="pending" label={`Pendientes (${rows.filter(r => r.status === "pending").length})`} />
        <FilterBtn k="settled" label={`Liquidados (${rows.filter(r => r.status === "settled").length})`} />
        <FilterBtn k="cancelled" label={`Anulados (${rows.filter(r => r.status === "cancelled").length})`} />
      </div>

      {loading && <Card className="p-6 text-center text-sm text-muted-foreground">Cargando…</Card>}

      {!loading && grouped.length === 0 && (
        <Card className="p-8 text-center">
          <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Sin registros para el filtro seleccionado</div>
        </Card>
      )}

      <div className="space-y-3">
        {grouped.map((mg) => {
          const days = Array.from(mg.days.values()).sort((a, b) => b.date.localeCompare(a.date));
          const totalPending = days.reduce((a, d) => a + d.pending.total, 0);
          const totalSettled = days.reduce((a, d) => a + d.settled.total, 0);
          return (
            <Card key={mg.machine.id || mg.machine.name} className="overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-muted/40 border-b">
                <Coffee className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{mg.machine?.name || "Máquina"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {days.length} día(s) ·
                    {totalPending > 0 && <span className="text-amber-600 font-medium"> Pend. {fmtMoney(totalPending)}</span>}
                    {totalSettled > 0 && <span className="text-emerald-600 font-medium"> · Liq. {fmtMoney(totalSettled)}</span>}
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {days.map((g) => (
                  <div key={g.date} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">
                        {format(new Date(g.date + "T00:00:00"), "dd/MM/yyyy")}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {g.pending.total > 0 && <span className="text-amber-600 font-medium">Pend. {fmtMoney(g.pending.total)}</span>}
                        {g.settled.total > 0 && <span className="text-emerald-600 font-medium">Liq. {fmtMoney(g.settled.total)}</span>}
                        {g.cancelled.total > 0 && <span className="text-muted-foreground">Anul. {fmtMoney(g.cancelled.total)}</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {g.rows.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs py-1">
                          <span className="font-mono text-muted-foreground w-10 shrink-0">{r.slot_code || "—"}</span>
                          <span className="flex-1 min-w-0 truncate">{r.products?.name || "Producto"}</span>
                          {statusBadge(r.status)}
                          <span className="text-muted-foreground w-12 text-right">×{r.quantity}</span>
                          <span className="font-semibold w-16 text-right">{fmtMoney(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MovementsHistory;
