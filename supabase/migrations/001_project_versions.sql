create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled Project',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  design_md text not null,
  screens jsonb not null default '[]',
  context_snapshot jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table projects enable row level security;
alter table project_versions enable row level security;

create policy "users see own projects"
  on projects for all
  using (auth.uid() = user_id);

create policy "users see own versions"
  on project_versions for all
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create index on project_versions(project_id, created_at desc);
