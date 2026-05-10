-- ============================================================
-- TRADEPULSE JOURNAL PRO — Schema Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. TRADES
--    Tabla principal. Cada fila = un setup visto (ejecutado o no).
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists trades (
  id             uuid        primary key default uuid_generate_v4(),

  -- Core trade data
  date           date        not null,
  hora           time,
  pair           text        not null,
  mercado        text        not null check (mercado in ('Forex','Commodities','Índices')),
  sesion         text        not null,
  capital        numeric(12,2) not null default 0,
  rr             numeric(8,4)  not null default 0,
  pnl            numeric(12,2) not null default 0,

  -- Setup classification
  setup          text        not null,
  ejecutado      boolean     not null default true,
  validez        smallint    not null default 3 check (validez between 1 and 4),
  confluencias   text[]      not null default '{}',

  -- Psychology & context
  estado_mental  text,
  link           text,
  notas          text,
  tags           text[]      default '{}',

  -- Metadata
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Índices para filtros y agrupaciones frecuentes
create index if not exists idx_trades_date        on trades (date desc);
create index if not exists idx_trades_pair        on trades (pair);
create index if not exists idx_trades_setup       on trades (setup);
create index if not exists idx_trades_mercado     on trades (mercado);
create index if not exists idx_trades_sesion      on trades (sesion);
create index if not exists idx_trades_ejecutado   on trades (ejecutado);
create index if not exists idx_trades_estado_mental on trades (estado_mental);
create index if not exists idx_trades_year_month  on trades (extract(year from date), extract(month from date));

-- Auto-update de updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trades_set_updated_at
  before update on trades
  for each row execute procedure set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. TRADING SESSIONS (journal diario)
--    Una entrada por día de sesión con reflexión pre y post mercado.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists trading_sessions (
  id                  uuid        primary key default uuid_generate_v4(),
  date                date        not null unique,
  mercado_bias        text,                     -- 'Alcista' | 'Bajista' | 'Neutral'
  notas_pre           text,
  notas_post          text,
  estado_mental       text,
  nivel_disciplina    smallint    check (nivel_disciplina between 1 and 5),
  setups_vistos       integer     default 0,
  setups_ejecutados   integer     default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_sessions_date on trading_sessions (date desc);

create trigger sessions_set_updated_at
  before update on trading_sessions
  for each row execute procedure set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. OBJECTIVES (metas periódicas)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists objectives (
  id               uuid        primary key default uuid_generate_v4(),
  periodo          text        not null,        -- '2026-05', '2026-Q2', '2026'
  tipo_periodo     text        not null check (tipo_periodo in ('monthly','quarterly','annual')),
  win_rate_target  numeric(5,2),
  r_target         numeric(8,2),
  pnl_target       numeric(12,2),
  max_trades       integer,
  max_dd_target    numeric(12,2),
  notas            text,
  activo           boolean     default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists idx_objectives_periodo on objectives (periodo, tipo_periodo);

create trigger objectives_set_updated_at
  before update on objectives
  for each row execute procedure set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. STATS SNAPSHOTS (caché de estadísticas calculadas)
--    Se guarda/actualiza automáticamente tras cada operación de trade.
--    Permite reportes instantáneos sin recalcular.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists stats_snapshots (
  id              uuid        primary key default uuid_generate_v4(),
  periodo         text        not null,
  tipo_periodo    text        not null check (tipo_periodo in ('weekly','monthly','quarterly','annual','alltime')),
  total_trades    integer     default 0,
  wins            integer     default 0,
  losses          integer     default 0,
  bes             integer     default 0,
  win_rate        numeric(5,2) default 0,
  total_pnl       numeric(12,2) default 0,
  total_r         numeric(8,2) default 0,
  profit_factor   numeric(8,2),
  exp_value       numeric(8,4),
  max_drawdown    numeric(12,2) default 0,
  max_drawdown_r  numeric(8,2)  default 0,
  best_streak     integer     default 0,
  worst_streak    integer     default 0,
  exec_rate       numeric(5,2) default 0,
  generated_at    timestamptz not null default now()
);

create unique index if not exists idx_snapshots_periodo on stats_snapshots (periodo, tipo_periodo);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. USER CONFIG (configuración clave-valor flexible)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists user_config (
  id          uuid        primary key default uuid_generate_v4(),
  clave       text        not null unique,
  valor       jsonb       not null,
  descripcion text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger config_set_updated_at
  before update on user_config
  for each row execute procedure set_updated_at();

-- Valores por defecto
insert into user_config (clave, valor, descripcion) values
  ('capital_inicial',  '10000',         'Capital base para cálculos'),
  ('moneda',           '"USD"',         'Moneda base'),
  ('min_sample_req',   '6',             'Mínimo de trades válidos por mes'),
  ('validez_minima',   '3',             'Validez mínima para Min.Sample'),
  ('tema',             '"dark"',        'Tema de la UI')
on conflict (clave) do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. ANALYTICS EVENTS (telemetría interna extensible)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists analytics_events (
  id         uuid        primary key default uuid_generate_v4(),
  evento     text        not null,
  payload    jsonb       default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_evento     on analytics_events (evento);
create index if not exists idx_analytics_created_at on analytics_events (created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
--    Por ahora: acceso abierto (uso personal).
--    Para multi-usuario: reemplazar por "using (auth.uid() = user_id)".
-- ──────────────────────────────────────────────────────────────────────────────
alter table trades            enable row level security;
alter table trading_sessions  enable row level security;
alter table objectives        enable row level security;
alter table stats_snapshots   enable row level security;
alter table user_config       enable row level security;
alter table analytics_events  enable row level security;

create policy "open_trades"    on trades            for all using (true) with check (true);
create policy "open_sessions"  on trading_sessions  for all using (true) with check (true);
create policy "open_objectives" on objectives       for all using (true) with check (true);
create policy "open_snapshots" on stats_snapshots   for all using (true) with check (true);
create policy "open_config"    on user_config       for all using (true) with check (true);
create policy "open_analytics" on analytics_events  for all using (true) with check (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. VISTA: resumen mensual rápido
-- ──────────────────────────────────────────────────────────────────────────────
create or replace view monthly_summary as
select
  to_char(date, 'YYYY-MM')                                           as periodo,
  count(*)                                                            as total_registros,
  count(*) filter (where ejecutado)                                   as ejecutados,
  count(*) filter (where ejecutado and rr > 0)                       as wins,
  count(*) filter (where ejecutado and rr < 0)                       as losses,
  count(*) filter (where ejecutado and rr = 0)                       as bes,
  round(
    count(*) filter (where ejecutado and rr > 0)::numeric
    / nullif(count(*) filter (where ejecutado), 0) * 100, 1
  )                                                                   as win_rate,
  round(sum(pnl) filter (where ejecutado), 2)                        as total_pnl,
  round(sum(rr)  filter (where ejecutado), 2)                        as total_r,
  round(
    count(*) filter (where ejecutado)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                                                   as exec_rate
from trades
group by to_char(date, 'YYYY-MM')
order by periodo desc;
