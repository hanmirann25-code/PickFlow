import { ORDER_STATUSES, isOrderStatus, type OrderStatus } from "@/lib/order-graph";
import type { SortKey } from "./list-query";

/**
 * 주문 목록의 조회 조건을 URL에 담는다.
 *
 * 조건의 출처는 URL 하나뿐이다. 컴포넌트가 따로 상태를 들고 있지 않는다.
 * 그래야 새로고침해도, 주소를 복사해 보내도 같은 화면이 나온다.
 */

/**
 * 주문 채널 목록.
 *
 * harness/lib/fake.ts에도 같은 목록이 있다. 의도한 중복이다.
 * 하네스는 앱 코드를 import하지 않는다(앱이 죽어 있어도 돌아가야 하므로).
 */
export const ORDER_CHANNELS = ["스마트스토어", "자사몰", "오픈마켓", "라이브커머스"] as const;

export type OrderFilters = {
  status: OrderStatus[];
  channel: string[];
  q: string;
  from: string;
  to: string;
  sort: SortKey;
};

export const DEFAULT_SORT: SortKey = "orderedAt:desc";

/**
 * 한 번에 받아올 행 수.
 *
 * 서버 컴포넌트가 미리 조회하는 첫 페이지와 화면이 스크롤로 이어 받는 페이지가
 * 같은 크기여야 한다. 다르면 초기 데이터가 화면의 조회 조건과 어긋나 버려진다.
 */
export const ORDERS_PAGE_SIZE = 100;

const SORT_KEYS: readonly SortKey[] = [
  "orderedAt:desc",
  "orderedAt:asc",
  "orderNo:desc",
  "orderNo:asc",
  "dueAt:asc",
  "dueAt:desc",
  "status:asc",
];

/** YYYY-MM-DD 형태만 받는다. 아니면 없는 것으로 친다. */
function readDate(value: string | null): string {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/**
 * URL에서 조건을 읽는다.
 *
 * 잘못된 값은 조용히 버리고 기본값으로 되돌린다.
 * 주소를 손으로 고쳐 넣어도 화면이 깨지지 않아야 한다.
 */
export function parseFilters(params: URLSearchParams): OrderFilters {
  const sort = params.get("sort");
  return {
    status: params.getAll("status").filter(isOrderStatus),
    channel: params
      .getAll("channel")
      .filter((value) => (ORDER_CHANNELS as readonly string[]).includes(value)),
    q: (params.get("q") ?? "").trim().slice(0, 100),
    from: readDate(params.get("from")),
    to: readDate(params.get("to")),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULT_SORT,
  };
}

/**
 * 조건을 URL 쿼리로 되돌린다.
 *
 * 기본값은 넣지 않는다. 주소가 짧아야 공유하기 좋고,
 * 같은 화면이 여러 주소를 갖지 않는다.
 */
export function serializeFilters(filters: OrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const value of filters.status) params.append("status", value);
  for (const value of filters.channel) params.append("channel", value);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  return params;
}

export const EMPTY_FILTERS: OrderFilters = {
  status: [],
  channel: [],
  q: "",
  from: "",
  to: "",
  sort: DEFAULT_SORT,
};

/** 정렬을 뺀 조건이 하나라도 걸려 있는가. "필터 초기화" 버튼을 보일지 정한다. */
export function hasActiveFilters(filters: OrderFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.channel.length > 0 ||
    filters.q !== "" ||
    filters.from !== "" ||
    filters.to !== ""
  );
}

/** 걸려 있는 조건 개수. 화면에 "필터 3개 적용됨"으로 알린다. */
export function activeFilterCount(filters: OrderFilters): number {
  return (
    filters.status.length +
    filters.channel.length +
    (filters.q ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

export { ORDER_STATUSES };
