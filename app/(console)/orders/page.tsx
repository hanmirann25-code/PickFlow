import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "주문 목록 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-03"
      title="주문 목록"
      plannedAt="P9~P10"
      description="10만 건 규모에서 끊기지 않는 가상 스크롤 목록. 필터·정렬·페이지는 URL에 반영합니다."
    />
  );
}
