-- ============================================================
-- 디지털기기 관리 플랫폼 — Supabase 초기 스키마
-- Supabase > SQL Editor 에서 실행하세요
-- ============================================================

-- [사전 설정] Supabase > Authentication > Providers > Email
-- "Confirm email" 옵션을 OFF 로 설정하세요.
-- (ON이면 회원가입 후 이메일 인증 전까지 DB 쓰기가 불가능합니다)

-- ============================================================
-- 테이블 생성
-- ============================================================

-- 1. 학교 설정 (학교마다 독립 행)
create table if not exists school_config (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_code text not null unique,
  created_at timestamptz default now()
);

-- 2. 관리자-학교 연결 (admin_profiles) — 학교당 관리자 1명 강제
create table if not exists admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null unique references school_config(id) on delete cascade,
  created_at timestamptz default now()
);

-- 3. 학급 정보 (school_id로 학교별 격리)
create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  class_name text not null,
  teacher_name text,
  created_at timestamptz default now(),
  unique(school_id, class_name)
);

-- 4. 기기 종류 마스터 (전역 공유 — school_id 없음)
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_type text not null unique,
  description text,
  created_at timestamptz default now()
);

insert into devices (device_type, description) values
  ('크롬북', '크롬OS 노트북'),
  ('펜 (스타일러스)', '터치스크린용 펜'),
  ('마우스', 'USB/블루투스 마우스'),
  ('충전 케이블', 'USB-C 충전 케이블')
on conflict do nothing;

-- 5. 학급별 기기 보유 현황
create table if not exists classroom_devices (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  quantity int not null default 0,
  updated_at timestamptz,
  unique(classroom_id, device_id)
);

-- 6. 고장 신고
create table if not exists repair_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid references devices(id),
  quantity int not null default 1,
  description text,
  status text not null default '접수 대기'
    check (status in ('접수 대기', '수리 중', '처리 완료')),
  reported_at timestamptz default now(),
  resolved_at timestamptz
);

-- 7. 학교 공유 기기
create table if not exists shared_devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  device_name text not null,
  total_quantity int not null default 0,
  available_quantity int not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 8. 대여·반납 이력
create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid references shared_devices(id),
  quantity int not null default 1,
  description text,
  rented_at timestamptz default now(),
  returned_at timestamptz,
  status text not null default '대여 중'
    check (status in ('대여 중', '반납 요청 중', '반납 완료'))
);

-- 9. 학생 목록 (크롬북 관리용)
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  name text not null,
  grade text,
  class_name text,
  student_number text,
  created_at timestamptz default now()
);

-- 10. 크롬북 기기 목록
create table if not exists chromebooks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  device_number text not null,
  device_year text,
  student_id uuid unique references students(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz default now(),
  unique(school_id, device_number)
);

-- 11. 튜터 수업 지원 신청
create table if not exists tutor_supports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  support_date date not null,
  period text not null
    check (period in ('1교시', '2교시', '3교시', '4교시', '5-1교시', '5-2교시', '6교시')),
  content text not null,
  created_at timestamptz default now()
);

-- 12. 교사기기대여 (교사 개인 기기 대여증·반납증)
create table if not exists teacher_device_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  status text not null default '대여중'
    check (status in ('대여중', '반납완료')),

  -- 대여
  borrower_name text not null,
  device_type text,
  device_etc text,
  model text,
  asset_no text,
  parts text[],
  parts_etc text,
  note text,
  rent_date date not null default current_date,
  sig_borrower text not null,
  sig_manager_out text not null,
  manager_out_name text,

  -- 반납
  return_date date,
  condition text,
  condition_etc text,
  return_note text,
  sig_returner text,
  sig_manager_in text,
  manager_in_name text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 13. 운영자 (플랫폼 슈퍼관리자, 소속 학교 없음)
create table if not exists operator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

