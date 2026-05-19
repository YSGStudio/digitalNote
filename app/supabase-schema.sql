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

-- 1. 학교 설정 (학교코드 관리)
create table if not exists school_config (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_code text not null unique,
  created_at timestamptz default now()
);

-- 2. 학급 정보
create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique,
  teacher_name text,
  created_at timestamptz default now()
);

-- 3. 기기 종류 마스터 (관리자가 설정)
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_type text not null unique,
  description text,
  created_at timestamptz default now()
);

-- 기본 기기 종류 삽입
insert into devices (device_type, description) values
  ('크롬북', '크롬OS 노트북'),
  ('펜 (스타일러스)', '터치스크린용 펜'),
  ('마우스', 'USB/블루투스 마우스'),
  ('충전 케이블', 'USB-C 충전 케이블')
on conflict do nothing;

-- 4. 학급별 기기 보유 현황
create table if not exists classroom_devices (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  quantity int not null default 0,
  unique(classroom_id, device_id)
);

-- 5. 고장 신고
create table if not exists repair_reports (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid references devices(id),
  quantity int not null default 1,
  description text,
  status text not null default '접수 대기'
    check (status in ('접수 대기', '수리 중', '처리 완료')),
  reported_at timestamptz default now(),
  resolved_at timestamptz
);

-- 6. 학교 공유 기기
create table if not exists shared_devices (
  id uuid primary key default gen_random_uuid(),
  device_name text not null,
  total_quantity int not null default 0,
  available_quantity int not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 7. 대여·반납 이력
create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  device_id uuid references shared_devices(id),
  quantity int not null default 1,
  rented_at timestamptz default now(),
  returned_at timestamptz,
  status text not null default '대여 중'
    check (status in ('대여 중', '반납 완료'))
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================

alter table school_config enable row level security;
alter table classrooms enable row level security;
alter table devices enable row level security;
alter table classroom_devices enable row level security;
alter table repair_reports enable row level security;
alter table shared_devices enable row level security;
alter table rentals enable row level security;

-- school_config: 모든 작업 허용
-- (관리자 회원가입 시 anon 상태로 insert하므로 using(true) 필요)
create policy "school_config_all" on school_config
  for all using (true) with check (true);

-- 나머지 테이블: 모든 작업 허용
create policy "classrooms_all"       on classrooms       for all using (true) with check (true);
create policy "devices_all"          on devices           for all using (true) with check (true);
create policy "classroom_devices_all" on classroom_devices for all using (true) with check (true);
create policy "repair_reports_all"   on repair_reports    for all using (true) with check (true);
create policy "shared_devices_all"   on shared_devices    for all using (true) with check (true);
create policy "rentals_all"          on rentals           for all using (true) with check (true);

-- ============================================================
-- 이미 스키마를 실행한 경우 — 아래 수정 SQL만 별도 실행하세요
-- ============================================================
-- drop policy if exists "school_config_read" on school_config;
-- create policy "school_config_all" on school_config
--   for all using (true) with check (true);
