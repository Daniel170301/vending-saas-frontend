import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { setMoneyCurrency } from "@/lib/format";
import { ArrowLeftRight, BarChart3, Boxes, Building2, LayoutDashboard, LogOut, Package, ShoppingCart, Users, UserSquare2, Truck, Warehouse, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sidebar (desktop) — mantiene Compras y Ventas separadas
const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/app/machines", icon: Boxes, label: "Máquinas" },
 { to: "/app/products", icon: Warehouse, label: "Planograma" },
  { to: "/app/inventory", icon: Package, label: "Inventario" },
  { to: "/app/purchases", icon: ShoppingCart, label: "Compras" },
  { to: "/app/sales", icon: Wallet, label: "Ventas" },
  { to: "/app/customers", icon: UserSquare2, label: "Clientes" },
  { to: "/app/suppliers", icon: Truck, label: "Proveedores" },
  { to: "/app/employees", icon: Users, label: "Empleados" },
  { to: "/app/reports", icon: BarChart3, label: "Reportes" },
  { to: "/app/company", icon: Building2, label: "Mi empresa" },
];

// Bottom nav (mobile) — Compras y Ventas unidas en "Movimientos"
const mobileNavItems = [
  { to: "/app", icon: LayoutDashboard, label: "Inicio", end: true },
  { to: "/app/machines", icon: Boxes, label: "Máquinas" },
{ to: "/app/products", icon: Warehouse, label: "Planograma" },
  { to: "/app/inventory", icon: Package, label: "Inventario" },
  { to: "/app/movements", icon: ArrowLeftRight, label: "Movimientos" },
  { to: "/app/reports", icon: BarChart3, label: "Reportes" },
];

const AppLayout = () => {
  const { user, loading, signOut } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (company?.currency) setMoneyCurrency(company.currency);
  }, [company?.currency]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Cargando…</div>;
  }
  if (!user) return null;

  const brandName = company?.business_name || "Kymez App";

  const handleLogout = async () => {
    signOut(); // Esta función ya limpia el localStorage y te redirige
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <Link to="/app" className="flex items-center gap-2 px-6 py-6 border-b border-sidebar-border">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-xl gradient-gold flex items-center justify-center">
              <Boxes className="h-5 w-5 text-primary-deep" />
            </div>
          )}
          <span className="font-display text-xl font-bold text-sidebar-foreground truncate">{brandName}</span>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 py-3">
        <Link to="/app" className="flex items-center gap-2">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg gradient-gold flex items-center justify-center">
              <Boxes className="h-4 w-4 text-primary-deep" />
            </div>
          )}
          <span className="font-display font-bold text-sidebar-foreground truncate max-w-[140px]">{brandName}</span>
        </Link>
        <Button size="sm" variant="ghost" className="text-sidebar-foreground" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
      </div>

      <main className="flex-1 min-w-0 md:pt-0 pt-14 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border flex items-center justify-around py-2">
        {mobileNavItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) =>
            cn("flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]",
              isActive ? "text-accent" : "text-sidebar-foreground/60")
          }>
            <it.icon className="h-5 w-5" />
            {it.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default AppLayout;
