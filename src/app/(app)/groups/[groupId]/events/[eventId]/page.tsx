import { EventScreen } from "@/features/events";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
  searchParams: Promise<{
    section?: string | string[];
    comentarios?: string | string[];
  }>;
}) {
  const { section, comentarios } = await searchParams;
  return (
    <EventScreen {...await params} section={section} comments={comentarios} />
  );
}
