-- The whole team (admin + operador) shares the Turo data on the main-menu pages
-- (Dashboard, Reservas, Calendário, Clientes, Turo). Tokens stay admin-only.

create policy "Staff can view turo_trips" on vertex.turo_trips
  for select using (vertex.get_current_user_role() = any (array['admin'::vertex.app_role, 'operador'::vertex.app_role]));

create policy "Staff can view turo_receipts" on vertex.turo_receipts
  for select using (vertex.get_current_user_role() = any (array['admin'::vertex.app_role, 'operador'::vertex.app_role]));

create policy "Staff can view turo_guests" on vertex.turo_guests
  for select using (vertex.get_current_user_role() = any (array['admin'::vertex.app_role, 'operador'::vertex.app_role]));

-- Our own notes / phone / email on a guest profile.
create policy "Operador can update turo_guests" on vertex.turo_guests
  for update using (vertex.get_current_user_role() = 'operador'::vertex.app_role)
  with check (vertex.get_current_user_role() = 'operador'::vertex.app_role);

-- Last Turo sync time for the dashboard, without exposing the token rows.
create or replace function vertex.turo_last_synced_at()
returns timestamptz
language sql
stable
security definer
set search_path = vertex, public
as $$
  select case
    when vertex.get_current_user_role() = any (array['admin'::vertex.app_role, 'operador'::vertex.app_role])
      then (select max(last_synced_at) from vertex.turo_tokens)
  end;
$$;

revoke all on function vertex.turo_last_synced_at() from public, anon;
grant execute on function vertex.turo_last_synced_at() to authenticated;
