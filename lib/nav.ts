import { can, type Permission, type Role } from "./auth/roles";

/**
 * 콘솔 메뉴 정의.
 *
 * 메뉴는 역할이 아니라 **권한**에 매단다.
 * 역할을 직접 적으면(`role === 'ADMIN'`) 나중에 권한이 바뀔 때
 * 메뉴와 서버 검사가 서로 다른 곳에서 갈라진다.
 *
 * 화면 ID는 기획서 5-1의 화면 목록과 대응한다.
 */

export type NavItem = {
  /** 기획서 5-1의 화면 ID. 문서와 대조하기 쉽게 남긴다. */
  screen: string;
  label: string;
  href: string;
  /** 이 메뉴를 보려면 필요한 권한. */
  permission: Permission;
};

const NAV_ITEMS: readonly NavItem[] = [
  { screen: "S-02", label: "대시보드", href: "/", permission: "order:read" },
  { screen: "S-03", label: "주문", href: "/orders", permission: "order:read" },
  { screen: "S-05", label: "재고", href: "/inventory", permission: "inventory:read" },
  { screen: "S-06", label: "웨이브", href: "/waves", permission: "wave:read" },
  { screen: "S-07", label: "패킹", href: "/packing", permission: "packing:register" },
  { screen: "S-10", label: "감사 로그", href: "/audit-logs", permission: "audit:read" },
  { screen: "S-11", label: "사용자 관리", href: "/users", permission: "user:manage" },
];

/** 그 역할이 볼 수 있는 메뉴만. */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.permission));
}

/**
 * 그 경로를 담당하는 메뉴. 없으면 null.
 *
 * 미들웨어가 경로 권한을 검사할 때 쓴다.
 * 메뉴를 숨기는 것만으로는 부족하다. 주소창에 직접 쳐서 들어올 수 있다.
 */
export function navItemForPath(pathname: string): NavItem | null {
  // 더 긴 경로가 먼저 맞도록 정렬한다. '/'가 모든 경로를 삼키지 않게 isCurrent가 막아준다.
  return NAV_ITEMS.find((item) => isCurrent(pathname, item.href)) ?? null;
}

/**
 * 현재 경로가 그 메뉴에 해당하는지.
 *
 * 대시보드(`/`)만 정확히 일치를 본다. `/`는 모든 경로의 접두사라
 * 접두사 비교를 하면 어느 화면에서든 대시보드가 현재 메뉴로 표시된다.
 */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
