-- 대한민국 역명 통합 검색 — SQLite 스키마
-- docs/data-integration-rules.md 의 데이터 모델을 그대로 구현한다.
-- 이 파일은 scripts/import 가 data/generated/korsub.sqlite3 를 새로 만들 때마다
-- 실행하는 단일 진실 소스(source of truth)다.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 운행 범위(운행 지역 + 열차 종류)
-- ---------------------------------------------------------------------------

-- 지역. 도시 지역(서울·수도권/부산/대구/광주/대전) 5개는 실제 데이터가 있어
-- AVAILABLE이다. "KTX"도 여기 함께 있다 — 특정 도시에 묶이지 않고 전국을
-- 가로지르는 열차 종류를 다루기 위한 pseudo-region이다(ktxLineDefinitions.ts 참고).
CREATE TABLE region (
  region_code   TEXT PRIMARY KEY,
  name_ko       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'COMING_SOON')),
  sort_order    INTEGER NOT NULL
);

-- 열차 종류 (KTX/ITX/무궁화호). 노선이 아니라 별도 종류로 취급한다.
-- SRT는 사용자 요청에 따라 다루지 않는다(메뉴 자체를 두지 않음).
CREATE TABLE train_service (
  train_service_code TEXT PRIMARY KEY,
  name_ko             TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'COMING_SOON')),
  sort_order          INTEGER NOT NULL
);

-- 화면 상단 "운행 범위 선택" 그리드. ALL/REGION/TRAIN_SERVICE 를 한 그리드에 두되
-- 내부적으로 kind 로 구분한다.
CREATE TABLE scope_option (
  scope_code          TEXT PRIMARY KEY,
  kind                TEXT NOT NULL CHECK (kind IN ('ALL', 'REGION', 'TRAIN_SERVICE')),
  name_ko             TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'COMING_SOON')),
  sort_order          INTEGER NOT NULL,
  region_code         TEXT REFERENCES region(region_code),
  train_service_code  TEXT REFERENCES train_service(train_service_code)
);

-- ---------------------------------------------------------------------------
-- 출처 추적
-- ---------------------------------------------------------------------------

CREATE TABLE import_batch (
  import_batch_id TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  description     TEXT
);

CREATE TABLE data_source (
  source_id        TEXT PRIMARY KEY,
  provider_name    TEXT NOT NULL,
  dataset_name     TEXT,
  source_url       TEXT,
  source_revision  TEXT,
  reference_date   TEXT,
  retrieved_at     TEXT,
  license          TEXT,
  import_batch_id  TEXT REFERENCES import_batch(import_batch_id)
);

-- ---------------------------------------------------------------------------
-- 노선
-- ---------------------------------------------------------------------------

