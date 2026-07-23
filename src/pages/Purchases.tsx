import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const Purchases = () => {
  const [list, setList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", quantity: "", unit_cost: "", supplier: "" });

  const load = async () => {
    const { data } = await supabase.from("purchases").select("*, products(name)").order("purchased_at", { ascending: false });
    setList(data || []);
    const { data: p } = await supabase.from("products").select("id, name, unit_cost").order("name");
    setProducts(p || []);
  };
  useEffect(() => { document.title = "Compras · Kymez App"; load(); }, []);

  const save = async () => {
    if (!form.product_id || !form.quantity || !form.unit_cost) return toast.error("Completa todos los campos");
    const qty = parseInt(form.quantity), cost = parseFloat(form.unit_cost);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("purchases").insert({
      user_id: user.id, product_id: form.product_id, quantity: qty, unit_cost: cost,
      total: qty * cost, supplier: form.supplier.trim() || null,
    });
    if (error) return toast.error(error.message);

    // bump stock + update product unit_cost
    const prod = products.find((p) => p.id === form.product_id);
    if (prod) {
      const { data: cur } = await supabase.from("products").select("stock_warehouse").eq("id", form.product_id).single();
      await supabase.from("products").update({
        stock_warehouse: (cur?.stock_warehouse || 0) + qty,
        unit_cost: cost,
      }).eq("id", form.product_id);
    }
    toast.success("Compra registrada");
    setOpen(false); setForm({ product_id: "", quantity: "", unit_cost: "", supplier: "" }); load();
  };

  return (
    <div className="container py-8">
      <PageHeader title="Compras" description="Registra las compras a proveedores" actions={
        <Button variant="hero" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nueva compra</Button>
      } />
      <Card>
        {list.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Sin compras registradas</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Costo unit.</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.purchased_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="font-medium">{r.products?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.supplier || "—"}</TableCell>
                  <TableCell className="text-right">{fmtNumber(r.quantity)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.unit_cost)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Producto</Label>
              <Select value={form.product_id} onValueChange={(v) => {
                const p = products.find((x) => x.id === v);
                setForm({ ...form, product_id: v, unit_cost: p ? String(p.unit_cost) : form.unit_cost });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><Label>Costo unit.</Label><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
            </div>
            <div><Label>Proveedor</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Opcional" /></div>
            <Button variant="hero" className="w-full" onClick={save}>Registrar compra</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
