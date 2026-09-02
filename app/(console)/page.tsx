import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/guard";
import { permissionsOf } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "대시보드 · PickFlow" };

/**
 * 대시보드 자리.
 *
 * 실시간 지표 화면(S-02)은 P23에서 만든다.
 * 지금은 세션과 권한이 제대로 실렸는지 확인하는 내용을 둔다.
 */
export default async function DashboardPage() {
  // 레이아웃에서 이미 확인했지만, 이 페이지도 스스로 서 있어야 한다.
  const user = await currentUser();
  if (!user) return null;

  const permissions = permissionsOf(user.role);

  return (
    <div className="space-y-6">
      <section aria-labelledby="page-title">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 id="page-title" className="text-xl font-bold text-slate-900">
            대시보드
          </h1>
          <p className="font-mono text-xs text-slate-600">S-02</p>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          오늘 주문·출고·지연 건수와 실시간 갱신은 P23에서 붙입니다.
        </p>
      </section>

      <section
        aria-labelledby="session-heading"
        className="rounded-lg border border-slate-300 bg-white p-6"
      >
        <h2 id="session-heading" className="text-base font-semibold text-slate-900">
          로그인 정보
        </h2>
        <dl className="mt-4 grid grid-cols-[5rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-slate-700">이름</dt>
          <dd className="text-slate-900">{user.name}</dd>
          <dt className="font-medium text-slate-700">이메일</dt>
          <dd className="break-all font-mono text-slate-900">{user.email}</dd>
          <dt className="font-medium text-slate-700">역할</dt>
          <dd className="text-slate-900">{user.role}</dd>
        </dl>
      </section>

      <section
        aria-labelledby="permissions-heading"
        className="rounded-lg border border-slate-300 bg-white p-6"
      >
        <h2 id="permissions-heading" className="text-base font-semibold text-slate-900">
          이 역할의 권한
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          왼쪽 메뉴도 이 목록에서 걸러집니다. 화면과 서버가 lib/auth/roles.ts 한 곳만 봅니다.
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
    </div>
  );
}
