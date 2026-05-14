import { useState, useMemo, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MODO DE DATOS
// ─────────────────────────────────────────────────────────────────────────────
// USE_SUPABASE = false  → datos de muestra locales (demo instantáneo, sin BD)
// USE_SUPABASE = true   → Supabase real (requiere schema.sql ejecutado y .env.local)
//
// Para migrar:
//   1. Ejecuta supabase/schema.sql en tu proyecto Supabase
//   2. Pon USE_SUPABASE = true
//   3. Corre: npm run dev
//   4. Click en "Migrar datos de muestra" para poblar la BD
// ─────────────────────────────────────────────────────────────────────────────
const USE_SUPABASE = true;

// Importación condicional del hook — sólo carga Supabase si está activado.
// En modo demo, usamos una implementación local que no toca la red.
import { useTrades } from "./hooks/useTrades";

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  bg:"#07080c", surface:"#0d0f16", surfaceAlt:"#11141d", surfaceHov:"#151926",
  border:"#1a1f2e", borderHov:"#252c3f",
  accent:"#00c896", accentDim:"rgba(0,200,150,0.10)",
  red:"#f04060", redDim:"rgba(240,64,96,0.10)",
  yellow:"#e8b320", yellowDim:"rgba(232,179,32,0.12)",
  blue:"#4f8ef5", blueDim:"rgba(79,142,245,0.10)",
  white:"#e8edf8", textPrimary:"#d4d9e8", textSec:"#5e6880", textMuted:"#282f42",
  fontMono:"'DM Mono', monospace", fontDisplay:"'Syne', sans-serif", fontUI:"'Inter', sans-serif",
};

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@400;500;600;700;800;900&family=Syne:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{background:${G.bg};color:${G.textPrimary};font-family:${G.fontUI};min-height:100vh}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${G.border};border-radius:2px}
  input,select,textarea{font-family:${G.fontUI};background:none;color:${G.textPrimary}}
  input[type=checkbox]{accent-color:${G.accent};width:14px;height:14px;cursor:pointer}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  @keyframes dropDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp 0.3s ease forwards}
  .blink{animation:blink 2.5s ease infinite}
  .rh:hover{background:${G.surfaceHov}!important}
  .pill:hover{border-color:${G.borderHov}!important;color:${G.textPrimary}!important}
  .nav-desktop{display:flex}
  .nav-mobile{display:none}
  @media(max-width:640px){
    .nav-desktop{display:none!important}
    .nav-mobile{display:flex!important}
  }
  .mob-dropdown{animation:dropDown 0.18s ease forwards;position:absolute;top:calc(100% + 6px);right:0;min-width:160px;background:${G.surfaceAlt};border:1px solid ${G.borderHov};border-radius:10px;overflow:hidden;box-shadow:0 10px 36px rgba(0,0,0,0.6);z-index:200}
  .mob-dropdown button{width:100%;display:block;text-align:left;padding:11px 16px;background:transparent;border:none;border-bottom:1px solid ${G.border};color:${G.textSec};font-size:12px;font-family:${G.fontMono};cursor:pointer;transition:background 0.12s,color 0.12s}
  .mob-dropdown button:last-child{border-bottom:none}
  .mob-dropdown button:hover{background:${G.surfaceHov};color:${G.textPrimary}}
  .mob-dropdown button.active{color:${G.accent};background:${G.accentDim}}