CREATE TABLE line (
  line_id       TEXT PRIMARY KEY,
  line_code     TEXT NOT NULL UNIQUE,       -- rail-line-colors.csv 와 연결하는 키
  official_name TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  icon_label    TEXT NOT NULL,               -- 여러 배지가 한 줄에 나열되는 곳(환승 배지 등)에 쓰는 짧은 아이콘 글자 — 예: "1", "인1", "KTX"
  line_number   INTEGER,                     -- 1,2,3... 숫자 검색용. 없으면 NULL
  operator_code TEXT NOT NULL,
  region_code   TEXT NOT NULL REFERENCES region(region_code),
  -- "범위 선택"이 지역이 아니라 열차 종류(KTX/SRT 등)를 기준으로도 좁혀야 할 때 쓴다.
  -- region_code와는 다른 축이다 — KTX와 SRT는 같은 pseudo-region("KTX")을 공유해
  -- 같은 물리적 역끼리 자동으로 병합되지만, 화면의 "운행 범위 선택"에서는 서로
  -- 다른 버튼(브랜드)으로 구분해야 하므로 이 컬럼으로 별도로 필터링한다.
  train_service_code TEXT REFERENCES train_service(train_service_code),
  color_hex     TEXT,                        -- rail-line-colors.csv 에서 채움
  text_color_hex TEXT,
  -- 이 노선이 다른 노선(본선)에 딸린 지선이면 그 본선의 line_id를 가리킨다.
  -- 지선은 "노선 선택" 버튼 목록에는 나오지 않고, 본선을 고르면 본선 패널
  -- 아래에 자기 패널로 추가로 나온다(예: 경춘선을 고르면 망우선 패널도 함께).
  parent_line_id TEXT REFERENCES line(line_id),
  -- "이 노선의 역 보기" 패널에서만 쓰는 이름(예: 2호선의 "을지로순환선(본선)").
  -- "노선 선택" 버튼·환승 배지 등 다른 모든 자리는 display_name을 그대로 쓴다.
  -- NULL이면 그 패널에서도 display_name을 그대로 쓴다(사용자 확인: "밑에
  -- 리스트를 변경해달라는거였지, 위의 노선 명을 바꾸라곤 안했어").
  station_list_label TEXT,
  -- 이 노선이 본선의 "지선"이 아니라 같은 노선의 서로 다른 운행계통(패턴) 변형일
  -- 때 1이다(예: 무궁화호 경부선의 "서울-제천"↔"서울-부산" 계통, 확장 25) —
  -- pattern_stops 순서를 그대로 반영해 station_line이 크게 겹치므로, listStationsOnLine
  -- 의 "↳ 갈림" 분기 표시(진짜 물리적 분기역 전용)를 이 관계에는 붙이지 않는다
  -- (사용자 확인: "각 운행 방식에 따른 역을 확인하기 위해 중복에 대해서는 신경쓰지
  -- 말고 pattern-stops 파일의 순서대로 토글에 반영해줘... 운행방식에 대한 환승
  -- 알은 표기하지 않아"). 환승 배지 억제 자체는 parent_line_id 관계만으로 이미
  -- 처리된다(engine.ts의 isSameLineFamily) — 이 컬럼은 분기 표시만 추가로 끈다.
  suppress_branch_tag INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL,
  source_id     TEXT REFERENCES data_source(source_id)
);

CREATE TABLE line_alias (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id           TEXT NOT NULL REFERENCES line(line_id) ON DELETE CASCADE,
  alias             TEXT NOT NULL,
  normalized_alias  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 역
-- ---------------------------------------------------------------------------

-- 환승 거점을 묶는 그룹. 자동 병합/수동 병합 모두 여기로 모인다.
CREATE TABLE station_group (
  station_group_id TEXT PRIMARY KEY,
  normalized_name  TEXT NOT NULL,
  merge_basis      TEXT NOT NULL CHECK (
    merge_basis IN ('COORDINATE', 'OFFICIAL_TRANSFER', 'NAME_ONLY_PROVISIONAL')
  ),
  notes            TEXT
);

CREATE TABLE station (
  station_id        TEXT PRIMARY KEY,
  official_name     TEXT NOT NULL,
  normalized_name   TEXT NOT NULL,
  sub_name          TEXT,                    -- 괄호 안 부역명, 예: 총신대입구(이수) -> 이수
  initials          TEXT NOT NULL,           -- 한글 초성열
  region_code       TEXT NOT NULL REFERENCES region(region_code),
  latitude          REAL,
  longitude         REAL,
  station_group_id  TEXT REFERENCES station_group(station_group_id),
  is_active         INTEGER NOT NULL DEFAULT 1,
  opened_at         TEXT,
  closed_at         TEXT,
  source_id         TEXT REFERENCES data_source(source_id),
  source_record_id  TEXT                     -- 원본 역 코드 (예: 전철역코드 1707)
);

CREATE INDEX idx_station_normalized_name ON station(normalized_name);
CREATE INDEX idx_station_initials ON station(initials);
CREATE INDEX idx_station_region ON station(region_code);

CREATE TABLE station_alias (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id        TEXT NOT NULL REFERENCES station(station_id) ON DELETE CASCADE,
  alias             TEXT NOT NULL,
  normalized_alias  TEXT NOT NULL,
  alias_type        TEXT NOT NULL CHECK (
    alias_type IN ('OLD_NAME', 'SUB_NAME', 'FOREIGN_NAME', 'MISC')
  )
);

-- ---------------------------------------------------------------------------
-- 역 ↔ 노선 (자동완성의 기본 표시 단위)
-- ---------------------------------------------------------------------------

CREATE TABLE station_line (
  station_line_id      TEXT PRIMARY KEY,
  station_id           TEXT NOT NULL REFERENCES station(station_id),
  line_id              TEXT NOT NULL REFERENCES line(line_id),
  source_station_code  TEXT,
  display_station_name TEXT NOT NULL,
  sequence             INTEGER,
  is_express_stop      INTEGER NOT NULL DEFAULT 0,
  is_active            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (station_id, line_id)
);

CREATE INDEX idx_station_line_line ON station_line(line_id);
CREATE INDEX idx_station_line_station ON station_line(station_id);

-- ---------------------------------------------------------------------------
-- 열차 종류 정차역
-- ---------------------------------------------------------------------------

CREATE TABLE station_service (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id          TEXT NOT NULL REFERENCES station(station_id),
  train_service_code  TEXT NOT NULL REFERENCES train_service(train_service_code),
  UNIQUE (station_id, train_service_code)
);

-- ---------------------------------------------------------------------------
-- 수동 검수
-- ---------------------------------------------------------------------------

CREATE TABLE manual_resolution (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  action                TEXT NOT NULL CHECK (action IN ('MERGE', 'KEEP_SEPARATE', 'REVIEW')),
  left_source_id        TEXT NOT NULL,
  right_source_id       TEXT NOT NULL,
  canonical_station_id  TEXT,
  reason                TEXT,
  verified_by           TEXT,
  verified_at           TEXT
);

-- ---------------------------------------------------------------------------
-- 스키마 버전 (향후 마이그레이션 관리용)
-- ---------------------------------------------------------------------------

CREATE TABLE schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO schema_meta(key, value) VALUES ('schema_version', '1');
