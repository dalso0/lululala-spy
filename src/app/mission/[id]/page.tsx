import { notFound } from "next/navigation";
import { MissionRouter } from "@/components/missions/MissionRouter";
import { getMission, MISSIONS } from "@/lib/missions";

// 정적 배포: 미션 목록에 있는 주소만 미리 만들어 둔다
export const dynamicParams = false;

export function generateStaticParams() {
  return MISSIONS.map((m) => ({ id: m.id }));
}

export default async function MissionPage({ params }: PageProps<"/mission/[id]">) {
  const { id } = await params;
  const mission = getMission(id);
  if (!mission) notFound();
  return <MissionRouter id={mission.id} />;
}
