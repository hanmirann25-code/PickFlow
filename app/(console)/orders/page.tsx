import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { OrdersTable } from "@/components/orders/orders-table";
import { parseOrderListQuery } from "@/lib/orders/list-query";
import { queryOrderList } from "@/lib/orders/server";
import { parseFilters, serializeFilters, ORDERS_PAGE_SIZE } from "@/lib/orders/url-state";
import type { OrderListResponse } from "@/lib/orders/client";

export const metadata: Metadata = { title: "주문 목록 · PickFlow" };

// 조회 조건이 주소에 있으므로 매 요청 서버에서 만든다.
export const dynamic = "force-dynamic";

/**
 * 주문 목록 화면.
 *
 * 첫 페이지를 여기서 미리 조회해 화면에 넘긴다.
 *
 * 클라이언트에서만 가져오면 문서 → 자바스크립트 → 하이드레이션 → API 순서로
 * 기다리게 된다. 측정해 보니 API 요청이 93ms 시점에야 시작해서 첫 렌더의 절반이
 * 그 대기였다. 서버가 미리 담아 보내면 문서가 도착한 순간 이미 행이 들어 있다.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  // 미들웨어가 이미 막지만 서버에서 한 번 더 확인한다.
  if (!user) redirect("/login");
  if (!can(user.role, "order:read")) redirect("/");

  const raw = await searchParams;

  // Next가 주는 객체를 URLSearchParams로 되돌린다. 배열 조건(status, channel)이
  // 문자열 하나로 뭉개지지 않게 항목별로 붙인다.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }

  const filters = parseFilters(params);

  // 화면이 쓸 조회 조건과 정확히 같은 조건으로 첫 페이지를 받는다.
  const parsed = parseOrderListQuery(
    new URLSearchParams({
      ...Object.fromEntries(serializeFilters(filters)),
      page: "1",
      size: String(ORDERS_PAGE_SIZE),
    }),
  );

  let initialData: OrderListResponse | null = null;
  if (parsed.success) {
    // 배열 조건은 위 생성자에서 하나만 남으므로 다시 채운다.
    const queryParams = { ...parsed.data, status: filters.status, channel: filters.channel };
    initialData = await queryOrderList(queryParams);
  }

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 id="page-title" className="text-xl font-bold text-slate-900">
          주문 목록
        </h1>
        <p className="font-mono text-xs text-slate-600">S-03</p>
      </div>

      <OrdersTable
        initialData={initialData}
        // 이 초기 데이터가 어떤 조건으로 받은 것인지 함께 넘긴다.
        // 화면의 현재 조건과 다르면 쓰지 않는다. 다른 조건의 목록을 잠깐이라도
        // 보여주면 사용자가 잘못된 결과를 사실로 받아들인다.
        initialFilterKey={serializeFilters(filters).toString()}
      />
    </section>
  );
}
