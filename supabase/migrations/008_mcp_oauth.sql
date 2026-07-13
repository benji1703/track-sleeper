-- Private ChatGPT MCP connection. OAuth credentials are opaque random values;
-- only SHA-256 hashes are persisted so a database read cannot reveal tokens.

create table if not exists mcp_oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris jsonb not null,
  created_at timestamptz not null default now(),
  constraint mcp_oauth_clients_redirect_uris_array
    check (jsonb_typeof(redirect_uris) = 'array')
);

create table if not exists mcp_oauth_codes (
  code_hash text primary key,
  client_id text not null references mcp_oauth_clients (client_id) on delete cascade,
  user_email text not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text not null,
  scope text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expires_idx
  on mcp_oauth_codes (expires_at);

create table if not exists mcp_oauth_tokens (
  token_hash text primary key,
  token_kind text not null check (token_kind in ('access', 'refresh')),
  client_id text not null references mcp_oauth_clients (client_id) on delete cascade,
  user_email text not null,
  resource text not null,
  scope text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_tokens_lookup_idx
  on mcp_oauth_tokens (token_kind, expires_at)
  where revoked_at is null;

alter table mcp_oauth_clients enable row level security;
alter table mcp_oauth_codes enable row level security;
alter table mcp_oauth_tokens enable row level security;
