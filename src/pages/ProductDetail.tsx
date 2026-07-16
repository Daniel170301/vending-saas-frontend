import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { ArrowLeft, Camera, ImagePlus, Package, Trash2, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string; parent_id: string | null };

const UNIT_TYPES = ["unidad", "caja", "paquete", "docena", "kilo", "gramo", "litro", "ml", "metro"];

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    const [{ data: p }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (!p) { toast.error("Producto no encontrado"); navigate("/app/products"); return; }
    const f = {
      name: p.name,
      category: p.category || "",
      subcategory: p.subcategory || "",
      unit_cost: String(p.unit_cost),
      sale_price: String(p.sale_price ?? 0),
      stock_warehouse: String(p.stock_warehouse),
      min_stock: String(p.min_stock ?? 0),
      sku: p.sku || "",
      barcode: p.barcode || "",
      image_url: p.image_url || "",
      unit_type: (p as any).unit_type || "unidad",
    };
    setForm(f);
    setOriginal(p);
    setCategories((cats as any) || []);
    setLoading(false);
  };

  useEffect(() => { document.title = "Producto · InventaXo"; load(); }, [id]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) return toast.error(error.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((prev: any) => ({ ...prev, image_url: data.publicUrl }));
      toast.success("Imagen cargada");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const payload: any = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      subcategory: form.subcategory.trim() || null,
      unit_cost: parseFloat(form.unit_cost) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_warehouse: parseInt(form.stock_warehouse) || 0,
      min_stock: parseInt(form.min_stock) || 0,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      image_url: form.image_url || null,
      unit_type: form.unit_type || "unidad",
    };
    const { error } = await supabase.from("products").update(payload).eq("id", id!);
    if (error) return toast.error(error.message);
    toast.success("Actualizado");
    setEditMode(false);
    load();
  };

  const remove = async () => {
    if (!confirm("¿Eliminar producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id!);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    navigate("/app/products");
  };

  if (loading || !form) {
    return <div className="container py-8"><div className="text-muted-foreground">Cargando...</div></div>;
  }

  const parentCats = categories.filter((c) => !c.parent_id);
  const selectedParent = parentCats.find((c) => c.name === form.category);
  const subCats = selectedParent ? categories.filter((c) => c.parent_id === selectedParent.id) : [];
  const low = (parseInt(form.stock_warehouse) || 0) <= (parseInt(form.min_stock) || 0);
  const inventoryValue = (parseFloat(form.unit_cost) || 0) * (parseInt(form.stock_warehouse) || 0);

  return (
    <div className="container py-8 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/products")} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />Volver
      </Button>

      <PageHeader
        title={original?.name || "Producto"}
        description="Detalle del producto"
        actions={
          editMode ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditMode(false); load(); }}>Cancelar</Button>
              <Button variant="hero" onClick={save}><Save className="h-4 w-4 mr-1" />Guardar</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={remove}><Trash2 className="h-4 w-4 mr-1 text-destructive" />Eliminar</Button>
              <Button variant="hero" onClick={() => setEditMode(true)}>Editar</Button>
            </div>
          )
        }
      />

      {!editMode ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              {form.image_url ? (
                <img src={form.image_url} alt={form.name} className="h-full w-full object-contain" />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{form.name}</h2>
                {(form.category || form.subcategory) && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {form.category}{form.subcategory ? ` / ${form.subcategory}` : ""}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Precio de venta</div>
                  <div className="text-xl font-bold text-primary">{fmtMoney(form.sale_price)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Precio de compra</div>
                  <div className="text-xl font-bold">{fmtMoney(form.unit_cost)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Stock disponible</div>
                  <div className="text-xl font-bold flex items-center gap-2">
                    {fmtNumber(form.stock_warehouse)} <span className="text-sm font-normal text-muted-foreground">{form.unit_type}</span>
                    {low && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Bajo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Mínimo: {fmtNumber(form.min_stock)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Valor en inventario</div>
                  <div className="text-xl font-bold">{fmtMoney(inventoryValue)}</div>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">SKU</div>
                  <div>{form.sku || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Código de barras</div>
                  <div>{form.barcode || "—"}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
              {form.image_url ? (
                <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Label>Imagen</Label>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" className="mt-1" disabled={uploading} onClick={() => imgInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-1" />{uploading ? "Subiendo..." : "Cambiar imagen"}
              </Button>
            </div>
          </div>

          <div>
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label>Código de barras</Label>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <input
                  ref={barcodeInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={() => toast.info("Foto capturada")}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => barcodeInputRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Precio de compra</Label>
              <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </div>
            <div>
              <Label>Precio de venta</Label>
              <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label>Cantidad disponible</Label>
              <Input type="number" value={form.stock_warehouse} onChange={(e) => setForm({ ...form, stock_warehouse: e.target.value })} />
            </div>
            <div>
              <Label>Cantidad mínima</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de unidad</Label>
              <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {parentCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategoría</Label>
              <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })} disabled={!selectedParent}>
                <SelectTrigger><SelectValue placeholder={selectedParent ? "Seleccionar" : "Elige categoría"} /></SelectTrigger>
                <SelectContent>
                  {subCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProductDetail;
