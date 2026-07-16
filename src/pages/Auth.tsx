import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
// ¡Adiós Supabase! Ya no lo importamos aquí.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passSchema = z.string().min(6, "Mínimo 6 caracteres").max(100);
const nameSchema = z.string().trim().min(1, "Requerido").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // 1. Verificamos si ya existe un Token válido guardado en el navegador
  useEffect(() => {
    document.title = "Ingresar | InventaXo";
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/app", { replace: true });
    }
  }, [navigate]);

  // 2. Conectamos el Login a tu propio servidor Node.js (Render)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.errors[0].message);
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      
      // Enviamos correo y contraseña a tu backend
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        // Guardamos el token JWT y los datos del usuario localmente
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        toast.success("¡Bienvenido!");
        navigate("/app", { replace: true });
      } else {
        // Mostramos el mensaje de error que configuramos en authController.js
        toast.error(data.message || "Error al iniciar sesión");
      }
    } catch (error) {
      console.error("Error en login:", error);
      toast.error("Error conectando con el servidor");
    } finally {
      setLoading(false);
    }
  };

  // 3. Temporalmente deshabilitamos el registro desde la web
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("Registro temporalmente desactivado. Usa DBeaver para agregar clientes.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center shadow-glow">
            <Boxes className="h-5 w-5 text-primary-deep" />
          </div>
          <span className="font-display text-2xl font-bold text-primary-foreground">
            InventaXo
          </span>
        </Link>
        <div className="bg-card rounded-2xl shadow-elegant p-8">
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Ingresar</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Ingresar
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;