import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/order-graph";
import type { Binds } from "@/lib/db/query";

/**
 * 주문 목록 조회 SQL을 만든다.
 *
 * 규칙(.cursor/rules/oracle.mdc):
 * - 값은 전부 바인드 변수로 넘긴다. 문자열을 이어붙여 SQL을 만들지 않는다.
 *   IN 목록도 :status0, :status1처럼 자리표시자를 만들어 붙인다.
 * - SELECT * 금지. 필요한 컬럼만 적는다.
 * - 정렬 기준 없는 페이징을 만들지 않는다. 정렬 컬럼이 같을 때를 대비해
 *   ID를 마지막 기준으로 항상 덧붙인다. 없으면 페이지를 넘길 때 행이 겹치거나 빠진다.
 */

/**
 * 정렬 허용 목록.
 *
 * 정렬 컬럼은 바인드 변수로 넘길 수 없다(SQL 구조라서).
 * 그래서 사용자 입력을 그대로 쓰지 않고 여기 있는 값만 통과시킨다.
 */
// 별칭 없이 컬럼과 방향만 적는다. 안쪽 쿼리는 O., 바깥쪽은 P. 를 붙여 쓴다.
const SORTS = {
  "orderedAt:desc": "ORDERED_AT DESC",
  "orderedAt:asc": "ORDERED_AT ASC",
  "orderNo:desc": "ORDER_NO DESC",
  "orderNo:asc": "ORDER_NO ASC",
  "dueAt:asc": "DUE_AT ASC NULLS LAST",
  "dueAt:desc": "DUE_AT DESC NULLS LAST",
  "status:asc": "STATUS ASC",
} as const;

/** 정렬 구문 앞에 테이블 별칭을 붙인다. */
function orderBy(sort: SortKey, alias: "O" | "P"): string {
  return `${alias}.${SORTS[sort]}, ${alias}.ID DESC`;
}

export type SortKey = keyof typeof SORTS;

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // 상한을 둔다. size=100000이 들어오면 서버가 10만 행을 만들어낸다.
  size: z.coerce.number().int().min(1).max(200).default(50),
  status: z.array(z.enum(ORDER_STATUSES)).default([]),
  channel: z.array(z.string().min(1).max(30)).default([]),
  q: z.string().trim().max(100).optional(),
  /** YYYY-MM-DD. 그 날 00:00부터. */
  from: z.iso.date().optional(),
  /** YYYY-MM-DD. 그 날을 포함하려고 하루를 더해 미만으로 비교한다. */
  to: z.iso.date().optional(),
  sort: z.enum(Object.keys(SORTS) as [SortKey, ...SortKey[]]).default("orderedAt:desc"),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/** URLSearchParams를 스키마가 읽을 수 있는 모양으로 바꾼다. 배열 파라미터는 getAll로 모은다. */
export function parseOrderListQuery(searchParams: URLSearchParams) {
  return orderListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    size: searchParams.get("size") ?? undefined,
    status: searchParams.getAll("status"),
    channel: searchParams.getAll("channel"),
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
}

/** 이 쿼리가 넘기는 바인드 값은 문자열 아니면 숫자뿐이다. */
type BindValues = Record<string, string | number>;

type WhereParts = { clause: string; binds: BindValues };

function buildWhere(query: OrderListQuery): WhereParts {
  const conditions: string[] = [];
  const binds: BindValues = {};

  if (query.status.length > 0) {
    // IN 목록도 값을 이어붙이지 않는다. 자리표시자를 개수만큼 만든다.
    const names = query.status.map((value, i) => {
      binds[`status${i}`] = value;
      return `:status${i}`;
    });
    conditions.push(`O.STATUS IN (${names.join(", ")})`);
  }

  if (query.channel.length > 0) {
    const names = query.channel.map((value, i) => {
      binds[`channel${i}`] = value;
      return `:channel${i}`;
    });
    conditions.push(`O.CHANNEL IN (${names.join(", ")})`);
  }

  if (query.from) {
    conditions.push(`O.ORDERED_AT >= TO_TIMESTAMP_TZ(:fromAt, 'YYYY-MM-DD TZH:TZM')`);
    binds.fromAt = `${query.from} +09:00`;
  }

  if (query.to) {
    // 종료일을 포함하려고 다음 날 00:00 미만으로 비교한다.
    // TRUNC(ORDERED_AT) <= :to 로 쓰면 컬럼에 함수가 걸려 인덱스를 못 탄다.
    conditions.push(
      `O.ORDERED_AT < TO_TIMESTAMP_TZ(:toAt, 'YYYY-MM-DD TZH:TZM') + INTERVAL '1' DAY`,
    );
    binds.toAt = `${query.to} +09:00`;
  }

  if (query.q) {
    // 앞부분 일치만 본다. '%검색어%'로 감싸면 인덱스를 못 타고 10만 건을 전부 훑는다.
    conditions.push(`(O.ORDER_NO LIKE :qPrefix OR O.RECIPIENT_NAME LIKE :qPrefix)`);
    binds.qPrefix = `${query.q}%`;
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join("\n   AND ")}` : "",
    binds,
  };
}

export function buildListSql(query: OrderListQuery): { sql: string; binds: Binds } {
  const where = buildWhere(query);

  // 페이징을 먼저 끝내고, 그 페이지의 행에만 상품 수를 센다.
  //
  // 상품 수 서브쿼리를 바깥 SELECT에 두면 OFFSET/FETCH로 잘라내기 전에
  // 10만 행 전부에 대해 실행된다. 실행 계획 비용이 2,676에서 299,000으로 뛴다.
  // 안쪽에서 50건을 먼저 고른 뒤 세면 서브쿼리는 50번만 돈다.
  const sql = `
    SELECT P.ID,
           P.ORDER_NO,
           P.CHANNEL,
           P.RECIPIENT_NAME,
           P.STATUS,
           P.ORDERED_AT,
           P.DUE_AT,
           (SELECT COUNT(*) FROM ORDER_ITEMS OI WHERE OI.ORDER_ID = P.ID) AS ITEM_COUNT
      FROM (
        SELECT O.ID,
               O.ORDER_NO,
               O.CHANNEL,
               O.RECIPIENT_NAME,
               O.STATUS,
               O.ORDERED_AT,
               O.DUE_AT
          FROM ORDERS O
          ${where.clause}
         ORDER BY ${orderBy(query.sort, "O")}
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
      ) P
     ORDER BY ${orderBy(query.sort, "P")}
  `;

  return {
    sql,
    binds: {
      ...where.binds,
      offset: (query.page - 1) * query.size,
      limit: query.size,
    },
  };
}

export function buildCountSql(query: OrderListQuery): { sql: string; binds: Binds } {
  const where = buildWhere(query);
  return {
    sql: `SELECT COUNT(*) AS TOTAL FROM ORDERS O ${where.clause}`,
    binds: where.binds,
  };
}

export type OrderListRow = {
  ID: number;
  ORDER_NO: string;
  CHANNEL: string;
  RECIPIENT_NAME: string;
  STATUS: string;
  ORDERED_AT: Date;
  DUE_AT: Date | null;
  ITEM_COUNT: number;
};
