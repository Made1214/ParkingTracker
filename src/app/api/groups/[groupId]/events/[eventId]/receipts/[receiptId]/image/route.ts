import { receiptImageResponse } from "@/features/receipts";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ groupId: string; eventId: string; receiptId: string }>;
  },
) {
  const { groupId, eventId, receiptId } = await params;
  return receiptImageResponse(groupId, eventId, receiptId);
}
