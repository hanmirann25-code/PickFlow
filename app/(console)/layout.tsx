import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth/guard";
import { navItemsFor } from "@/lib/nav";
import { NavList } from "@/components/console/nav-list";
import { MobileNav } from "@/components/console/mobile-nav";
import { SignOutButton } from "@/components/console/sign-out-button";

/**
 * 관리자 콘솔 공통 레이아웃.
 *
 * 랜드마크를 제대로 나눈다. header / nav / main.
 * 스크린리더 사용자는 이 랜드마크로 화면을 건너뛰며 훑는다.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // 미들웨어가 이미 막지만 서버에서 한 번 더 확인한다.
  if (!user) redirect("/login");

  const items = navItemsFor(user.role);

  return (
    /* 모바일 주소창 때문에 100vh는 잘린다. 100dvh를 쓴다. */
    <div className="min-h-dvh bg-slate-100">
      {/*
        본문 바로가기. 평소에는 숨어 있다가 탭으로 포커스가 오면 나타난다.
        키보드 사용자가 매번 메뉴 전체를 지나치지 않아도 되게 한다.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-800 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문 바로가기
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-300 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <MobileNav items={items} />

          <Link
            href="/"
            className="rounded text-lg font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            PickFlow
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <p className="hidden text-sm text-slate-700 sm:block">
              {user.name}
              <span className="ml-2 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                {user.role}
              </span>
            </p>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* 데스크톱 사이드바. 모바일에서는 숨기고 상단바의 햄버거로 연다. */}
        <nav
          aria-label="주 메뉴"
          className="sticky top-[57px] hidden h-[calc(100dvh-57px)] w-56 shrink-0 overflow-y-auto border-r border-slate-300 bg-white p-3 md:block"
        >
          <NavList items={items} />
        </nav>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6">
          {items.length === 0 ? (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-6">
              <h1 className="text-base font-semibold text-amber-900">
                이 역할에는 콘솔 메뉴가 없습니다
              </h1>
              <p className="mt-2 text-sm text-amber-900">
                현장 작업자({user.role})는 모바일 피킹 화면을 사용합니다. 그 화면은 P19에서
                만듭니다.
              </p>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
