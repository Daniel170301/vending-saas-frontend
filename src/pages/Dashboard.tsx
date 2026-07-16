import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { AlertTriangle, BarChart3, Boxes, Coins, LineChart as LineIcon, Package, PackageX, Plus, ShoppingCart, TrendingUp, Truck, UserSquare2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LOW_THRESHOLD = 5;   // ≤ 5 unidades → bajo
const CRIT_THRESHOLD = 2;  // ≤ 2 unidades → crítico
type Alert = { id: string; machine: string; product: string; qty: number; slot: string | null; level: "out" | "crit" | "low"; priority: number };
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, format, subDays } from "date-fns";
import { es } from "date-fns/locale";

const quickActions = [
  { to: "/app/sales", icon: Wallet, label: "Ventas", desc: "Registrar venta", style: "gold" as const },
  { to: "/app/machines", icon: Boxes, label: "Máquinas", desc: "Gestionar", style: "emerald" as const },
  { to: "/app/products", icon: Package, label: "Productos", desc: "Catálogo", style: "emerald" as const },
  { to: "/app/purchases", icon: ShoppingCart, label: "Compras", desc: "Inventario", style: "gold" as const },
  { to: "/app/customers", icon: UserSquare2, label: "Clientes", desc: "Crear cliente", style: "emerald" as const },
  { to: "/app/suppliers", icon: Truck, label: "Proveedores", desc: "Crear proveedor", style: "gold" as const },
  { to: "/app/reports", icon: BarChart3, label: "Reportes", desc: "Análisis", style: "emerald" as const },
  { to: "/app/machines", icon: Coins, label: "Monedero", desc: "Capital base", style: "gold" as const },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, year: 0, machines: 0, coin: 0, profit: 0 });
  const [daily, setDaily] = useState<{ day: string; total: number }[]>([]);
  const [byMachine, setByMachine] = useState<{ name: string; total: number }[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    document.title = "Dashboard · InventaXo";
    load();
  }, [user]);

