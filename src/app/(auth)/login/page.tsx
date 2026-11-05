import { AuthScreen } from "@/features/auth";
import { safeNext } from "@/shared/lib/utils";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthScreen
      mode="login"
      next={safeNext(query.next)}
      failed={!!query.error}
    />
  );
}
