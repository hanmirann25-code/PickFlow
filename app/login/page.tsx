import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 · PickFlow",
  description: "PickFlow 풀필먼트 운영 콘솔 로그인",
};

const DEMO_ACCOUNTS = [
  { role: "관리자", email: "admin@demo.io" },
  { role: "운영자", email: "ops@demo.io" },
  { role: "작업자", email: "picker@demo.io" },
  { role: "조회 전용", email: "viewer@demo.io" },
];

export default function LoginPage() {
  return (
    /* 모바일 주소창 때문에 100vh는 잘린다. 100dvh를 쓴다. */
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">PickFlow</h1>
          <p className="mt-1.5 text-sm text-slate-700">풀필먼트 운영 콘솔</p>
        </header>

        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">로그인</h2>
          <LoginForm />
        </div>

        <section aria-labelledby="demo-accounts" className="mt-6">
          <h2 id="demo-accounts" className="mb-2 text-sm font-semibold text-slate-800">
            데모 계정
          </h2>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">역할별 데모 계정 목록. 비밀번호는 모두 demo1234</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-slate-300 py-1.5 text-left font-medium text-slate-700"
                >
                  역할
                </th>
                <th
                  scope="col"
                  className="border-b border-slate-300 py-1.5 text-left font-medium text-slate-700"
                >
                  이메일
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ACCOUNTS.map((account) => (
                <tr key={account.email}>
                  <th scope="row" className="py-1.5 text-left font-normal text-slate-700">
                    {account.role}
                  </th>
                  <td className="py-1.5 font-mono text-slate-800">{account.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-slate-700">
            비밀번호는 모두 <code className="font-mono">demo1234</code> 입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
