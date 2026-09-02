import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can, type Permission, type Role } from "./roles";

/**
 * 서버에서 역할을 검사하는 헬퍼.
 *
 * 화면에서 버튼을 숨기는 것은 권한 처리가 아니다. 편의일 뿐이다.
 * 브라우저 콘솔에서 fetch 한 줄이면 그대로 호출된다.
 * 그래서 모든 보호 대상 API는 여기를 반드시 거친다.
 */

export type SessionUser = {
  id: string;
  role: Role;
  email: string | null;
  name: string | null;
};

/** 로그인 사용자. 없으면 null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;

  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

/** 권한 검사 결과. 통과면 user, 실패면 그대로 반환할 응답이 들어 있다. */
export type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

/**
 * API 라우트에서 쓴다.
 *
 * ```ts
 * const guard = await requirePermission("user:manage");
 * if (!guard.ok) return guard.response;
 * // 여기서부터 guard.user 사용
 * ```
 *
 * 401(누구인지 모름)과 403(누구인지는 알지만 권한 없음)을 구분한다.
 * 화면이 "로그인하세요"와 "권한이 없습니다"를 다르게 안내할 수 있어야 하기 때문이다.
 */
export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const user = await currentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "UNAUTHENTICATED",
          message: "로그인이 필요합니다.",
          hint: "로그인 후 다시 시도하세요.",
        },
        { status: 401 },
      ),
    };
  }

  if (!can(user.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "FORBIDDEN",
          message: `이 작업에는 ${permission} 권한이 필요합니다.`,
          hint: `현재 역할(${user.role})로는 수행할 수 없습니다. 관리자에게 문의하세요.`,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}

/** 로그인만 확인하면 될 때. */
export async function requireLogin(): Promise<GuardResult> {
  const user = await currentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}
