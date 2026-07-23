-- Lead source categorization: every source is either inbound (the lead
-- reached out to us) or outbound (we reached out to them). This lives on
-- `sources` (not a new column on `leads`) so it's just another attribute
-- of the existing runtime-configurable lookup table, same as label/is_active.

alter table public.sources add column direction text not null default 'inbound' check (direction in ('inbound', 'outbound'));

update public.sources set direction = 'inbound' where label in ('Facebook ad', 'Website form', 'Referral');
update public.sources set direction = 'outbound' where label = 'Foreclosure Monitor';

insert into public.sources (label, direction, is_active) values
  ('Bandit Sign', 'inbound', true),
  ('Agent', 'inbound', true),
  ('Cold Call', 'outbound', true),
  ('FSBO', 'outbound', true),
  ('Text', 'outbound', true),
  ('Door Knock', 'outbound', true);
