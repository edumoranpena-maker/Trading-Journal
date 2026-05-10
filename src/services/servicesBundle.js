// src/services/sessionsService.js
import { supabase } from "../lib/supabaseClient";
const T = "trading_sessions";

export async function fetchSessions({ from, to } = {}) {
  let q = supabase.from(T).select("*").order("date", { ascending: false });
  if (from) q = q.gte("date", from);
  if (to)   q = q.lte("date", to);
  return await q;
}

export async function fetchSessionByDate(date) {
  const { data, error } = await supabase.from(T).select("*").eq("date", date).maybeSingle();
  return { data, error };
}

/** Crea o actualiza la sesión del día (upsert por date). */
export async function upsertSession(session) {
  const { data, error } = await supabase
    .from(T)
    .upsert({
      date:               session.date,
      mercado_bias:       session.mercado_bias       ?? null,
      notas_pre:          session.notas_pre          ?? null,
      notas_post:         session.notas_post         ?? null,
      estado_mental:      session.estado_mental      ?? null,
      nivel_disciplina:   session.nivel_disciplina   ?? null,
      setups_vistos:      session.setups_vistos      ?? 0,
      setups_ejecutados:  session.setups_ejecutados  ?? 0,
    }, { onConflict: "date" })
    .select().single();
  return { data, error };
}

export async function deleteSession(id) {
  return await supabase.from(T).delete().eq("id", id);
}


// ─── Objectives ──────────────────────────────────────────────────────────────
// src/services/objectivesService.js  (exportado desde este mismo archivo)
const OT = "objectives";

export async function fetchObjectives({ activo = true } = {}) {
  let q = supabase.from(OT).select("*").order("periodo", { ascending: false });
  if (activo !== undefined) q = q.eq("activo", activo);
  return await q;
}

export async function upsertObjective(obj) {
  const { data, error } = await supabase
    .from(OT)
    .upsert({
      periodo:         obj.periodo,
      tipo_periodo:    obj.tipo_periodo,
      win_rate_target: obj.win_rate_target ?? null,
      r_target:        obj.r_target        ?? null,
      pnl_target:      obj.pnl_target      ?? null,
      max_trades:      obj.max_trades      ?? null,
      max_dd_target:   obj.max_dd_target   ?? null,
      notas:           obj.notas           ?? null,
      activo:          true,
    }, { onConflict: "periodo,tipo_periodo" })
    .select().single();
  return { data, error };
}

export async function deleteObjective(id) {
  return await supabase.from(OT).delete().eq("id", id);
}


// ─── Config ──────────────────────────────────────────────────────────────────
const CT = "user_config";

/** Devuelve toda la config como objeto plano { clave: valor } */
export async function fetchConfig() {
  const { data, error } = await supabase.from(CT).select("clave, valor");
  if (error) return { data: null, error };
  const config = Object.fromEntries(data.map(({ clave, valor }) => [clave, valor]));
  return { data: config, error: null };
}

export async function setConfig(clave, valor) {
  return await supabase
    .from(CT)
    .upsert({ clave, valor }, { onConflict: "clave" })
    .select().single();
}

export async function bulkSetConfig(updates) {
  const rows = Object.entries(updates).map(([clave, valor]) => ({ clave, valor }));
  return await supabase.from(CT).upsert(rows, { onConflict: "clave" }).select();
}


// ─── Analytics ───────────────────────────────────────────────────────────────
const AT = "analytics_events";

/** Fire-and-forget: registra un evento sin bloquear la UI. */
export function trackEvent(evento, payload = {}) {
  supabase.from(AT).insert({ evento, payload }).then();
}

export async function fetchEvents({ evento, limit = 100 } = {}) {
  let q = supabase.from(AT).select("*").order("created_at", { ascending: false }).limit(limit);
  if (evento) q = q.eq("evento", evento);
  return await q;
}
