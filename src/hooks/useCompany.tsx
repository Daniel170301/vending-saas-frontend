import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id: string;
  user_id: string;
  business_name: string;
  legal_name: string | null;
  doc_type: string | null;
  doc_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  business_type: string;
  logo_url: string | null;
};

export const useCompany = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCompany(null); setLoading(false); return; }
    const { data } = await (supabase as any).from("company_profile").select("*").eq("user_id", user.id).maybeSingle();
    setCompany((data as any) || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("company-profile")
      .on("postgres_changes", { event: "*", schema: "public", table: "company_profile" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return { company, loading, reload: load };
};