`;

const pColor = v => v > 0 ? G.accent : v < 0 ? G.red : G.textSec;

// ─── Constants ────────────────────────────────────────────────────────────────
const SETUPS   = ["IOF","EOF","Pullback","Mitigación","Continuación Interna","LQ Pool"];
const MERCADOS = ["Forex","Commodities","Índices"];
const SESIONES = ["Londres","New York","Asia","Overlap (Lon/NY)"];
const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_ES  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const DIAS_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const SETUP_COLORS = {
  "IOF":                  ["#4f8ef5","rgba(79,142,245,0.15)"],
  "EOF":                  ["#9f7aea","rgba(159,122,234,0.15)"],
  "Pullback":             ["#e8b320","rgba(232,179,32,0.15)"],
  "Mitigación":           ["#f06040","rgba(240,96,64,0.15)"],
  "Continuación Interna": ["#00c896","rgba(0,200,150,0.15)"],
  "LQ Pool":              ["#4fc3f7","rgba(79,195,247,0.15)"],
};
const TF_OPTS      = [{id:"weekly",label:"Semana"},{id:"monthly",label:"Mes"},{id:"quarterly",label:"Trimestre"},{id:"annual",label:"Año"},{id:"alltime",label:"All‑Time"}];
const ANAL_TF_OPTS = [{id:"quarterly",label:"Trimestre"},{id:"annual",label:"Año"},{id:"alltime",label:"All‑Time"}];
const REPORT_TF_OPTS = [{id:"monthly",label:"Mensual"},{id:"quarterly",label:"Trimestral"},{id:"annual",label:"Anual"}];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function detectMercado(pair) {
  const p = (pair||"").toUpperCase();
  if (["XAU","XAG","CL","NG","HG","OIL","GOLD","SILVER","CRUDE","GAS","CORN","WHEAT","ZC","ZW","ZS"].some(c=>p.includes(c))) return "Commodities";
  if (["DAX","NQ","ES","YM","NAS","DOW","SPX","FTSE","CAC","NIKKEI","NASDAQ","SP500","DJ","MNQ","MES","MYM"].some(c=>p.includes(c))) return "Índices";
  return "Forex";
}
function getResult(t) {
  if (!t.ejecutado) return null;
  if (Math.abs(t.pnl) < t.capital * 0.5) return "BE";
  return t.rr > 0 ? "Win" : "Loss";
}
const fmtD = v => `${v>=0?"+":"-"}$${Math.abs(v).toFixed(0)}`;
const fmtR = v => `${v>=0?"+":""}${parseFloat(v).toFixed(2)}R`;

function calcStats(trades) {
  const exec = trades.filter(t=>t.ejecutado);
  const zero = {total:0,wins:0,losses:0,bes:0,winRate:"0.0",totalPnl:0,totalR:"0.0",avgRR:"0.0",profitFactor:"0.00",maxDD:0,maxDDR:"0.00",expValue:"0.00",execRate:"0.0",execCount:0,nonExecCount:0,bestStreak:0,worstStreak:0,avgWin:0,avgLoss:0};
  if (!exec.length) return {...zero,nonExecCount:trades.length};
  const wins=exec.filter(t=>getResult(t)==="Win"), losses=exec.filter(t=>getResult(t)==="Loss"), bes=exec.filter(t=>getResult(t)==="BE");
  const totalPnl=exec.reduce((s,t)=>s+t.pnl,0), totalR=exec.reduce((s,t)=>s+t.rr,0);
  const avgWinR=wins.length?wins.reduce((s,t)=>s+t.rr,0)/wins.length:0;
  const avgLossR=losses.length?Math.abs(losses.reduce((s,t)=>s+t.rr,0)/losses.length):1;
  const wr=wins.length/exec.length, expVal=(wr*avgWinR-(1-wr)*avgLossR).toFixed(2);
  const gw=wins.reduce((s,t)=>s+t.pnl,0), gl=Math.abs(losses.reduce((s,t)=>s+t.pnl,0)), pf=gl>0?(gw/gl).toFixed(2):"∞";
  const maxDD=(()=>{let pk=0,cum=0,dd=0;exec.forEach(t=>{cum+=t.pnl;if(cum>pk)pk=cum;dd=Math.max(dd,pk-cum);});return dd;})();
  const maxDDR=(()=>{let pk=0,cum=0,dd=0;exec.forEach(t=>{cum+=t.rr;if(cum>pk)pk=cum;dd=Math.max(dd,pk-cum);});return dd;})();
  let best=0,worst=0,cur=0;
  exec.forEach(t=>{const r=getResult(t);if(r==="Win"){cur=cur>=0?cur+1:1;}else if(r==="Loss"){cur=cur<=0?cur-1:-1;}else{cur=0;}best=Math.max(best,cur);worst=Math.min(worst,cur);});
  const execRate=trades.length>0?((exec.length/trades.length)*100).toFixed(1):"0.0";
  // Potential if all trades executed
  const potentialPnl = trades.reduce((s,t)=>s+t.pnl,0);
  const potentialR   = trades.reduce((s,t)=>s+t.rr,0);
  return {total:exec.length,wins:wins.length,losses:losses.length,bes:bes.length,winRate:(wr*100).toFixed(1),totalPnl,totalR:totalR.toFixed(2),avgRR:avgWinR.toFixed(2),profitFactor:pf,maxDD:maxDD.toFixed(0),maxDDR:maxDDR.toFixed(2),expValue:expVal,execRate,execCount:exec.length,nonExecCount:trades.length-exec.length,bestStreak:best,worstStreak:worst,avgWin:wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0,avgLoss:losses.length?losses.reduce((s,t)=>s+t.pnl,0)/losses.length:0,potentialPnl:potentialPnl.toFixed(0),potentialR:potentialR.toFixed(2),validSetups:trades.length};
}

function filterByPeriod(trades, tf, periodId) {
  if (tf==="alltime"||!periodId) return trades;
  return trades.filter(t=>{
    const d=new Date(t.date);
    if(tf==="weekly"){const day=d.getDay(),diff=(day===0?-6:1)-day;const mon=new Date(d);mon.setDate(d.getDate()+diff);mon.setHours(0,0,0,0);return mon.toISOString().slice(0,10)===periodId;}
    if(tf==="monthly"){const[yr,mo]=periodId.split("-").map(Number);return d.getFullYear()===yr&&d.getMonth()===mo;}
    if(tf==="quarterly"){const[yr,qStr]=periodId.split("-Q");const q=parseInt(qStr);return d.getFullYear()===parseInt(yr)&&Math.floor(d.getMonth()/3)+1===q;}
    if(tf==="annual"){return d.getFullYear()===parseInt(periodId);}
    return true;
  });
}

function buildPeriodOptions(tf, trades) {
  const dates=trades.map(t=>new Date(t.date));
  if(!dates.length) return [];
  if(tf==="weekly"){const seen=new Set(),opts=[];dates.forEach(d=>{const day=d.getDay(),diff=(day===0?-6:1)-day;const mon=new Date(d);mon.setDate(d.getDate()+diff);mon.setHours(0,0,0,0);const k=mon.toISOString().slice(0,10);if(!seen.has(k)){seen.add(k);opts.push({id:k,label:`Sem ${mon.getDate()}/${mon.getMonth()+1}/${mon.getFullYear()}`});}});return opts.sort((a,b)=>new Date(b.id)-new Date(a.id));}
  if(tf==="monthly"){const seen=new Set(),opts=[];dates.forEach(d=>{const k=`${d.getFullYear()}-${d.getMonth()}`;if(!seen.has(k)){seen.add(k);opts.push({id:k,label:`${MESES_ES[d.getMonth()]} ${d.getFullYear()}`,yr:d.getFullYear(),mon:d.getMonth()});}});return opts.sort((a,b)=>b.yr!==a.yr?b.yr-a.yr:b.mon-a.mon);}
  if(tf==="quarterly"){const seen=new Set(),opts=[];dates.forEach(d=>{const q=Math.floor(d.getMonth()/3)+1,yr=d.getFullYear();const k=`${yr}-Q${q}`;if(!seen.has(k)){seen.add(k);opts.push({id:k,label:`Q${q} ${yr}`,yr,q});}});return opts.sort((a,b)=>b.yr!==a.yr?b.yr-a.yr:b.q-a.q);}
  if(tf==="annual"){const seen=new Set(),opts=[];dates.forEach(d=>{const yr=d.getFullYear();if(!seen.has(yr)){seen.add(yr);opts.push({id:`${yr}`,label:`${yr}`,yr});}});return opts.sort((a,b)=>b.yr-a.yr);}
  return [{id:"alltime",label:"All‑Time"}];
}

function wrScore(wins,total,sumR){if(total===0)return -Infinity;return(wins/total)*100+(sumR/total)*0.1;}
function statsByDayOfWeek(trades){
  const m={};trades.filter(t=>t.ejecutado).forEach(t=>{const dow=new Date(t.date).getDay();if(!m[dow])m[dow]={label:DIAS_ES[dow],wins:0,total:0,sumR:0};if(getResult(t)==="Win")m[dow].wins++;m[dow].total++;m[dow].sumR+=t.rr;});
  return Object.values(m).map(v=>({label:v.label,count:v.total,wr:v.total?((v.wins/v.total)*100).toFixed(0):0,score:wrScore(v.wins,v.total,v.sumR)})).sort((a,b)=>b.score-a.score);
}
function statsByWeekOfMonth(trades){
  const m={};trades.filter(t=>t.ejecutado).forEach(t=>{const d=new Date(t.date);const wn=Math.ceil((d.getDate()+new Date(d.getFullYear(),d.getMonth(),1).getDay())/7);const k=`W${wn}`;if(!m[k])m[k]={label:`Semana ${wn}`,wins:0,total:0,sumR:0};if(getResult(t)==="Win")m[k].wins++;m[k].total++;m[k].sumR+=t.rr;});
  return Object.values(m).map(v=>({label:v.label,count:v.total,wr:v.total?((v.wins/v.total)*100).toFixed(0):0,score:wrScore(v.wins,v.total,v.sumR)})).sort((a,b)=>b.score-a.score);
}
function statsByMonth(trades){
  const m={};trades.filter(t=>t.ejecutado).forEach(t=>{const mon=new Date(t.date).getMonth();const k=MESES_ES[mon];if(!m[k])m[k]={label:k,wins:0,total:0,sumR:0};if(getResult(t)==="Win")m[k].wins++;m[k].total++;m[k].sumR+=t.rr;});
  return Object.values(m).map(v=>({label:v.label,count:v.total,wr:v.total?((v.wins/v.total)*100).toFixed(0):0,score:wrScore(v.wins,v.total,v.sumR)})).sort((a,b)=>b.score-a.score);
}

function getMentalPolarity(val) {
  const found = MENTAL_STATES.find(m => m.value === val);
  return found ? found.polarity : null;
}

// ─── Sample data ──────────────────────────────────────────────────────────────
function mkT(id,date,hora,pair,sesion,capital,rr,setup,ejecutado,validez,confluencias,estado_mental) {
  const pnl = parseFloat((rr * capital).toFixed(2));
  return { id, date, hora, pair, mercado: detectMercado(pair), sesion, capital, rr, pnl, setup, ejecutado, validez, confluencias, estado_mental, link: "", notas: "", tags: [] };
}
const SAMPLE = [
  mkT(1,"2026-01-06","08:15","EUR/USD","Londres",100,2.1,"IOF",true,4,["Candle Bias","Daily Cycle"],"Enfocado"),
  mkT(2,"2026-01-08","10:00","XAU/USD","New York",120,-1,"Mitigación",true,3,["Daily Cycle"],"Disciplinado"),
  mkT(3,"2026-01-09","09:45","GBP/USD","Londres",80,1.8,"Pullback",true,4,["Candle Bias"],"Disciplinado"),
  mkT(4,"2026-01-13","08:30","DAX","Londres",150,-1,"EOF",true,2,["Candle Bias"],"Impaciente/FOMO"),
  mkT(5,"2026-01-14","11:00","EUR/USD","New York",100,0,"LQ Pool",true,3,["Candle Bias","Daily Cycle"],"Inseguro"),
  mkT(6,"2026-01-15","14:00","CL/USD","New York",100,0,"Continuación Interna",false,2,["Daily Cycle"],"Temeroso"),
  mkT(7,"2026-01-20","09:00","GBP/USD","Londres",90,2.5,"IOF",true,4,["Candle Bias","Daily Cycle"],"Confiado"),
  mkT(8,"2026-01-22","13:30","XAG/USD","New York",100,-1,"EOF",true,3,["Daily Cycle"],"Vengativo"),
  mkT(9,"2026-02-03","09:15","EUR/USD","Londres",100,1.9,"Pullback",true,4,["Candle Bias"],"Enfocado"),
  mkT(10,"2026-02-04","10:30","XAU/USD","New York",130,2.8,"Mitigación",true,4,["Candle Bias","Daily Cycle"],"Confiado"),
  mkT(11,"2026-02-05","08:45","DAX","Londres",120,-1,"LQ Pool",true,2,["Daily Cycle"],"Frustrado"),
  mkT(12,"2026-02-10","12:00","GBP/JPY","Overlap (Lon/NY)",100,0,"IOF",true,3,["Candle Bias"],"Inseguro"),
  mkT(13,"2026-02-11","15:00","CL/USD","New York",100,0,"EOF",false,2,["Daily Cycle"],"Temeroso"),
  mkT(14,"2026-02-17","09:30","EUR/USD","Londres",100,2.2,"Continuación Interna",true,4,["Candle Bias","Daily Cycle"],"Disciplinado"),
  mkT(15,"2026-02-18","11:15","XAU/USD","New York",150,-1,"Pullback",true,3,["Daily Cycle"],"Impaciente/FOMO"),
  mkT(16,"2026-03-03","08:00","DAX","Londres",120,1.7,"IOF",true,3,["Candle Bias"],"Disciplinado"),
  mkT(17,"2026-03-04","10:45","EUR/USD","New York",100,-1,"EOF",true,2,["Daily Cycle"],"Frustrado"),
  mkT(18,"2026-03-05","13:00","XAG/USD","New York",80,3.1,"LQ Pool",true,4,["Candle Bias","Daily Cycle"],"Confiado"),
  mkT(19,"2026-03-10","09:20","GBP/USD","Londres",100,0,"Mitigación",true,3,["Candle Bias"],"Inseguro"),
  mkT(20,"2026-03-11","14:30","CL/USD","New York",110,0,"Continuación Interna",false,2,["Daily Cycle"],"Evitativo/Distraído"),
  mkT(21,"2026-03-16","09:00","EUR/USD","Londres",100,2.0,"Pullback",true,4,["Candle Bias","Daily Cycle"],"Paciente"),
  mkT(22,"2026-03-17","11:30","XAU/USD","New York",130,-1,"IOF",true,3,["Candle Bias"],"Disciplinado"),
  mkT(23,"2026-04-01","08:30","DAX","Londres",120,1.5,"EOF",true,3,["Candle Bias"],"Selectivo"),
  mkT(24,"2026-04-02","10:00","EUR/USD","New York",100,-1,"LQ Pool",true,2,["Daily Cycle"],"Impaciente/FOMO"),
  mkT(25,"2026-04-03","09:45","XAU/USD","New York",150,2.4,"IOF",true,4,["Candle Bias","Daily Cycle"],"Confiado"),
  mkT(26,"2026-04-07","08:15","GBP/USD","Londres",100,0,"Mitigación",true,3,["Candle Bias"],"Temeroso"),
  mkT(27,"2026-04-08","13:00","CL/USD","New York",100,-1,"Pullback",false,2,["Daily Cycle"],"Temeroso"),
  mkT(28,"2026-04-09","09:00","DAX","Londres",120,2.6,"Continuación Interna",true,4,["Candle Bias","Daily Cycle"],"Enfocado"),
  mkT(29,"2026-04-14","12:30","EUR/USD","Overlap (Lon/NY)",90,0,"EOF",false,2,["Candle Bias"],"Evitativo/Distraído"),
  mkT(30,"2026-04-15","10:15","XAG/USD","New York",80,1.9,"IOF",true,3,["Daily Cycle"],"Paciente"),
  mkT(31,"2026-04-22","09:30","GBP/USD","Londres",100,-1,"LQ Pool",true,3,["Candle Bias"],"Eufórico"),
  mkT(32,"2026-04-28","11:00","XAU/USD","New York",150,2.2,"Pullback",true,4,["Candle Bias","Daily Cycle"],"Disciplinado"),
  mkT(33,"2026-05-05","09:00","EUR/USD","Londres",100,2.1,"IOF",true,4,["Candle Bias","Daily Cycle"],"Confiado"),
  mkT(34,"2026-05-06","10:30","XAU/USD","New York",130,-1,"Mitigación",true,3,["Daily Cycle"],"Neutral"),
];

// ─── Mental States ────────────────────────────────────────────────────────────
const MENTAL_STATES = [
  { value:"Confiado",            polarity:"positive" },
  { value:"Enfocado",            polarity:"positive" },
  { value:"Disciplinado",        polarity:"positive" },
  { value:"Paciente",            polarity:"positive" },
  { value:"Proactivo",           polarity:"positive" },
  { value:"Neutral",             polarity:"positive" },
  { value:"Selectivo",           polarity:"positive" },
  { value:"Temeroso",            polarity:"negative" },
  { value:"Inseguro",            polarity:"negative" },
  { value:"Evitativo/Distraído", polarity:"negative" },
  { value:"Impaciente/FOMO",     polarity:"negative" },
  { value:"Frustrado",           polarity:"negative" },
  { value:"Eufórico",            polarity:"negative" },
  { value:"Vengativo",           polarity:"negative" },
];

// ─── Primitive components ─────────────────────────────────────────────────────
function MentalStateChip({ val, size = "sm" }) {
  if (!val || val === "—") return <span style={{ color:G.textMuted, fontSize:10 }}>—</span>;
  const pol = getMentalPolarity(val);
  const col  = pol === "positive" ? G.accent : pol === "negative" ? G.red : G.textSec;
  const bg   = pol === "positive" ? G.accentDim : pol === "negative" ? G.redDim : "transparent";
  const fs   = size === "lg" ? 12 : 9;
  return (
    <span style={{ fontSize:fs, background:bg, color:col, borderRadius:20, padding:size==="lg"?"3px 11px":"2px 8px", border:`1px solid ${col}44`, whiteSpace:"nowrap", fontFamily:G.fontMono }}>
      {pol === "positive" ? "▲ " : pol === "negative" ? "▼ " : ""}{val}
    </span>
  );
}

function KpiCard({ label, val, sub, col, tag }) {
  return (
    <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:"15px 17px", display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:9, color:G.textSec, letterSpacing:"0.13em", textTransform:"uppercase", fontFamily:G.fontDisplay }}>{label}</span>
        {tag && <span style={{ fontSize:8, background:G.border, color:G.textSec, borderRadius:3, padding:"1px 5px" }}>{tag}</span>}
      </div>
      <span style={{ fontSize:21, fontWeight:700, color:col||G.textPrimary, fontFamily:G.fontDisplay, lineHeight:1.1 }}>{val}</span>
      {sub && <span style={{ fontSize:10, color:G.textSec }}>{sub}</span>}
    </div>
  );
}

function BWCard({ label, arr, best }) {
  const item = best ? arr[0] : arr[arr.length - 1];
  const col  = best ? G.accent : G.red;
  return (
    <div style={{ background:G.surfaceAlt, border:`1px solid ${G.border}`, borderRadius:8, padding:"12px 14px" }}>
      <div style={{ fontSize:9, color:G.textSec, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6, fontFamily:G.fontDisplay }}>{label}</div>
      {item ? (
        <>
          <div style={{ fontSize:12, fontWeight:600, fontFamily:G.fontDisplay, color:G.textPrimary, marginBottom:2 }}>{item.label}</div>
          <div style={{ fontSize:13, fontWeight:700, color:col }}>{item.wr}% WR</div>
          <div style={{ fontSize:9, color:G.textSec }}>{item.count} trades</div>
        </>
      ) : <div style={{ color:G.textMuted, fontSize:11 }}>Sin datos</div>}
    </div>
  );
}

function SetupChip({ setup }) {
  const [col, bg] = SETUP_COLORS[setup] || [G.textSec, G.border];
  return <span style={{ fontSize:9, background:bg, color:col, borderRadius:20, padding:"2px 9px", whiteSpace:"nowrap", border:`1px solid ${col}44`, fontFamily:G.fontDisplay, fontWeight:500 }}>{setup}</span>;
}

function ValidityDots({ n }) {
  return (
    <div style={{ display:"flex", gap:4 }}>
      {[1,2,3,4].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:i<=n ? G.blue : G.border }}/>)}
    </div>
  );
}

function SectionHeader({ title }) {
  return <div style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12, fontFamily:G.fontDisplay }}>{title}</div>;
}

function TFSelector({ value, onChange, options }) {
  return (
    <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,0.04)", border:`1px solid ${G.border}`, borderRadius:10, padding:4 }}>
      {options.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)}
          style={{ background:value===id?"rgba(255,255,255,0.10)":"transparent", border:value===id?"1px solid rgba(255,255,255,0.15)":"1px solid transparent", color:value===id?G.white:G.textSec, borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:12, fontFamily:G.fontUI, fontWeight:value===id?600:400, transition:"all 0.15s", whiteSpace:"nowrap" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function PeriodSelector({ tf, periodId, onChange, trades }) {
  const options = useMemo(() => buildPeriodOptions(tf, trades), [tf, trades]);
  const [open, setOpen] = useState(false);
  if (tf === "alltime" || !options.length) return null;
  const current = options.find(o => o.id === periodId) || options[0];
  return (
    <div style={{ position:"relative", width:"100%" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.04)", border:`1px solid ${open?"rgba(255,255,255,0.18)":G.border}`, borderRadius:12, padding:"13px 16px", cursor:"pointer" }}>
        <span style={{ fontSize:16, opacity:0.5, flexShrink:0 }}>📅</span>
        <span style={{ flex:1, textAlign:"left", fontSize:14, fontFamily:G.fontUI, fontWeight:500, color:G.white }}>{current ? current.label : "—"}</span>
        <span style={{ fontSize:12, color:G.textSec, transform:open?"rotate(180deg)":"rotate(0deg)", display:"inline-block" }}>▾</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:100, background:G.surfaceAlt, border:`1px solid ${G.border}`, borderRadius:10, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
          {options.map(o => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
              style={{ width:"100%", display:"block", textAlign:"left", padding:"10px 16px", background:o.id===periodId?"rgba(255,255,255,0.06)":"transparent", border:"none", borderBottom:`1px solid ${G.border}`, color:o.id===periodId?G.white:G.textSec, fontSize:13, fontFamily:G.fontUI, fontWeight:o.id===periodId?600:400, cursor:"pointer" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({ trades, H=60 }) {
  const exec = trades.filter(t => t.ejecutado);
  const pts = useMemo(() => { let c=0; return exec.map(t => { c += t.pnl; return c; }); }, [exec.length]);
  if (pts.length < 2) return <div style={{ color:G.textMuted, fontSize:10, padding:"18px 0", textAlign:"center" }}>Sin datos</div>;
  const W = 1000;
  const mn=Math.min(...pts,0), mx=Math.max(...pts,1), rng=mx-mn||1, p=8;
  const xs = pts.map((_,i) => p + (i/(pts.length-1)) * (W-p*2));
  const ys = pts.map(v => H-p - ((v-mn)/rng) * (H-p*2));
  const d  = xs.map((x,i) => `${i===0?"M":"L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const fill = `${d} L${W-p},${H} L${p},${H} Z`;
  const col = pts[pts.length-1] >= 0 ? G.accent : G.red;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display:"block" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={col} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sg)"/>
      <path d={d} fill="none" stroke={col} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="6" fill={col} stroke={G.bg} strokeWidth="3"/>
    </svg>
  );
}

