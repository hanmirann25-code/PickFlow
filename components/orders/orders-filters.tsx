"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-graph";
import {
  ORDER_CHANNELS,
  ORDER_STATUSES,
  activeFilterCount,
  hasActiveFilters,
  type OrderFilters,
} from "@/lib/orders/url-state";

/**
 * 주문 목록 필터.
 *
 * 값을 스스로 들고 있지 않는다. 현재 조건은 URL에서 내려오고,
 * 바꾸면 URL을 갱신해 다시 내려받는다. 화면과 주소가 어긋날 수 없다.
 *
 * 검색어만 예외로 입력 중 로컬 상태를 둔다. 글자마다 주소를 바꾸면
 * 히스토리가 더럽혀지고 요청도 너무 자주 나간다.
 */
export function OrdersFilters({
  filters,
  onChange,
  onSearchChange,
  onReset,
  resultCount,
  isFetching,
}: {
  filters: OrderFilters;
  /** 즉시 반영되는 조건. 히스토리에 남는다. */
  onChange: (next: OrderFilters) => void;
  /** 디바운스된 검색어. 히스토리를 더럽히지 않게 현재 항목을 교체한다. */
  onSearchChange: (q: string) => void;
  onReset: () => void;
  resultCount: number | null;
  isFetching: boolean;
}) {
  const ids = useId();
  const [searchText, setSearchText] = useState(filters.q);
  const composing = useRef(false);

  // 뒤로 가기 등으로 URL이 바뀌면 입력칸도 따라간다.
  useEffect(() => {
    setSearchText(filters.q);
  }, [filters.q]);

  // 입력이 멈춘 뒤 300ms에 한 번만 조회한다.
  useEffect(() => {
    if (searchText === filters.q) return;
    const timer = setTimeout(() => {
      // 한글 조합 중에는 보내지 않는다. 자모가 끊긴 상태로 검색된다.
      if (!composing.current) onSearchChange(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filters.q, onSearchChange]);

  function toggleArray<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  const count = activeFilterCount(filters);

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="rounded-lg border border-slate-300 bg-white p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${ids}-title`} className="text-sm font-semibold text-slate-900">
          조회 조건
          {count > 0 && (
            <span className="ml-2 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-900">
              {count}개 적용됨
            </span>
          )}
        </h2>

        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 검색 */}
        <div className="space-y-1.5">
          <label htmlFor={`${ids}-q`} className="block text-sm font-medium text-slate-800">
            검색
          </label>
          <input
            id={`${ids}-q`}
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              setSearchText(event.currentTarget.value);
            }}
            placeholder="주문번호 또는 수취인"
            aria-describedby={`${ids}-q-hint`}
            /* iOS 사파리 자동 확대를 막으려면 16px 이상이어야 한다. */
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
          <p id={`${ids}-q-hint`} className="text-xs text-slate-600">
            앞부분이 일치하는 것만 찾습니다.
          </p>
        </div>

        {/* 기간 */}
        <div className="space-y-1.5">
          <label htmlFor={`${ids}-from`} className="block text-sm font-medium text-slate-800">
            주문일 시작
          </label>
          <input
            id={`${ids}-from`}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => onChange({ ...filters, from: event.target.value })}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${ids}-to`} className="block text-sm font-medium text-slate-800">
            주문일 종료
          </label>
          <input
            id={`${ids}-to`}
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => onChange({ ...filters, to: event.target.value })}
            className="w-full rounded-md border border-slate-400 px-3 py-2 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
        </div>

        {/* 결과 안내. 조건을 바꾸면 스크린리더에도 결과가 전달된다. */}
        <div className="flex items-end">
          <p aria-live="polite" className="text-sm text-slate-700">
            {isFetching
              ? "조회 중…"
              : resultCount === null
                ? ""
                : `${resultCount.toLocaleString()}건 조회됨`}
          </p>
        </div>
      </div>

      {/* 상태 — 체크박스 묶음은 fieldset/legend로 관계를 알린다. */}
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-slate-800">상태</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ORDER_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <input
                id={`${ids}-status-${status}`}
                type="checkbox"
                checked={filters.status.includes(status)}
                onChange={() =>
                  onChange({
                    ...filters,
                    status: toggleArray<OrderStatus>(filters.status, status),
                  })
                }
                className="h-5 w-5 rounded border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              <label htmlFor={`${ids}-status-${status}`} className="text-sm text-slate-800">
                {ORDER_STATUS_LABELS[status]}
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      {/* 채널 */}
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-slate-800">채널</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ORDER_CHANNELS.map((channel) => (
            <div key={channel} className="flex items-center gap-1.5">
              <input
                id={`${ids}-channel-${channel}`}
                type="checkbox"
                checked={filters.channel.includes(channel)}
                onChange={() =>
                  onChange({ ...filters, channel: toggleArray(filters.channel, channel) })
                }
                className="h-5 w-5 rounded border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              <label htmlFor={`${ids}-channel-${channel}`} className="text-sm text-slate-800">
                {channel}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
