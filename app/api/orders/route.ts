import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { parseOrderListQuery } from "@/lib/orders/list-query";
import { queryOrderList } from "@/lib/orders/server";

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
 *
 * 첫 페이지는 화면이 서버 컴포넌트에서 미리 받아 가므로 이 라우트는
 * 스크롤로 이어 받는 두 번째 페이지부터 주로 쓰인다.
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

  const startedAt = Date.now();
  const result = await queryOrderList(parsed.data);
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ...result,
    // 실행 시간은 개발 환경에서만 내보낸다. 운영에서는 내부 정보를 굳이 노출하지 않는다.
    ...(process.env.NODE_ENV === "production" ? {} : { elapsedMs }),
  });
}
