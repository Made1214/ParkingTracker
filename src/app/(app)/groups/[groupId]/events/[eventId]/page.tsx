import { EventScreen } from "@/features/events";
// Pasa al detalle la pestaña activa y los cursores de sus galerías.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
  searchParams: Promise<{
    section?: string | string[];
    comentarios?: string | string[];
    fotos?: string | string[];
  }>;
}) {
  const { section, comentarios, fotos } = await searchParams;
  return (
    <EventScreen
      {...await params}
      section={section}
      comments={comentarios}
      photos={fotos}
    />
  );
}
