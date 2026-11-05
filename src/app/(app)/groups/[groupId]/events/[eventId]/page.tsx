import { EventScreen } from "@/features/events";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { section } = await searchParams;
  return <EventScreen {...await params} section={section} />;
}
