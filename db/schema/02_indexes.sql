-- PickFlow 스키마 — 인덱스
--
-- 01_tables.sql 다음에 실행한다. 두 번 실행해도 깨지지 않는다.
--
-- 인덱스를 새로 추가할 때는 EXPLAIN PLAN을 먼저 확인하고, 왜 필요한지 주석으로 남긴다.
-- 근거 없는 인덱스는 쓰기 성능만 깎는다.

-- ─────────────────────────────────────────────────────────────
-- 기획서 6장에 명시된 필수 인덱스 4개
-- 이게 없으면 10만 건에서 주문 목록이 느려진다.
-- ─────────────────────────────────────────────────────────────

-- 주문 목록의 기본 정렬 + 상태 필터. S-03 화면의 기본 조회 경로다.
CREATE INDEX IF NOT EXISTS IX_ORDERS_STATUS_DATE
  ON ORDERS (STATUS, ORDERED_AT DESC);

-- 채널별 조회.
CREATE INDEX IF NOT EXISTS IX_ORDERS_CHANNEL_DATE
  ON ORDERS (CHANNEL, ORDERED_AT DESC);

-- 재고 조회 겸 유니크 제약. 같은 상품이 같은 로케이션에 두 행으로 생기는 것을 막는다.
CREATE UNIQUE INDEX IF NOT EXISTS UX_INV_PROD_LOC
  ON INVENTORY (PRODUCT_ID, LOCATION_ID);

-- 피킹 작업 동선 정렬. 모바일 화면이 다음 작업을 꺼낼 때 타는 경로다.
CREATE INDEX IF NOT EXISTS IX_TASKS_WAVE_SORT
  ON PICKING_TASKS (WAVE_ID, SORT_ORDER);

-- ─────────────────────────────────────────────────────────────
-- 외래키 인덱스
-- 오라클은 외래키에 인덱스를 자동으로 만들지 않는다. 없으면 부모 행을 갱신·삭제할 때
-- 자식 테이블 전체에 잠금이 걸리고, 조인도 풀 스캔이 된다.
-- ─────────────────────────────────────────────────────────────

-- 주문 상세(S-04)에서 주문 하나의 상품 줄을 꺼낼 때.
CREATE INDEX IF NOT EXISTS IX_ORDER_ITEMS_ORDER
  ON ORDER_ITEMS (ORDER_ID);

-- 정합성 조건 3(상품별 ALLOCATED_QTY 합계 대조)에서 상품 기준으로 훑는다.
CREATE INDEX IF NOT EXISTS IX_ORDER_ITEMS_PRODUCT
  ON ORDER_ITEMS (PRODUCT_ID);

-- 재고 할당 시 상품 기준으로 대상 행을 PRODUCT_ID 오름차순으로 잠근다.
CREATE INDEX IF NOT EXISTS IX_INVENTORY_PRODUCT
  ON INVENTORY (PRODUCT_ID);

CREATE INDEX IF NOT EXISTS IX_PICKING_TASKS_ITEM
  ON PICKING_TASKS (ORDER_ITEM_ID);

-- 작업자별 진행률(S-02 대시보드).
CREATE INDEX IF NOT EXISTS IX_PICKING_WAVES_USER
  ON PICKING_WAVES (ASSIGNED_USER_ID);

CREATE INDEX IF NOT EXISTS IX_SHIPMENTS_ORDER
  ON SHIPMENTS (ORDER_ID);

-- 정합성 조건 6(델타 총합 대조).
CREATE INDEX IF NOT EXISTS IX_INVENTORY_TX_PRODUCT
  ON INVENTORY_TRANSACTIONS (PRODUCT_ID);

-- 감사 로그 화면(S-10)은 "이 주문에 무슨 일이 있었나"로 조회한다.
CREATE INDEX IF NOT EXISTS IX_AUDIT_LOGS_TARGET
  ON AUDIT_LOGS (TARGET_TYPE, TARGET_ID, CREATED_AT DESC);

-- 사용자·기간 필터.
CREATE INDEX IF NOT EXISTS IX_AUDIT_LOGS_USER_DATE
  ON AUDIT_LOGS (USER_ID, CREATED_AT DESC);
