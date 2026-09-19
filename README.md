# 대한민국 역명 통합 검색

전국 지하철·전철·광역철도의 역명을 노선까지 포함해 하나로 통합 검색하는 **데스크톱 전용** 프로그램입니다. 인터넷 연결 없이 동작합니다.

[메트로타이핑(metrotyping.kr)](https://metrotyping.kr) 게임을 더 편하게 즐기고 실제 노선을 익히려는 목적으로 만들기 시작한 개인 프로젝트입니다 — metrotyping과 공식적인 제휴는 없습니다.

**저장소**: [github.com/SepGOM/KorSubSearch](https://github.com/SepGOM/KorSubSearch)

- 화면·문서: 한국어 / 코드 식별자: 영어
- 지원 범위: **서울·수도권 / 부산 / 대구 / 광주 / 대전 / KTX / ITX(ITX-새마을) / 무궁화호** (ITX-청춘·ITX-마음은 아직 데이터가 없습니다). SRT는 별도 범위가 아니라 KTX 안의 "행신착발"/"수서착발" 이름 구분으로 통합되어 있습니다.
- 범위 + 노선을 고르면 "이 노선의 역 보기"로 전체 역을 물리적 순서대로 볼 수 있고, 환승역에는 **지금 고른 범위 밖의 노선까지 포함해** 갈아탈 수 있는 다른 노선 배지가 함께 표시됩니다.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 데스크톱 셸 | Tauri 2 |
| UI | React + TypeScript(strict) + Tailwind CSS v4 |
| 데이터 저장 | SQLite (오프라인 번들) |
| 테스트 | Vitest(단위·통합·컴포넌트) + Playwright(E2E) |
| 패키지 매니저 | pnpm |

## 빠른 시작

```bash
corepack enable pnpm   # pnpm이 없다면
pnpm install
pnpm db:import         # data/raw → data/generated/korsub.sqlite3 + public/korsub-dataset.json
pnpm tauri dev         # 데스크톱 앱 실행
```

Rust 툴체인이 없다면 데스크톱 앱은 빌드할 수 없지만, 브라우저 미리보기로 검색 기능 자체는 확인할 수 있습니다.

```bash
pnpm dev               # http://localhost:1420 — 정적 JSON 스냅샷으로 동작
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | Vite 개발 서버 (브라우저 미리보기, `public/korsub-dataset.json` 사용) |
| `pnpm build` | 타입 체크 + 프런트엔드 프로덕션 빌드 |
| `pnpm tauri dev` / `pnpm tauri build` | 데스크톱 앱 실행 / 빌드 |
| `pnpm db:import` | 원본 CSV → SQLite + 검수 리포트 + 정적 JSON 생성 (전체 가져오기 파이프라인) |
| `pnpm db:validate` | 생성된 SQLite에 대한 데이터 검증 |
| `pnpm colors:generate` / `pnpm colors:validate` | `rail-line-colors-source.json` → `rail-line-colors.csv` 생성/검증 (색상 출처가 바뀔 때만) |
| `pnpm typecheck` | `tsc -b --noEmit` (앱/스크립트/테스트 전체) |
| `pnpm lint` | oxlint |
| `pnpm test` / `pnpm test:watch` | Vitest (단위+통합+컴포넌트) |
| `pnpm test:e2e` | Playwright E2E (개발 서버를 자동으로 띄웁니다) |

## 디렉터리

```text
data/
├── raw/          # 제공기관 원본. 직접 수정하지 않음
├── overrides/    # 사람이 확인한 예외(역 병합/분리, 표시명, 노선 내 순서 등)
├── generated/    # korsub.sqlite3, 검수 리포트
├── reference/    # 노선 색상 및 그 출처 스냅샷
└── metadata/     # 출처 메타데이터

scripts/
├── db/           # schema.sql, Node용 저장소 헬퍼
├── import/       # 지역/노선별 로더 + 전체 가져오기 파이프라인(run-import.ts)
└── validate/     # 데이터 검증

src/
├── lib/
│   ├── normalize/  # 초성·문자열·노선명·토큰화 (순수 함수)
│   ├── search/     # 검색 점수·엔진 (순수 함수)
│   ├── merge/      # 중복역 자동 병합 판정 (순수 함수)
│   └── data/       # DB 매핑, 저장소 추상화(Tauri SQL / 브라우저 JSON)
├── components/     # ScopeSelector, LineSelector, SearchBox, LineBadge 등
└── hooks/

src-tauri/          # Rust — plugin-sql 등록, 번들 DB를 앱 데이터 폴더로 복사하는 커맨드
docs/               # data-integration-rules.md(데이터 규칙), data-model.md, implementation-plan.md(변경 이력)
tests/, e2e/        # Vitest / Playwright
```

## 데이터 파이프라인 (요약)

전국 표준 코드(운영기관코드/노선코드/역사코드) 원본을 지역별로 분류·정규화한 뒤, 동명역을 그룹핑해 자동/잠정 병합을 판정하고 SQLite + 검수 리포트를 만듭니다. KTX/SRT·무궁화호는 각자의 원본(운행계통 기준)을 별도 출처로 얹습니다.

- 병합된 역도 검색용 대표 이름과 노선별 표시 이름은 분리되어 있어, 실제로 이름이 다른 환승역(예: 1호선 "아산" ↔ KTX "천안아산")도 각자의 이름 그대로 보입니다.
- 좌표 데이터가 없어 자동 병합의 상당수가 "잠정" 상태이며, `data/overrides/station-resolution.csv`로 사람이 하나씩 확정합니다.
- 노선 분기(지선)·운행계통(무궁화호 대표/자식, KTX 착발)은 `line.parent_line_id` 기반 계층 구조로 표현합니다.

자세한 규칙과 판단 근거는 [docs/data-integration-rules.md](docs/data-integration-rules.md)에, 기능별 변경 이력(왜 이렇게 설계했는지)은 [docs/implementation-plan.md](docs/implementation-plan.md)에 정리되어 있습니다.

## 노선 색상 출처 및 라이선스

`data/reference/rail-line-colors.csv`는 두 출처를 합쳤습니다(`data/reference/rail-line-colors-source.json`에 출처별로 기록).

1. [위키백과 "틀:한국 철도 노선색"](https://ko.wikipedia.org/wiki/틀:한국_철도_노선색) — 서울·수도권/부산/대구/광주/대전. 텍스트는 CC BY-SA 4.0이며, 색상값은 사실 정보로 간주해 사용했습니다.
2. [metrotyping.kr](https://metrotyping.kr)의 KTX/SRT 노선 선택 화면 — 코레일 공식 색상 규정이 아닌 참고 자료입니다.

앱은 이 CSV를 로컬에서만 읽으며, 실행 중 어떤 외부 페이지도 호출하지 않습니다.

## 배포 파일 생성

```bash
pnpm tauri build
```

`src-tauri/target/release/bundle/`에 플랫폼별 설치 파일이 생성됩니다(macOS는 `macos/*.app`, `dmg/*.dmg`).

## 테스트

```bash
pnpm test        # Vitest: 단위(초성/정규화/점수/병합/색상/거리) + 통합(실제 DB) + 컴포넌트
pnpm test:e2e     # Playwright: 실제 개발 서버 + 실제 데이터로 핵심 검색 플로우 검증
```

## 알려진 한계

- ITX는 ITX-새마을만 지원합니다 — ITX-청춘·ITX-마음은 데이터가 없습니다. ITX-새마을은 무궁화호와 같은 역 마스터(`data/raw/mugunghwa-ITXsaemaul/`)를 재사용합니다.
- "동해선 전구간"은 원본 결함으로 서울~동대구 구간(KTX)과 SRT 데이터 자체가 빠져 있습니다 — 임의 보정하지 않고 원본 그대로 둡니다.
- 좌표 데이터가 없어 자동 병합 대부분이 "잠정(NAME_ONLY_PROVISIONAL)" 상태이며 사람 검수가 필요합니다.
- 대경선은 대구·경북에 걸쳐 있으나, 아직 별도 "경북" 범위가 없어 잠정적으로 "대구"에 포함됩니다.
- 오타 유사일치는 지원하지 않습니다(오탐이 더 커서 제거) — 역명·초성·노선 별칭이 정확히 포함되어야 검색됩니다.

그 외 세부 예외·판단 근거는 [docs/data-integration-rules.md](docs/data-integration-rules.md) 13장과 [docs/implementation-plan.md](docs/implementation-plan.md)를 참고하세요.
