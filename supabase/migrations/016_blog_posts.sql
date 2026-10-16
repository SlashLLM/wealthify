-- Blog posts + cover/inline image storage.
--
-- Public site reads published posts with the anon key; RLS hides drafts and
-- posts scheduled for the future. Every write (and every admin read, which
-- includes drafts) goes through api/blog.js with SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. Anon gets no write grants: the anon key is not a secret,
-- so an anon write policy would let anyone edit the blog.
-- Safe to re-run.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  excerpt text not null default '',
  content_md text not null default '',
  cover_image_url text,
  cover_image_alt text,
  category text not null default 'Mortgages',
  tags text[] not null default '{}',
  author_name text not null default 'Wealthify Team',
  author_role text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  reading_minutes int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists blog_posts_slug_key on public.blog_posts (slug);
create index if not exists blog_posts_published_idx
  on public.blog_posts (published_at desc)
  where status = 'published';

create or replace function public.blog_posts_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.blog_posts_touch_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "anon_select_published_blog_posts" on public.blog_posts;
create policy "anon_select_published_blog_posts"
  on public.blog_posts
  for select
  to anon
  using (status = 'published' and published_at is not null and published_at <= now());

grant usage on schema public to anon;
grant select on public.blog_posts to anon;

-- Public bucket: images are readable by URL, uploads need the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
