import type { NextAuthConfig } from "next-auth";
import { can, isRole } from "@/lib/auth/roles";
import { navItemForPath } from "@/lib/nav";

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

      // 로그인하지 않았으면 Auth.js가 /login으로 보낸다.
      const role = auth?.user?.role;
      if (!isRole(role)) return false;

      // 메뉴를 숨기는 것만으로는 부족하다. 주소창에 직접 쳐서 들어올 수 있으므로
      // 경로를 담당하는 메뉴의 권한을 여기서 다시 검사한다.
      //
      // 대시보드('/')는 검사에서 뺀다. 되돌려 보낼 곳이 대시보드인데
      // 대시보드까지 막으면 리다이렉트가 무한히 반복된다.
      // 메뉴가 하나도 없는 역할(PICKER)에게는 레이아웃이 안내 문구를 보여준다.
      const item = navItemForPath(pathname);
      if (item && item.href !== "/" && !can(role, item.permission)) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
