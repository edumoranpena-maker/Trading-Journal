// src/hooks/useTrades.js
// ─────────────────────────────────────────────────────────────────────────────
// Hook central de trades. Sin loops de re-fetch.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import * as svc from "../services/tradesService";
import { trackEvent } from "../services/servicesBundle";

export function useTrades(options) {
  // ── Estabilizamos options en un ref desde el primer render ────────────────
  // Si el caller pasa un objeto literal inline ({}), sería nuevo en cada render.
  // Guardarlo en initRef garantiza que nunca cambie la referencia.
  const initRef = useRef(options);
  const useSample = initRef.current?.useSample ?? false;
  const sampleData = initRef.current?.sampleData ?? [];

  const [trades,  setTrades]  = useState(() => useSample ? sampleData : []);
  const [loading, setLoading] = useState(!useSample); // demo arranca listo
  const [error,   setError]   = useState(null);
  const [syncing, setSyncing] = useState(false);

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── fetch con guard de doble ejecución ───────────────────────────────────
  const fetchingRef = useRef(false);

  const reload = useCallback(async () => {
    // Modo demo: no hay red, retornar inmediatamente
    if (useSample) {
      setTrades(sampleData);
      setLoading(false);
      return;
    }
    // Guard: evita llamadas paralelas
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await svc.fetchTrades();
      if (!mounted.current) return;
      if (err) {
        setError(err.message ?? String(err));
      } else {
        setTrades(data ?? []);
      }
    } catch (e) {
      if (mounted.current) setError(String(e));
    } finally {
      if (mounted.current) setLoading(false);
      fetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // sin dependencias — useSample/sampleData vienen del ref estable

  // Solo se ejecuta UNA vez al montar
  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CREATE ────────────────────────────────────────────────────────────────
  const addTrade = useCallback(async (tradeData) => {
    if (useSample) {
      const fake = {
        ...tradeData,
        id:         `local-${Date.now()}`,
        pnl:        parseFloat((tradeData.rr * tradeData.capital).toFixed(2)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setTrades(prev => [fake, ...prev]);
      return { data: fake, error: null };
    }
    setSyncing(true);
    const { data, error: err } = await svc.createTrade(tradeData);
    setSyncing(false);
    if (err) return { data: null, error: err.message ?? String(err) };
    if (mounted.current) setTrades(prev => [data, ...prev]);
    trackEvent("trade_added", { setup: data.setup, rr: data.rr, pair: data.pair });
    return { data, error: null };
  }, []); // eslint-disable-line

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const updateTrade = useCallback(async (id, updates) => {
    if (useSample) {
      setTrades(prev => prev.map(t =>
        t.id === id
          ? { ...t, ...updates, pnl: parseFloat((updates.rr * updates.capital).toFixed(2)) }
          : t
      ));
      return { error: null };
    }
    setSyncing(true);
    const { data, error: err } = await svc.updateTrade(id, updates);
    setSyncing(false);
    if (err) return { error: err.message ?? String(err) };
    if (mounted.current) setTrades(prev => prev.map(t => t.id === id ? data : t));
    trackEvent("trade_updated", { id });
    return { error: null };
  }, []); // eslint-disable-line

  // ── DELETE ────────────────────────────────────────────────────────────────
  const deleteTrade = useCallback(async (id) => {
    if (useSample) {
      setTrades(prev => prev.filter(t => t.id !== id));
      return { error: null };
    }
    setTrades(prev => prev.filter(t => t.id !== id)); // optimista
    const { error: err } = await svc.deleteTrade(id);
    if (err) {
      // rollback: recargar sin disparar loop (reload tiene guard)
      reload();
      return { error: err.message ?? String(err) };
    }
    trackEvent("trade_deleted", { id });
    return { error: null };
  }, [reload]);

  // ── SEED ──────────────────────────────────────────────────────────────────
  const seedFromSample = useCallback(async (samples) => {
    if (useSample) return { error: "No disponible en modo demo" };
    setLoading(true);
    const { data, error: err } = await svc.bulkCreateTrades(samples);
    if (!mounted.current) return { error: null };
    if (err) { setError(err.message ?? String(err)); setLoading(false); return { error: err.message }; }
    setTrades(data ?? []);
    setLoading(false);
    return { data, error: null };
  }, []); // eslint-disable-line

  return {
    trades, loading, error, syncing,
    reload, addTrade, updateTrade, deleteTrade, seedFromSample,
    isEmpty:  !loading && trades.length === 0,
    hasError: !!error,
  };
}
