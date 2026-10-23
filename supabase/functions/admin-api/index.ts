import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminPassword = Deno.env.get("MAHIGIR_ADMIN_PASSWORD");
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "تنظیمات اصلی سمت سرور ناقص است؛ متغیرهای محیطی تابع را بررسی کن." }, 500);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "درخواست معتبر نیست." }, 400); }

  const action = String(body.action || "");
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    if (action === "create-order") {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token || token === anonKey) return json({ error: "برای ثبت سفارش باید وارد حساب شوی." }, 401);
      const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data: userData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !userData.user) return json({ error: "نشست ورود معتبر نیست؛ دوباره وارد حساب شو." }, 401);

      const p = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
      if (p.user_id !== userData.user.id) return json({ error: "کاربر درخواست با حساب واردشده یکسان نیست." }, 403);
      for (const field of ["recipient", "phone", "city", "address", "postal_code"] as const) {
        if (typeof p[field] !== "string" || !(p[field] as string).trim()) return json({ error: "اطلاعات نشانی کامل نیست." }, 400);
      }
      if (!/^\d{10}$/.test(String(p.postal_code))) return json({ error: "کد پستی باید ۱۰ رقم باشد." }, 400);
      if (!Array.isArray(p.items) || !p.items.length) return json({ error: "سبد خرید خالی است." }, 400);
      // Older Mahigir databases may lack the optional username/shipping_method columns.
      // Retry only for those fields; approval_status and stage_id remain required.
      const orderPayload = { ...p };
      let inserted = await service.from("mahigir_orders").insert(orderPayload).select("id").single();
      const missingColumn = (message: string) => {
        const match = message.match(/column\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+does not exist|Could not find the\s+['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?\s+column/i);
        return match ? (match[1] || match[2] || "") : "";
      };
      for (let attempt = 0; inserted.error && attempt < 2; attempt++) {
        const missing = missingColumn(inserted.error.message || "");
        if (!["username", "shipping_method"].includes(missing) || !(missing in orderPayload)) break;
        delete orderPayload[missing];
        inserted = await service.from("mahigir_orders").insert(orderPayload).select("id").single();
      }
      if (inserted.error) {
        const message = inserted.error.message || "خطای نامشخص پایگاه داده";
        if (/approval_status/i.test(message) && /column|schema cache|Could not find/i.test(message)) {
          return json({ error: "ستون approval_status در جدول mahigir_orders وجود ندارد. ابتدا SQL اصلاح جدول را در Supabase اجرا کن، سپس دوباره سفارش ثبت کن." }, 400);
        }
        return json({ error: "ثبت سفارش در پایگاه داده ناموفق بود: " + message }, 400);
      }
      return json({ ok: true, id: inserted.data.id });
    }

    if (!adminPassword) {
      return json({ error: "رمز مدیریت در تنظیمات تابع تعریف نشده است." }, 500);
    }
    if (String(body.password || "") !== adminPassword) {
      return json({ error: "رمز مدیریت اشتباه است." }, 401);
    }

    if (action === "admin-login") return json({ ok: true });
    if (action === "admin-users") {
      const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) return json({ error: error.message }, 400);
      return json({ users: (data.users || []).map((u) => ({ id: u.id, username: String(u.user_metadata?.username || u.email || ""), display_name: String(u.user_metadata?.display_name || u.user_metadata?.username || u.email || ""), created_at: u.created_at })) });
    }
    if (action === "admin-approve-order") {
      const { error } = await service.from("mahigir_orders").update({ approval_status: "approved" }).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "admin-orders") {
      const { data, error } = await service.from("mahigir_orders").select("*").order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ orders: data || [] });
    }
    if (action === "admin-stages") {
      // Older installations may not have a "position" column. Do not order by it in SQL.
      const { data, error } = await service.from("mahigir_order_stages").select("*");
      if (error) return json({ error: error.message }, 400);
      const defaults = [
        { id: 1, title: "ثبت سفارش", position: 1 }, { id: 2, title: "در حال انجام", position: 2 },
        { id: 3, title: "ارسال به واحد پستی", position: 3 }, { id: 4, title: "ارسال شده", position: 4 },
        { id: 5, title: "تحویل داده شده", position: 5 },
      ];
      const stages = (data || []).map((row, i) => ({
        ...row,
        position: Number(row.position || row.id || i + 1),
      })).sort((a, b) => a.position - b.position);
      return json({ stages: stages.length ? stages : defaults });
    }
    if (action === "admin-save-order") {
      const id = body.id;
      const stage_id = body.stage_id;
      const tracking_code = body.tracking_code || null;
      const { error } = await service.from("mahigir_orders").update({ stage_id, tracking_code }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "admin-rename-stage") {
      const { error } = await service.from("mahigir_order_stages").update({ title: String(body.title || "").trim() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "عملیات ناشناخته است." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "خطای غیرمنتظره سمت سرور" }, 500);
  }
});
