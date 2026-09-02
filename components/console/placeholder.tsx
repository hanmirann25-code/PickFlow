/**
 * 아직 만들지 않은 화면의 자리표시자.
 *
 * P7에서 레이아웃과 메뉴 이동을 검증하려면 갈 곳이 있어야 한다.
 * 각 화면이 실제로 만들어지면 이 컴포넌트를 쓰던 페이지가 통째로 교체된다.
 */
export function Placeholder({
  screen,
  title,
  plannedAt,
  description,
}: {
  screen: string;
  title: string;
  plannedAt: string;
  description: string;
}) {
  return (
    <section aria-labelledby="page-title">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 id="page-title" className="text-xl font-bold text-slate-900">
          {title}
        </h1>
        <p className="font-mono text-xs text-slate-600">{screen}</p>
      </div>

      <p className="mt-2 text-sm text-slate-700">{description}</p>

      <div className="mt-6 rounded-lg border border-dashed border-slate-400 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-800">아직 만들지 않은 화면입니다</p>
        <p className="mt-1 text-sm text-slate-600">{plannedAt}에서 만듭니다.</p>
      </div>
    </section>
  );
}
