create table public.scrapped_visit (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  type_reaction text not null,
  profil_linkedin_url_reaction text not null,
  profil_fullname text null,
  linkedin_url_profil_visited text not null,
  date_start_after_initial_setup date null,
  headline text null,
  date_scrapped text not null,
  date_scrapped_calculated date not null,
  constraint scrapped_visit_pkey primary key (
    profil_linkedin_url_reaction,
    linkedin_url_profil_visited,
    date_scrapped_calculated
  )
) TABLESPACE pg_default;

create trigger add_linkedin_url_to_waiting_list_enrich_queue_scrapped_visit_tr
after INSERT on scrapped_visit for EACH row
execute FUNCTION add_linkedin_url_to_waiting_list_enrich_queue ('contact', 'profil_linkedin_url_reaction');

create trigger "scrapped visit to slack"
after INSERT on scrapped_visit for EACH row
execute FUNCTION supabase_functions.http_request (
  'https://hooks.zapier.com/hooks/catch/8419032/2pd6lsy/',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