const load = async () => {
// 🔥 ESCUDO PROTECTOR: Si React aún no lee el correo, cancelamos la función aquí mismo
    if (!user?.email) {
      return; 
    }
  try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const userIdentifier = user?.email || 'desconocido';

      // 1. Pedimos SOLO los datos del dashboard para evitar errores 404
      const dashRes = await fetch(`${apiUrl}/dashboard?user=${userIdentifier}`);
      
      // 2. Verificamos que todo esté OK antes de leer los datos (¡dentro del try!)
      if (dashRes.ok) {
        // Leemos la respuesta una sola vez
        const dashData = await dashRes.json();
        
        // 👇 AQUÍ VEMOS LOS DATOS EN LA CONSOLA DEL NAVEGADOR 👇
        console.log("Datos recibidos del servidor para mi cuenta:", dashData);

        setStats({ 
          today: dashData.today || 0, 
          week: dashData.week || 0, 
          month: dashData.month || 0, 
          year: dashData.year || 0, 
          machines: dashData.machinesCount || 0, 
          coin: dashData.totalCoin || 0, 
          profit: dashData.profit || 0 
        });
      } else {
        console.error("El servidor respondió con un error:", dashRes.status);
      }

      // 3. Dejamos las gráficas y alertas vacías hasta crear sus rutas en el backend
      setDaily([]);
      setByMachine([]);
      setAlerts([]);

    } catch (error) {
      console.error("Error de red conectando con el backend:", error);
    }
  };

  return (
    <div className="container py-6 md:py-10">
      {/* Greeting + quick sale CTA */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Hola{user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-1">Tu negocio hoy</h1>
        </div>
        <Link to="/app/sales">
          <Button variant="hero" size="lg" className="rounded-2xl shadow-elegant">
            <Plus className="h-5 w-5" /> Registrar venta
          </Button>
        </Link>
      </div>

      {/* Hero balance card (Treinta-style) */}
      <div className="rounded-3xl gradient-hero p-6 md:p-8 mb-6 shadow-elegant relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-primary-foreground/70 text-sm font-medium">Ventas de hoy</p>
            <p className="font-display text-4xl md:text-5xl font-bold text-primary-foreground mt-2">{fmtMoney(stats.today)}</p>
            <p className="text-accent text-sm mt-2 font-medium">Ganancia año: {fmtMoney(stats.profit)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
              <p className="text-primary-foreground/70 text-xs font-medium">Esta semana</p>
              <p className="font-display text-xl font-bold text-primary-foreground mt-1">{fmtMoney(stats.week)}</p>
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
              <p className="text-primary-foreground/70 text-xs font-medium">Este mes</p>
              <p className="font-display text-xl font-bold text-primary-foreground mt-1">{fmtMoney(stats.month)}</p>
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
              <p className="text-primary-foreground/70 text-xs font-medium">Este año</p>
              <p className="font-display text-xl font-bold text-primary-foreground mt-1">{fmtMoney(stats.year)}</p>
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-sm p-4 border border-primary-foreground/10">
              <p className="text-primary-foreground/70 text-xs font-medium">Monedero total</p>
              <p className="font-display text-xl font-bold text-primary-foreground mt-1">{fmtMoney(stats.coin)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions grid (Treinta-style, esmeralda + dorado) */}
      <h2 className="font-display text-lg font-semibold text-foreground mb-3 mt-2">Accesos rápidos</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 mb-10">
        {quickActions.map((a) => {
          const isGold = a.style === "gold";
          return (
            <Link key={a.label} to={a.to} className="group">
              <Card className="p-5 md:p-6 flex items-center gap-4 hover:shadow-elegant hover:-translate-y-1 transition-all duration-300 border-border/60 h-full bg-gradient-card">
                <div className={`h-14 w-14 md:h-16 md:w-16 rounded-full flex items-center justify-center shadow-soft flex-shrink-0 ${isGold ? "gradient-gold" : "gradient-emerald"} group-hover:scale-105 transition-transform`}>
                  <a.icon className={`h-7 w-7 md:h-8 md:w-8 ${isGold ? "text-primary-deep" : "text-primary-foreground"}`} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-base md:text-lg text-foreground leading-tight">{a.label}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{a.desc}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 gradient-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Máquinas activas</p>
            <p className="font-display text-xl font-bold">{fmtNumber(stats.machines)}</p>
          </div>
        </Card>
        <Card className="p-4 gradient-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ganancia año</p>
            <p className="font-display text-xl font-bold">{fmtMoney(stats.profit)}</p>
          </div>
        </Card>
        <Card className="p-4 gradient-card flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Coins className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monedero base</p>
            <p className="font-display text-xl font-bold">{fmtMoney(stats.coin)}</p>
          </div>
        </Card>
      </div>

      {/* Stock alerts — replenishment by priority */}
      <Card className="p-5 md:p-6 mb-8 border-border/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Alertas de stock</h3>
              <p className="text-xs text-muted-foreground">Reposiciones sugeridas por prioridad (≤ {LOW_THRESHOLD} uds)</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="rounded-full">{alerts.length}</Badge>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
              <Package className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm text-muted-foreground">Todo en orden. Ningún producto está bajo en tus máquinas.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 9).map((a) => {
              const cfg =
                a.level === "out"
                  ? { label: "Agotado", icon: PackageX, ring: "border-destructive/40 bg-destructive/5", chip: "bg-destructive text-destructive-foreground", iconBg: "bg-destructive/15 text-destructive" }
                  : a.level === "crit"
                  ? { label: "Crítico", icon: AlertTriangle, ring: "border-warning/50 bg-warning/5", chip: "bg-warning text-primary-deep", iconBg: "bg-warning/20 text-warning" }
                  : { label: "Bajo", icon: AlertTriangle, ring: "border-accent/40 bg-accent/5", chip: "bg-accent text-accent-foreground", iconBg: "bg-accent/20 text-accent" };
              const Icon = cfg.icon;
              return (
                <div key={a.id} className={`rounded-2xl border p-4 ${cfg.ring} flex items-start gap-3`}>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-display font-semibold text-sm text-foreground truncate">{a.product}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.chip}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.machine}{a.slot ? ` · slot ${a.slot}` : ""}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-semibold text-foreground">{fmtNumber(a.qty)}</span>
                      <span className="text-muted-foreground"> uds disponibles</span>
                    </p>
                  </div>
                </div>
              );
            })}
            {alerts.length > 9 && (
              <Link to="/app/machines" className="rounded-2xl border border-dashed border-border flex items-center justify-center p-4 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                Ver {alerts.length - 9} más →
              </Link>
            )}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Ventas últimos 14 días</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Line type="monotone" dataKey="total" stroke="url(#g1)" strokeWidth={3} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Top máquinas</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMachine} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="total" fill="hsl(var(--accent))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
