"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchOrders, type OrderRow } from "@/lib/orders/client";
import type { SortKey } from "@/lib/orders/list-query";
import {
  EMPTY_FILTERS,
  parseFilters,
  serializeFilters,
  type OrderFilters,
} from "@/lib/orders/url-state";
import { OrdersFilters } from "./orders-filters";

/**
 * 주문 목록 표 — 3단계: 필터 + URL 동기화.
 *
 * 다중 선택(4단계)은 아직 없다.
 *
 * 조회 조건의 출처는 URL 하나다. 컴포넌트가 조건을 따로 들고 있지 않으므로
 * 새로고침해도, 주소를 복사해 보내도 같은 화면이 나온다.
 *
 * 스크롤하면 다음 페이지를 이어 붙이고, 화면에 보이는 30여 행만 실제로 그린다.
 * 10만 건을 전부 DOM에 만들면 브라우저가 멈춘다.
 *
 * div로 행을 그리는 방법도 있지만 table/th/aria-sort를 포기하게 된다.
 * 진짜 <table>을 유지하고, 위아래에 높이만 가진 빈 행(스페이서)을 넣어
 * 스크롤 길이를 맞추는 방식을 쓴다.
 */

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, OrderRow>();
const EMPTY: OrderRow[] = [];

/** 한 번에 받아올 행 수. 스크롤을 조금만 내려도 다음 묶음이 붙도록 넉넉히 잡는다. */
const PAGE_SIZE = 100;
/** 행 높이(px). 가상 스크롤이 전체 높이를 계산하는 기준이라 실제 높이와 맞춰야 한다. */
const ROW_HEIGHT = 44;

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

