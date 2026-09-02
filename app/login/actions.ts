"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";

export type LoginState = {
  /** 화면에 보여줄 오류. 성공이면 null. */
  error: string | null;
  /** 오류가 난 입력에 포커스를 옮기기 위한 표시. */
  field: "email" | "password" | null;
};

const schema = z.object({
  email: z.email({ message: "이메일 형식이 올바르지 않습니다." }),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요." }),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: first.message,
      field: first.path[0] === "password" ? "password" : "email",
    };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // 어느 쪽이 틀렸는지 알려주지 않는다. 계정 존재 여부가 드러난다.
      return {
        error: "이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해주세요.",
        field: "password",
      };
    }
    return {
      error: "로그인 처리 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.",
      field: null,
    };
  }

  // redirect는 내부적으로 예외를 던진다. try 밖에서 불러야 한다.
  // 현장 작업자를 모바일 피킹 화면으로 따로 보내는 것은 그 화면이 생기는 P19에서 붙인다.
  redirect("/");
}
