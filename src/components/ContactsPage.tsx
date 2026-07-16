import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Pencil, Plus, Trash2, Users, Building2, Search } from "lucide-react";
import { toast } from "sonner";

type Contact = {
  id: string; name: string; company: string | null; doc_type: string | null; doc_number: string | null;
  phone: string | null; email: string | null; address: string | null; notes: string | null; active: boolean;
};

type Props = {
  table: "customers" | "suppliers";
  title: string;
  description: string;
  emptyLabel: string;
};

const ContactsPage = ({ table, title, description, emptyLabel }: Props) => {
  const [list, setList] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "", company: "", doc_type: "DNI", doc_number: "", phone: "", email: "", address: "", notes: "",
  });

  const load = async () => {
    const { data } = await (supabase as any).from(table).select("*").order("created_at", { ascending: false });
    setList((data as any) || []);
  };
  useEffect(() => { document.title = `${title} · InventaXo`; load(); /* eslint-disable-next-line */ }, [table]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", company: "", doc_type: "DNI", doc_number: "", phone: "", email: "", address: "", notes: "" });
    setOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name, company: c.company || "", doc_type: c.doc_type || "DNI", doc_number: c.doc_number || "",
      phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("El nombre o razón social es obligatorio");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Correo inválido");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      doc_type: form.doc_type || null,
      doc_number: form.doc_number.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Actualizado");
    } else {
      const { error } = await (supabase as any).from(table).insert({ ...payload, user_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Creado");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  const filtered = list.filter((c) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return (
      c.name.toLowerCase().includes(s) ||
      (c.doc_number || "").toLowerCase().includes(s) ||
      (c.phone || "").toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s)
    );
  });

  const Icon = table === "customers" ? Users : Building2;

  return (
    <div className="container py-8">
      <PageHeader
        title={title}
        description={description}
        actions={<Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre, documento, teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyLabel}</p>
          <Button variant="hero" className="mt-4" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 hover:shadow-soft transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  {c.company && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Building2 className="h-3 w-3" />{c.company}
                    </div>
                  )}
                  {c.doc_number && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">{c.doc_type || "DOC"} · {c.doc_number}</Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} {table === "customers" ? "cliente" : "proveedor"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label>Nombre o razón social *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Comercial XYZ S.A.C." maxLength={150} />
            </div>
            <div>
              <Label>Empresa / Tienda</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Nombre de su negocio (aparecerá en comprobantes)" maxLength={150} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Documento</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="RUC">RUC</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Número</Label>
                <Input value={form.doc_number} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} maxLength={20} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} />
              </div>
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} rows={2} />
            </div>
            <Button variant="hero" className="w-full" onClick={save}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactsPage;
