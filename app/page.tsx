import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { permissionsOf } from "@/lib/auth/roles";
import { SignOutButton } from "./sign-out-button";

/**
 * 임시 홈 화면.
 *
 * 로그인이 됐고 세션에 역할이 실려 있는지 눈으로 확인하기 위한 최소 화면이다.
 * 사이드바·상단바를 갖춘 실제 콘솔 레이아웃은 P7에서 만든다.
 */
export default async function HomePage() {
  const user = await currentUser();

  // 미들웨어가 이미 막지만, 서버에서 한 번 더 확인한다.
  if (!user) redirect("/login");

  const permissions = permissionsOf(user.role);

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">PickFlow</h1>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <section
          aria-labelledby="session-heading"
          className="rounded-lg border border-slate-300 bg-white p-6"
        >
          <h2 id="session-heading" className="text-base font-semibold text-slate-900">
            로그인 정보
          </h2>

          <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-slate-700">이름</dt>
            <dd className="text-slate-900">{user.name}</dd>
            <dt className="font-medium text-slate-700">이메일</dt>
            <dd className="font-mono text-slate-900">{user.email}</dd>
            <dt className="font-medium text-slate-700">역할</dt>
            <dd className="text-slate-900">{user.role}</dd>
          </dl>
        </section>

        <section
          aria-labelledby="permissions-heading"
          className="mt-6 rounded-lg border border-slate-300 bg-white p-6"
        >
          <h2 id="permissions-heading" className="text-base font-semibold text-slate-900">
            이 역할의 권한
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            lib/auth/roles.ts의 정의에서 가져온 값입니다. 화면과 서버가 같은 정의를 봅니다.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <li
                key={permission}
                className="rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-800"
              >
                {permission}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="next-heading"
          className="mt-6 rounded-lg border border-slate-300 bg-white p-6"
        >
          <h2 id="next-heading" className="text-base font-semibold text-slate-900">
            다음 단계
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            사이드바와 상단바를 갖춘 콘솔 레이아웃은 P7에서, 주문 목록은 P10에서 만듭니다.
          </p>
        </section>
      </main>
    </div>
  );
}
