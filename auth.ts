import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { queryOne } from "@/lib/db/query";
import { isRole, type Role } from "@/lib/auth/roles";

/**
 * Auth.js 설정 — 서버 전용.
 *
 * 공통 설정은 auth.config.ts에 있고, 여기서 DB에 붙는 Credentials 제공자만 더한다.
 * 이 파일은 oracledb를 끌어오므로 미들웨어(Edge)에서 import하면 안 된다.
 */

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type UserRow = {
  ID: number;
  EMAIL: string;
  NAME: string;
  PASSWORD_HASH: string;
  ROLE: string;
};

/**
 * 계정이 없을 때 비교용으로 쓰는 더미 해시.
 *
 * 계정이 없다고 바로 null을 반환하면 응답이 눈에 띄게 빨라진다.
 * 그 시간 차이만으로 "이 이메일은 가입돼 있다"가 새어나간다.
 * 있든 없든 bcrypt 비교를 한 번 돌려 시간을 맞춘다.
 */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8DGpaGDGuPHmYtQ5W7YO0Vd0hZ8k1S";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await queryOne<UserRow>(
          `SELECT ID, EMAIL, NAME, PASSWORD_HASH, ROLE
             FROM USERS
            WHERE EMAIL = :email`,
          { email },
        );

        const matched = await bcrypt.compare(password, user?.PASSWORD_HASH ?? DUMMY_HASH);

        if (!user || !matched) return null;
        if (!isRole(user.ROLE)) return null;

        return {
          id: String(user.ID),
          email: user.EMAIL,
          name: user.NAME,
          role: user.ROLE,
        };
      },
    }),
  ],
});

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// next-auth/jwt의 JWT는 Record<string, unknown>을 상속하므로 따로 증강하지 않는다.
// token.role은 unknown으로 읽히고, isRole()로 좁혀서 쓴다.
