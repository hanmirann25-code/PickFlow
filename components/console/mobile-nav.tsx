"use client";

import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/lib/nav";
import { NavList } from "./nav-list";

/**
 * 모바일 메뉴 서랍.
 *
 * 직접 포커스 트랩을 짜는 대신 네이티브 <dialog>의 showModal()을 쓴다.
 * 브라우저가 포커스 가두기, ESC로 닫기, 배경 비활성화,
 * 닫을 때 원래 위치로 포커스 복귀까지 해준다. 손으로 구현하면 빠뜨리기 쉬운 것들이다.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // ESC나 배경 클릭으로 닫힐 때도 상태를 맞춘다(aria-expanded 때문).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  function openDrawer() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeDrawer() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="flex min-h-12 min-w-12 items-center justify-center rounded-md border border-slate-400 text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 md:hidden"
      >
        {/* 아이콘만 있는 버튼이므로 이름을 따로 준다. */}
        <span className="sr-only">메뉴 열기</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>

      <dialog
        id="mobile-nav-drawer"
        ref={dialogRef}
        aria-label="주 메뉴"
        /*
          dialog는 기본이 가운데 정렬이다. 왼쪽에 붙은 전체 높이 서랍으로 바꾼다.
          backdrop:은 배경 레이어를 칠한다.
        */
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 backdrop:bg-slate-900/50"
        onClick={(event) => {
          // 배경(dialog 자체)을 누르면 닫는다. 내용 클릭은 그대로 둔다.
          if (event.target === dialogRef.current) closeDrawer();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
            <p className="text-base font-bold text-slate-900">PickFlow</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <span className="sr-only">메뉴 닫기</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto p-3">
            {/* 메뉴를 고르면 서랍을 닫는다. 화면이 바뀐 뒤에도 덮여 있으면 안 된다. */}
            <NavList items={items} onNavigate={closeDrawer} />
          </nav>
        </div>
      </dialog>
    </>
  );
}
