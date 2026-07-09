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

-- 2. 관리자-학교 연결 (admin_profiles)
create table if not exists admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null references school_config(id) on delete cascade,
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
