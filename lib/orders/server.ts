import { query, queryOne } from "@/lib/db/query";
import { ORDER_STATUS_LABELS, isOrderStatus } from "@/lib/order-graph";
import { buildListSql, buildCountSql, type OrderListQuery, type OrderListRow } from "./list-query";
import type { OrderListResponse } from "./client";

/**
 * 주문 목록 조회 — 서버 전용.
 *
 * API 라우트와 서버 컴포넌트가 같은 함수를 쓴다.
 * 각자 조회하면 응답 모양이 조금씩 달라지고, 화면이 서버가 미리 넣어준 데이터와
 * 스크롤로 받아온 데이터를 다르게 그리게 된다.
 */
export async function queryOrderList(params: OrderListQuery): Promise<OrderListResponse> {
  const list = buildListSql(params);
  const count = buildCountSql(params);

  // 전체 건수는 별도 쿼리로 센다.
  // 목록 쿼리에 COUNT(*) OVER ()를 붙이면 매 행마다 전체를 세느라 느려진다.
  const [rows, total] = await Promise.all([
    query<OrderListRow>(list.sql, list.binds),
    queryOne<{ TOTAL: number }>(count.sql, count.binds),
  ]);

  const totalCount = total?.TOTAL ?? 0;

  return {
    orders: rows.map((row) => ({
      id: row.ID,
      orderNo: row.ORDER_NO,
      channel: row.CHANNEL,
      recipientName: row.RECIPIENT_NAME,
      status: row.STATUS,
      // 색만으로 상태를 전달하지 않도록 화면이 쓸 한글 이름을 함께 내려준다.
      statusLabel: isOrderStatus(row.STATUS) ? ORDER_STATUS_LABELS[row.STATUS] : row.STATUS,
      // 서버 컴포넌트가 클라이언트로 넘기려면 직렬화가 되어야 한다.
      orderedAt: row.ORDERED_AT.toISOString(),
      dueAt: row.DUE_AT ? row.DUE_AT.toISOString() : null,
      itemCount: row.ITEM_COUNT,
    })),
    page: {
      page: params.page,
      size: params.size,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / params.size)),
    },
  };
}
