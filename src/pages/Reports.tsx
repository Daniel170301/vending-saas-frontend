import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--primary-glow))", "hsl(var(--primary-deep))", "hsl(var(--success))"];

const Reports = () => {
  const [monthly, setMonthly] = useState<any[]>([]);
  const [byProduct, setByProduct] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Reportes · InventaXo";
    (async () => {
      const start = startOfMonth(subMonths(new Date(), 11));
      const { data: sales } = await supabase.from("sales")
        .select("total, unit_cost, quantity, sold_at, products(name)")
        .gte("sold_at", start.toISOString());

      const monthMap = new Map<string, { mes: string; ventas: number; ganancia: number }>();
      eachMonthOfInterval({ start, end: new Date() }).forEach((d) => {
        const k = format(d, "MMM yy", { locale: es });
        monthMap.set(k, { mes: k, ventas: 0, ganancia: 0 });
      });
      const prodMap = new Map<string, number>();
      (sales || []).forEach((s: any) => {
        const k = format(new Date(s.sold_at), "MMM yy", { locale: es });
        const cur = monthMap.get(k);
        if (cur) { cur.ventas += Number(s.total); cur.ganancia += Number(s.total) - (Number(s.unit_cost) * (s.quantity || 1)); }
        const pname = s.products?.name || "Otros";
        prodMap.set(pname, (prodMap.get(pname) || 0) + Number(s.total));
      });
      setMonthly(Array.from(monthMap.values()));
      setByProduct(Array.from(prodMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6));
    })();
  }, []);

  return (
    <div className="container py-8">
      <PageHeader title="Reportes" description="Tendencias, ganancias y productos top" />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Ventas vs ganancia · 12 meses</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="vSale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vGain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" fill="url(#vSale)" strokeWidth={2} />
                <Area type="monotone" dataKey="ganancia" stroke="hsl(var(--accent))" fill="url(#vGain)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Top productos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byProduct} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
