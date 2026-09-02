import { Suspense } from "react";
import type { Metadata } from "next";
import { OrdersTable } from "@/components/orders/orders-table";

export const metadata: Metadata = { title: "주문 목록 · PickFlow" };

export default function OrdersPage() {
  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 id="page-title" className="text-xl font-bold text-slate-900">
          주문 목록
        </h1>
        <p className="font-mono text-xs text-slate-600">S-03</p>
      </div>

      {/*
        OrdersTable은 useSearchParams로 조회 조건을 읽는다.
        Next는 그 훅을 쓰는 트리에 Suspense 경계를 요구한다.
      */}
      <Suspense
        fallback={
          <p role="status" className="py-10 text-center text-sm text-slate-600">
            주문 목록을 준비하는 중입니다…
          </p>
        }
      >
        <OrdersTable />
      </Suspense>
    </section>
  );
}
