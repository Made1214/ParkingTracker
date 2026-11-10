import { StatsScreen } from "@/features/stats";
export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return <StatsScreen groupId={(await params).groupId} />;
}
