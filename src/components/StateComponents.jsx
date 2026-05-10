// src/components/StateComponents.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Componentes de estado reutilizables: loading, error, vacío, sincronización.
// ─────────────────────────────────────────────────────────────────────────────

const G = {
  bg:"#07080c", surface:"#0d0f16", surfaceAlt:"#11141d",
  border:"#1a1f2e", accent:"#00c896", accentDim:"rgba(0,200,150,0.10)",
  red:"#f04060", redDim:"rgba(240,64,96,0.10)",
  textPrimary:"#d4d9e8", textSec:"#5e6880", textMuted:"#282f42",
  fontMono:"'DM Mono', monospace", fontDisplay:"'Syne', sans-serif",
};

export function LoadingState({ message = "Cargando datos..." }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"56px 0", gap:16 }}>
      <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${G.border}`, borderTopColor:G.accent, animation:"spin 0.8s linear infinite" }}/>
      <span style={{ fontSize:11, color:G.textSec, fontFamily:G.fontMono }}>{message}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ background:G.redDim, border:`1px solid ${G.red}44`, borderRadius:10, padding:"20px 22px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <span style={{ fontSize:16 }}>⚠️</span>
        <span style={{ fontSize:12, fontWeight:600, color:G.red, fontFamily:G.fontDisplay }}>Error de conexión</span>
      </div>
      <p style={{ fontSize:11, color:G.textSec, fontFamily:G.fontMono, marginBottom:onRetry ? 12 : 0 }}>
        {message || "No se pudieron cargar los datos. Verifica tu conexión a Supabase."}
      </p>
      {onRetry && (
        <button onClick={onRetry} style={{ background:"none", border:`1px solid ${G.red}66`, color:G.red, borderRadius:6, padding:"7px 16px", cursor:"pointer", fontSize:11, fontFamily:G.fontMono }}>
          ↻ Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = "No hay trades registrados." }) {
  return (
    <div style={{ textAlign:"center", padding:"56px 0", color:G.textMuted, fontSize:12, fontFamily:G.fontMono }}>
      <div style={{ fontSize:32, marginBottom:12, opacity:0.3 }}>📭</div>
      {message}
    </div>
  );
}

/** Pequeño badge que aparece en el nav cuando hay sincronización en progreso */
export function SyncBadge({ syncing, error }) {
  if (!syncing && !error) return null;
  return (
    <span style={{ fontSize:9, fontFamily:G.fontMono, color:error ? G.red : G.textSec, display:"inline-flex", alignItems:"center", gap:5 }}>
      {syncing && <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", border:`1.5px solid ${G.border}`, borderTopColor:G.accent, animation:"spin 0.8s linear infinite" }}/>}
      {syncing ? "Guardando..." : `Error: ${error}`}
    </span>
  );
}
