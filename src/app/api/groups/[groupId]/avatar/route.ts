import { groupAvatarResponse } from "@/features/groups";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return groupAvatarResponse((await params).groupId);
}
