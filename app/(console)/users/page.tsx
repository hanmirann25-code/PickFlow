import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "사용자 관리 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-11"
      title="사용자 관리"
      plannedAt="이후 단계"
      description="역할별 계정을 관리합니다. ADMIN 전용 화면입니다."
    />
  );
}
