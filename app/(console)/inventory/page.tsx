import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "재고 현황 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-05"
      title="재고 현황"
      plannedAt="P15 전후"
      description="SKU별 실재고·할당됨·가용 재고를 로케이션 단위로 봅니다."
    />
  );
}
