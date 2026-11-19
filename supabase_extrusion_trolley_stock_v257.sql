-- AIS Tracker V257: trolley reference for physical extrusion stock movements
-- Additive and safe to run repeatedly. Existing stock movement and receipt rows are preserved.
alter table public.extrusion_stock_movements
  add column if not exists trolley_no text not null default '';

create index if not exists extrusion_stock_movements_trolley_idx
  on public.extrusion_stock_movements(trolley_no);

comment on column public.extrusion_stock_movements.trolley_no is
  'Plant trolley identifier for extrusion stock IN; optional for OUT and SET movements.';
