-- Rappels individuels : "préviens-moi" sur une sortie, une date ou une ouverture du Labo.
create table reminders (
  user_id     uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('release','event','drop')),
  target_id   uuid not null,
  remind_at   timestamptz not null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index on reminders (remind_at) where sent_at is null;
