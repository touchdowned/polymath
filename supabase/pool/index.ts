// PolyMath 1v1 pool: shares a player's uploaded SAT question bank (pictures + official answer keys) after they agree,
// and removes everything they shared when they take it back.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const filePath = (uid: string, k: string) => uid + "/" + encodeURIComponent(k).replace(/%/g, "_") + ".txt";   // same naming as the web app
const RATING: Record<string, number> = { easy: 85, medium: 100, hard: 115 };
const LEVEL: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

async function copy(src: string, dst: string) {
  const r = await fetch(URL_ + "/storage/v1/object/copy", { method: "POST", headers: { apikey: SERVICE, authorization: "Bearer " + SERVICE, "content-type": "application/json" },
    body: JSON.stringify({ bucketId: "userdata", sourceKey: src, destinationKey: dst, destinationBucket: "pool" }) });
  if (r.ok) return true;
  const t = await r.text(); return /exists|Duplicate/i.test(t);   // already there from an earlier try
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Sign in again." }, 401);
  const uid = u.user.id;
  let b: any; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  if (b.action === "share_sat") {
    const bank = String(b.bank || "");
    if (!/^sat_[a-z0-9]+$/i.test(bank)) return json({ error: "Unknown question bank." }, 400);
    const { data: row } = await admin.from("kv").select("value").eq("user_id", uid).eq("key", "sat:" + bank).maybeSingle();
    const all: any[] = (row?.value?.questions || []).filter((q: any) => q && q.id && q.answer && (q.type === "mc" || q.type === "spr"));
    if (!row) return json({ error: "That question bank isn't saved to your account yet. Open PolyMath on the device you added it from." }, 404);
    const off = Math.max(0, +b.offset || 0), lim = Math.min(120, Math.max(1, +b.limit || 100));
    const part = all.slice(off, off + lim);
    const { count: mine } = await admin.from("pool_questions").select("*", { count: "exact", head: true }).eq("owner", uid);
    if ((mine || 0) > 6000) return json({ error: "Sharing limit reached." }, 400);
    const srcOf = (q: any) => q.label && /^[A-Za-z0-9_-]{4,40}$/.test(q.label) ? "cb:" + q.label : "u:" + uid + ":" + q.id;
    const { data: have } = await admin.from("pool_questions").select("src").eq("kind", "sat").in("src", part.map(srcOf));
    const seen = new Set((have || []).map((x: any) => x.src));
    let added = 0, skipped = 0, missing = 0;
    const todo = part.filter((q) => { const s = srcOf(q); if (seen.has(s)) { skipped++; return false; } seen.add(s); return true; });
    for (let i = 0; i < todo.length; i += 10) {
      const rows: any[] = [];
      await Promise.all(todo.slice(i, i + 10).map(async (q) => {
        const src = srcOf(q), dst = "sat/" + src.replace(/[^A-Za-z0-9_-]/g, "_") + ".txt";
        if (!(await copy(filePath(uid, "satimg:" + q.id), dst))) { missing++; return; }
        const mc = q.type === "mc", letter = String(q.answer).toUpperCase().replace(/[^A-D]/g, "");
        if (mc && !letter) { missing++; return; }
        const d = String(q.difficulty || "medium").toLowerCase();
        rows.push({ owner: uid, kind: "sat", src, img: dst, qtype: q.type, subject: q.subject === "rw" ? "rw" : "math", cat: q.subject === "rw" ? "english" : "math",
          title: "SAT " + (q.subject === "rw" ? "Reading and Writing" : "Math"),
          q: ("SAT " + (q.subject === "rw" ? "Reading and Writing" : "Math") + (q.skill ? " · " + q.skill : "")).slice(0, 200),
          choices: mc ? ["A", "B", "C", "D"] : [], answer: mc ? "ABCD".indexOf(letter[0]) : 0, ans_text: mc ? null : String(q.answer).slice(0, 80),
          level: LEVEL[d] || 2, rating: RATING[d] || 100, explain: q.skill ? "Skill: " + q.skill + "." : "" });
      }));
      if (rows.length) { const { error } = await admin.from("pool_questions").insert(rows); if (error) return json({ error: error.message }, 500); added += rows.length; }
    }
    const next = off + part.length;
    return json({ ok: true, added, skipped, missing, next, total: all.length, done: next >= all.length });
  }

  if (b.action === "unshare_all") {   // take back everything this player shared, pictures included
    const { data: imgs } = await admin.from("pool_questions").select("img").eq("owner", uid).not("img", "is", null);
    const paths = (imgs || []).map((x: any) => x.img);
    for (let i = 0; i < paths.length; i += 500) await admin.storage.from("pool").remove(paths.slice(i, i + 500));
    const { error } = await admin.from("pool_questions").delete().eq("owner", uid);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, removed: paths.length });
  }
  return json({ error: "Unknown action" }, 400);
});
