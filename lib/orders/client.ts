import type { SortKey } from "./list-query";

/** /api/orders 응답. 서버가 내려주는 모양 그대로. */
export type OrderRow = {
  id: number;
  orderNo: string;
  channel: string;
  recipientName: string;
  status: string;
  /** 색만으로 상태를 전달하지 않도록 서버가 한글 이름을 함께 내려준다. */
  statusLabel: string;
  orderedAt: string;
  dueAt: string | null;
  itemCount: number;
};

export type OrderListResponse = {
  orders: OrderRow[];
  page: { page: number; size: number; total: number; totalPages: number };
  elapsedMs?: number;
};

export type OrderListParams = {
  page: number;
  size: number;
  sort: SortKey;
};

export function toSearchParams(params: OrderListParams): URLSearchParams {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("size", String(params.size));
  search.set("sort", params.sort);
  return search;
}

/**
 * 목록을 가져온다.
 *
 * 실패해도 빈 목록으로 삼키지 않는다. 화면이 "데이터 없음"과 "오류"를
 * 구분해서 보여줘야 하기 때문이다.
 */
export async function fetchOrders(params: OrderListParams): Promise<OrderListResponse> {
  const response = await fetch(`/api/orders?${toSearchParams(params)}`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `주문 목록을 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  return response.json();
}
