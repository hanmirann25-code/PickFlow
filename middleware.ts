import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * 비로그인 접근 차단 — 화면(페이지) 전용.
 *
 * auth.ts가 아니라 auth.config.ts를 쓴다. 미들웨어는 Edge 런타임이고
 * auth.ts는 oracledb를 끌어오기 때문이다. 세션이 JWT라 토큰만 열어보면 되고
 * 여기서 DB에 붙을 일은 없다.
 *
 * API(/api/*)는 일부러 제외했다.
 * 미들웨어는 로그인이 없으면 /login으로 리다이렉트하는데,
 * API 호출에 HTML 로그인 페이지가 돌아오면 부르는 쪽이 처리할 수 없다.
 * API는 lib/auth/guard.ts가 401/403을 JSON으로 돌려준다.
 * 보호가 필요한 API는 예외 없이 guard를 거쳐야 한다.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // 정적 파일과 API를 뺀 모든 화면.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
