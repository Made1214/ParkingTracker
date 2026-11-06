import { ProfileScreen } from "@/features/profile";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const query = await searchParams;
  return <ProfileScreen passwordUpdated={query.password === "updated"} />;
}
