create table "auth"."user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "auth"."session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "auth"."user" ("id") on delete cascade);

create table "auth"."account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "auth"."user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "auth"."verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

-- maybe should be named session_userId_idx
create index "auth_session_userId_idx" on "auth"."session" ("userId");

-- maybe should be named account_userId_idx
create index "auth_account_userId_idx" on "auth"."account" ("userId");

-- maybe should be named verification_identifier_idx
create index "auth_verification_identifier_idx" on "auth"."verification" ("identifier");

alter table "auth"."session" add column "activeOrganizationId" text;

alter table "auth"."session" add column "activeTeamId" text;

create table "auth"."organization" ("id" text not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdAt" timestamptz not null, "metadata" text);

create table "auth"."team" ("id" text not null primary key, "name" text not null, "organizationId" text not null references "auth"."organization" ("id") on delete cascade, "createdAt" timestamptz not null, "updatedAt" timestamptz);

create table "auth"."teamMember" ("id" text not null primary key, "teamId" text not null references "auth"."team" ("id") on delete cascade, "userId" text not null references "auth"."user" ("id") on delete cascade, "createdAt" timestamptz);

create table "auth"."member" ("id" text not null primary key, "organizationId" text not null references "auth"."organization" ("id") on delete cascade, "userId" text not null references "auth"."user" ("id") on delete cascade, "role" text not null, "createdAt" timestamptz not null);

create table "auth"."invitation" ("id" text not null primary key, "organizationId" text not null references "auth"."organization" ("id") on delete cascade, "email" text not null, "role" text, "teamId" text, "status" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "inviterId" text not null references "auth"."user" ("id") on delete cascade);

create unique index "auth_organization_slug_uidx" on "auth"."organization" ("slug");

create index "auth_team_organizationId_idx" on "auth"."team" ("organizationId");

create index "auth_teamMember_teamId_idx" on "auth"."teamMember" ("teamId");

create index "auth_teamMember_userId_idx" on "auth"."teamMember" ("userId");

create index "auth_member_organizationId_idx" on "auth"."member" ("organizationId");

create index "auth_member_userId_idx" on "auth"."member" ("userId");

create index "auth_invitation_organizationId_idx" on "auth"."invitation" ("organizationId");

create index "auth_invitation_email_idx" on "auth"."invitation" ("email");

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO auth_user;
GRANT REFERENCES ON ALL TABLES IN SCHEMA auth TO owner_role;
