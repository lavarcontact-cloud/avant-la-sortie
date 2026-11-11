-- Tests des règles métier de PROMOTER OS.
-- Lancement : ./promoter-os/supabase/tests/run.sh  (PostgreSQL local, base jetable)
-- Chaque bloc lève une exception si une règle n'est pas respectée.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Données de test (fictives) ---------------------------------------------
insert into workspaces (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Test');
insert into workspaces (id, name) values ('00000000-0000-0000-0000-0000000000a2', 'Autre promoteur');
insert into workspace_members values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000d', 'door'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into venues (id, workspace_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Little Room'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Bridge');
insert into message_templates (id, workspace_id, name, kind, variant, body) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Invit', 'invitation', 'A', 'Salut {{prenom}}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Invit', 'invitation', 'B', 'Hello {{prenom}}');
insert into events (id, workspace_id, venue_id, title, starts_at, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000b1', 'Samedi', now() + interval '3 days', 'open'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000b1', 'Samedi d''après', now() + interval '10 days', 'open');

-- 12 contacts majeurs vérifiés, consentement Little Room
insert into contacts (workspace_id, instagram_handle, source, adult_verified_at)
select '00000000-0000-0000-0000-0000000000a1', 'guest_' || g, 'inbound_dm', now()
from generate_series(1, 12) g;
insert into consents (contact_id, venue_id, purpose, evidence)
select id, '00000000-0000-0000-0000-0000000000b1', 'invitations', 'DM entrant INVITATION' from contacts;

-- 1. Doublon de contact (même handle, casse différente) refusé ------------
do $$ begin
  begin
    insert into contacts (workspace_id, instagram_handle, source)
      values ('00000000-0000-0000-0000-0000000000a1', 'GUEST_1', 'manual');
    raise exception 'ECHEC: doublon de contact accepté';
  exception when unique_violation then null; end;
end $$;

-- 2. Doublon d'invitation pour la même soirée refusé ----------------------
insert into invitations (event_id, contact_id, template_id)
select '00000000-0000-0000-0000-0000000000e1', id,
       case when instagram_handle in ('guest_1','guest_2','guest_3','guest_4','guest_5','guest_6')
            then '00000000-0000-0000-0000-0000000000c1'::uuid else '00000000-0000-0000-0000-0000000000c2'::uuid end
from contacts;
do $$ begin
  begin
    insert into invitations (event_id, contact_id)
      select '00000000-0000-0000-0000-0000000000e1', id from contacts where instagram_handle = 'guest_1';
    raise exception 'ECHEC: double invitation acceptée';
  exception when unique_violation then null; end;
end $$;

-- 3. Pas de consentement pour l'établissement → refus ---------------------
do $$ declare c uuid; begin
  insert into contacts (workspace_id, instagram_handle, source, adult_verified_at)
    values ('00000000-0000-0000-0000-0000000000a1', 'sans_consent', 'manual', now()) returning id into c;
  -- consentement Bridge uniquement : ne vaut pas pour Little Room
  insert into consents (contact_id, venue_id, purpose, evidence)
    values (c, '00000000-0000-0000-0000-0000000000b2', 'invitations', 'test');
  begin
    insert into invitations (event_id, contact_id) values ('00000000-0000-0000-0000-0000000000e1', c);
    raise exception 'ECHEC: invitation sans consentement acceptée';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
end $$;

-- 4. Majorité non vérifiée + alcool → refus -------------------------------
do $$ declare c uuid; begin
  insert into contacts (workspace_id, instagram_handle, source)
    values ('00000000-0000-0000-0000-0000000000a1', 'non_verifiee', 'manual') returning id into c;
  insert into consents (contact_id, venue_id, purpose, evidence)
    values (c, '00000000-0000-0000-0000-0000000000b1', 'invitations', 'test');
  begin
    insert into invitations (event_id, contact_id) values ('00000000-0000-0000-0000-0000000000e1', c);
    raise exception 'ECHEC: invitation alcool sans majorité acceptée';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
end $$;

-- 5. Relance unique -------------------------------------------------------
update invitations set status = 'sent' where event_id = '00000000-0000-0000-0000-0000000000e1';
do $$ declare inv uuid; begin
  select i.id into inv from invitations i join contacts c on c.id = i.contact_id
    where c.instagram_handle = 'guest_12' and i.event_id = '00000000-0000-0000-0000-0000000000e1';
  perform relance_invitation(inv);
  begin
    perform relance_invitation(inv);
    raise exception 'ECHEC: deuxième relance acceptée';
  exception when check_violation then null; end;
end $$;

-- 6. Relance impossible sur une invitation qui a déjà une réponse ---------
update invitations i set status = 'yes' from contacts c
  where c.id = i.contact_id and i.event_id = '00000000-0000-0000-0000-0000000000e1'
    and c.instagram_handle in ('guest_1','guest_2','guest_3','guest_4','guest_5','guest_6','guest_7','guest_8','guest_9','guest_10');
update invitations i set status = 'no' from contacts c
  where c.id = i.contact_id and c.instagram_handle = 'guest_11';
do $$ declare inv uuid; begin
  select i.id into inv from invitations i join contacts c on c.id = i.contact_id where c.instagram_handle = 'guest_11';
  begin
    perform relance_invitation(inv);
    raise exception 'ECHEC: relance sur une réponse NON acceptée';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
end $$;

-- 7. Horodatages automatiques ---------------------------------------------
do $$ begin
  if exists (select 1 from invitations where status = 'yes' and (confirmed_at is null or responded_at is null or sent_at is null)) then
    raise exception 'ECHEC: horodatages manquants';
  end if;
end $$;

-- 8. Rôle "door" : peut pointer, ne peut rien changer d'autre -------------
do $r$ begin create role app_user nologin; exception when duplicate_object then null; end $r$;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
set role app_user;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
update invitations i set attendance = 'present' from contacts c
  where c.id = i.contact_id and c.instagram_handle in ('guest_1','guest_2','guest_3','guest_4','guest_5','guest_6','guest_7','guest_8','guest_9');
do $$ begin
  begin
    update invitations set status = 'no' where status = 'yes';
    raise exception 'ECHEC: le rôle door a modifié un statut';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
  if (select count(*) from contacts) <> 10 then
    raise exception 'ECHEC: le rôle door voit % contacts (attendu : 10 confirmées)', (select count(*) from contacts);
  end if;
end $$;
-- guest_10 a confirmé mais n'est pas venue
update invitations i set attendance = 'absent' from contacts c
  where c.id = i.contact_id and c.instagram_handle = 'guest_10';
reset role;
reset request.jwt.claim.sub;

do $$ begin
  if exists (select 1 from invitations where attendance = 'present' and (checked_in_at is null or checked_in_by is null)) then
    raise exception 'ECHEC: pointage sans horodatage / auteur';
  end if;
end $$;

-- 9. Isolation entre espaces : l'autre promoteur ne voit rien -------------
set role app_user;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from contacts) <> 0 or (select count(*) from invitations) <> 0
     or (select count(*) from event_report) <> 0 then
    raise exception 'ECHEC: fuite de données entre espaces';
  end if;
