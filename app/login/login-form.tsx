"use client";

import { useActionState, useEffect, useRef } from "react";
import { login, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null, field: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 오류가 나면 문제가 된 입력으로 포커스를 옮긴다.
  // 스크린리더 사용자가 오류 안내를 듣고 나서 어디를 고쳐야 할지 찾아 헤매지 않게 한다.
  useEffect(() => {
    if (!state.error) return;
    if (state.field === "password") passwordRef.current?.focus();
    else if (state.field === "email") emailRef.current?.focus();
  }, [state]);

  const hasError = state.error !== null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/*
        오류는 role="alert"로 즉시 읽어준다.
        내용이 없을 때도 요소를 남겨두어야 나중에 채워진 텍스트가 확실히 전달된다.
      */}
      <p
        id="login-error"
        role="alert"
        aria-live="assertive"
        className={
          hasError
            ? "rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
            : "sr-only"
        }
      >
        {state.error ?? ""}
      </p>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-800">
          이메일
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
          <span className="sr-only">(필수)</span>
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue="admin@demo.io"
          aria-describedby={hasError ? "login-error" : undefined}
          aria-invalid={state.field === "email" ? true : undefined}
          /* iOS 사파리는 16px 미만 입력에 자동 확대가 걸린다. text-base(16px)를 유지한다. */
          className="w-full rounded-md border border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-slate-800">
          비밀번호
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
          <span className="sr-only">(필수)</span>
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue="demo1234"
          aria-describedby={hasError ? "login-error" : undefined}
          aria-invalid={state.field === "password" ? true : undefined}
          className="w-full rounded-md border border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        /* 터치 영역을 충분히 확보한다(최소 48px). */
        className="min-h-12 w-full rounded-md bg-blue-800 px-4 py-3 text-base font-semibold text-white hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-500"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>

      {/* 진행 상태도 색이나 애니메이션이 아니라 텍스트로 전달한다. */}
      <p aria-live="polite" className="sr-only">
        {pending ? "로그인을 처리하고 있습니다." : ""}
      </p>
    </form>
  );
}
