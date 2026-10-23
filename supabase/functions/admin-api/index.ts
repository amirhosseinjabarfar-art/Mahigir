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
      const postalCode = String(p.postal_code).replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      if (!/^\d{10}$/.test(postalCode)) return json({ error: "کد پستی باید ۱۰ رقم باشد." }, 400);
      if (!Array.isArray(p.items) || !p.items.length) return json({ error: "سبد خرید خالی است." }, 400);
      const items = (p.items as Record<string, unknown>[]).map((raw) => {
        const item = raw && typeof raw === "object" ? raw : {};
        return {
          id: String(item.id ?? ""),
          title: String(item.title ?? "کتاب").slice(0, 200),
          price: Math.max(0, Math.round(Number(item.price) || 0)),
          qty: Math.max(1, Math.min(99, Math.round(Number(item.qty) || 1))),
        };
      });
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const shippingCost = 300000;
      const orderPayload = {
        user_id: userData.user.id,
        items,
        subtotal,
        shipping_cost: shippingCost,
        total: subtotal + shippingCost,
        recipient: String(p.recipient).trim(),
        phone: String(p.phone).trim(),
        city: String(p.city).trim(),
        address: String(p.address).trim(),
        postal_code: postalCode,
        shipping_method: "تیپاکس",
        status: "ثبت سفارش",
        tracking_code: "",
        admin_note: "",
        approval_status: "pending_review",
      };
      const inserted = await service.from("mahigir_orders").insert(orderPayload).select("id,order_number").single();
      if (inserted.error) return json({ error: "ثبت سفارش در پایگاه داده ناموفق بود: " + inserted.error.message }, 400);
      return json({ ok: true, id: inserted.data.order_number ?? inserted.data.id });
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
      const stages = (data || []).filter((row) => row.is_active).map((row) => ({
        id: row.id, title: row.stage_name, position: Number(row.stage_order || row.id),
      })).sort((a, b) => a.position - b.position);
      return json({ stages: stages.length ? stages : defaults });
    }
    if (action === "admin-save-order") {
      const { data: stage, error: stageError } = await service.from("mahigir_order_stages")
        .select("stage_name").eq("id", Number(body.stage_id)).maybeSingle();
      if (stageError) return json({ error: stageError.message }, 400);
      if (!stage) return json({ error: "مرحلهٔ انتخاب‌شده پیدا نشد." }, 400);
      const { error } = await service.from("mahigir_orders")
        .update({ status: stage.stage_name, tracking_code: String(body.tracking_code || "") }).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "admin-rename-stage") {
      const { error } = await service.from("mahigir_order_stages").update({ stage_name: String(body.title || "").trim() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "عملیات ناشناخته است." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "خطای غیرمنتظره سمت سرور" }, 500);
  }
});
