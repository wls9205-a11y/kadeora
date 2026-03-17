import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const API_KEY = Deno.env.get("APT_DATA_API_KEY") ?? "";

  const today = new Date().toISOString().slice(0, 10);
  const { data: apts } = await supabase
    .from("apt_subscriptions")
    .select("id, house_nm, rcept_endde")
    .lt("rcept_endde", today)
    .is("competition_rate_1st", null)
    .limit(30);

  let updated = 0;
  const errors: string[] = [];

  for (const apt of apts ?? []) {
    try {
      const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=10&cond%5BHOUSE_MANAGE_NO%3A%3AEQ%5D=${apt.id}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const item = json?.data?.[0];
      if (item) {
        await supabase.from("apt_subscriptions").update({
          competition_rate_1st: parseFloat(item.CMPTT_RATE ?? "0") || null,
          tot_supply_hshld_co: parseInt(item.TOT_SUPLY_HSHLDCO ?? "0") || null,
          competition_updated_at: new Date().toISOString(),
        }).eq("id", apt.id);
        updated++;
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      errors.push(`${apt.house_nm}: ${String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, updated, errors: errors.length, timestamp: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
