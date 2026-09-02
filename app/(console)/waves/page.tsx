import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "웨이브 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-06"
      title="웨이브"
      plannedAt="P18"
      description="선택한 주문들로 피킹 웨이브를 만들고 작업자를 배정합니다."
    />
  );
}
