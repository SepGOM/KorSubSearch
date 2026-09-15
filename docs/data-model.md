# 데이터 모델

이 문서는 [data-integration-rules.md](data-integration-rules.md)의 엔터티 정의를 실제 SQLite 스키마([scripts/db/schema.sql](../scripts/db/schema.sql))로 구현한 방식을 설명한다. 스키마 파일 자체가 단일 진실 소스이며, 이 문서는 그 위에 "왜 이렇게 설계했는지"를 덧붙인다.

## 엔터티 개요

| 엔터티 | 테이블 | 요약 |
|---|---|---|
| Station | `station` | 물리적/서비스상 하나의 역. 역명은 고유키가 아니다. |
| StationAlias | `station_alias` | 과거 명칭, 부역명 등 역의 별칭. |
| StationGroup | `station_group` | 환승 거점을 묶는 그룹. `merge_basis`로 병합 근거를 기록. |
| Line | `line` | 노선. `line_code`로 색상 CSV와 연결된다. |
| LineAlias | `line_alias` | 노선의 약칭·과거 명칭 (예: 수인분당선 → "분당선", "수인선"). |
| StationLine | `station_line` | 역↔노선 다대다 관계. **검색·채점의 기본 단위**(화면 표시는 `station_id`로 한 번 더 묶는다). |
| TrainService | `train_service` | KTX/ITX/무궁화호 등 열차 종류 (노선이 아님). SRT는 사용자 요청에 따라 다루지 않는다. |
| StationService | `station_service` | 특정 열차 종류가 정차하는 역. 이번 버전엔 데이터 없음. |
| DataSource | `data_source` | 출처 기관, 데이터셋명, URL, 기준일, 라이선스. |
| ImportBatch | `import_batch` | 가져오기 실행 단위. |
| ManualResolution | `manual_resolution` | 중복역 병합/분리에 대한 사람의 판단(override) + 자동 생성된 검수 항목. |

## 운행 범위 선택을 위한 추가 테이블

요구사항의 "운행 범위 선택" 그리드(전체/지역/열차 종류를 한 그리드에, 내부적으로는 `ALL`/`REGION`/`TRAIN_SERVICE`로 구분)를 위해 두 테이블을 추가했다.

- `region`: 지역 목록과 `AVAILABLE`/`COMING_SOON` 상태.
- `scope_option`: 화면에 그대로 뿌리는 선택지 목록. `kind`(ALL/REGION/TRAIN_SERVICE)와 연결된 `region_code`/`train_service_code`를 갖는다.

노선 목록(`line` 테이블)과 운행 범위(`scope_option` 테이블) 모두 프런트엔드 코드에 하드코딩하지 않고 DB에서 읽는다 — `src/components/ScopeSelector.tsx`와 `LineSelector.tsx`는 props로 받은 데이터를 그대로 그릴 뿐이다.

## Station 고유키에 대해

역명을 고유키로 쓰지 않는다는 규칙(7.1)에 따라 `station_id`는 내부에서 발급하는 값(`STN-000001`…)이고, `official_name`/`normalized_name`은 어디까지나 중복 후보를 찾는 1차 신호일 뿐이다. 실제 병합 판정은 [src/lib/merge/resolveDuplicates.ts](../src/lib/merge/resolveDuplicates.ts)의 `decideMerge()`가 담당하며, 그 결과가 `station_group.merge_basis`에 `COORDINATE` / `OFFICIAL_TRANSFER` / `NAME_ONLY_PROVISIONAL` 중 하나로 기록된다.

이번 버전의 원본 데이터에는 좌표가 전혀 없어 `COORDINATE` 조건을 기계적으로 만족시킬 수 없다. 사용자와 상의해 "같은 지역 안에서 정규화 역명이 일치하면 잠정 병합 + 검수 리포트에 기록"하는 정책으로 처리했다 — 서로 다른 지역(서울 vs 부산)은 애초에 병합 후보에서 제외한다(`isSameOrAdjacentRegion`). `OFFICIAL_TRANSFER`는 사람이 `data/overrides/station-resolution.csv`에 `MERGE`로 직접 확인해 준 경우에만 쓴다(정규화 역명이 달라도 강제로 합칠 수 있다 — 예: 이름이 서로 다른 환승역). 자세한 내용은 [README.md](../README.md)의 "알려진 한계"와 `data/generated/station-resolution-review.csv`를 참고.

## StationLine은 채점 단위, 화면은 station_id로 묶어 표시

검색·채점의 기본 단위는 여전히 `station_line`이다(노선 필터·노선 번호 토큰이 `station_line.line`을 직접 참조해야 하고, 동명이역과 환승역을 정확히 구분하려면 역명만으로는 부족하기 때문). `src/lib/search/engine.ts`의 `search()`가 이 단위로 채점·정렬한다.

다만 자동완성 화면은 `searchGrouped()`(같은 파일)로 한 번 더 묶어서 보여준다 — **같은 `station_id`를 가진 결과는 한 행에 노선 배지를 여러 개** 붙이고, `station_id`가 다르면(동명이역) 이름이 같아도 별도 행으로 남긴다. 즉 화면에 몇 개의 노선 배지가 붙는지는 가져오기 단계의 병합 판정(자동/수동, 규칙 7.2)이 결정한다 — 오금역(3·5호선 환승)은 한 행, 신촌역(2호선/경의중앙선, 환승 아님)은 두 행이 되는 식이다. `data/overrides/station-resolution.csv`에 그 판단 근거가 남는다.

## 출처 추적

`data_source`/`import_batch`는 규칙 4장의 "제공기관/데이터셋명/원본 URL/기준일/수집일/배치 ID/라이선스"를 담는다. 이번 버전은 사용자가 직접 추가한 전국 역사고유번호 원본(`운영기관_역사_코드정보_2026.07.11_일반.xlsx`) 하나를 5개 지역으로 나눠 쓰며, 정확한 URL은 확인하지 못해 `data/metadata/sources.json`에 그 사실 자체를 기록해 두었다(규칙 4장: "출처가 없는 레코드는 최종 데이터에 자동 반영하지 않고 검수 대상으로 출력한다" — 이번 경우는 기관명·데이터셋명·기준일은 파일명에서 확인되므로 실제 데이터로 채택하되, URL 미상은 명시적으로 남겨 두는 절충을 사용자가 직접 선택했다). 이전에 쓰던 개별 원본들은 `superseded_sources`/`unused_files`로 옮겨 기록했다.

## 검색 엔진과의 관계

DB 스키마는 저장 형태이고, 검색은 `src/lib/search/*`의 순수 함수가 담당한다. `src/lib/data/mapRowsToRecords.ts`가 SQL 조회 결과(스네이크 케이스 행)를 검색 엔진이 쓰는 `StationLineRecord`(카멜 케이스, 별칭 배열 포함)로 변환하는 유일한 경계다. Tauri(데스크톱)와 브라우저 미리보기/테스트가 서로 다른 방식으로 데이터를 읽어와도 이 매핑 함수 하나로 합쳐지므로 검색 로직은 실행 환경과 완전히 독립적이다.
