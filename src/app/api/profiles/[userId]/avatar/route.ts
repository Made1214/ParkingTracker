import { avatarResponse } from "@/features/profile";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return avatarResponse((await params).userId);
}
