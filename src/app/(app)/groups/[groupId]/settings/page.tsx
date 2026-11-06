import { GroupSettingsScreen } from "@/features/groups";
export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return <GroupSettingsScreen groupId={(await params).groupId} />;
}
