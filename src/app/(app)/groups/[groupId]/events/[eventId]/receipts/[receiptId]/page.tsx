import { ReceiptScreen } from "@/features/receipts";

export const metadata = { title: "Factura" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string; receiptId: string }>;
}) {
  return <ReceiptScreen {...await params} />;
}
