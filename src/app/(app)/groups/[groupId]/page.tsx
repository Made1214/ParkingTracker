import { GroupScreen } from "@/features/groups";
export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return <GroupScreen groupId={(await params).groupId} />;
}
