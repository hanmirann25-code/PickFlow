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

### 하네스

검증·데이터 생성 스크립트는 `harness/`에 독립 실행 스크립트로 둔다.
앱 코드를 import하지 않으므로 앱이 떠 있지 않아도 돌아간다.

| 명령                      | 하는 일                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `pnpm harness:seed-small` | 개발 확인용 소량 데이터 (상품 20 / 로케이션 30 / 재고 50 / 주문 10 / 사용자 4) |

```bash
# 규모를 바꾸려면 인자로 넘긴다
pnpm harness:seed-small -- --products 50 --orders 100
```

- **실행할 때마다 기존 데이터를 전부 지우고 다시 넣는다.**
- 시드값이 고정돼 있어 같은 옵션이면 항상 같은 데이터가 나온다.
- 접속 대상이 `localhost`가 아니면 실행을 거부한다.
  의도한 것이라면 `HARNESS_ALLOW_REMOTE=1`을 설정한다.
- 건수가 맞지 않으면 종료 코드 1로 끝난다.

TypeScript는 Node 22의 타입 스트리핑으로 그대로 실행한다. 별도 빌드나 `tsx`가 필요 없다.
그래서 `harness/` 안의 import는 `.ts` 확장자를 붙여야 한다.

### 데모 계정

`harness:seed-small`이 만드는 계정. 비밀번호는 전부 `demo1234`.

| 역할     | 계정           |
| -------- | -------------- |
| ADMIN    | admin@demo.io  |
| OPERATOR | ops@demo.io    |
| PICKER   | picker@demo.io |
| VIEWER   | viewer@demo.io |

---

## 인증과 권한

Auth.js(Credentials) + 자체 `USERS` 테이블. 비밀번호는 bcrypt 해시로만 저장한다.
세션은 JWT이며 사용자 id와 역할을 담는다.

역할·권한 정의는 `lib/auth/roles.ts` **한 곳에만** 둔다. 화면과 서버가 같은 정의를 본다.

### 두 겹으로 막는다

| 계층      | 파일                | 하는 일                                           |
| --------- | ------------------- | ------------------------------------------------- |
| 미들웨어  | `middleware.ts`     | 비로그인 **화면** 접근을 `/login`으로 돌린다      |
| 서버 가드 | `lib/auth/guard.ts` | **API**에서 역할을 검사해 401/403을 JSON으로 반환 |

미들웨어는 `/api/*`를 일부러 건드리지 않는다. API 호출에 HTML 로그인 페이지가
돌아오면 부르는 쪽이 처리할 수 없기 때문이다. API는 예외 없이 가드를 거친다.

```ts
const guard = await requirePermission("user:manage");
if (!guard.ok) return guard.response; // 401 또는 403
```

**화면에서 버튼을 숨기는 것은 권한 처리가 아니다.** 브라우저 콘솔에서 `fetch` 한 줄이면
그대로 호출된다. 실제로 확인한 결과는 아래와 같다.

| 호출자   | `GET /api/users`                          |
| -------- | ----------------------------------------- |
| 비로그인 | `401 UNAUTHENTICATED`                     |
| PICKER   | `403 FORBIDDEN` — `user:manage` 권한 없음 |
| ADMIN    | `200`                                     |

### 메뉴와 경로

콘솔 메뉴는 `lib/nav.ts`에서 역할이 아니라 **권한**에 매단다. 역할을 직접 적으면
(`role === "ADMIN"`) 나중에 권한이 바뀔 때 메뉴와 서버 검사가 서로 다른 곳에서 갈라진다.

메뉴를 숨기는 것만으로는 부족해서 주소를 직접 입력한 경우도 미들웨어에서 막는다.

| 역할     | 보이는 메뉴                    | `/users` 직접 접근 |
| -------- | ------------------------------ | ------------------ |
| ADMIN    | 7개 전부                       | 통과               |
| OPERATOR | 대시보드·주문·재고·웨이브·패킹 | 대시보드로 되돌림  |
| VIEWER   | 대시보드·주문·재고·웨이브      | 대시보드로 되돌림  |
| PICKER   | 없음 (모바일 피킹 전용)        | 대시보드로 되돌림  |

대시보드(`/`)만 경로 권한 검사에서 제외한다. 되돌려 보낼 곳이 대시보드인데
대시보드까지 막으면 리다이렉트가 무한히 반복되기 때문이다.

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
