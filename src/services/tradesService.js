// src/services/tradesService.js
// ─────────────────────────────────────────────────────────────────────────────
// Toda la comunicación con Supabase para la tabla `trades`.
// Los hooks y componentes NUNCA tocan supabase directamente.
// Retorna siempre { data, error } para manejo uniforme.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "../lib/supabaseClient";

const TABLE = "trades";

// ── Normalización ────────────────────────────────────────────────────────────
// Convierte la fila de Supabase (snake_case) al shape que usa la UI.
function normalize(row) {
  return {
    id:            row.id,
    date:          row.date,                      // "YYYY-MM-DD" — string puro, sin parsear
    hora:          row.hora          ?? "",
    pair:          row.pair,
    mercado:       row.mercado,
    sesion:        row.sesion,
    capital:       parseFloat(row.capital),
    rr:            parseFloat(row.rr),
    pnl:           parseFloat(row.pnl),
    setup:         row.setup,
    ejecutado:     row.ejecutado,
    validez:       row.validez,
    confluencias:  row.confluencias  ?? [],
    estado_mental: row.estado_mental ?? "",
    link:          row.link          ?? "",
    notas:         row.notas         ?? "",
    tags:          row.tags          ?? [],
    created_at:    row.created_at,
    updated_at:    row.updated_at,
  };
}

// Prepara el payload para Supabase desde el shape de la UI.
function toPayload(trade) {
  const capital = parseFloat(trade.capital);
  const rr      = parseFloat(trade.rr);
  return {
    date:          trade.date,
    hora:          trade.hora          || null,
    pair:          trade.pair,
    mercado:       trade.mercado,
    sesion:        trade.sesion,
    capital,
    rr,
    // PnL se recalcula aquí para evitar inconsistencias desde la UI
    pnl:           parseFloat((rr * capital).toFixed(2)),
    setup:         trade.setup,
    ejecutado:     Boolean(trade.ejecutado),
    validez:       Number(trade.validez),
    confluencias:  trade.confluencias  ?? [],
    estado_mental: trade.estado_mental || null,
    link:          trade.link          || null,
    notas:         trade.notas         || null,
    tags:          trade.tags          ?? [],
  };
}

// ── READ ─────────────────────────────────────────────────────────────────────

/**
 * Carga todos los trades, con filtros opcionales.
 * @param {{ pair?, setup?, mercado?, sesion?, from?, to? }} filters
 */
export async function fetchTrades(filters = {}) {
  let q = supabase
    .from(TABLE)
    .select("*")
    .order("date", { ascending: false })
    .order("hora", { ascending: false, nullsFirst: false });

  if (filters.pair)    q = q.ilike("pair",    `%${filters.pair}%`);
  if (filters.setup)   q = q.eq("setup",      filters.setup);
  if (filters.mercado) q = q.eq("mercado",    filters.mercado);
  if (filters.sesion)  q = q.eq("sesion",     filters.sesion);
  if (filters.from)    q = q.gte("date",      filters.from);
  if (filters.to)      q = q.lte("date",      filters.to);

  const { data, error } = await q;
  if (error) return { data: null, error };
  return { data: data.map(normalize), error: null };
}

export async function fetchTradeById(id) {
  const { data, error } = await supabase
    .from(TABLE).select("*").eq("id", id).single();
  if (error) return { data: null, error };
  return { data: normalize(data), error: null };
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createTrade(tradeData) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(toPayload(tradeData))
    .select()
    .single();
  if (error) return { data: null, error };
  return { data: normalize(data), error: null };
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateTrade(id, updates) {
  const payload = toPayload(updates);
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error };
  return { data: normalize(data), error: null };
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteTrade(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  return { error };
}

export async function deleteTrades(ids) {
  const { error } = await supabase.from(TABLE).delete().in("id", ids);
  return { error };
}

// ── BULK INSERT (migración de datos de muestra) ───────────────────────────────

export async function bulkCreateTrades(tradesArray) {
  const payloads = tradesArray.map(toPayload);
  const { data, error } = await supabase
    .from(TABLE).insert(payloads).select();
  if (error) return { data: null, error };
  return { data: data.map(normalize), error: null };
}
