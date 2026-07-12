import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { decompressBuffer } from "@/lib/compression";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { sid } = await params;
  const submissionId = Number(sid);
  if (!Number.isInteger(submissionId)) return new NextResponse("Not found", { status: 404 });

  const row = await q1<{
    student_id: number;
    file_name: string | null;
    file_data: Buffer | null;
    subject_id: number;
  }>(
    `SELECT s.student_id, s.file_name, s.file_data, a.subject_id
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE s.id = $1`,
    [submissionId]
  );
  if (!row || !row.file_data) return new NextResponse("Not found", { status: 404 });

  const access = await getSubjectAccess(row.subject_id, user.id, user.role);
  const allowed = access?.as === "teacher" || row.student_id === user.id;
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(new Uint8Array(decompressBuffer(row.file_data)), {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(row.file_name ?? "submission")}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
