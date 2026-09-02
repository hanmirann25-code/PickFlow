# PickFlow

주문 접수부터 출고까지를 관리하는 풀필먼트 운영 콘솔. 웹 관리자 화면 + 창고 현장용 모바일 화면.

> 진행 중인 포트폴리오 프로젝트입니다. 성과 지표와 데모 주소는 완성 후 채웁니다.
> 설계 문서: [docs/기획서.md](docs/기획서.md) · 작업 규칙: [AGENTS.md](AGENTS.md)

---

## 로컬 실행

### 1. 요구 사항

| 항목            | 버전          | 비고                                         |
| --------------- | ------------- | -------------------------------------------- |
| Node.js         | 22 이상       |                                              |
| pnpm            | 9 이상        |                                              |
| Oracle Database | **23ai 이상** | 스키마 스크립트가 `IF NOT EXISTS` DDL을 쓴다 |

### 2. 환경변수

`.env.example`을 `.env.local`로 복사해 값을 채운다. `.env.local`은 커밋되지 않는다.

```bash
cp .env.example .env.local
```

로컬 Oracle Database Free 기준 접속 문자열은 아래와 같다.
**CDB(`FREE`)가 아니라 PDB(`FREEPDB1`)에 붙어야 한다.**

```
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
```

`ORACLE_WALLET_DIR`에 값이 있으면 클라우드(지갑) 접속으로 자동 전환된다. 코드는 고치지 않는다.

### 3. 스키마 생성

`db/schema/`의 스크립트를 **번호 순서대로** 실행한다. 순서를 지키지 않으면 외래키가 참조할 테이블이 없어 실패한다.

| 순서 | 파일               | 내용                                                |
| ---- | ------------------ | --------------------------------------------------- |
| 1    | `01_tables.sql`    | 테이블 12개 + 외래키 + CHECK 제약                   |
| 2    | `02_indexes.sql`   | 필수 인덱스 4개 + 외래키 인덱스                     |
| 3    | `03_sequences.sql` | 주문번호·웨이브번호 채번 시퀀스                     |
| —    | `99_drop_all.sql`  | **개발용 초기화.** 전체 삭제. 운영 DB에서 실행 금지 |

```bash
sqlplus PICKFLOW/비밀번호@localhost:1521/FREEPDB1 @db/schema/01_tables.sql
sqlplus PICKFLOW/비밀번호@localhost:1521/FREEPDB1 @db/schema/02_indexes.sql
sqlplus PICKFLOW/비밀번호@localhost:1521/FREEPDB1 @db/schema/03_sequences.sql
```

세 스크립트 모두 **두 번 실행해도 깨지지 않는다.** 이미 있는 객체는 건너뛴다.

처음부터 다시 만들려면 `99_drop_all.sql`을 먼저 돌리고 1 → 2 → 3을 다시 실행한다.

> **윈도우 한글 환경 주의.** `NLS_LANG`이 설정돼 있지 않으면 sqlplus가 스크립트의 한글을
> 잘못 읽어 `ORA-01756`(문자열이 종료되지 않음)으로 실패할 수 있다. 실행 전에 아래를 설정한다.
>
> ```
> set NLS_LANG=KOREAN_KOREA.AL32UTF8
> ```

### 4. 개발 서버

```bash
pnpm install
pnpm dev
```

DB 연결 상태는 <http://localhost:3000/api/health> 에서 확인한다.

```json
{ "status": "ok", "db": { "connected": true, "elapsedMs": 2 } }
```

연결에 실패하면 `503`과 함께 원인(ORA 코드)과 다음에 할 일을 함께 돌려준다.

---

## 명령어

| 명령             | 하는 일                                                        |
| ---------------- | -------------------------------------------------------------- |
| `pnpm dev`       | 개발 서버                                                      |
| `pnpm build`     | 프로덕션 빌드 (개발 서버를 먼저 내릴 것 — 같은 `.next`를 쓴다) |
| `pnpm typecheck` | 타입 검사                                                      |
| `pnpm lint`      | 린트                                                           |
| `pnpm format`    | 포맷 정리                                                      |

커밋하면 `typecheck` → `lint-staged`가 자동으로 돈다.

---

## 데이터 모델

테이블 12개. 상세는 [docs/기획서.md](docs/기획서.md) 6장 참고.

```
USERS  PRODUCTS  LOCATIONS
  └ INVENTORY (PRODUCT_ID + LOCATION_ID 유니크)
ORDERS ─ ORDER_ITEMS
PICKING_WAVES ─ PICKING_TASKS
SHIPMENTS   INVENTORY_TRANSACTIONS   AUDIT_LOGS   IDEMPOTENCY_KEYS
```

**가용 재고는 저장하지 않는다.** 항상 `QTY_ON_HAND - QTY_ALLOCATED`로 계산한다.

정합성 조건 1·2(할당량은 실재고를 넘을 수 없고, 가용 재고는 음수가 될 수 없다)는
애플리케이션이 아니라 `INVENTORY` 테이블의 CHECK 제약이 직접 막는다.
앱 로직이나 프로시저가 틀려도 음수 재고는 저장되지 않는다.

---

## 상태 전이

```
RECEIVED → ALLOCATED → PICKING → PACKED → SHIPPED
RECEIVED → BACKORDER → ALLOCATED
어느 단계든 → HOLD / CANCELLED   (단, SHIPPED 이후 취소 불가)
```

정의는 `lib/order-graph.ts` 한 곳에만 둔다. `ORDERS.STATUS`의 CHECK 제약은
그 정의를 벗어난 값이 저장되는 것을 막는 마지막 방어선이다.