function DonutChart({ exec, nonExec }) {
  const total = exec + nonExec;
  const pct   = total > 0 ? Math.round((exec / total) * 100) : 0;
  const R=36, cx=48, cy=48, sw=9, circ=2*Math.PI*R;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20 }}>
      <svg width={96} height={96} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={G.border} strokeWidth={sw}/>
        {pct > 0 && (<circle cx={cx} cy={cy} r={R} fill="none" stroke={G.accent} strokeWidth={sw} strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ/4} strokeLinecap="round"/>)}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={G.textPrimary} style={{ fontSize:14, fontWeight:700, fontFamily:G.fontDisplay }}>{pct}%</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div><div style={{ fontSize:12, color:G.accent, fontWeight:500 }}>{exec} ejecutados</div><div style={{ fontSize:10, color:G.textSec }}>Execution Rate</div></div>
        <div><div style={{ fontSize:12, color:G.textSec }}>{nonExec} no ejecutados</div><div style={{ fontSize:10, color:G.textMuted }}>setups vistos</div></div>
      </div>
    </div>
  );
}

function ExecSequence({ trades, year, month }) {
  const fallback = useMemo(() => {
    const sorted = [...trades].sort((a,b) => new Date(b.date) - new Date(a.date));
    const latest = sorted.length ? new Date(sorted[0].date) : new Date("2026-05-07");
    return { yr: latest.getFullYear(), mon: latest.getMonth() };
  }, [trades]);
  const yr  = year  !== undefined ? year  : fallback.yr;
  const mon = month !== undefined ? month : fallback.mon;
  const monthT = trades.filter(t => { const[yrS,moS]=t.date.split("-");return parseInt(yrS)===yr&&parseInt(moS)-1===mon&&t.ejecutado; }).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const count=monthT.length, validCount=monthT.filter(t=>t.validez>=3).length, achieved=validCount>=6;
  const boxes=Math.max(10,count+(10-count%10===10?0:10-count%10));
  const resC=r=>r==="Win"?G.accent:r==="Loss"?G.red:r==="BE"?G.white:G.border;
  const resBg=r=>r==="Win"?`${G.accent}22`:r==="Loss"?`${G.red}22`:r==="BE"?"rgba(232,237,248,0.08)":"transparent";
  return (
    <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:600, fontFamily:G.fontDisplay }}>{MESES_ES[mon]} {yr}</span>
        {achieved && <span style={{ fontSize:14 }}>🏆</span>}
        <span style={{ fontSize:9, color:G.textSec, marginLeft:"auto" }}>Min. Sample Req. · {validCount}/6</span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
        {Array.from({length:boxes}).map((_,i)=>{const t=monthT[i],r=t?getResult(t):null,counts=t&&t.validez>=3;return(<div key={i} style={{width:28,height:28,borderRadius:"50%",background:r?resBg(r):G.surfaceAlt,border:`2px solid ${r?resC(r):G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:r?resC(r):G.textMuted,fontWeight:700,flexShrink:0,boxShadow:counts&&r?`0 0 7px ${resC(r)}55`:"none",opacity:t&&!counts?0.4:1}}>{r==="Win"?"W":r==="Loss"?"L":r==="BE"?"B":""}</div>);})}
      </div>
      <div style={{ display:"flex", gap:14, marginTop:10, fontSize:9, color:G.textSec }}>
        <span style={{ color:G.accent }}>● Win</span><span style={{ color:G.red }}>● Loss</span><span style={{ color:G.white }}>● BE</span><span style={{ color:G.textMuted }}>○ Pendiente</span>
      </div>
    </div>
  );
}

function TradingCalendar({ trades }) {
  const [nowNY, setNowNY] = useState(()=>{const d=new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));return{y:d.getFullYear(),m:d.getMonth(),d:d.getDate()};});
  useEffect(()=>{const tick=()=>{const d=new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));setNowNY({y:d.getFullYear(),m:d.getMonth(),d:d.getDate()});};const id=setInterval(tick,60_000);return()=>clearInterval(id);},[]);
  const [viewYear,setViewYear]=useState(nowNY.y);
  const [viewMonth,setViewMonth]=useState(nowNY.m);
  const dayMap=useMemo(()=>{const m={};trades.filter(t=>t.ejecutado).forEach(t=>{const[yrS,moS,dyS]=t.date.split("-");const yr2=parseInt(yrS),mo2=parseInt(moS)-1,dy2=parseInt(dyS);if(yr2===viewYear&&mo2===viewMonth){if(!m[dy2])m[dy2]={pnl:0,count:0};m[dy2].pnl+=t.pnl;m[dy2].count++;}});return m;},[trades,viewYear,viewMonth]);
  const firstDow=new Date(viewYear,viewMonth,1).getDay();
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const totalPnl=Object.values(dayMap).reduce((s,v)=>s+v.pnl,0);
  return (
    <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>{if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1);}} style={{ background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 }}>‹</button>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:G.fontDisplay }}>{MESES_ES[viewMonth]} {viewYear}</span>
          <button onClick={()=>{if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1);}} style={{ background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:13 }}>›</button>
        </div>
        <div style={{ textAlign:"right" }}><span style={{ fontSize:11, color:G.textSec }}>Total: </span><span style={{ fontSize:13, fontWeight:700, color:pColor(totalPnl), fontFamily:G.fontDisplay }}>{fmtD(totalPnl)}</span></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>{DIAS_SHORT.map(d=><div key={d} style={{ textAlign:"center", fontSize:9, color:G.textSec, padding:"4px 0", letterSpacing:"0.06em" }}>{d}</div>)}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {Array.from({length:firstDow}).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length:daysInMonth}).map((_,i)=>{const day=i+1,data=dayMap[day],isToday=viewYear===nowNY.y&&viewMonth===nowNY.m&&day===nowNY.d;let bg=G.surfaceAlt,border=G.border,pnlColor=G.textSec;if(data){if(data.pnl>0){bg="rgba(0,200,150,0.14)";border=`${G.accent}55`;pnlColor=G.accent;}else if(data.pnl<0){bg="rgba(240,64,96,0.14)";border=`${G.red}55`;pnlColor=G.red;}else{bg="rgba(232,237,248,0.06)";border=`${G.white}33`;pnlColor=G.textSec;}}return(<div key={day} style={{background:bg,border:`1px solid ${border}`,borderRadius:7,padding:"8px 6px",minHeight:70,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",gap:3,textAlign:"center"}}><span style={{fontSize:11,color:isToday?G.blue:G.textSec,fontWeight:isToday?700:400}}>{day}</span>{data&&<><span style={{fontSize:10,fontWeight:700,color:pnlColor,lineHeight:1}}>{fmtD(data.pnl)}</span><span style={{fontSize:9,color:G.textSec,lineHeight:1}}>{data.count} trade{data.count>1?"s":""}</span></>}</div>);})}
      </div>
      <div style={{ display:"flex", gap:14, marginTop:12, fontSize:9, color:G.textSec }}><span style={{ color:G.accent }}>▮ Día positivo</span><span style={{ color:G.red }}>▮ Día negativo</span><span style={{ color:G.white }}>▮ Breakeven</span></div>
    </div>
  );
}

function GroupBars({ data, barColor }) {
  const col = barColor || G.accent;
  if (!data.length) return <div style={{ color:G.textMuted, fontSize:11, textAlign:"center", padding:16 }}>Sin datos</div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {data.map(d=>{const wr=d.total?((d.wins/d.total)*100).toFixed(0):0;return(<div key={d.label}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}><span>{d.label}<span style={{color:G.textSec,fontSize:10}}> ({d.total})</span></span><div style={{display:"flex",gap:10}}><span style={{color:pColor(d.pnl)}}>{fmtD(d.pnl)}</span><span style={{color:pColor(d.r)}}>{fmtR(d.r)}</span><span style={{color:G.textSec,width:30,textAlign:"right"}}>{wr}%</span></div></div><div style={{height:4,background:G.border,borderRadius:2,overflow:"hidden"}}><div style={{width:`${wr}%`,height:"100%",background:col,borderRadius:2}}/></div></div>);})}
    </div>
  );
}

function TradeTable({ trades, onDelete, onEdit, showDelete=true }) {
  const [confirmId, setConfirmId] = useState(null);
  const confirmTrade = confirmId ? trades.find(t => t.id === confirmId) : null;

  return (
    <div style={{ overflowX:"auto" }}>
      {/* ── Modal de confirmación ── */}
      {confirmId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:G.surfaceAlt, border:`1px solid ${G.border}`, borderRadius:14, padding:"28px 28px 22px", maxWidth:380, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize:28, textAlign:"center", marginBottom:12 }}>🗑</div>
            <div style={{ fontSize:14, fontWeight:700, color:G.textPrimary, fontFamily:G.fontDisplay, textAlign:"center", marginBottom:6 }}>
              ¿Eliminar este trade?
            </div>
            {confirmTrade && (
              <div style={{ background:G.bg, border:`1px solid ${G.border}`, borderRadius:8, padding:"10px 14px", marginBottom:18, fontSize:11, color:G.textSec, textAlign:"center" }}>
                <span style={{ color:G.textPrimary, fontWeight:600 }}>{confirmTrade.pair}</span>
                {" · "}{confirmTrade.date}
                {" · "}<span style={{ color:pColor(confirmTrade.pnl), fontWeight:600 }}>{fmtD(confirmTrade.pnl)}</span>
              </div>
            )}
            <p style={{ fontSize:11, color:G.textSec, textAlign:"center", marginBottom:20, lineHeight:1.5 }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={() => setConfirmId(null)}
                style={{ flex:1, background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:12, fontFamily:G.fontDisplay, fontWeight:600 }}>
                Cancelar
              </button>
              <button
                onClick={() => { onDelete(confirmId); setConfirmId(null); }}
                style={{ flex:1, background:G.red, border:"none", color:"#fff", borderRadius:8, padding:"10px 0", cursor:"pointer", fontSize:12, fontFamily:G.fontDisplay, fontWeight:700 }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
        <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Fecha","Hora","Activo","Sesión","Cap","R:R","P&L","Ejec","Setup","Valid","Confluencias","Mental","Link",...(showDelete?[""]:[])].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",color:G.textSec,fontWeight:400,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>
          {trades.map(t=>(
            <tr key={t.id} className="rh" style={{ borderBottom:`1px solid ${G.border}`, transition:"background 0.1s" }}>
              <td style={{padding:"8px 10px",color:G.textSec,whiteSpace:"nowrap"}}>{t.date}</td>
              <td style={{padding:"8px 10px",color:G.textSec,fontSize:10}}>{t.hora||"—"}</td>
              <td style={{padding:"8px 10px",fontWeight:500,whiteSpace:"nowrap"}}>{t.pair}</td>
              <td style={{padding:"8px 10px",color:G.textSec,fontSize:10,whiteSpace:"nowrap"}}>{t.sesion}</td>
              <td style={{padding:"8px 10px"}}>${t.capital}</td>
              <td style={{padding:"8px 10px",fontWeight:600,color:pColor(t.rr)}}>{fmtR(t.rr)}</td>
              <td style={{padding:"8px 10px",fontWeight:600,color:pColor(t.pnl),whiteSpace:"nowrap"}}>{fmtD(t.pnl)}</td>
              <td style={{padding:"8px 10px",textAlign:"center"}}>{t.ejecutado?<span style={{color:G.accent,fontSize:13}}>✓</span>:<span style={{color:G.textMuted,fontSize:13}}>—</span>}</td>
              <td style={{padding:"8px 10px"}}><SetupChip setup={t.setup}/></td>
              <td style={{padding:"8px 10px"}}><ValidityDots n={t.validez}/></td>
              <td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.confluencias||[]).map(c=><span key={c} style={{fontSize:9,background:G.blueDim,color:G.blue,borderRadius:10,padding:"1px 7px",border:`1px solid ${G.blue}33`,whiteSpace:"nowrap"}}>{c}</span>)}</div></td>
              <td style={{padding:"8px 10px"}}><MentalStateChip val={t.estado_mental||"—"}/></td>
              <td style={{padding:"8px 10px"}}>{t.link?<a href={t.link} target="_blank" rel="noreferrer" style={{color:G.blue,fontSize:10,textDecoration:"none"}}>🔗</a>:<span style={{color:G.textMuted}}>—</span>}</td>
              {showDelete&&<td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:6}}>{onEdit&&<button onClick={()=>onEdit(t)} style={{background:"none",border:"none",color:G.textSec,cursor:"pointer",fontSize:12}}>✎</button>}{onDelete&&<button onClick={()=>setConfirmId(t.id)} style={{background:"none",border:"none",color:G.textMuted,cursor:"pointer",fontSize:14,lineHeight:1}}>×</button>}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!trades.length&&<div style={{textAlign:"center",padding:"40px 0",color:G.textMuted,fontSize:12}}>Sin trades</div>}
    </div>
  );
}

function TradeForm({ initial, onSave, onCancel }) {
  const empty = { date:"", hora:"09:30", pair:"", sesion:"New York", capital:"", rr:"", setup:"IOF", ejecutado:true, validez:3, confluencias:[], estado_mental:"", link:"" };
  const [f, setF] = useState(initial || empty);
  const inp = { background:G.bg, border:`1px solid ${G.border}`, borderRadius:6, padding:"8px 11px", color:G.textPrimary, fontSize:11, fontFamily:G.fontMono, width:"100%", outline:"none" };
  const lbl = { fontSize:9, color:G.textSec, textTransform:"uppercase", letterSpacing:"0.12em", display:"block", marginBottom:4, fontFamily:G.fontDisplay };
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  function toggleConf(c){setF(p=>({...p,confluencias:p.confluencias.includes(c)?p.confluencias.filter(x=>x!==c):[...p.confluencias,c]}));}
  function submit(){if(!f.date||!f.pair||f.capital===""||f.rr==="")return;const capital=parseFloat(f.capital),rr=parseFloat(f.rr);if(isNaN(capital)||isNaN(rr))return;const pnl=parseFloat((rr*capital).toFixed(2));onSave({...f,capital,rr,pnl,mercado:detectMercado(f.pair),id:f.id||Date.now()});}
  return (
    <div className="fade-up" style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:12, padding:20, marginBottom:18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))", gap:10 }}>
        <div><label style={lbl}>Fecha</label><input type="date" value={f.date} onChange={set("date")} style={inp}/></div>
        <div><label style={lbl}>Hora</label><input type="time" value={f.hora} onChange={set("hora")} style={inp}/></div>
        <div><label style={lbl}>Activo</label><input value={f.pair} onChange={e=>setF(p=>({...p,pair:e.target.value.toUpperCase()}))} placeholder="EUR/USD, XAU..." style={inp}/></div>
        <div><label style={lbl}>Sesión</label><select value={f.sesion} onChange={set("sesion")} style={inp}>{SESIONES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Capital ($)</label><input value={f.capital} onChange={set("capital")} placeholder="100" style={inp}/></div>
        <div><label style={lbl}>R:R Obtenido</label><input value={f.rr} onChange={set("rr")} placeholder="2.5 o -1" style={inp}/></div>
        <div><label style={lbl}>Setup</label><select value={f.setup} onChange={set("setup")} style={inp}>{SETUPS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Validez — <span style={{color:G.blue}}>{f.validez}/4</span></label><div style={{display:"flex",gap:5,paddingTop:2}}>{[1,2,3,4].map(n=><button key={n} onClick={()=>setF(p=>({...p,validez:n}))} style={{flex:1,padding:"7px 0",background:n<=f.validez?G.blueDim:G.bg,border:`1px solid ${n<=f.validez?G.blue:G.border}`,borderRadius:5,color:n<=f.validez?G.blue:G.textSec,cursor:"pointer",fontSize:11}}>{n}</button>)}</div></div>
        <div><label style={lbl}>Confluencias</label><div style={{display:"flex",gap:6,paddingTop:2}}>{["Candle Bias","Daily Cycle"].map(c=>{const sel=f.confluencias.includes(c);return(<button key={c} onClick={()=>toggleConf(c)} style={{flex:1,padding:"7px 4px",background:sel?G.blueDim:G.bg,border:`1px solid ${sel?G.blue:G.border}`,borderRadius:5,color:sel?G.blue:G.textSec,cursor:"pointer",fontSize:9,fontFamily:G.fontMono,lineHeight:1.3}}>{c}</button>);})}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={lbl}>Ejecutado</label><div style={{display:"flex",alignItems:"center",gap:8,paddingTop:6}}><input type="checkbox" checked={f.ejecutado} onChange={e=>setF(p=>({...p,ejecutado:e.target.checked}))}/><span style={{fontSize:11,color:f.ejecutado?G.accent:G.textSec}}>{f.ejecutado?"Sí":"No"}</span></div></div>
        <div><label style={lbl}>Mental State</label><select value={f.estado_mental} onChange={set("estado_mental")} style={inp}><option value="">— Sin etiquetar —</option><optgroup label="▲ Positivo">{MENTAL_STATES.filter(m=>m.polarity==="positive").map(m=><option key={m.value} value={m.value}>{m.value}</option>)}</optgroup><optgroup label="▼ Negativo">{MENTAL_STATES.filter(m=>m.polarity==="negative").map(m=><option key={m.value} value={m.value}>{m.value}</option>)}</optgroup></select></div>
        <div style={{gridColumn:"span 2"}}><label style={lbl}>Link TradingView</label><input value={f.link} onChange={set("link")} placeholder="https://www.tradingview.com/..." style={inp}/></div>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:14 }}>
        <button onClick={submit} style={{ background:G.accent, color:G.bg, border:"none", borderRadius:7, padding:"10px 22px", cursor:"pointer", fontFamily:G.fontDisplay, fontWeight:700, fontSize:12 }}>{initial?"Actualizar":"Guardar"}</button>
        <button onClick={onCancel} style={{ background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:7, padding:"10px 16px", cursor:"pointer", fontSize:11 }}>Cancelar</button>
      </div>
    </div>
  );
}

function EconomicCalendar() {
  // Usamos allorigins.win como proxy CORS para fetchear el JSON de ForexFactory.
  // ForexFactory tiene CORS bloqueado en directo, pero allorigins.win lo permite.
  const PROXY = "https://api.allorigins.win/get?url=";
  const FF_URL = (week) =>
    `${PROXY}${encodeURIComponent(`https://nfs.faireconomy.media/ff_calendar_${week}.xml`)}`;

  const DIAS_EN  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MESES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const todayNY = useMemo(() => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone:"America/New_York" }));
    return { y:d.getFullYear(), m:d.getMonth(), d:d.getDate() };
  }, []);

  const [dayOffset, setDayOffset] = useState(0);
  const targetDate = useMemo(() => {
    const base = new Date(todayNY.y, todayNY.m, todayNY.d);
    base.setDate(base.getDate() + dayOffset);
    return { y:base.getFullYear(), m:base.getMonth(), d:base.getDate(), dow:base.getDay() };
  }, [todayNY, dayOffset]);

  const [allItems, setAllItems] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lastUpd,  setLastUpd]  = useState(null);
  const fetchingRef = useRef(false);

  function parseXML(text) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      return Array.from(xml.querySelectorAll("event")).map(ev => ({
        dateStr:  ev.querySelector("date")?.textContent?.trim()     ?? "",
        time:     ev.querySelector("time")?.textContent?.trim()     ?? "All Day",
        currency: ev.querySelector("country")?.textContent?.trim()  ?? "",
        title:    ev.querySelector("title")?.textContent?.trim()    ?? "",
        impact:   ev.querySelector("impact")?.textContent?.trim()   ?? "",
        forecast: ev.querySelector("forecast")?.textContent?.trim() ?? "—",
        previous: ev.querySelector("previous")?.textContent?.trim() ?? "—",
        actual:   ev.querySelector("actual")?.textContent?.trim()   ?? "",
      }));
    } catch { return []; }
  }

  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.allSettled([
        fetch(FF_URL("thisweek")).then(r => r.json()),
        fetch(FF_URL("nextweek")).then(r => r.json()),
      ]);
      let items = [];
      if (r1.status === "fulfilled" && r1.value?.contents)
        items = [...items, ...parseXML(r1.value.contents)];
      if (r2.status === "fulfilled" && r2.value?.contents)
        items = [...items, ...parseXML(r2.value.contents)];
      if (!items.length) throw new Error("Sin datos del calendario");
      setAllItems(items);
      setLastUpd(new Date().toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" }));
    } catch (e) {
      setError("No se pudo cargar el calendario. Verifica tu conexión.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []); // eslint-disable-line

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line
  useEffect(() => {
    const id = setInterval(fetchAll, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const events = useMemo(() => {
    if (!allItems) return [];
    return allItems.filter(ev => {
      const parts = ev.dateStr.split("-");
      if (parts.length < 3) return false;
      const [mo, dy, yr] = parts.map(Number);
      return yr === targetDate.y
          && (mo - 1) === targetDate.m
          && dy === targetDate.d
          && ev.impact === "High";
    });
  }, [allItems, targetDate]);

  const isToday   = dayOffset === 0;
  const dateLabel = `${DIAS_EN[targetDate.dow]}, ${MESES_EN[targetDate.m]} ${targetDate.d}, ${targetDate.y}`;
  const impactDot = <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#e03030", boxShadow:"0 0 5px #e0303099", flexShrink:0 }}/>;

  const navBtn = (onClick, label) => (
    <button onClick={onClick} style={{ background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18, marginTop:12 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:G.fontDisplay }}>Noticias de Alto Impacto</span>
          <span style={{ fontSize:9, background:"rgba(224,48,48,0.12)", color:"#e05050", border:"1px solid rgba(224,48,48,0.3)", borderRadius:4, padding:"1px 6px" }}>● ROJO</span>
          {!isToday && (
            <button onClick={() => setDayOffset(0)} style={{ fontSize:9, background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:4, padding:"2px 8px", cursor:"pointer" }}>Hoy</button>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {lastUpd && <span style={{ fontSize:9, color:G.textMuted }}>act. {lastUpd}</span>}
          <button onClick={fetchAll} disabled={loading} style={{ background:"none", border:`1px solid ${G.border}`, color:G.textSec, borderRadius:5, width:22, height:22, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
        </div>
      </div>

      {/* Day nav */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${G.border}` }}>
        {navBtn(() => setDayOffset(o => o - 1), "‹")}
        <div style={{ flex:1, textAlign:"center" }}>
          <span style={{ fontSize:12, fontWeight:600, color:isToday ? G.accent : G.textPrimary }}>{dateLabel}</span>
        </div>
        {navBtn(() => setDayOffset(o => o + 1), "›")}
      </div>

      {/* States */}
      {loading && (
        <div style={{ display:"flex", alignItems:"center", gap:8, color:G.textSec, fontSize:11, padding:"12px 0" }}>
          <span style={{ display:"inline-block", animation:"spin 1s linear infinite", fontSize:14 }}>⟳</span>
          Cargando noticias…
        </div>
      )}
      {error && !loading && (
        <div style={{ color:G.red, fontSize:11, padding:"12px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          {error}
          <button onClick={fetchAll} style={{ background:"none", border:`1px solid ${G.red}66`, color:G.red, borderRadius:5, padding:"3px 10px", cursor:"pointer", fontSize:10 }}>Reintentar</button>
        </div>
      )}
      {!loading && !error && events.length === 0 && (
        <div style={{ color:G.textMuted, fontSize:11, textAlign:"center", padding:"18px 0" }}>Sin noticias de alto impacto este día ✓</div>
      )}

      {/* Events table */}
      {!loading && !error && events.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          <div style={{ display:"grid", gridTemplateColumns:"70px 52px 1fr 72px 72px 64px", paddingBottom:6, marginBottom:2, borderBottom:`1px solid ${G.border}` }}>
            {["Hora","Par","Evento","Forecast","Anterior","Actual"].map(h => (
              <div key={h} style={{ fontSize:8, color:G.textMuted, letterSpacing:"0.10em", textTransform:"uppercase", padding:"0 6px" }}>{h}</div>
            ))}
          </div>
          {events.map((ev, i) => {
            const hasActual = ev.actual && ev.actual !== "" && ev.actual !== "—";
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"70px 52px 1fr 72px 72px 64px", padding:"9px 0", borderBottom:i < events.length - 1 ? `1px solid ${G.border}` : "none", alignItems:"center" }}>
                <div style={{ padding:"0 6px", fontSize:10, color:G.textSec }}>{ev.time}</div>
                <div style={{ padding:"0 6px" }}>
                  <span style={{ fontSize:10, fontWeight:700, background:"rgba(224,48,48,0.12)", color:"#e06060", border:"1px solid rgba(224,48,48,0.25)", borderRadius:4, padding:"1px 6px" }}>{ev.currency}</span>
                </div>
                <div style={{ padding:"0 6px", display:"flex", alignItems:"center", gap:6 }}>
                  {impactDot}
                  <span style={{ fontSize:11, fontWeight:600, color:G.textPrimary, lineHeight:1.3 }}>{ev.title}</span>
                </div>
                <div style={{ padding:"0 6px", fontSize:10, color:G.textSec, textAlign:"right" }}>{ev.forecast || "—"}</div>
                <div style={{ padding:"0 6px", fontSize:10, color:G.textSec, textAlign:"right" }}>{ev.previous || "—"}</div>
                <div style={{ padding:"0 6px", fontSize:10, fontWeight:700, textAlign:"right", color:hasActual ? G.accent : G.textMuted }}>{hasActual ? ev.actual : "—"}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${G.border}`, fontSize:9, color:G.textMuted, display:"flex", justifyContent:"space-between" }}>
        <span>Fuente: ForexFactory · solo impacto alto</span>
        <span>Auto-refresh cada 5 min</span>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ─── REPORTES TAB ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// Tipos de reporte disponibles
const REPORT_TYPES = [
  { id:"metricas", label:"Métricas Generales",    icon:"📊", desc:"KPIs completos, rachas, ejecución y resumen del período" },
  { id:"mental",   label:"Mental State Report",   icon:"🧠", desc:"Rendimiento agrupado por estado mental con ejecución y PnL" },
  { id:"edge",     label:"Edge Realization Report", icon:"⚡", desc:"Análisis de validez del edge: setups válidos, execution rate, winrate, expectancy y drawdown" },
];

// ── Generadores de reporte sin IA ─────────────────────────────────────────────
// Toman los datos y producen texto estructurado en markdown que luego
// el renderer y el PDF pueden usar directamente.

function buildMetricasReport(stats, trades, periodLabel) {
  const exec    = trades.filter(t => t.ejecutado);
  const wins    = exec.filter(t => getResult(t) === "Win");
  const losses  = exec.filter(t => getResult(t) === "Loss");
  const bes     = exec.filter(t => getResult(t) === "BE");
  const nonExec = trades.filter(t => !t.ejecutado);

  // Setup breakdown
  const setupMap = {};
  exec.forEach(t => {
    if (!setupMap[t.setup]) setupMap[t.setup] = { total:0, wins:0, pnl:0, r:0 };
    setupMap[t.setup].total++;
    if (getResult(t) === "Win") setupMap[t.setup].wins++;
    setupMap[t.setup].pnl += t.pnl;
    setupMap[t.setup].r   += t.rr;
  });
  const setupLines = Object.entries(setupMap)
    .sort(([,a],[,b]) => b.pnl - a.pnl)
    .map(([s,d]) => `- **${s}**: ${d.total} trades · WR ${d.total ? ((d.wins/d.total)*100).toFixed(0) : 0}% · PnL ${fmtD(d.pnl)} · ${fmtR(d.r)}`)
    .join("\n");

  // Session breakdown
  const sesMap = {};
  exec.forEach(t => {
    if (!sesMap[t.sesion]) sesMap[t.sesion] = { total:0, wins:0, pnl:0 };
    sesMap[t.sesion].total++;
    if (getResult(t) === "Win") sesMap[t.sesion].wins++;
    sesMap[t.sesion].pnl += t.pnl;
  });
  const sesLines = Object.entries(sesMap)
    .sort(([,a],[,b]) => b.pnl - a.pnl)
    .map(([s,d]) => `- **${s}**: ${d.total} trades · WR ${d.total ? ((d.wins/d.total)*100).toFixed(0) : 0}% · PnL ${fmtD(d.pnl)}`)
    .join("\n");

  // Day of week
  const dowMap = {};
  exec.forEach(t => {
    const[yrS,moS,dyS]=t.date.split("-");
    const dow = new Date(parseInt(yrS), parseInt(moS)-1, parseInt(dyS)).getDay();
    const label = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dow];
    if (!dowMap[label]) dowMap[label] = { total:0, wins:0, pnl:0 };
    dowMap[label].total++;
    if (getResult(t) === "Win") dowMap[label].wins++;
    dowMap[label].pnl += t.pnl;
  });
  const dowLines = Object.entries(dowMap)
    .sort(([,a],[,b]) => b.pnl - a.pnl)
    .map(([d,v]) => `- **${d}**: ${v.total} trades · WR ${v.total ? ((v.wins/v.total)*100).toFixed(0) : 0}% · PnL ${fmtD(v.pnl)}`)
    .join("\n");

  const avgWin  = wins.length  ? (wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(0)   : "0";
  const avgLoss = losses.length ? (losses.reduce((s,t)=>s+t.pnl,0)/losses.length).toFixed(0) : "0";

  return `## MÉTRICAS GENERALES — ${periodLabel}

### Resumen del Período
- **Total registros**: ${trades.length} (${exec.length} ejecutados · ${nonExec.length} no ejecutados)
- **Execution Rate**: ${stats.execRate}%
- **Win Rate**: ${stats.winRate}% (${wins.length}W · ${losses.length}L · ${bes.length}BE)
- **Net PnL**: ${fmtD(stats.totalPnl)}
- **Net R**: ${fmtR(parseFloat(stats.totalR))}
- **Profit Factor**: ${stats.profitFactor}
- **Expected Value**: ${stats.expValue}R por trade

### Gestión de Capital
- **Max Drawdown**: -$${stats.maxDD} (${fmtR(-Math.abs(parseFloat(stats.maxDDR)))})
- **Avg. trade ganador**: +$${avgWin}
- **Avg. trade perdedor**: $${avgLoss}
- **Mejor racha ganadora**: ${stats.bestStreak} trades consecutivos
- **Peor racha perdedora**: ${Math.abs(stats.worstStreak)} trades consecutivos

### Rendimiento por Setup
${setupLines || "- Sin datos suficientes"}

### Rendimiento por Sesión
${sesLines || "- Sin datos suficientes"}

### Rendimiento por Día de la Semana
${dowLines || "- Sin datos suficientes"}
`;
}

function buildEdgeReport(stats, trades, periodLabel) {
  const exec    = trades.filter(t => t.ejecutado);
  const wins    = exec.filter(t => getResult(t) === "Win");
  const losses  = exec.filter(t => getResult(t) === "Loss");
  const bes     = exec.filter(t => getResult(t) === "BE");
  const nonExec = trades.filter(t => !t.ejecutado);

  // Setups válidos = validez >= 3
  const validSetups  = trades.filter(t => t.validez >= 3);
  const validExec    = validSetups.filter(t => t.ejecutado);
  const validNonExec = validSetups.filter(t => !t.ejecutado);

  // Avg Win / Loss en R
  const avgWinR  = wins.length   ? (wins.reduce((s,t)=>s+t.rr,0)/wins.length).toFixed(2)   : "0.00";
  const avgLossR = losses.length ? (Math.abs(losses.reduce((s,t)=>s+t.rr,0)/losses.length)).toFixed(2) : "0.00";

  // Potential R y % si todos los setups válidos se hubieran ejecutado
  const potentialR   = validSetups.reduce((s,t)=>s+t.rr,0);
  const potentialPnl = validSetups.reduce((s,t)=>s+t.pnl,0);

  // Max Drawdown en R y en $
  const maxDDR  = parseFloat(stats.maxDDR)  || 0;
  const maxDDDol = parseFloat(stats.maxDD)  || 0;

  // Execution rate sobre setups válidos
  const execRateValid = validSetups.length > 0
    ? ((validExec.length / validSetups.length) * 100).toFixed(1)
    : "0.0";

  // Setup breakdown (solo válidos, >=3)
  const setupMap = {};
  validExec.forEach(t => {
    if (!setupMap[t.setup]) setupMap[t.setup] = { total:0, wins:0, r:0, pnl:0 };
    setupMap[t.setup].total++;
    if (getResult(t) === "Win") setupMap[t.setup].wins++;
    setupMap[t.setup].r   += t.rr;
    setupMap[t.setup].pnl += t.pnl;
  });
  const setupLines = Object.entries(setupMap)
    .sort(([,a],[,b]) => b.pnl - a.pnl)
    .map(([s,d]) => `- **${s}**: ${d.total} ejec. · WR ${d.total ? ((d.wins/d.total)*100).toFixed(0) : 0}% · ${fmtR(d.r)} · PnL ${fmtD(d.pnl)}`)
    .join("\n");

  return `## EDGE REALIZATION REPORT — ${periodLabel}

### Setups & Ejecución
- **Setups válidos (validez ≥ 3)**: ${validSetups.length} (${validExec.length} ejecutados · ${validNonExec.length} no ejecutados)
- **Ejecutados (total período)**: ${exec.length}
- **No ejecutados (total período)**: ${nonExec.length}
- **Execution Rate (sobre válidos)**: ${execRateValid}%
- **Execution Rate (total)**: ${stats.execRate}%

### Resultados
- **Wins**: ${wins.length}
- **Losses**: ${losses.length}
- **Breakeven (BE)**: ${bes.length}
- **Win Rate**: ${stats.winRate}%

### Métricas de Edge
- **Avg Win (R)**: +${avgWinR}R
- **Avg Loss (R)**: -${avgLossR}R
- **Expectancy**: ${stats.expValue}R por trade
- **Profit Factor**: ${stats.profitFactor}

### Resultado Potencial
- **Resultado potencial (si todos los válidos ejecutados)**: ${fmtR(potentialR)} / PnL ${fmtD(parseFloat(potentialPnl.toFixed(0)))}
- **Resultado real (ejecutados)**: ${fmtR(parseFloat(stats.totalR))} / PnL ${fmtD(parseFloat(stats.totalPnl.toFixed ? stats.totalPnl.toFixed(0) : stats.totalPnl))}
- **Oportunidad no capturada**: ${fmtR(parseFloat((potentialR - parseFloat(stats.totalR)).toFixed(2)))}

### Risk Management
- **Max Drawdown (R)**: ${fmtR(-Math.abs(maxDDR))}
- **Max Drawdown ($)**: -$${maxDDDol}
- **Mejor racha ganadora**: ${stats.bestStreak} trades consecutivos
- **Peor racha perdedora**: ${Math.abs(stats.worstStreak)} trades consecutivos

### Edge por Setup (válidos ejecutados)
${setupLines || "- Sin datos suficientes"}
`;
}

function buildMentalReport(trades, periodLabel) {
  const m = {};
  trades.forEach(t => {
    const s = t.estado_mental;
    if (!s) return;
    if (!m[s]) m[s] = { total:0, exec:0, wins:0, netPnl:0, missed:0, avoided:0, polarity: getMentalPolarity(s) };
    m[s].total++;
    if (t.ejecutado) {
      m[s].exec++;
      m[s].netPnl += t.pnl;
      if (getResult(t) === "Win") m[s].wins++;
    } else {
      if (t.rr > 0) m[s].missed  += Math.abs(t.pnl);
      if (t.rr < 0) m[s].avoided += Math.abs(t.pnl);
    }
  });

  const rows = Object.entries(m)
    .sort(([,a],[,b]) => b.netPnl - a.netPnl)
    .map(([state, d]) => {
      const wr = d.exec > 0 ? ((d.wins/d.exec)*100).toFixed(0) : "—";
      const pol = d.polarity === "positive" ? "▲" : d.polarity === "negative" ? "▼" : "·";
      return `- ${pol} **${state}**: ${d.exec}/${d.total} ejecutados · WR ${wr}% · Net PnL ${fmtD(d.netPnl)} · Missed ${d.missed>0?fmtD(d.missed):"—"} · Avoided ${d.avoided>0?fmtD(d.avoided):"—"}`;
    })
    .join("\n");

  const positivos = Object.entries(m).filter(([,d])=>d.polarity==="positive");
  const negativos = Object.entries(m).filter(([,d])=>d.polarity==="negative");
  const pnlPos = positivos.reduce((s,[,d])=>s+d.netPnl,0);
  const pnlNeg = negativos.reduce((s,[,d])=>s+d.netPnl,0);
  const topState = Object.entries(m).sort(([,a],[,b])=>b.netPnl-a.netPnl)[0];
  const worstState = Object.entries(m).sort(([,a],[,b])=>a.netPnl-b.netPnl)[0];

  return `## MENTAL STATE REPORT — ${periodLabel}

### Resumen por Estado Mental
${rows || "- Sin datos de estado mental en este período"}

### Comparativa: Positivo vs Negativo
- **Estados positivos (▲)**: ${positivos.length} estados · PnL total ${fmtD(pnlPos)}
- **Estados negativos (▼)**: ${negativos.length} estados · PnL total ${fmtD(pnlNeg)}

### Highlights
- **Mejor estado mental**: ${topState ? `${topState[0]} (${fmtD(topState[1].netPnl)})` : "—"}
- **Peor estado mental**: ${worstState ? `${worstState[0]} (${fmtD(worstState[1].netPnl)})` : "—"}
- **Trades sin etiquetar**: ${trades.filter(t=>!t.estado_mental).length}
`;
}

// Función para generar PDF usando jsPDF (cargado dinámicamente)
async function generatePDF(reportContent, reportType, periodLabel) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const pageW = 210, pageH = 297, margin = 18, contentW = pageW - margin * 2;
  let y = margin;

  const typeInfo = REPORT_TYPES.find(r => r.id === reportType);

  // Header
  doc.setFillColor(7, 8, 12);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(0, 200, 150);
  doc.rect(0, 42, pageW, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 200, 150);
  doc.text('TRADEPULSE', margin, 16);
  doc.setFontSize(8);
  doc.setTextColor(94, 104, 128);
  doc.text('JOURNAL PRO', margin, 22);
  doc.setFontSize(13);
  doc.setTextColor(212, 217, 232);
  doc.text(typeInfo.label.toUpperCase(), margin, 33);
  doc.setFontSize(9);
  doc.setTextColor(94, 104, 128);
  doc.text(`Período: ${periodLabel}  ·  ${new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })}`, margin, 39);
  y = 52;

  const addPage = () => {
    doc.addPage();
    doc.setFillColor(7, 8, 12);
    doc.rect(0, 0, pageW, 12, 'F');
    doc.setFillColor(0, 200, 150);
    doc.rect(0, 12, pageW, 0.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(94, 104, 128);
    doc.text('TRADEPULSE JOURNAL PRO', margin, 8);
    doc.text(`${periodLabel} · ${typeInfo.label}`, pageW - margin, 8, { align:'right' });
    y = 20;
  };
  const checkPage = (needed = 8) => { if (y + needed > pageH - 14) addPage(); };

  for (const line of reportContent.split('\n')) {
    if (line.startsWith('## ')) {
      checkPage(16); if (y > 55) y += 4;
      doc.setFillColor(13, 15, 22);
      doc.roundedRect(margin - 3, y - 5, contentW + 6, 11, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 200, 150);
      doc.text(line.replace('## ', ''), margin, y + 2); y += 10;
      doc.setFillColor(0, 200, 150); doc.rect(margin, y, contentW, 0.5, 'F'); y += 5;
    } else if (line.startsWith('### ')) {
      checkPage(12); y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(232, 237, 248);
      doc.text(line.replace('### ', ''), margin, y); y += 1;
      doc.setFillColor(26, 31, 46); doc.rect(margin, y + 1, contentW, 0.3, 'F'); y += 5;
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const text = line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '');
      const wrapped = doc.splitTextToSize(`• ${text}`, contentW - 4);
      checkPage(wrapped.length * 4.5 + 1);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(180, 185, 200);
      wrapped.forEach(wl => { doc.text(wl, margin + 3, y); y += 4.5; });
    } else if (line.trim() === '') {
      y += 2;
    } else {
      const text = line.replace(/\*\*/g, '');
      const wrapped = doc.splitTextToSize(text, contentW);
      checkPage(wrapped.length * 4.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(180, 185, 200);
      wrapped.forEach(wl => { doc.text(wl, margin, y); y += 4.5; });
    }
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(7, 8, 12); doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(40, 47, 66);
    doc.text(`TradePulse Journal Pro · ${typeInfo.label} · ${periodLabel}`, margin, pageH - 4);
    doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 4, { align:'right' });
  }

  const fileName = `tradepulse_${reportType}_${periodLabel.replace(/\s+/g,'_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);
}

// ─── Reportes Tab Component ───────────────────────────────────────────────────
function ReportesTab({ trades }) {
  const [reportTf,     setReportTf]     = useState("monthly");
  const [reportPeriod, setReportPeriod] = useState("");
  const [selectedType, setSelectedType] = useState("metricas");
  const [generatedContent, setGeneratedContent] = useState(null);
  const [activeReport,     setActiveReport]     = useState(null);
  const [error,            setError]            = useState(null);
  const [downloadingPdf,   setDownloadingPdf]   = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    const opts = buildPeriodOptions(reportTf, trades);
    setReportPeriod(opts.length ? opts[0].id : "");
    setGeneratedContent(null);
    setActiveReport(null);
  }, [reportTf]); // eslint-disable-line

  const periodOptions  = useMemo(() => buildPeriodOptions(reportTf, trades), [reportTf, trades]);
  const filteredTrades = useMemo(() => filterByPeriod(trades, reportTf, reportPeriod), [trades, reportTf, reportPeriod]);
  const stats          = useMemo(() => calcStats(filteredTrades), [filteredTrades]);
  const periodLabel    = useMemo(() => periodOptions.find(o => o.id === reportPeriod)?.label || reportPeriod || "Período", [periodOptions, reportPeriod]);

  function handleGenerate() {
    if (!filteredTrades.length) { setError("No hay trades en el período seleccionado."); return; }
    setError(null);
    let content = "";
    if (selectedType === "metricas") content = buildMetricasReport(stats, filteredTrades, periodLabel);
    if (selectedType === "mental")   content = buildMentalReport(filteredTrades, periodLabel);
    if (selectedType === "edge")     content = buildEdgeReport(stats, filteredTrades, periodLabel);
    setGeneratedContent(content);
    setActiveReport(selectedType);
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
  }

  async function handleDownloadPDF() {
    if (!generatedContent) return;
    setDownloadingPdf(true);
    try { await generatePDF(generatedContent, activeReport, periodLabel); }
    catch (e) { setError("Error al generar PDF: " + e.message); }
    finally { setDownloadingPdf(false); }
  }

  function renderContent(content) {
    const elements = []; let key = 0;
    content.split('\n').forEach(line => {
      if (line.startsWith('## ')) {
        elements.push(<div key={key++} style={{ marginTop:24, marginBottom:10 }}><div style={{ background:"rgba(0,200,150,0.06)", border:`1px solid ${G.accent}33`, borderRadius:8, padding:"10px 16px" }}><div style={{ fontSize:14, fontWeight:700, color:G.accent, fontFamily:G.fontDisplay }}>{line.replace('## ','')}</div></div></div>);
      } else if (line.startsWith('### ')) {
        elements.push(<div key={key++} style={{ marginTop:18, marginBottom:8 }}><div style={{ fontSize:12, fontWeight:600, color:G.textPrimary, fontFamily:G.fontDisplay, paddingBottom:6, borderBottom:`1px solid ${G.border}` }}>{line.replace('### ','')}</div></div>);
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        const text = line.replace(/^[-•]\s*/,'');
        elements.push(<div key={key++} style={{ display:"flex", gap:8, marginBottom:4, paddingLeft:8 }}><span style={{ color:G.accent, flexShrink:0, fontSize:10 }}>▸</span><span style={{ fontSize:11, color:G.textSec, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: text.replace(/\*\*([^*]+)\*\*/g,`<strong style="color:${G.textPrimary}">$1</strong>`) }}/></div>);
      } else if (line.trim() === '') {
        elements.push(<div key={key++} style={{ height:6 }}/>);
      } else {
        elements.push(<p key={key++} style={{ fontSize:11, color:G.textSec, lineHeight:1.7, marginBottom:4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g,`<strong style="color:${G.textPrimary}">$1</strong>`) }}/>);
      }
    });
    return elements;
  }

  return (
    <div className="fade-up" style={{ maxWidth:900, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:G.fontUI, fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>Reportes</h1>
        <p style={{ fontSize:11, color:G.textSec }}>Genera y descarga reportes PDF de tus datos de trading</p>
      </div>

      {/* 1. Período */}
      <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:12, padding:20, marginBottom:14 }}>
        <div style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:G.fontDisplay, marginBottom:14 }}>1. Seleccionar Período</div>
        <div style={{ marginBottom:12 }}>
          <TFSelector value={reportTf} onChange={v => { setReportTf(v); setGeneratedContent(null); }} options={REPORT_TF_OPTS}/>
        </div>
        <PeriodSelector tf={reportTf} periodId={reportPeriod} onChange={p => { setReportPeriod(p); setGeneratedContent(null); }} trades={trades}/>
        {!filteredTrades.length && reportPeriod && (
          <div style={{ marginTop:12, padding:"10px 14px", background:G.redDim, border:`1px solid ${G.red}33`, borderRadius:8, fontSize:11, color:G.red }}>
            ⚠ No hay trades en el período seleccionado.
          </div>
        )}
      </div>

      {/* 2. Tipo de reporte */}
      <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:12, padding:20, marginBottom:14 }}>
        <div style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:G.fontDisplay, marginBottom:14 }}>2. Tipo de Reporte</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {REPORT_TYPES.map(rt => (
            <button key={rt.id} onClick={() => { setSelectedType(rt.id); setGeneratedContent(null); setError(null); }}
              style={{ background:selectedType===rt.id?`${G.accent}12`:G.surfaceAlt, border:`1px solid ${selectedType===rt.id?G.accent:G.border}`, borderRadius:10, padding:"14px 16px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{ fontSize:18 }}>{rt.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:selectedType===rt.id?G.accent:G.textPrimary, fontFamily:G.fontDisplay }}>{rt.label}</span>
              </div>
              <div style={{ fontSize:10, color:G.textSec, lineHeight:1.4 }}>{rt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Generar */}
      <button
        onClick={handleGenerate}
        disabled={!filteredTrades.length}
        style={{ width:"100%", background:G.accent, color:G.bg, border:"none", borderRadius:10, padding:"14px 24px", cursor:!filteredTrades.length?"not-allowed":"pointer", fontFamily:G.fontDisplay, fontWeight:700, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:20, opacity:!filteredTrades.length?0.5:1 }}>
        <span>📄</span> Generar Reporte
      </button>

      {/* Error */}
      {error && (
        <div style={{ background:G.redDim, border:`1px solid ${G.red}44`, borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:11, color:G.red }}>{error}</div>
      )}

      {/* Reporte generado */}
      {generatedContent && (
        <div ref={previewRef} style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:12, overflow:"hidden", marginBottom:24 }}>
          <div style={{ background:"rgba(0,200,150,0.06)", borderBottom:`1px solid ${G.border}`, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:20 }}>{REPORT_TYPES.find(r=>r.id===activeReport)?.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:G.textPrimary, fontFamily:G.fontDisplay }}>{REPORT_TYPES.find(r=>r.id===activeReport)?.label}</div>
                <div style={{ fontSize:10, color:G.textSec }}>Período: <span style={{ color:G.accent }}>{periodLabel}</span> · {filteredTrades.length} registros</div>
              </div>
            </div>
            <button onClick={handleDownloadPDF} disabled={downloadingPdf}
              style={{ background:G.accent, color:G.bg, border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", fontFamily:G.fontDisplay, fontWeight:700, fontSize:11, display:"flex", alignItems:"center", gap:6 }}>
              {downloadingPdf ? "⟳ Generando..." : "⬇ Descargar PDF"}
            </button>
          </div>
          <div style={{ padding:"20px 24px", maxHeight:700, overflowY:"auto" }}>
            {renderContent(generatedContent)}
          </div>
        </div>
      )}

      {/* Placeholder */}
      {!generatedContent && (
        <div style={{ background:G.surfaceAlt, border:`1px solid ${G.border}`, borderRadius:12, padding:"40px 24px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
          <div style={{ fontSize:13, fontWeight:600, color:G.textPrimary, fontFamily:G.fontDisplay, marginBottom:8 }}>Tu reporte aparecerá aquí</div>
          <div style={{ fontSize:11, color:G.textSec, lineHeight:1.6 }}>Selecciona período y tipo, luego presiona <strong style={{ color:G.accent }}>Generar Reporte</strong></div>
        </div>
      )}
    </div>
  );
}


// Opciones estables fuera del componente — un objeto inline dentro del
// componente sería nuevo en cada render y podría causar re-ejecuciones.
const TRADES_OPTIONS = USE_SUPABASE
  ? {}
  : { useSample: true, sampleData: SAMPLE };

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    trades, loading, error, syncing,
    addTrade:    addTradeAsync,
    updateTrade: updateTradeAsync,
    deleteTrade: deleteTradeAsync,
    seedFromSample, reload,
  } = useTrades(TRADES_OPTIONS);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,        setTab]       = useState("dashboard");
  const [tf,         setTf]        = useState("monthly");
  const [tfPeriod,   setTfPeriod]  = useState("");
  const [analTf,     setAnalTf]    = useState("annual");
  const [analPeriod, setAnalPeriod]= useState("");
  const [addOpen,    setAddOpen]   = useState(false);
  const [editTrade,  setEditTrade] = useState(null);
  const [opError,    setOpError]   = useState(null);  // errores de CRUD
  const [mobNavOpen, setMobNavOpen] = useState(false);

  // Close mobile nav when clicking outside
  useEffect(() => {
    if (!mobNavOpen) return;
    const handler = (e) => {
      if (!e.target.closest('.nav-mobile')) setMobNavOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobNavOpen]);

  const TABS = [
    {id:"dashboard",label:"Dashboard"},
    {id:"trades",   label:"Trades"},
    {id:"analisis", label:"More Stats"},
    {id:"reportes", label:"Reportes"},
  ];

  // Sincroniza el período seleccionado cuando cambia el timeframe
  // IMPORTANTE: no depende de `trades` directamente para evitar re-fetch loop.
  // Solo se recalcula cuando cambia tf/analTf o cuando trades pasa de vacío a poblado.
  const tradesLoadedRef = useRef(false);
  useEffect(() => {
    if (!trades.length && tradesLoadedRef.current) return; // ya inicializado, no resetear
    if (trades.length) tradesLoadedRef.current = true;
    const opts = buildPeriodOptions(tf, trades);
    setTfPeriod(opts.length ? opts[0].id : "");
  }, [tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carga inicial de periodo cuando llegan los trades por primera vez
  const tfInitRef   = useRef(false);
  const analInitRef = useRef(false);
  useEffect(() => {
    if (!trades.length) return;
    if (!tfInitRef.current) {
      tfInitRef.current = true;
      const opts = buildPeriodOptions(tf, trades);
      setTfPeriod(opts.length ? opts[0].id : "");
    }
    if (!analInitRef.current) {
      analInitRef.current = true;
      const opts = buildPeriodOptions(analTf, trades);
      setAnalPeriod(opts.length ? opts[0].id : "");
    }
  }, [trades.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const opts = buildPeriodOptions(analTf, trades);
    setAnalPeriod(opts.length ? opts[0].id : "");
  }, [analTf]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date("2026-05-07");
  const latestDate = useMemo(() => { if(!trades.length)return now; return new Date([...trades].sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date); }, [trades]);
  const curYr=latestDate.getFullYear(), curMon=latestDate.getMonth();
  const currentMonthTrades = useMemo(() => trades.filter(t=>{const[yr,,mo]=t.date.split("-").map(Number);return yr===curYr&&(mo-1)===curMon;}), [trades,curYr,curMon]);
  const filteredTrades = useMemo(() => filterByPeriod(trades,tf,tfPeriod), [trades,tf,tfPeriod]);
  const stats          = useMemo(() => calcStats(filteredTrades), [filteredTrades]);
  const analTrades     = useMemo(() => filterByPeriod(trades,analTf,analPeriod), [trades,analTf,analPeriod]);

  function groupByKey(arr,key,onlyExec=true){const m={};arr.filter(t=>onlyExec?t.ejecutado:true).forEach(t=>{const k=t[key]||"Otro";if(!m[k])m[k]={wins:0,total:0,pnl:0,r:0};if(getResult(t)==="Win")m[k].wins++;m[k].total++;m[k].pnl+=t.pnl;m[k].r+=t.rr;});return Object.entries(m).sort(([,a],[,b])=>b.pnl-a.pnl).map(([label,d])=>({label,...d}));}

  const confAnalysis=useMemo(()=>{const c={cb:{wins:0,total:0,pnl:0,r:0},dc:{wins:0,total:0,pnl:0,r:0},both:{wins:0,total:0,pnl:0,r:0}};analTrades.forEach(t=>{const hasCB=(t.confluencias||[]).includes("Candle Bias");const hasDC=(t.confluencias||[]).includes("Daily Cycle");const add=key=>{if(getResult(t)==="Win")c[key].wins++;c[key].total++;c[key].pnl+=t.pnl;c[key].r+=t.rr;};if(hasCB&&hasDC)add("both");else if(hasCB)add("cb");else if(hasDC)add("dc");});return[{label:"Candle Bias",...c.cb},{label:"Daily Cycle",...c.dc},{label:"Ambos",...c.both}].filter(d=>d.total>0);},[analTrades]);
  const validAnalysis=useMemo(()=>[1,2,3,4].map(n=>{const vt=analTrades.filter(t=>t.validez===n);return{n,total:vt.length,wins:vt.filter(t=>getResult(t)==="Win").length,pnl:vt.reduce((s,t)=>s+t.pnl,0),r:vt.reduce((s,t)=>s+t.rr,0)};}).filter(d=>d.total>0),[analTrades]);
  const dayStats  =useMemo(()=>statsByDayOfWeek(trades),[trades]);
  const weekStats =useMemo(()=>statsByWeekOfMonth(trades),[trades]);
  const monthStats=useMemo(()=>statsByMonth(trades),[trades]);
  const monthlySeqs=useMemo(()=>{const m={};analTrades.filter(t=>t.ejecutado).forEach(t=>{const[yr,,mo]=t.date.split("-").map(Number);const mon=mo-1;const k=`${yr}-${String(mon).padStart(2,"0")}`;if(!m[k])m[k]={label:`${MESES_ES[mon]} ${yr}`,trades:[]};m[k].trades.push(t);});return Object.entries(m).sort(([a],[b])=>a>b?1:-1).map(([,v])=>v);},[analTrades]);
  const tradesByMonth=useMemo(()=>{const m={};analTrades.forEach(t=>{const[yr,,mo]=t.date.split("-").map(Number);const mon=mo-1;const k=`${yr}-${String(mon).padStart(2,"0")}`;const lbl=`${MESES_ES[mon]} ${yr}`;if(!m[k])m[k]={label:lbl,trades:[]};m[k].trades.push(t);});return Object.entries(m).sort(([a],[b])=>a>b?-1:1).map(([,v])=>v);},[analTrades]);
  const marketStats=useMemo(()=>MERCADOS.map(m=>{const mt=filteredTrades.filter(t=>t.mercado===m&&t.ejecutado);if(!mt.length)return null;return{m,pnl:mt.reduce((s,t)=>s+t.pnl,0),r:mt.reduce((s,t)=>s+t.rr,0),wr:((mt.filter(t=>getResult(t)==="Win").length/mt.length)*100).toFixed(0),len:mt.length};}).filter(Boolean),[filteredTrades]);
  const sesionStats=useMemo(()=>SESIONES.map(s=>{const st=filteredTrades.filter(t=>t.sesion===s&&t.ejecutado);if(!st.length)return null;return{s,pnl:st.reduce((a,t)=>a+t.pnl,0),r:st.reduce((a,t)=>a+t.rr,0),wr:((st.filter(t=>getResult(t)==="Win").length/st.length)*100).toFixed(0),len:st.length};}).filter(Boolean),[filteredTrades]);
  const dominantEmotion=useMemo(()=>{const counts={};filteredTrades.forEach(t=>{const s=t.estado_mental;if(s)counts[s]=(counts[s]||0)+1;});if(!Object.keys(counts).length)return null;const top=Object.entries(counts).sort(([,a],[,b])=>b-a)[0];return{state:top[0],count:top[1],total:filteredTrades.length,polarity:getMentalPolarity(top[0])};},[filteredTrades]);
  const mentalStateAnalysis=useMemo(()=>{const m={};analTrades.forEach(t=>{const s=t.estado_mental;if(!s)return;if(!m[s])m[s]={total:0,exec:0,wins:0,netPnl:0,missedProfit:0,avoidedLoss:0};m[s].total++;if(t.ejecutado){m[s].exec++;m[s].netPnl+=t.pnl;if(getResult(t)==="Win")m[s].wins++;}else{if(t.rr>0)m[s].missedProfit+=Math.abs(t.pnl);if(t.rr<0)m[s].avoidedLoss+=Math.abs(t.pnl);}});return Object.entries(m).map(([state,d])=>({state,total:d.total,exec:d.exec,wins:d.wins,netPnl:d.netPnl,missedProfit:d.missedProfit,avoidedLoss:d.avoidedLoss,winRate:d.exec>0?((d.wins/d.exec)*100).toFixed(0):"—",polarity:getMentalPolarity(state)})).sort((a,b)=>b.netPnl-a.netPnl);},[analTrades]);

  // ── CRUD wrappers (compatibles con modo demo y Supabase) ──────────────────
  async function addTrade(t) {
    setOpError(null);
    const { error: err } = await addTradeAsync(t);
    if (err) setOpError(err);
    else setAddOpen(false);
  }

  async function updateTrade(t) {
    setOpError(null);
    const { error: err } = await updateTradeAsync(t.id, t);
    if (err) setOpError(err);
    else setEditTrade(null);
  }

  async function deleteTrade(id) {
    setOpError(null);
    const { error: err } = await deleteTradeAsync(id);
    if (err) setOpError(err);
  }

  const curMonthPnl=currentMonthTrades.filter(t=>t.ejecutado).reduce((s,t)=>s+t.pnl,0);

  // ── Loading / Error global ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:"100vh", background:G.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
        <style>{STYLE}</style>
        <div style={{ fontFamily:G.fontDisplay, fontWeight:800, fontSize:18, letterSpacing:"-0.03em" }}>TRADE<span style={{ color:G.accent }}>PULSE</span></div>
        <div style={{ display:"flex", alignItems:"center", gap:10, color:G.textSec, fontSize:12, fontFamily:G.fontMono }}>
          <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${G.border}`, borderTopColor:G.accent, animation:"spin 0.8s linear infinite" }}/>
          {USE_SUPABASE ? "Conectando a Supabase..." : "Cargando datos..."}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight:"100vh", background:G.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}>
        <style>{STYLE}</style>
        <div style={{ maxWidth:460, textAlign:"center" }}>
          <div style={{ fontFamily:G.fontDisplay, fontWeight:800, fontSize:18, marginBottom:24 }}>TRADE<span style={{ color:G.accent }}>PULSE</span></div>
          <div style={{ background:"rgba(240,64,96,0.10)", border:"1px solid rgba(240,64,96,0.3)", borderRadius:10, padding:24 }}>
            <div style={{ fontSize:14, fontWeight:600, color:G.red, marginBottom:8 }}>Error de conexión a Supabase</div>
            <div style={{ fontSize:11, color:G.textSec, fontFamily:G.fontMono, marginBottom:16 }}>{error}</div>
            <button onClick={reload} style={{ background:G.accent, color:G.bg, border:"none", borderRadius:7, padding:"10px 22px", cursor:"pointer", fontFamily:G.fontDisplay, fontWeight:700 }}>Reintentar</button>
          </div>
          <div style={{ marginTop:16, fontSize:10, color:G.textMuted, fontFamily:G.fontMono }}>
            Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:G.bg }}>
      <style>{STYLE}</style>

      {/* ── HEADER ── */}
      <header style={{ borderBottom:`1px solid ${G.border}`, padding:"0 22px", display:"flex", alignItems:"center", justifyContent:"space-between", height:50, position:"sticky", top:0, background:G.bg, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div className="blink" style={{ width:6, height:6, borderRadius:"50%", background:USE_SUPABASE ? G.accent : G.yellow }}/>
          <span style={{ fontFamily:G.fontDisplay, fontWeight:800, fontSize:14, letterSpacing:"-0.03em" }}>TRADE<span style={{ color:G.accent }}>PULSE</span></span>
          <span style={{ color:G.border }}>|</span>
          <span style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em" }}>JOURNAL PRO</span>
          {/* Indicador de modo */}
          <span style={{ fontSize:8, padding:"2px 7px", borderRadius:10, background: USE_SUPABASE ? `${G.accent}20` : `${G.yellow}20`, color: USE_SUPABASE ? G.accent : G.yellow, border:`1px solid ${USE_SUPABASE ? G.accent : G.yellow}44`, fontFamily:G.fontMono }}>
            {USE_SUPABASE ? "● SUPABASE" : "◌ DEMO"}
          </span>
          {syncing && <span style={{ fontSize:8, color:G.textSec, fontFamily:G.fontMono }}>↻ guardando…</span>}
        </div>
        {/* Desktop nav */}
        <nav className="nav-desktop" style={{ gap:2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background:tab===t.id?G.surfaceAlt:"none",
                border:`1px solid ${tab===t.id?G.border:"transparent"}`,
                color:tab===t.id?G.textPrimary:G.textSec,
                borderRadius:6, padding:"5px 13px", cursor:"pointer", fontSize:10, fontFamily:G.fontMono, transition:"all 0.15s",
                ...(t.id==="reportes"&&tab!=="reportes" ? { color:G.accent } : {}),
              }}>
              {t.id==="reportes" ? <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontSize:9 }}>✦</span>{t.label}</span> : t.label}
            </button>
          ))}
        </nav>

        {/* Mobile nav dropdown */}
        <div className="nav-mobile" style={{ position:"relative", alignItems:"center" }}>
          <button
            onClick={() => setMobNavOpen(o => !o)}
            style={{
              display:"flex", alignItems:"center", gap:6,
              background: mobNavOpen ? G.surfaceAlt : "rgba(255,255,255,0.05)",
              border:`1px solid ${mobNavOpen ? G.borderHov : G.border}`,
              color: G.textPrimary, borderRadius:7, padding:"5px 11px",
              cursor:"pointer", fontSize:11, fontFamily:G.fontMono,
              transition:"all 0.15s", whiteSpace:"nowrap",
            }}>
            {TABS.find(t => t.id === tab)?.id === "reportes"
              ? <span style={{ color:G.accent }}>✦ {TABS.find(t => t.id === tab)?.label}</span>
              : TABS.find(t => t.id === tab)?.label}
            <span style={{
              fontSize:10, color:G.textSec, marginLeft:2,
              display:"inline-block",
              transform: mobNavOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition:"transform 0.18s",
            }}>▾</span>
          </button>
          {mobNavOpen && (
            <div className="mob-dropdown">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => { setTab(t.id); setMobNavOpen(false); }}>
                  {t.id === "reportes"
                    ? <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:9 }}>✦</span>{t.label}</span>
                    : t.label}
                  {tab === t.id && <span style={{ float:"right", color:G.accent, fontSize:9 }}>●</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main style={{ padding:"20px 22px", maxWidth:1380, margin:"0 auto" }}>

        {/* ══════════ DASHBOARD ════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="fade-up">
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div>
                  <h1 style={{ fontFamily:G.fontUI, fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:2 }}>Dashboard</h1>
                  <p style={{ fontSize:11, color:G.textSec }}>{filteredTrades.length} registros en el período seleccionado</p>
                </div>
                <div style={{ textAlign:"right", paddingTop:4 }}>
                  {stats.execCount >= 4 ? (
                    <>
                      <div style={{ fontSize:36, fontWeight:800, fontFamily:G.fontUI, color:pColor(stats.totalPnl), lineHeight:1, letterSpacing:"-0.04em" }}>{fmtD(stats.totalPnl)}</div>
                      <div style={{ fontSize:14, fontFamily:G.fontUI, fontWeight:600, color:pColor(parseFloat(stats.totalR)), letterSpacing:"-0.02em", marginTop:4 }}>{fmtR(stats.totalR)}</div>
                    </>
                  ) : (
                    <div style={{ fontSize:11, color:G.textMuted, fontFamily:G.fontMono, marginTop:6 }}>mín. 4 trades ejecutados</div>
                  )}
                </div>
              </div>
              <div style={{ marginTop:14, marginBottom:10 }}><TFSelector value={tf} onChange={v=>{setTf(v);}} options={TF_OPTS}/></div>
              <PeriodSelector tf={tf} periodId={tfPeriod} onChange={setTfPeriod} trades={trades}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))", gap:10, marginBottom:14 }}>
              <KpiCard label="Win Rate"     val={`${stats.winRate}%`}  col={G.accent} sub={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`}/>
              <KpiCard label="Profit Factor" val={stats.profitFactor} col={parseFloat(stats.profitFactor)>=1.5?G.accent:parseFloat(stats.profitFactor)>=1?G.yellow:G.red}/>
              <KpiCard label="Exp. Value"   val={`${stats.expValue}R`} col={parseFloat(stats.expValue)>0?G.accent:G.red} tag="por trade"/>
              <KpiCard label="Trades Ejec." val={stats.total}          sub={`Exec. Rate ${stats.execRate}%`}/>
              <KpiCard label="Mejor Racha"  val={stats.bestStreak>0?`${stats.bestStreak} trades`:"—"}  col={G.accent} sub="consecutivos ganadores"/>
              <KpiCard label="Peor Racha"   val={stats.worstStreak<0?`${Math.abs(stats.worstStreak)} trades`:"—"} col={G.red} sub="consecutivos perdedores"/>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:"15px 17px", display:"flex", flexDirection:"column", gap:6 }}>
                <span style={{ fontSize:9, color:G.textSec, letterSpacing:"0.13em", textTransform:"uppercase", fontFamily:G.fontDisplay }}>Dominant Emotion</span>
                {dominantEmotion?(<><MentalStateChip val={dominantEmotion.state} size="lg"/><span style={{fontSize:10,color:G.textSec}}>{dominantEmotion.count} de {dominantEmotion.total} trades</span></>):<span style={{fontSize:13,color:G.textMuted}}>Sin datos</span>}
              </div>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:"15px 17px", display:"flex", flexDirection:"column", gap:4 }}>
                <span style={{ fontSize:9, color:G.textSec, letterSpacing:"0.13em", textTransform:"uppercase", fontFamily:G.fontDisplay }}>Max. Drawdown</span>
                <span style={{ fontSize:21, fontWeight:700, fontFamily:G.fontDisplay, color:parseFloat(stats.maxDD)>0?G.red:G.textMuted, lineHeight:1.1 }}>{parseFloat(stats.maxDD)>0?`-$${stats.maxDD}`:"—"}</span>
                <span style={{ fontSize:10, color:G.textSec }}>{fmtR(-Math.abs(parseFloat(stats.maxDDR)))}</span>
              </div>
            </div>
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18, marginBottom:12 }}>
              <SectionHeader title="Curva de Equity"/>
              <Sparkline trades={filteredTrades} H={150}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:10, color:G.textSec }}><span>inicio del período</span><span style={{color:pColor(stats.totalPnl)}}>{fmtD(stats.totalPnl)} · {fmtR(stats.totalR)}</span></div>
            </div>
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18, marginBottom:12 }}>
              <SectionHeader title="Execution Rate"/>
              <div style={{ display:"flex", alignItems:"center", gap:32 }}>
                <DonutChart exec={stats.execCount} nonExec={stats.nonExecCount}/>
                <div style={{ fontSize:10, color:G.textSec }}>{stats.execRate}% de setups vistos ejecutados en el período</div>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>{(()=>{let seqYear,seqMonth;if(tf==="monthly"&&tfPeriod){const[yr,mo]=tfPeriod.split("-").map(Number);seqYear=yr;seqMonth=mo;}else if(tf==="weekly"&&tfPeriod){const d=new Date(tfPeriod);seqYear=d.getFullYear();seqMonth=d.getMonth();}else if(tf==="quarterly"&&tfPeriod){const[yr,qStr]=tfPeriod.split("-Q");seqYear=parseInt(yr);seqMonth=(parseInt(qStr)-1)*3;}else{const sorted=[...filteredTrades].sort((a,b)=>new Date(b.date)-new Date(a.date));const latest=sorted.length?new Date(sorted[0].date):new Date("2026-05-07");seqYear=latest.getFullYear();seqMonth=latest.getMonth();}return<ExecSequence trades={filteredTrades} year={seqYear} month={seqMonth}/>;})()}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Mercado"/>
                {!marketStats.length&&<div style={{color:G.textMuted,fontSize:11}}>Sin datos</div>}
                {marketStats.map(({m,pnl,r,wr,len})=>(<div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${G.border}`}}><div><div style={{fontSize:12,fontWeight:500,fontFamily:G.fontDisplay}}>{m}</div><div style={{fontSize:10,color:G.textSec}}>{len} trades · {wr}% WR</div></div><div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:pColor(pnl),fontFamily:G.fontDisplay}}>{fmtD(pnl)}</div><div style={{fontSize:10,color:pColor(r)}}>{fmtR(r)}</div></div></div>))}
              </div>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Sesión"/>
                {!sesionStats.length&&<div style={{color:G.textMuted,fontSize:11}}>Sin datos</div>}
                {sesionStats.map(({s,pnl,r,wr,len})=>(<div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${G.border}`}}><div><div style={{fontSize:12,fontWeight:500,fontFamily:G.fontDisplay}}>{s}</div><div style={{fontSize:10,color:G.textSec}}>{len} trades · {wr}% WR</div></div><div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:pColor(pnl),fontFamily:G.fontDisplay}}>{fmtD(pnl)}</div><div style={{fontSize:10,color:pColor(r)}}>{fmtR(r)}</div></div></div>))}
              </div>
            </div>
            <EconomicCalendar/>
          </div>
        )}

        {/* ══════════ TRADES ═══════════════════════════════════════════════ */}
        {tab === "trades" && (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div>
                <h1 style={{ fontFamily:G.fontUI, fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:2 }}>Trades</h1>
                <p style={{ fontSize:11, color:G.textSec }}>{trades.length} registros totales {USE_SUPABASE ? "· Supabase" : "· Demo"}</p>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {USE_SUPABASE && trades.length === 0 && (
                  <button onClick={() => seedFromSample(SAMPLE)}
                    style={{ background:`${G.yellow}20`, border:`1px solid ${G.yellow}66`, color:G.yellow, borderRadius:7, padding:"8px 14px", cursor:"pointer", fontSize:10, fontFamily:G.fontMono }}>
                    ↑ Migrar datos de muestra
                  </button>
                )}
                <button onClick={()=>{setAddOpen(p=>!p);setEditTrade(null);}} style={{ background:G.accent, color:G.bg, border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", fontFamily:G.fontDisplay, fontWeight:700, fontSize:12 }}>{addOpen?"× Cancelar":"+ Nuevo Trade"}</button>
              </div>
            </div>
            {opError && (
              <div style={{ background:"rgba(240,64,96,0.10)", border:"1px solid rgba(240,64,96,0.3)", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:11, color:G.red, fontFamily:G.fontMono, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                ⚠ {opError}
                <button onClick={() => setOpError(null)} style={{ background:"none", border:"none", color:G.red, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
              </div>
            )}
            {addOpen&&!editTrade&&<TradeForm onSave={addTrade} onCancel={()=>setAddOpen(false)}/>}
            {editTrade&&<TradeForm initial={editTrade} onSave={updateTrade} onCancel={()=>setEditTrade(null)}/>}
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
              <TradeTable trades={[...trades].sort((a,b)=>new Date(b.date)-new Date(a.date))} onDelete={deleteTrade} onEdit={t=>{setEditTrade(t);setAddOpen(false);window.scrollTo({top:0,behavior:'smooth'});}} showDelete={true}/>
            </div>
            {/* Trading Calendar — debajo de la tabla */}
            <TradingCalendar trades={trades}/>
          </div>
        )}

        {/* ══════════ ANALYSIS ═════════════════════════════════════════════ */}
        {tab === "analisis" && (
          <div className="fade-up">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div><h1 style={{ fontFamily:G.fontUI, fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:2 }}>More Stats</h1><p style={{ fontSize:11, color:G.textSec }}>{analTrades.length} registros en el período</p></div>
              <TFSelector value={analTf} onChange={v=>{setAnalTf(v);}} options={ANAL_TF_OPTS}/>
            </div>
            <div style={{ marginBottom:16 }}><PeriodSelector tf={analTf} periodId={analPeriod} onChange={setAnalPeriod} trades={trades}/></div>
            {/* Setup Performance */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Setup"/>
                <GroupBars data={groupByKey(analTrades,"setup",false)} barColor={G.accent}/>
              </div>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Mercado"/>
                <GroupBars data={groupByKey(analTrades,"mercado")} barColor={G.blue}/>
              </div>
            </div>
            {/* Confluencias & Validez */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Confluencias"/>
                <GroupBars data={confAnalysis} barColor={G.yellow}/>
              </div>
              <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
                <SectionHeader title="Por Validez"/>
                <GroupBars data={validAnalysis.map(d=>({...d,label:`Validez ${d.n}`}))} barColor={G.blue}/>
              </div>
            </div>
            {/* Calendar */}
            {/* Mental State Analysis */}
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18, marginBottom:12 }}>
              <SectionHeader title="Mental State vs Performance"/>
              {!mentalStateAnalysis.length&&<div style={{color:G.textMuted,fontSize:11,textAlign:"center",padding:"18px 0"}}>Sin datos de estado mental en este período</div>}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr style={{ borderBottom:`1px solid ${G.border}` }}>{["Estado Mental","Total","Exec","Exec Rate","Win Rate","Net PnL","Missed Profit","Avoided Loss"].map(h=><th key={h} style={{padding:"7px 12px",textAlign:"left",color:G.textSec,fontWeight:400,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {mentalStateAnalysis.map(r=>{
                      const avoidedLoss=r.avoidedLoss||0;
                      return(
                        <tr key={r.state} className="rh" style={{borderBottom:`1px solid ${G.border}`}}>
                          <td style={{padding:"10px 12px"}}><MentalStateChip val={r.state}/></td>
                          <td style={{padding:"10px 12px",color:G.textSec}}>{r.total}</td>
                          <td style={{padding:"10px 12px",color:G.textSec}}>{r.exec}</td>
                          <td style={{padding:"10px 12px"}}>{r.exec>0?<span style={{color:parseFloat((r.exec/r.total*100).toFixed(0))>=70?G.accent:G.yellow}}>{(r.exec/r.total*100).toFixed(0)}%</span>:<span style={{color:G.textMuted}}>—</span>}</td>
                          <td style={{padding:"10px 12px"}}>{r.winRate!=="—"?<span style={{color:parseFloat(r.winRate)>=50?G.accent:G.red}}>{r.winRate}%</span>:<span style={{color:G.textMuted}}>—</span>}</td>
                          <td style={{padding:"10px 12px",fontFamily:G.fontMono,whiteSpace:"nowrap"}}><span style={{color:pColor(r.netPnl)}}>{fmtD(r.netPnl)}</span></td>
                          <td style={{padding:"10px 12px",fontFamily:G.fontMono,whiteSpace:"nowrap"}}>{r.missedProfit>0?<span style={{color:G.yellow}}>{fmtD(r.missedProfit).replace(/^[+-]/,"")}</span>:<span style={{color:G.textMuted}}>—</span>}</td>
                          <td style={{padding:"10px 12px",fontFamily:G.fontMono,whiteSpace:"nowrap"}}>{avoidedLoss>0?<span style={{color:G.accent}}>{fmtD(avoidedLoss).replace(/^[+-]/,"")}</span>:<span style={{color:G.textMuted}}>—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Best/Worst */}
            <div style={{ marginBottom:4 }}>
              <div style={{ fontSize:9, color:G.textSec, marginBottom:8, fontFamily:G.fontDisplay }}>MEJOR / PEOR — basado en win rate histórico (todos los datos)</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
              <BWCard label="Mejor Semana" arr={weekStats}  best={true}/>
              <BWCard label="Mejor Día"    arr={dayStats}   best={true}/>
              <BWCard label="Mejor Mes"    arr={monthStats} best={true}/>
              <BWCard label="Peor Semana"  arr={weekStats}  best={false}/>
              <BWCard label="Peor Día"     arr={dayStats}   best={false}/>
              <BWCard label="Peor Mes"     arr={monthStats} best={false}/>
            </div>
            {/* Monthly Sequences */}
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18, marginBottom:12 }}>
              <SectionHeader title="Secuencia de Ejecución — Todos los Meses"/>
              {!monthlySeqs.length&&<div style={{color:G.textMuted,fontSize:11}}>Sin datos</div>}
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                {monthlySeqs.map(({label,trades:mt})=>{
                  const count=mt.length,validCount=mt.filter(t=>t.validez>=3).length,achieved=validCount>=6;
                  const boxes=Math.max(10,count+(10-count%10===10?0:10-count%10));
                  const sorted=[...mt].sort((a,b)=>new Date(a.date)-new Date(b.date));
                  const resC=r=>r==="Win"?G.accent:r==="Loss"?G.red:r==="BE"?G.white:G.border;
                  const resBg=r=>r==="Win"?`${G.accent}22`:r==="Loss"?`${G.red}22`:r==="BE"?"rgba(232,237,248,0.08)":"transparent";
                  return(
                    <div key={label}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:11,fontWeight:600,fontFamily:G.fontDisplay}}>{label}</span>{achieved&&<span style={{fontSize:13}}>🏆</span>}<span style={{fontSize:9,color:G.textSec,marginLeft:"auto"}}>{validCount} válidos · {count} ejec.</span></div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{Array.from({length:boxes}).map((_,i)=>{const t=sorted[i],r=t?getResult(t):null,counts=t&&t.validez>=3;return(<div key={i} title={t?`${t.date} · ${t.pair} · ${r||"BE"}`:""} style={{width:24,height:24,borderRadius:"50%",background:r?resBg(r):G.surfaceAlt,border:`2px solid ${r?resC(r):G.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:r?resC(r):G.textMuted,fontWeight:700,flexShrink:0,boxShadow:counts&&r?`0 0 5px ${resC(r)}44`:"none",opacity:t&&!counts?0.4:1}}>{r==="Win"?"W":r==="Loss"?"L":r==="BE"?"B":""}</div>);})}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* All Trades */}
            <div style={{ background:G.surface, border:`1px solid ${G.border}`, borderRadius:10, padding:18 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:9, color:G.textSec, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:G.fontDisplay }}>{`Todos los Trades — ${analTf==="quarterly"?"Trimestre":analTf==="annual"?"Anual":"All‑Time"}`}</div>
                <div style={{ textAlign:"right" }}>
                  {(()=>{const exec=analTrades.filter(t=>t.ejecutado);const pnl=exec.reduce((s,t)=>s+t.pnl,0);const r=exec.reduce((s,t)=>s+t.rr,0);return(<><div style={{fontSize:14,fontWeight:800,fontFamily:G.fontUI,color:pColor(pnl),lineHeight:1,letterSpacing:"-0.03em"}}>{fmtD(pnl)}</div><div style={{fontSize:11,fontWeight:600,fontFamily:G.fontUI,color:pColor(r),letterSpacing:"-0.02em",marginTop:2}}>{fmtR(r)}</div></>);})()} 
                </div>
              </div>
              {tradesByMonth.map(({label,trades:mt})=>(<div key={label} style={{marginBottom:24}}><div style={{fontSize:11,fontWeight:600,fontFamily:G.fontDisplay,color:G.textSec,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${G.border}`}}>{label} <span style={{fontWeight:400,fontSize:10}}>({mt.length})</span></div><TradeTable trades={mt} showDelete={false}/></div>))}
              {!tradesByMonth.length&&<div style={{color:G.textMuted,fontSize:12,textAlign:"center",padding:"28px 0"}}>Sin trades en este período</div>}
            </div>
          </div>
        )}

        {/* ══════════ REPORTES ═════════════════════════════════════════════ */}
        {tab === "reportes" && <ReportesTab trades={trades}/>}

      </main>
    </div>
  );
}
