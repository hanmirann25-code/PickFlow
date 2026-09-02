import { NextResponse, type NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db/query";
import { requirePermission } from "@/lib/auth/guard";
import { ORDER_STATUS_LABELS, isOrderStatus } from "@/lib/order-graph";
import {
  parseOrderListQuery,
  buildListSql,
  buildCountSql,
  type OrderListRow,
} from "@/lib/orders/list-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 주문 목록.
 *
 * GET /api/orders?page=1&size=50&status=RECEIVED&status=HOLD&channel=자사몰
 *                &q=O-2026&from=2026-08-01&to=2026-08-31&sort=orderedAt:desc
 *
 * 페이징·필터·정렬은 전부 SQL에서 처리한다.
 * 10만 건을 브라우저로 내려보내 거르는 방식은 쓰지 않는다.
 */
export async function GET(request: NextRequest) {
  const guard = await requirePermission("order:read");
  if (!guard.ok) return guard.response;

  const parsed = parseOrderListQuery(request.nextUrl.searchParams);
  if (!parsed.success) {
    // 어떤 파라미터가 왜 틀렸는지 알려준다. "잘못된 요청"만 돌려주지 않는다.
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "조회 조건이 올바르지 않습니다.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const params = parsed.data;
  const startedAt = Date.now();

  const list = buildListSql(params);
  const count = buildCountSql(params);

  // 전체 건수는 별도 쿼리로 센다.
  // 목록 쿼리에 COUNT(*) OVER ()를 붙이면 매 행마다 전체를 세느라 느려진다.
  const [rows, total] = await Promise.all([
    query<OrderListRow>(list.sql, list.binds),
    queryOne<{ TOTAL: number }>(count.sql, count.binds),
  ]);

  const elapsedMs = Date.now() - startedAt;
  const totalCount = total?.TOTAL ?? 0;

  return NextResponse.json({
    orders: rows.map((row) => ({
      id: row.ID,
      orderNo: row.ORDER_NO,
      channel: row.CHANNEL,
      recipientName: row.RECIPIENT_NAME,
      status: row.STATUS,
      // 색만으로 상태를 전달하지 않도록 화면이 쓸 한글 이름을 함께 내려준다.
      statusLabel: isOrderStatus(row.STATUS) ? ORDER_STATUS_LABELS[row.STATUS] : row.STATUS,
      orderedAt: row.ORDERED_AT,
      dueAt: row.DUE_AT,
      itemCount: row.ITEM_COUNT,
    })),
    page: {
      page: params.page,
      size: params.size,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / params.size)),
    },
    // 실행 시간은 개발 환경에서만 내보낸다. 운영에서는 내부 정보를 굳이 노출하지 않는다.
    ...(process.env.NODE_ENV === "production" ? {} : { elapsedMs }),
  });
}
