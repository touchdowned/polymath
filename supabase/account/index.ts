// PolyMath accounts: username sign-up, email verification and password reset for username accounts.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE = "https://polymath-liard.vercel.app";
const DOMAIN = "@users.polymath.invalid";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const since = (min: number) => new Date(Date.now() - min * 60e3).toISOString();
const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 200 && !e.endsWith(DOMAIN);
const RESERVED = new Set(["admin", "polymath", "support", "root", "system", "moderator", "anthropic", "claude"]);

async function sendLink(email: string, origin: string) {
  const r = await fetch(URL_ + "/auth/v1/otp?redirect_to=" + encodeURIComponent(origin + "/"), {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, create_user: true }),
  });
  if (!r.ok) { let m = ""; try { const j = await r.json(); m = j.msg || j.message || j.error_description || ""; } catch {} throw new Error(/rate|seconds/i.test(m) ? "PolyMath has sent too many emails this hour. Try again later." : (m || "Could not send the email.")); }
}
async function userFrom(req: Request) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t || t === ANON) return null;
  const { data } = await admin.auth.getUser(t); return data?.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  let b: any; try { b = await req.json(); } catch { return fail("Bad request"); }
  const origin = /^https:\/\/polymath-liard\.vercel\.app$|^http:\/\/localhost(:\d+)?$/.test(String(b.origin || "")) ? b.origin : SITE;
  try {
    if (b.action === "signup") {
      const u = String(b.username || "").trim().toLowerCase(), pw = String(b.password || "");
      if (!/^[a-z0-9_]{3,20}$/.test(u)) return fail("Usernames are 3 to 20 letters, numbers or _ (no spaces).");
      if (RESERVED.has(u)) return fail("That username is taken. Try another.");
      if (pw.length < 8) return fail("Use a password of at least 8 characters.");
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
      const { count } = await admin.from("signup_log").select("*", { count: "exact", head: true }).eq("ip", ip).gte("at", since(60));
      if ((count || 0) >= 40) return fail("Too many new accounts from this network. Try again in an hour.", 429);   // a whole school shares one network address
      const { data: taken } = await admin.from("usernames").select("user_id").eq("username", u).maybeSingle();
      if (taken) return fail("That username is taken. Try another.");
      const { data, error } = await admin.auth.admin.createUser({ email: u + DOMAIN, password: pw, email_confirm: true, user_metadata: { username: u } });
      if (error || !data?.user) return fail(/already|exists|registered/i.test(error?.message || "") ? "That username is taken. Try another." : (error?.message || "Could not create the account."));
      const { error: e2 } = await admin.from("usernames").insert({ username: u, user_id: data.user.id });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return fail("That username is taken. Try another."); }
      await admin.from("signup_log").insert({ ip });
      return json({ ok: true, email: u + DOMAIN });
    }

    if (b.action === "guest") {   // 1v1 only, never rated: a throwaway account with a random name and password
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
      const { count } = await admin.from("signup_log").select("*", { count: "exact", head: true }).eq("ip", "g:" + ip).gte("at", since(60));
      if ((count || 0) >= 120) return fail("Too many guests from this network. Try again in an hour.", 429);
      const tag = Array.from(crypto.getRandomValues(new Uint8Array(5))).map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 8);
      const email = "guest_" + tag + DOMAIN, password = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { guest: true } });
      if (error || !data?.user) return fail(error?.message || "Could not start a guest session.");
      await admin.from("player_profiles").insert({ user_id: data.user.id, name: "Guest " + (1000 + Math.floor(Math.random() * 9000)), is_guest: true });
      await admin.from("signup_log").insert({ ip: "g:" + ip });
      return json({ ok: true, email, password });
    }

    if (b.action === "status") {
      const me = await userFrom(req); if (!me) return fail("Sign in again.", 401);
      const isName = (me.email || "").endsWith(DOMAIN);
      const { data: ae } = await admin.from("account_emails").select("email").eq("user_id", me.id).maybeSingle();
      return json({ username: isName ? me.email!.slice(0, -DOMAIN.length) : null, email: isName ? (ae?.email || null) : me.email, verified: !isName || !!ae });
    }

    if (b.action === "verify_start") {
      const me = await userFrom(req); if (!me) return fail("Sign in again.", 401);
      const email = String(b.email || "").trim().toLowerCase(); if (!okEmail(email)) return fail("Enter a real email address.");
      const { count } = await admin.from("email_pending").select("*", { count: "exact", head: true }).eq("user_id", me.id).gte("created_at", since(60));
      if ((count || 0) >= 5) return fail("Too many tries. Wait an hour and try again.", 429);
      await admin.from("email_pending").insert({ user_id: me.id, email, purpose: "verify" });
      await sendLink(email, origin);
      return json({ ok: true });
    }

    if (b.action === "reset_start") {
      const u = String(b.username || "").trim().toLowerCase();
      const { data: un } = await admin.from("usernames").select("user_id").eq("username", u).maybeSingle();
      const { data: ae } = un ? await admin.from("account_emails").select("email").eq("user_id", un.user_id).maybeSingle() : { data: null };
      if (!un || !ae) return fail("No verified email is linked to that username, so the password can't be reset.");
      const { count } = await admin.from("email_pending").select("*", { count: "exact", head: true }).eq("user_id", un.user_id).eq("purpose", "reset").gte("created_at", since(60));
      if ((count || 0) >= 3) return fail("Too many reset emails. Wait an hour and try again.", 429);
      await admin.from("email_pending").insert({ user_id: un.user_id, email: ae.email, purpose: "reset" });
      await sendLink(ae.email, origin);
      const [n, d] = ae.email.split("@");
      return json({ ok: true, hint: n.slice(0, 2) + "•••@" + d });
    }

    if (b.action === "finish") {   // the email link landed: prove the address, then clean up the sign-in it created
      const { data: td } = await admin.auth.getUser(String(b.access_token || ""));
      const t = td?.user; if (!t || !t.email) return fail("This link is no longer valid. Send a new one.");
      const email = t.email.toLowerCase();
      const { data: p } = await admin.from("email_pending").select("*").eq("email", email).eq("used", false).gte("created_at", since(60)).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!p) return fail("This link has expired. Send a new one from PolyMath.", 404);
      const temp = t.id !== p.user_id && new Date(t.created_at).getTime() >= new Date(p.created_at).getTime() - 5000;
      if (temp) await admin.auth.admin.deleteUser(t.id);
      if (p.purpose === "verify") {
        await admin.from("email_pending").update({ used: true }).eq("id", p.id);
        const { error } = await admin.from("account_emails").upsert({ user_id: p.user_id, email, verified_at: new Date().toISOString() });
        if (error) return fail(error.message, 500);
        return json({ ok: true, verified: email });
      }
      const ticket = crypto.randomUUID() + crypto.randomUUID();
      await admin.from("email_pending").update({ used: true, ticket }).eq("id", p.id);
      const { data: un } = await admin.from("usernames").select("username").eq("user_id", p.user_id).maybeSingle();
      return json({ ok: true, reset: ticket, username: un?.username || "" });
    }

    if (b.action === "reset_finish") {
      const pw = String(b.password || ""); if (pw.length < 8) return fail("Use a password of at least 8 characters.");
      const { data: p } = await admin.from("email_pending").select("*").eq("ticket", String(b.ticket || "x")).eq("purpose", "reset").gte("created_at", since(60)).maybeSingle();
      if (!p) return fail("This reset has expired. Start again.");
      const { error } = await admin.auth.admin.updateUserById(p.user_id, { password: pw });
      if (error) return fail(error.message, 500);
      await admin.from("email_pending").update({ ticket: null }).eq("id", p.id);
      const { data: un } = await admin.from("usernames").select("username").eq("user_id", p.user_id).maybeSingle();
      return json({ ok: true, username: un?.username || "" });
    }
    return fail("Unknown action");
  } catch (e) { return fail(String((e as Error).message || e), 500); }
});
