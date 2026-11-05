import { EventScreen } from "@/features/events";
export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
}) {
  return <EventScreen {...await params} />;
}
