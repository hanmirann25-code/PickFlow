import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "감사 로그 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-10"
      title="감사 로그"
      plannedAt="P25"
      description="누가 언제 무엇을 바꿨는지, 변경 전후 값과 함께 봅니다."
    />
  );
}
