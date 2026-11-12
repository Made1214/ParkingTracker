import { GroupScreen } from "@/features/groups";
import { eventTab } from "@/features/events";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{
    salidas?: string | string[];
    desde?: string | string[];
  }>;
}) {
  const { salidas, desde } = await searchParams;
  return (
    <GroupScreen
      groupId={(await params).groupId}
      tab={eventTab(salidas)}
      cursor={Array.isArray(desde) ? desde[0] : desde}
    />
  );
}
