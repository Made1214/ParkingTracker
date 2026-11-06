import { RecoveryScreen, requireUser } from "@/features/auth";
export default async function Page() {
  await requireUser("/reset-password");
  return <RecoveryScreen reset />;
}
