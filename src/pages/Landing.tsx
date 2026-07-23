import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Boxes, Coins, Cpu, LineChart, ShieldCheck, Sparkles, Wifi } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="container flex items-center justify-between py-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-gold flex items-center justify-center shadow-glow">
              <Boxes className="h-5 w-5 text-primary-deep" />
            </div>
            <span className="font-display text-xl font-bold text-primary-foreground">Kymez App</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-primary-foreground/80">
            <a href="#features" className="hover:text-accent transition-colors">Funcionalidades</a>
            <a href="#how" className="hover:text-accent transition-colors">Cómo funciona</a>
            <a href="#iot" className="hover:text-accent transition-colors">IoT</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Ingresar</Button></Link>
            <Link to="/auth"><Button variant="gold">Empezar gratis</Button></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative gradient-hero pt-36 pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(42 70% 60% / 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 30%, hsl(162 70% 50% / 0.3) 0%, transparent 50%)',
        }} />
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-primary-foreground/5 backdrop-blur-sm mb-8">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm text-primary-foreground/90">Inventario en tiempo real para vending</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-[1.05]">
              Controla todas tus <span className="text-gradient-gold">máquinas expendedoras</span> desde un solo lugar
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/75 max-w-2xl mx-auto mb-10">
              Inventario, compras, ventas y monedero base. Ve tus ganancias del día, semana, mes y año con datos en tiempo real desde cada máquina.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button variant="gold" size="xl" className="group">
                  Crear mi cuenta
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#features">
                {/* Quitamos el variant="outline" y aplicamos los colores verdes directamente */}
                <Button size="xl" className="bg-emerald-600 text-white hover:bg-emerald-700 border-none transition-colors shadow-lg">
                  Ver funcionalidades
                </Button>
              </a>
            </div>
          </div>

          {/* MOCK DASHBOARD CARD */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="rounded-3xl border border-accent/20 bg-card/95 backdrop-blur shadow-elegant p-6 md:p-8 animate-float">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Ventas hoy", value: "$248,500", icon: LineChart },
                  { label: "Máquinas activas", value: "12", icon: Boxes },
                  { label: "Monedero base", value: "$420,000", icon: Coins },
                  { label: "Margen mes", value: "38%", icon: BarChart3 },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl gradient-card border p-4">
                    <s.icon className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-background">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">Todo lo que necesitas</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              La operación de tu vending, ordenada
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Boxes, t: "Máquinas con código", d: "Registra cada máquina con un nombre o código único, ubicación y monedero base." },
              { icon: Coins, t: "Monedero autorecargable", d: "Define el capital de monedas para vuelto. Se autorecarga con cada venta." },
              { icon: LineChart, t: "Ventas día/semana/mes/año", d: "Visualiza tus ventas y ganancias en cualquier rango de tiempo." },
              { icon: ShieldCheck, t: "Compras y costos", d: "Registra compras de bebidas, snacks y galletas. Calcula margen automáticamente." },
              { icon: BarChart3, t: "Gráficos en tiempo real", d: "Dashboards visuales para tomar decisiones rápido." },
              { icon: Wifi, t: "Listo para IoT", d: "Endpoint preparado para que dispositivos en cada máquina envíen ventas en vivo." },
            ].map((f) => (
              <div key={f.t} className="group rounded-2xl border bg-card p-6 hover:border-primary/40 hover:shadow-soft transition-all duration-300">
                <div className="h-12 w-12 rounded-xl gradient-emerald flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{f.t}</h3>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IOT */}
      <section id="iot" className="py-24 bg-secondary">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">Tiempo real</p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
                Datos en vivo desde cada máquina
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Conecta un dispositivo IoT a cada máquina expendedora. Cada venta llega a tu panel al instante, sin que tengas que ingresarla manualmente.
              </p>
              <ul className="space-y-3">
                {["Endpoint seguro con token por dispositivo", "Inventario actualizado automáticamente", "Alertas de stock bajo", "Historial completo por máquina"].map((p) => (
                  <li key={p} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full gradient-gold flex items-center justify-center flex-shrink-0">
                      <Cpu className="h-3.5 w-3.5 text-primary-deep" />
                    </div>
                    <span className="text-foreground">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl gradient-hero p-8 shadow-elegant">
              <pre className="text-xs md:text-sm text-primary-foreground/80 overflow-x-auto font-mono">
{`POST /functions/v1/iot-sale
Authorization: Bearer <DEVICE_TOKEN>
Content-Type: application/json

{
  "product_id": "...",
  "quantity": 1,
  "unit_price": 2500
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="rounded-3xl gradient-hero p-12 md:p-16 text-center shadow-elegant">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Empieza a controlar tu negocio hoy
            </h2>
            <p className="text-primary-foreground/75 text-lg mb-8 max-w-xl mx-auto">
              Crea tu cuenta gratis y registra tu primera máquina en menos de 2 minutos.
            </p>
            <Link to="/auth"><Button variant="gold" size="xl">Crear cuenta gratis<ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 Kymez App · Inventario inteligente para vending
        </div>
      </footer>
    </div>
  );
};

export default Landing;