export function OrdersTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 조회 조건은 URL에서만 읽는다. 컴포넌트가 사본을 들고 있으면 둘이 어긋난다.
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const sort = filters.sort;

  /** 키보드로 이동 중인 행. 가상 스크롤에서 포커스를 잃지 않기 위한 기준점이다. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * 조건을 URL에 반영한다.
   *
   * replace를 쓰면 히스토리에 쌓이지 않는다. 검색어처럼 자주 바뀌는 값에 쓴다.
   * 체크박스·날짜처럼 사용자가 의식적으로 누른 조작은 push로 남겨
   * 뒤로 가기로 되돌릴 수 있게 한다.
   */
  const applyFilters = useCallback(
    (next: OrderFilters, mode: "push" | "replace" = "push") => {
      const params = serializeFilters(next);
      const url = params.size > 0 ? `${pathname}?${params}` : pathname;
      // scroll: false — 목록 위치를 건드리지 않는다.
      router[mode](url, { scroll: false });
    },
    [pathname, router],
  );

  const query = useInfiniteQuery({
    // 서버가 처리하는 조건은 전부 키에 넣는다. 하나라도 빠지면 옛 결과가 남는다.
    queryKey: ["orders", { size: PAGE_SIZE, ...filters }],
    queryFn: ({ pageParam }) =>
      fetchOrders({
        page: pageParam,
        size: PAGE_SIZE,
        sort: filters.sort,
        status: filters.status,
        channel: filters.channel,
        q: filters.q,
        from: filters.from,
        to: filters.to,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page.page < last.page.totalPages ? last.page.page + 1 : undefined,
  });

  // 받아온 페이지들을 한 줄로 편다. 페이지가 바뀔 때만 다시 만든다.
  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.orders) ?? EMPTY,
    [query.data],
  );

  const total = query.data?.pages[0]?.page.total ?? 0;

  const table = useTable({ features, columns, data: rows });
  const modelRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // 화면 밖 위아래로 여유분을 더 그려둔다. 빠르게 스크롤할 때 빈 칸이 보이지 않는다.
    overscan: 12,
    getItemKey: (index) => modelRows[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 끝에 다가가면 다음 묶음을 미리 받는다.
  const lastIndex = virtualItems.at(-1)?.index ?? 0;
  useEffect(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    if (lastIndex >= modelRows.length - 20) query.fetchNextPage();
  }, [lastIndex, modelRows.length, query]);

  // 조건이 바뀌면 목록이 완전히 달라지므로 맨 위에서 다시 본다.
  //
  // 의존성에 virtualizer를 넣으면 안 된다. 렌더마다 이 effect가 다시 돌면서
  // setActiveIndex(null)이 활성 행을 지운다. 그러면 포커스 관리 effect가
  // 아무것도 하지 못해 스크롤 시 포커스가 body로 떨어진다.
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  const filterKey = searchParams.toString();
  useEffect(() => {
    virtualizerRef.current.scrollToOffset(0);
    setActiveIndex(null);
  }, [filterKey]);

  /**
   * 활성 행으로 포커스를 옮긴다.
   *
   * 가상 스크롤에서는 화면 밖 행이 DOM에서 사라진다. 포커스가 그 행에 있으면
   * 포커스가 body로 떨어져 키보드 사용자가 위치를 잃는다.
   * 활성 행을 항상 화면 안으로 스크롤해 DOM에 남게 하고, 그 행에 포커스를 준다.
   */
  useEffect(() => {
    if (activeIndex === null) return;
    const container = scrollRef.current;
    if (!container) return;

    const active = document.activeElement;
    const focusInside = active === container || container.contains(active);
    const focusLost = active === document.body;

    // 사용자가 정렬 버튼 같은 다른 곳을 보고 있으면 포커스를 뺏지 않는다.
    if (!focusInside && !focusLost) return;

    const row = container.querySelector<HTMLElement>(`tr[data-index="${activeIndex}"]`);

    if (row) {
      if (active !== row) row.focus({ preventScroll: true });
      return;
    }

    // 활성 행이 화면 밖으로 밀려 DOM에서 사라졌다.
    // 그냥 두면 포커스가 body로 떨어져 키보드 사용자가 목록 밖으로 튕겨 나간다.
    // 스크롤 영역이 포커스를 받아두면 화살표 키로 바로 목록을 이어서 쓸 수 있다.
    if (focusLost) container.focus({ preventScroll: true });
  }, [activeIndex, virtualItems]);

  const moveActive = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, modelRows.length - 1));
      virtualizer.scrollToIndex(clamped, { align: "auto" });
      setActiveIndex(clamped);
    },
    [modelRows.length, virtualizer],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = activeIndex ?? -1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(current - 1);
        break;
      case "Home":
        event.preventDefault();
        moveActive(0);
        break;
      case "End":
        event.preventDefault();
        moveActive(modelRows.length - 1);
        break;
      case "PageDown":
        event.preventDefault();
        moveActive(current + 20);
        break;
      case "PageUp":
        event.preventDefault();
        moveActive(current - 20);
        break;
      default:
        break;
    }
  }

  // 검색어는 타이핑마다 바뀌므로 히스토리에 쌓지 않는다(replace).
  const handleSearchChange = useCallback(
    (q: string) => applyFilters({ ...filters, q }, "replace"),
    [applyFilters, filters],
  );

  const sortState = useMemo(() => {
    const [key, direction] = sort.split(":");
    return { key, direction: direction as "asc" | "desc" };
  }, [sort]);

  function toggleSort(columnId: string) {
    const options = SORTABLE[columnId];
    if (!options) return;
    const next: SortKey =
      sortState.key === columnId && sortState.direction === "asc" ? options.desc : options.asc;
    applyFilters({ ...filters, sort: next });
  }

  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);
  const columnCount = table.getHeaderGroups()[0]?.headers.length ?? 1;

  return (
    <div className="space-y-3">
      <OrdersFilters
        filters={filters}
        onChange={(next) => applyFilters(next, "push")}
        onSearchChange={handleSearchChange}
        onReset={() => applyFilters({ ...EMPTY_FILTERS, sort: filters.sort }, "push")}
        resultCount={query.isPending ? null : total}
        isFetching={query.isFetching && !query.isFetchingNextPage}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
        <p>
          전체 <strong className="font-semibold text-slate-900">{total.toLocaleString()}</strong> 건
        </p>
        <p className="text-slate-600">
          {rows.length.toLocaleString()}건 불러옴
          {/* 화면에 실제로 그려진 행 수. 가상 스크롤이 동작하는지 눈으로 확인할 수 있다. */}
          <span className="ml-2 text-slate-500">(DOM {virtualItems.length}행)</span>
        </p>
        <p aria-live="polite" className="text-slate-600">
          {query.isFetchingNextPage ? "다음 목록을 불러오는 중…" : ""}
        </p>
      </div>

      <div
        ref={scrollRef}
        onKeyDown={handleKeyDown}
        // 활성 행이 없을 때도 스크롤 영역 자체가 키보드로 잡힌다.
        // 포커스가 body로 떨어지는 것을 막는 마지막 안전장치다.
        tabIndex={0}
        role="group"
        aria-label="주문 목록. 위아래 화살표로 행을 이동합니다."
        className="h-[calc(100dvh-16rem)] min-h-80 overflow-auto rounded-lg border border-slate-300 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <table
          /*
            border-collapse: collapse 에서는 thead/th에 position:sticky가 먹지 않는다.
            테두리를 셀이 각자 그리도록 separate로 바꾸고 간격을 0으로 둔다.
          */
          className="w-full border-separate border-spacing-0 text-sm"
          // 가상 스크롤은 일부 행만 그리므로 스크린리더가 전체 개수를 알 수 없다.
          // 실제 전체 행 수와 각 행의 진짜 순번을 따로 알려준다.
          aria-rowcount={total}
        >
          <caption className="sr-only">
            주문 목록. 주문번호·상태·주문일시 열은 열 제목 버튼으로 정렬할 수 있습니다. 목록 안에서
            위아래 화살표로 행을 이동할 수 있습니다.
          </caption>

          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} aria-rowindex={1}>
                {group.headers.map((header) => {
                  const sortable = SORTABLE[header.column.id] !== undefined;
                  const isCurrent = sortable && sortState.key === header.column.id;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        isCurrent
                          ? sortState.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : sortable
                            ? "none"
                            : undefined
                      }
                      // 헤더 고정. thead가 아니라 각 th에 걸어야 동작한다.
                      className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800"
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
            {/* 위쪽 여백. 스크롤 막대 길이를 실제 전체 행 수에 맞추기 위한 빈 행이다. */}
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columnCount} style={{ height: paddingTop }} />
              </tr>
            )}

            {virtualItems.map((item) => {
              const row = modelRows[item.index];
              if (!row) return null;
              const isActive = activeIndex === item.index;
              return (
                <tr
                  key={row.id}
                  data-index={item.index}
                  // 헤더가 1번이므로 데이터 행은 2번부터 시작한다.
                  aria-rowindex={item.index + 2}
                  // 로빙 탭인덱스. 목록 전체가 탭 정지점 하나로 동작한다.
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => setActiveIndex(item.index)}
                  style={{ height: ROW_HEIGHT }}
                  className={[
                    // border-separate라 행 아래 테두리는 셀이 그린다.
                    "[&>td]:border-b [&>td]:border-slate-200",
                    "focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-700",
                    isActive ? "bg-blue-50" : "",
                  ].join(" ")}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-3 py-2 text-slate-800">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* 아래쪽 여백. */}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columnCount} style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>

        <StatePanel query={query} rowCount={rows.length} />
      </div>

      {/*
        스크롤로만 더 불러올 수 있으면 키보드·스크린리더 사용자가 막힌다.
        같은 동작을 하는 버튼을 따로 둔다.
      */}
      {query.hasNextPage && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="min-h-11 rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:text-slate-400"
          >
            {query.isFetchingNextPage ? "불러오는 중…" : "다음 100건 더 불러오기"}
          </button>
        </div>
      )}
    </div>
  );
}

type QueryLike = {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

function StatePanel({ query, rowCount }: { query: QueryLike; rowCount: number }) {
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
        <p className="mt-1 text-sm text-slate-600">시드 하네스로 데이터를 넣어보세요.</p>
      </div>
    );
  }

  return null;
}