end $$;
reset role;
reset request.jwt.claim.sub;

-- 10. Bilan de soirée et commission ---------------------------------------
do $$ declare r event_report; begin
  select * into r from event_report where event_id = '00000000-0000-0000-0000-0000000000e1';
  if r.invited <> 12 or r.replied <> 11 or r.accepted <> 10 or r.present <> 9 or r.no_shows <> 1 or r.relanced <> 1 then
    raise exception 'ECHEC: bilan incorrect %', row_to_json(r);
  end if;
  -- 9 présentes / groupe de 10 → 0 groupe rempli, 0 € (la règle ne gonfle pas les chiffres)
  if r.groups_filled <> 0 or r.commission_due <> 0 then
    raise exception 'ECHEC: commission incorrecte %', row_to_json(r);
  end if;
end $$;

-- Une 10e arrivée → 1 groupe → 300 €
update invitations i set attendance = 'present' from contacts c
  where c.id = i.contact_id and c.instagram_handle = 'guest_12' and i.event_id = '00000000-0000-0000-0000-0000000000e1';
insert into commission_payments (event_id, amount) values ('00000000-0000-0000-0000-0000000000e1', 300);
do $$ declare r event_report; begin
  select * into r from event_report where event_id = '00000000-0000-0000-0000-0000000000e1';
  if r.groups_filled <> 1 or r.commission_due <> 300 or r.commission_paid <> 300 then
    raise exception 'ECHEC: commission après 10e arrivée %', row_to_json(r);
  end if;
