import { AuthScreen } from "@/features/auth";
import { safeNext } from "@/shared/lib/utils";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthScreen mode="register" next={safeNext((await searchParams).next)} />
  );
}
