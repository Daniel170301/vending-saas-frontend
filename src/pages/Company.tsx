import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { CURRENCY_OPTIONS, setMoneyCurrency } from "@/lib/format";

const DOC_TYPES = ["DNI", "RUC", "CE", "Pasaporte", "NIT", "RFC", "CUIT", "CC", "Otro"];
const BUSINESS_TYPES = [
  { v: "vending_machine", l: "Vending Machine" },
  { v: "tienda", l: "Tienda / Retail" },
  { v: "restaurante", l: "Restaurante" },
  { v: "servicios", l: "Servicios" },
  { v: "otro", l: "Otro" },
];

const Company = () => {
  const [form, setForm] = useState({
    id: "" as string | null,
    business_name: "",
    legal_name: "",
    doc_type: "RUC",
    doc_number: "",
    address: "",
    phone: "",
    email: "",
    currency: "PEN",
    business_type: "vending_machine",
    logo_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Mi empresa · Kymez App";
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await (supabase as any).from("company_profile").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setForm({
          id: data.id,
          business_name: data.business_name || "",
          legal_name: data.legal_name || "",
          doc_type: data.doc_type || "RUC",
          doc_number: data.doc_number || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          currency: data.currency || "PEN",
          business_type: data.business_type || "vending_machine",
          logo_url: data.logo_url || "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!form.business_name.trim()) return toast.error("Ingresa el nombre comercial");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload: any = {
        user_id: user.id,
        business_name: form.business_name.trim(),
        legal_name: form.legal_name.trim() || null,
        doc_type: form.doc_type || null,
        doc_number: form.doc_number.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        currency: form.currency,
        business_type: form.business_type,
        logo_url: form.logo_url.trim() || null,
      };
      if (form.id) {
        const { error } = await (supabase as any).from("company_profile").update(payload).eq("id", form.id);
        if (error) return toast.error(error.message);
      } else {
        const { data, error } = await (supabase as any).from("company_profile").insert(payload).select("id").single();
        if (error) return toast.error(error.message);
        setForm((f) => ({ ...f, id: (data as any).id }));
      }
      setMoneyCurrency(form.currency);
      toast.success("Empresa guardada");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="container py-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="container py-8 max-w-3xl">
      <PageHeader title="Mi empresa" description="Estos datos aparecerán en tus comprobantes y reemplazarán el nombre por defecto" />
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="h-12 w-12 rounded-xl gradient-gold flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-deep" />
          </div>
          <div>
            <h3 className="font-semibold">Datos del negocio</h3>
            <p className="text-xs text-muted-foreground">Reemplaza “Kymez App” por tu marca</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Nombre comercial *</Label>
            <Input value={form.business_name} maxLength={120}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="Ej: Vendimax" />
          </div>
          <div>
            <Label>Razón social</Label>
            <Input value={form.legal_name} maxLength={160}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              placeholder="Ej: Vendimax SAC" />
          </div>
          <div>
            <Label>Tipo de documento</Label>
            <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número de documento</Label>
            <Input value={form.doc_number} maxLength={20}
              onChange={(e) => setForm({ ...form, doc_number: e.target.value })}
              placeholder="DNI / RUC / NIT" />
          </div>
          <div className="sm:col-span-2">
            <Label>Dirección fiscal</Label>
            <Input value={form.address} maxLength={200}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Av. Principal 123, Lima" />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={form.phone} maxLength={30}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+51 999 999 999" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} maxLength={120}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contacto@empresa.com" />
          </div>
          <div>
            <Label>Moneda de trabajo</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de negocio</Label>
            <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((b) => <SelectItem key={b.v} value={b.v}>{b.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Logo (URL, opcional)</Label>
            <Input value={form.logo_url} maxLength={500}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://…/logo.png" />
          </div>
        </div>

        <Button variant="hero" onClick={save} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando…" : "Guardar empresa"}
        </Button>
      </Card>
    </div>
  );
};

export default Company;