-- 14. 심의받은 소프트웨어 목록 (소프트웨어 조회 탭)
create table if not exists approved_software (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  name text not null,
  company text,
  eduzip_registered boolean not null default false,
  eduzip_url text,
  note text,
  is_active boolean not null default true,
  source_request_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 학교 안에서 이름+회사 중복 방지 (앞뒤 공백·대소문자 무시)
create unique index if not exists idx_approved_software_unique
  on approved_software (school_id, lower(btrim(name)), lower(btrim(coalesce(company, ''))));

-- 15. 교사가 신청한 소프트웨어
create table if not exists software_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references school_config(id) on delete cascade,
  classroom_id uuid references classrooms(id) on delete set null,
  requester_name text not null,
  name text not null,
  company text not null,
  eduzip_registered boolean not null default false,
  eduzip_url text not null,
  purpose text,
  status text not null default '처리중'
    check (status in ('처리중', '심의완료')),
  processed_at timestamptz,
  processed_by text,
  approved_software_id uuid references approved_software(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- approved_software.source_request_id 는 순환 참조를 피하기 위해 테이블 생성 후 FK 추가
alter table approved_software
  drop constraint if exists approved_software_source_request_fk;
alter table approved_software
  add constraint approved_software_source_request_fk
  foreign key (source_request_id) references software_requests(id) on delete set null;

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================

alter table school_config enable row level security;
alter table admin_profiles enable row level security;
alter table classrooms enable row level security;
alter table devices enable row level security;
alter table classroom_devices enable row level security;
alter table repair_reports enable row level security;
alter table shared_devices enable row level security;
alter table rentals enable row level security;
alter table tutor_supports enable row level security;
alter table students enable row level security;
alter table chromebooks enable row level security;
alter table teacher_device_loans enable row level security;
alter table operator_profiles enable row level security;
alter table approved_software enable row level security;
alter table software_requests enable row level security;

drop policy if exists "school_config_all"     on school_config;
drop policy if exists "admin_profiles_all"    on admin_profiles;
drop policy if exists "classrooms_all"        on classrooms;
drop policy if exists "devices_all"           on devices;
drop policy if exists "classroom_devices_all" on classroom_devices;
drop policy if exists "repair_reports_all"    on repair_reports;
drop policy if exists "shared_devices_all"    on shared_devices;
drop policy if exists "rentals_all"           on rentals;
drop policy if exists "tutor_supports_all"    on tutor_supports;
drop policy if exists "students_all"          on students;
drop policy if exists "chromebooks_all"       on chromebooks;
drop policy if exists "teacher_device_loans_all" on teacher_device_loans;
drop policy if exists "approved_software_all" on approved_software;
drop policy if exists "software_requests_all" on software_requests;

create policy "school_config_all"      on school_config      for all using (true) with check (true);
create policy "admin_profiles_all"     on admin_profiles      for all using (true) with check (true);
create policy "classrooms_all"         on classrooms          for all using (true) with check (true);
create policy "devices_all"            on devices             for all using (true) with check (true);
create policy "classroom_devices_all"  on classroom_devices   for all using (true) with check (true);
create policy "repair_reports_all"     on repair_reports      for all using (true) with check (true);
create policy "shared_devices_all"     on shared_devices      for all using (true) with check (true);
create policy "rentals_all"            on rentals             for all using (true) with check (true);
create policy "tutor_supports_all"     on tutor_supports      for all using (true) with check (true);
create policy "students_all"           on students            for all using (true) with check (true);
create policy "chromebooks_all"        on chromebooks         for all using (true) with check (true);
create policy "teacher_device_loans_all" on teacher_device_loans for all using (true) with check (true);
create policy "approved_software_all"  on approved_software   for all using (true) with check (true);
create policy "software_requests_all" on software_requests  for all using (true) with check (true);

-- operator_profiles는 의도적으로 전체허용(_all) 정책을 두지 않습니다.
-- INSERT/UPDATE/DELETE는 Supabase Dashboard(service_role)에서만 가능하고,
-- 본인 여부 확인용 SELECT만 허용합니다.
drop policy if exists "operator_profiles_self_select" on operator_profiles;
create policy "operator_profiles_self_select" on operator_profiles
  for select using (auth.uid() = user_id);

-- ============================================================
-- 운영자 페이지 — 집계 뷰 / 함수 / 인덱스
-- (운영자 페이지.md 5~6장 구현)
-- ============================================================

-- 탭 사용 현황 뷰 — 학교별 × 탭별 활동 집계
create or replace view school_tab_activity as
with events as (
  select t.school_id, '학급관리'::text as tab, t.created_at as at
    from classrooms t

  union all
  -- classroom_devices(기기 수량 편집)는 /admin/classrooms 안의 기능이므로 같은 '학급관리' 탭으로 집계
  select c.school_id, '학급관리'::text as tab, cd.updated_at as at
    from classroom_devices cd
    join classrooms c on c.id = cd.classroom_id

  union all
  select t.school_id, '고장신고'::text as tab, t.reported_at as at from repair_reports t
  union all
  select t.school_id, '공유기기'::text as tab, t.created_at as at  from shared_devices t
  union all
  select t.school_id, '대여관리'::text as tab, t.rented_at as at   from rentals t
  union all
  select t.school_id, '크롬북'::text as tab,   t.created_at as at  from chromebooks t
  union all
  select t.school_id, '튜터지원'::text as tab, t.created_at as at  from tutor_supports t
  union all
  select t.school_id, '교사대여'::text as tab, t.created_at as at  from teacher_device_loans t
  union all
  select t.school_id, '소프트웨어'::text as tab, t.created_at as at from approved_software t
  union all
  select t.school_id, '소프트웨어'::text as tab, t.created_at as at from software_requests t
)
select
  school_id,
  tab,
  count(*)                                                        as total_count,
  count(*) filter (where at > now() - interval '30 days')         as recent_count,
  max(at)                                                         as last_activity,
  case
    when count(*) = 0                                       then '미사용'
    when max(at) < now() - interval '90 days'               then '초기설정만'
    when count(*) filter (where at > now() - interval '30 days') >= 5 then '활발'
    when count(*) filter (where at > now() - interval '30 days') >= 1 then '저조'
    else '초기설정만'
  end                                                             as status
from events
where at is not null          -- classroom_devices.updated_at은 nullable
group by school_id, tab;

-- 학교 요약 뷰 — KPI 카드 + 학교 목록 테이블
create or replace view school_overview as
select
  s.id                                              as school_id,
  s.school_name,
  s.school_code,
  s.created_at                                      as joined_at,
  (select count(*) from classrooms c where c.school_id = s.id)   as classroom_count,
  (select count(*) from chromebooks cb where cb.school_id = s.id) as chromebook_count,
  (select coalesce(sum(total_quantity), 0)
     from shared_devices sd where sd.school_id = s.id)            as shared_device_count,
  (select max(last_activity) from school_tab_activity a
     where a.school_id = s.id)                                    as last_activity,
  (select count(*) from repair_reports r
     where r.school_id = s.id
       and r.status <> '처리 완료'
       and r.reported_at < now() - interval '30 days')            as stale_repair_count
from school_config s;

-- 뷰는 기본적으로 소유자(postgres) 권한으로 실행되어 RLS를 우회할 수 있으므로,
-- 조회하는 사용자 권한으로 실행되도록 security_invoker를 켠다.
alter view school_tab_activity set (security_invoker = on);
alter view school_overview set (security_invoker = on);

-- 운영자 전용 함수 — 학교별 관리자 이메일 조회
-- auth.users는 PostgREST에 노출되지 않으므로 SECURITY DEFINER 함수로 우회하되,
-- 함수 내부에서 자체적으로 운영자 권한을 검증한다.
create or replace function operator_school_admins()
returns table(school_id uuid, admin_email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from operator_profiles where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  return query
    select ap.school_id, u.email::text
    from admin_profiles ap
    join auth.users u on u.id = ap.user_id;
end;
$$;

grant execute on function operator_school_admins() to authenticated;

-- 인덱스 — 학교 수가 늘면 UNION ALL 집계가 느려지므로 미리 추가
create index if not exists idx_classrooms_school_created
  on classrooms (school_id, created_at);
create index if not exists idx_repair_school_reported
  on repair_reports (school_id, reported_at);
create index if not exists idx_rentals_school_rented
  on rentals (school_id, rented_at);
create index if not exists idx_shared_devices_school_created
  on shared_devices (school_id, created_at);
create index if not exists idx_chromebooks_school_created
  on chromebooks (school_id, created_at);
create index if not exists idx_tutor_school_created
  on tutor_supports (school_id, created_at);
create index if not exists idx_teacher_loans_school_created
  on teacher_device_loans (school_id, created_at);
create index if not exists idx_classroom_devices_classroom
  on classroom_devices (classroom_id, updated_at);
create index if not exists idx_approved_software_school_created
  on approved_software (school_id, created_at);
create index if not exists idx_software_requests_school_created
  on software_requests (school_id, created_at);
create index if not exists idx_software_requests_school_status
  on software_requests (school_id, status);

-- ============================================================
-- 관리자 감사 로그
-- ============================================================

-- 16. audit_logs — 관리자가 데이터를 수정할 때마다 남는 기록
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references school_config(id) on delete cascade,
  actor_email text not null,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  summary text not null,
  changes jsonb,
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;

drop policy if exists "audit_logs_all" on audit_logs;
create policy "audit_logs_all" on audit_logs for all using (true) with check (true);

create index if not exists idx_audit_logs_school_created
  on audit_logs (school_id, created_at desc);

-- ============================================================
-- [기존 DB 마이그레이션] 이미 스키마를 실행한 경우 아래 SQL만 실행하세요
-- ============================================================
--
-- -- 1. admin_profiles 테이블 추가
-- create table if not exists admin_profiles (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null unique references auth.users(id) on delete cascade,
--   school_id uuid not null references school_config(id) on delete cascade,
--   created_at timestamptz default now()
-- );
-- alter table admin_profiles enable row level security;
-- create policy "admin_profiles_all" on admin_profiles for all using (true) with check (true);
--
-- -- 기존 관리자 계정을 admin_profiles에 연결 (Supabase Auth > Users에서 user_id 확인 후 실행)
-- -- INSERT INTO admin_profiles (user_id, school_id)
-- -- SELECT '<your-user-id>', id FROM school_config LIMIT 1;
--
-- -- 2. 각 테이블에 school_id 컬럼 추가
-- alter table classrooms    add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table repair_reports add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table shared_devices add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table rentals        add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table tutor_supports add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table students       add column if not exists school_id uuid references school_config(id) on delete cascade;
-- alter table chromebooks    add column if not exists school_id uuid references school_config(id) on delete cascade;
--
-- -- 3. 기존 데이터에 school_id 채우기 (school_config에 행이 하나인 경우)
-- update classrooms    set school_id = (select id from school_config limit 1) where school_id is null;
-- update repair_reports set school_id = (select id from school_config limit 1) where school_id is null;
-- update shared_devices set school_id = (select id from school_config limit 1) where school_id is null;
-- update rentals        set school_id = (select id from school_config limit 1) where school_id is null;
-- update tutor_supports set school_id = (select id from school_config limit 1) where school_id is null;
-- update students       set school_id = (select id from school_config limit 1) where school_id is null;
-- update chromebooks    set school_id = (select id from school_config limit 1) where school_id is null;
--
-- -- 4. NOT NULL 제약 추가
-- alter table classrooms    alter column school_id set not null;
-- alter table repair_reports alter column school_id set not null;
-- alter table shared_devices alter column school_id set not null;
-- alter table rentals        alter column school_id set not null;
-- alter table tutor_supports alter column school_id set not null;
-- alter table students       alter column school_id set not null;
-- alter table chromebooks    alter column school_id set not null;
--
-- -- 5. chromebooks 유니크 제약 변경 (전역 → 학교별)
-- alter table chromebooks drop constraint if exists chromebooks_device_number_key;
-- alter table chromebooks add constraint chromebooks_school_device_unique unique(school_id, device_number);
--
-- -- 6. classrooms 유니크 제약 변경
-- alter table classrooms drop constraint if exists classrooms_class_name_key;
-- alter table classrooms add constraint classrooms_school_class_unique unique(school_id, class_name);
--
-- -- 7. 소프트웨어 조회 탭 (approved_software / software_requests)
-- --    위 "14. 심의받은 소프트웨어 목록" ~ "15. 교사가 신청한 소프트웨어" 블록과
-- --    해당 RLS·인덱스 구문, 그리고 school_tab_activity 뷰 재생성 구문을 그대로 실행하세요.
-- --    (모두 if not exists / create or replace 라 여러 번 실행해도 안전합니다)
