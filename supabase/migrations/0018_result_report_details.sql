-- Result declaration letter fields (file no, dated, university ref, swearing-in).

alter table public.elections
  add column if not exists report_file_no text,
  add column if not exists report_dated date,
  add column if not exists report_ref_no text,
  add column if not exists report_ref_dated date,
  add column if not exists report_ceremony_date date,
  add column if not exists report_ceremony_time text,
  add column if not exists report_ceremony_venue text;
