import { useEffect, useState } from "react";
// Corregido: Importación con llaves para evitar el error "no default export"
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

type AlmacenProduct = {
  id?: number;
  name: string;
  category: string;
  subcategory: string;
  unit_cost: number;
  sale_price: number;
  stock_warehouse: number;
  capacidad: number;
  unit_type: string;
};

const emptyForm: AlmacenProduct = {
  name: "",
  category: "",
  subcategory: "",
  unit_cost: 0,
  sale_price: 0,
  stock_warehouse: 0,
  capacidad: 10, // Capacidad por defecto para la máquina
  unit_type: "unidad",
};

const UNIT_TYPES = ["unidad", "caja", "paquete", "docena", "kilo", "litro", "ml"];

const Inventory = () => {
  const [list, setList] = useState<AlmacenProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para el Modal (Ventana emergente)
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AlmacenProduct>(emptyForm);
  const [processing, setProcessing] = useState(false);

  const loadInventory = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/productos-almacen`);
      const data = await res.json();
      
      if (data.success) {
        setList(data.productos || []);
      }
    } catch (err) {
      toast.error("Error al cargar el inventario del almacén");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Inventario · InventaXo";
    loadInventory();
  }, []);

  // Función para guardar en PostgreSQL
  const saveProduct = async () => {
    if (!form.name.trim()) return toast.error("El nombre es requerido");
    if (form.sale_price <= 0) return toast.error("El precio debe ser mayor a 0");

    setProcessing(true);
    try {
      // Obtenemos el usuario (dueño) de localStorage para saber de quién es el producto
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      
      if (!user) {
        toast.error("Sesión no válida");
        return;
      }

      const payload = {
        ...form,
        id_dueno: user.id || user.userId // Asegúrate de enviar el ID del dueño
      };

      const apiUrl = import.meta.env.VITE_API_URL;
      
      // Petición a tu backend (Endpoint que debes crear en Node.js)
      const res = await fetch(`${apiUrl}/productos-almacen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Producto guardado exitosamente");
        setOpen(false);
        setForm(emptyForm);
        loadInventory(); // Recargamos la lista
      } else {
        toast.error(data.message || "Error al guardar el producto");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión con el servidor");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container py-8 pb-32">
      <PageHeader 
        title="Inventario de Almacén" 
        description="Gestiona los productos, stock general y precios base."
        actions={
          <Button 
            className="bg-primary text-primary-foreground"
            onClick={() => { setForm(emptyForm); setOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
          </Button>
        }
      />

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando inventario...</div>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center mt-6">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay productos en el almacén</p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p, index) => (
            <Card key={p.id || index} className="p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{p.category || "Sin categoría"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-4 border-t pt-3">
                <div>
                  <span className="block text-muted-foreground text-xs">Stock Bodega</span>
                  <span className="font-bold">{p.stock_warehouse} {p.unit_type || 'un.'}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-xs">Precio Base</span>
                  <span className="font-bold text-emerald-600">{fmtMoney(p.sale_price)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para Nuevo Producto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Producto al Almacén</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre del producto</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder="Ej. Galletas Oreo"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Input 
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })} 
                  placeholder="Ej. Snacks"
                />
              </div>
              <div>
                <Label>Subcategoría</Label>
                <Input 
                  value={form.subcategory} 
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio de compra (Costo)</Label>
                <Input 
                  type="number" step="0.01"
                  value={form.unit_cost || ""} 
                  onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div>
                <Label>Precio de venta base</Label>
                <Input 
                  type="number" step="0.01"
                  value={form.sale_price || ""} 
                  onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Stock Inicial</Label>
                <Input 
                  type="number"
                  value={form.stock_warehouse || ""} 
                  onChange={(e) => setForm({ ...form, stock_warehouse: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div>
                <Label>Capacidad resorte</Label>
                <Input 
                  type="number"
                  value={form.capacidad || ""} 
                  onChange={(e) => setForm({ ...form, capacidad: parseInt(e.target.value) || 10 })} 
                />
              </div>
              <div>
                <Label>Tipo unidad</Label>
                <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={processing}>
              {processing ? "Guardando..." : "Guardar Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;