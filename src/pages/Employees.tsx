import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";

type Employee = { id: string; name: string; active: boolean };

const Employees = () => {
  const [list, setList] = useState<Employee[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { document.title = "Empleados · Kymez App"; load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("employees").select("id, name, active").order("name");
    setList((data as any) || []);
  };

  const add = async () => {
    if (!name.trim()) return toast.error("Nombre requerido");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("employees").insert({ user_id: user.id, name: name.trim() });
    if (error) return toast.error(error.message);
    setName(""); load();
  };

  const toggle = async (e: Employee) => {
    await supabase.from("employees").update({ active: !e.active }).eq("id", e.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar empleado?")) return;
    await supabase.from("employees").delete().eq("id", id);
    load();
  };

  return (
    <div className="container py-8">
      <PageHeader title="Empleados" description="Administra quién registra cada venta o gasto" />
      <Card className="p-3 mb-4 flex gap-2">
        <Input placeholder="Nombre del empleado" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </Card>
      {list.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Sin empleados todavía
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((e) => (
            <Card key={e.id} className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"><User className="h-4 w-4" /></div>
              <div className="flex-1 font-medium">{e.name}</div>
              <Switch checked={e.active} onCheckedChange={() => toggle(e)} />
              <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Employees;
