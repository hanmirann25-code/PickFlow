"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, type NavItem } from "@/lib/nav";

/**
 * 메뉴 목록. 데스크톱 사이드바와 모바일 서랍이 같은 것을 쓴다.
 *
 * 목록이므로 ul/li로 마크업한다. 스크린리더가 "총 5개 중 2번째"처럼 읽어준다.
 * 현재 위치는 aria-current="page"로 알린다. 색만으로 구분하지 않는다.
 */
export function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={[
                // 터치 영역 최소 48px.
                "flex min-h-12 items-center gap-2 rounded-md px-3 py-2 text-sm",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
                current
                  ? "bg-blue-50 font-semibold text-blue-900"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {/*
                현재 메뉴를 색으로만 알리지 않는다.
                왼쪽 막대를 함께 두어 색을 구분하지 못해도 위치를 알 수 있게 한다.
              */}
              <span
                aria-hidden="true"
                className={[
                  "h-5 w-1 rounded-full",
                  current ? "bg-blue-700" : "bg-transparent",
                ].join(" ")}
              />
              <span>{item.label}</span>
              {current && <span className="sr-only">(현재 위치)</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
