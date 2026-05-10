// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Singleton del cliente Supabase.
// REGLA: importar `supabase` SOLO desde aquí.
// Nunca instanciar createClient directamente en componentes o hooks.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "[TradePulse] Variables de entorno faltantes.\n" +
    "Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Sin login activo por ahora. Cuando agregues auth:
    // persistSession: true, autoRefreshToken: true
    persistSession: false,
    autoRefreshToken: false,
  },
  db:     { schema: "public" },
  global: { headers: { "x-app-name": "tradepulse-journal-pro" } },
});
