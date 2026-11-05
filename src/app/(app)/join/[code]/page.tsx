import { JoinScreen } from "@/features/groups";
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <JoinScreen code={(await params).code} />;
}