end $$;

-- 11. A/B : présences comparées par variante ------------------------------
do $$ declare a numeric; b numeric; begin
  select presence_rate into a from template_performance where variant = 'A';
  select presence_rate into b from template_performance where variant = 'B';
  -- A : guest_1..6 → 6/6 présentes. B : guest_7..12 → 7,8,9,12 présentes = 4/6
  if a <> 1.000 or b <> 0.667 then
    raise exception 'ECHEC: A/B incorrect (A=%, B=%)', a, b;
  end if;
end $$;

-- 12. Seuil d'absence réglable --------------------------------------------
-- Seuil par défaut = 2 : une absence ne signale pas encore guest_10.
do $$ begin
  if (select status from contacts where instagram_handle = 'guest_10') <> 'active' then
    raise exception 'ECHEC: contact signalé dès la 1re absence avec seuil 2';
  end if;
end $$;
-- Deuxième soirée, deuxième absence après confirmation → signalée (pas supprimée).
insert into invitations (event_id, contact_id, status)
  select '00000000-0000-0000-0000-0000000000e2', id, 'sent' from contacts where instagram_handle = 'guest_10';
update invitations i set status = 'yes' from contacts c
  where c.id = i.contact_id and c.instagram_handle = 'guest_10' and i.event_id = '00000000-0000-0000-0000-0000000000e2';
update invitations i set attendance = 'absent' from contacts c
  where c.id = i.contact_id and c.instagram_handle = 'guest_10' and i.event_id = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  if (select status from contacts where instagram_handle = 'guest_10') <> 'flagged' then
    raise exception 'ECHEC: contact non signalé après 2 absences';
  end if;
  if (select no_shows from contact_stats where instagram_handle = 'guest_10') <> 2 then
    raise exception 'ECHEC: compteur d''absences incorrect';
  end if;
end $$;

-- 13. Désinscription : consentements révoqués, invitations futures annulées, plus invitable
do $$ declare c uuid; begin
  select id into c from contacts where instagram_handle = 'guest_1';
  insert into invitations (event_id, contact_id) values ('00000000-0000-0000-0000-0000000000e2', c);
  perform unsubscribe_contact(c);
  if exists (select 1 from consents where contact_id = c and revoked_at is null) then
    raise exception 'ECHEC: consentement non révoqué';
  end if;
  if (select status from invitations where contact_id = c and event_id = '00000000-0000-0000-0000-0000000000e2') <> 'cancelled' then
    raise exception 'ECHEC: invitation future non annulée';
  end if;
  -- l'historique passé est conservé
  if (select attendance from invitations where contact_id = c and event_id = '00000000-0000-0000-0000-0000000000e1') <> 'present' then
    raise exception 'ECHEC: historique passé altéré';
  end if;
end $$;

-- 14. Journal d'audit alimenté -------------------------------------------
do $$ begin
  if (select count(*) from audit_log where entity = 'invitations' and action = 'update') = 0
     or (select count(*) from audit_log where actor = '00000000-0000-0000-0000-00000000000d') = 0 then
    raise exception 'ECHEC: journal d''audit incomplet';
  end if;
end $$;

\echo 'OK : 14 groupes de tests passés'
