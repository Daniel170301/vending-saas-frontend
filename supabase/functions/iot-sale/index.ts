import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "@supabase/supabase-js";

// IoT ingest endpoint — devices POST sales using their device_token
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing device token" }, 401);

    const body = await req.json().catch(() => ({}));
    const product_id: string | null = body.product_id ?? null;
    const quantity: number = Number(body.quantity ?? 1);
    const unit_price: number = Number(body.unit_price ?? 0);

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      return json({ error: "invalid quantity" }, 400);
    }
    if (!Number.isFinite(unit_price) || unit_price <= 0 || unit_price > 100000) {
      return json({ error: "invalid unit_price" }, 400);
    }
    if (product_id !== null && typeof product_id !== "string") {
      return json({ error: "invalid product_id" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: device, error: dErr } = await admin.from("devices")
      .select("id, user_id, machine_id").eq("device_token", token).maybeSingle();
    if (dErr || !device) return json({ error: "Invalid device token" }, 401);

    let unit_cost = 0;
    if (product_id) {
      const { data: prod } = await admin.from("products")
        .select("unit_cost")
        .eq("id", product_id)
        .eq("user_id", device.user_id)
        .maybeSingle();
      if (!prod) return json({ error: "invalid product_id" }, 400);
      unit_cost = Number(prod?.unit_cost || 0);
    }

    const total = quantity * unit_price;
    const { error: sErr } = await admin.from("sales").insert({
      user_id: device.user_id, machine_id: device.machine_id, product_id,
      quantity, unit_price, unit_cost, total, source: "iot",
    });
    if (sErr) return json({ error: sErr.message }, 500);

    const { data: m } = await admin.from("machines").select("coin_current").eq("id", device.machine_id).maybeSingle();
    await admin.from("machines").update({ coin_current: Number(m?.coin_current || 0) + total }).eq("id", device.machine_id);
    await admin.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
