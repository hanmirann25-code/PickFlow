import type { Metadata } from "next";
import { Placeholder } from "@/components/console/placeholder";

export const metadata: Metadata = { title: "패킹 · PickFlow" };

export default function Page() {
  return (
    <Placeholder
      screen="S-07"
      title="패킹"
      plannedAt="P24"
      description="검수·포장과 송장번호 등록. 엑셀 일괄 업로드를 포함합니다."
    />
  );
}
