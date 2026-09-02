import type { NextAuthConfig } from "next-auth";
import { isRole } from "@/lib/auth/roles";

/**
 * 미들웨어와 서버가 함께 쓰는 설정.
 *
 * 여기에는 DB에 붙는 코드를 넣지 않는다.
 * 미들웨어는 Edge 런타임에서 도는데 oracledb는 Node 런타임에서만 동작한다.
 * 사용자 조회가 필요한 Credentials 제공자는 auth.ts에서만 붙인다.
 *
 * 세션은 JWT라 미들웨어는 토큰만 열어보면 되고, DB 접근이 필요 없다.
 */

/** 로그인 없이 열 수 있는 경로. */
const PUBLIC_PATHS = ["/login"];

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // 실제 제공자는 auth.ts에서 붙인다.
  callbacks: {
    // 로그인 직후 한 번만 user가 들어온다. 그때 역할을 토큰에 심는다.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    // 화면에서 쓰는 session에도 같은 값을 실어준다.
    session({ session, token }) {
      if (token.id) session.user.id = String(token.id);
      if (isRole(token.role)) session.user.role = token.role;
      return session;
    },

    // 미들웨어가 이 값으로 통과 여부를 정한다.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
        return true;
      }

      // 로그인했으면 통과, 아니면 Auth.js가 /login으로 보낸다.
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
