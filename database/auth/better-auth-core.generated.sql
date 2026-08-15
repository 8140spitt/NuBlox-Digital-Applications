create table `auth_users` (`id` varchar(36) not null primary key, `display_name` varchar(255) not null, `email` varchar(255) not null unique, `email_verified` boolean not null, `image` text, `created_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updated_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null);

create table `auth_sessions` (`id` varchar(36) not null primary key, `expires_at` timestamp(3) not null, `token` varchar(255) not null unique, `created_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updated_at` timestamp(3) not null, `ip_address` text, `user_agent` text, `auth_user_id` varchar(36) not null references `auth_users` (`id`) on delete cascade);

create table `auth_accounts` (`id` varchar(36) not null primary key, `provider_account_id` text not null, `provider_id` text not null, `auth_user_id` varchar(36) not null references `auth_users` (`id`) on delete cascade, `access_token` text, `refresh_token` text, `id_token` text, `access_token_expires_at` timestamp(3), `refresh_token_expires_at` timestamp(3), `scope` text, `password` text, `created_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updated_at` timestamp(3) not null);

create table `auth_verifications` (`id` varchar(36) not null primary key, `identifier` varchar(255) not null, `value` text not null, `expires_at` timestamp(3) not null, `created_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null, `updated_at` timestamp(3) default CURRENT_TIMESTAMP(3) not null);

create index `auth_sessions_auth_user_id_idx` on `auth_sessions` (`auth_user_id`);

create index `auth_accounts_auth_user_id_idx` on `auth_accounts` (`auth_user_id`);

create index `auth_verifications_identifier_idx` on `auth_verifications` (`identifier`);