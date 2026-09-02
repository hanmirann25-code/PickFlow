"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { fetchOrders, type OrderRow } from "@/lib/orders/client";
import type { SortKey } from "@/lib/orders/list-query";

/**
 * 주문 목록 표 — 1단계: 기본 표.
 *
 * 가상 스크롤(2단계), 필터·URL 동기화(3단계), 다중 선택(4단계)은 아직 없다.
 *
 * 페이징·정렬은 전부 서버가 한다. 표는 서버가 이미 처리한 한 페이지를 받아 그릴 뿐이다.
 * 그래서 manualPagination/manualSorting을 켜고 클라이언트 행 모델을 붙이지 않는다.
 */

// features/columns/data는 렌더마다 새로 만들지 않는다. 참조가 바뀌면 표가 매번 다시 만들어진다.
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, OrderRow>();
const EMPTY: OrderRow[] = [];

/** 표의 컬럼 id → API의 sort 키. 여기 없는 컬럼은 정렬할 수 없다. */
const SORTABLE: Partial<Record<string, { asc: SortKey; desc: SortKey }>> = {
  orderNo: { asc: "orderNo:asc", desc: "orderNo:desc" },
  status: { asc: "status:asc", desc: "status:asc" },
  orderedAt: { asc: "orderedAt:asc", desc: "orderedAt:desc" },
};

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 주문 후 지난 시간. 화면의 "경과" 열. */
function elapsedText(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

const columns = helper.columns([
  helper.accessor("orderNo", { header: "주문번호" }),
  helper.accessor("channel", { header: "채널" }),
  helper.accessor("recipientName", { header: "수취인" }),
  helper.accessor("itemCount", { header: "상품수" }),
  helper.accessor("statusLabel", { id: "status", header: "상태" }),
  helper.accessor("orderedAt", {
    header: "주문일시",
    cell: ({ getValue }) => dateFormat.format(new Date(getValue())),
  }),
  helper.display({
    id: "elapsed",
    header: "경과",
    cell: ({ row }) => elapsedText(row.original.orderedAt),
  }),
]);

const PAGE_SIZE = 50;

export function OrdersTable() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("orderedAt:desc");

  const query = useQuery({
    // 서버가 처리하는 값은 전부 키에 넣는다. 하나라도 빠지면 옛 결과가 그대로 남는다.
    queryKey: ["orders", { page, size: PAGE_SIZE, sort }],
    queryFn: () => fetchOrders({ page, size: PAGE_SIZE, sort }),
    // 페이지를 넘길 때 표가 비었다가 다시 그려지지 않게 이전 결과를 잠깐 유지한다.
    placeholderData: keepPreviousData,
  });

  const data = query.data?.orders ?? EMPTY;

  // 페이징·정렬 기능(feature)을 등록하지 않는다.
  // v9는 등록한 기능만 상태와 API를 만든다. 여기서는 서버가 이미 처리한 한 페이지를
  // 그리기만 하므로 표에 그 상태를 둘 이유가 없다. 페이지와 정렬은 위의 useState가 갖는다.
  const table = useTable({ features, columns, data });

  const pageInfo = query.data?.page;
  const totalPages = pageInfo?.totalPages ?? 1;

  const sortState = useMemo(() => {
    const [key, direction] = sort.split(":");
    return { key, direction: direction as "asc" | "desc" };
  }, [sort]);

  function toggleSort(columnId: string) {
    const options = SORTABLE[columnId];
    if (!options) return;
    setPage(1);
    setSort(
      sortState.key === columnId && sortState.direction === "asc" ? options.desc : options.asc,
    );
  }

  return (
    <div className="space-y-3">
      <StatusBar query={query} total={pageInfo?.total} />

      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            주문 목록. 주문번호·상태·주문일시 열은 열 제목 버튼으로 정렬할 수 있습니다.
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-slate-300 bg-slate-50">
                {group.headers.map((header) => {
                  const sortable = SORTABLE[header.column.id] !== undefined;
                  const isCurrent = sortable && sortState.key === header.column.id;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      // 정렬 상태를 스크린리더에 알린다. 화살표 모양만으로는 전달되지 않는다.
                      aria-sort={
                        isCurrent
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : sortable
                            ? "none"
                            : undefined
                      }
                      className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-800"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(header.column.id)}
                          className="flex min-h-11 items-center gap-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-slate-500">
                            {isCurrent ? (sortState.direction === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 last:border-b-0">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-3 py-2 text-slate-800">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 데이터 없음 / 불러오는 중 / 오류는 표 아래에 따로 안내한다. */}
        <EmptyOrErrorPanel query={query} rowCount={data.length} />
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={pageInfo?.total ?? 0}
        disabled={query.isPending}
        onChange={setPage}
      />
    </div>
  );
}

type QueryLike = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

function StatusBar({ query, total }: { query: QueryLike; total?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
      <p>
        전체{" "}
        <strong className="font-semibold text-slate-900">{(total ?? 0).toLocaleString()}</strong> 건
      </p>
      {/* 갱신 중임을 텍스트로도 알린다. */}
      <p aria-live="polite" className="text-slate-600">
        {query.isFetching && !query.isPending ? "목록을 갱신하는 중…" : ""}
      </p>
    </div>
  );
}

function EmptyOrErrorPanel({ query, rowCount }: { query: QueryLike; rowCount: number }) {
  if (query.isPending) {
    return (
      <p role="status" className="px-3 py-10 text-center text-sm text-slate-600">
        주문 목록을 불러오는 중입니다…
      </p>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="px-3 py-10 text-center">
        <p className="text-sm font-medium text-red-900">주문 목록을 불러오지 못했습니다.</p>
        <p className="mt-1 text-sm text-slate-700">
          {query.error?.message ?? "알 수 없는 오류입니다."}
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 min-h-11 rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (rowCount === 0) {
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">조회된 주문이 없습니다.</p>
        <p className="mt-1 text-sm text-slate-600">
          다른 페이지를 보거나, 시드 하네스로 데이터를 넣어보세요.
        </p>
      </div>
    );
  }

  return null;
}

function Pagination({
  page,
  totalPages,
  total,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;

  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-700" aria-live="polite">
        {totalPages.toLocaleString()}쪽 중 {page.toLocaleString()}쪽
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={disabled || page <= 1}
          className="min-h-11 rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className="min-h-11 rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          다음
        </button>
      </div>
    </nav>
  );
}
