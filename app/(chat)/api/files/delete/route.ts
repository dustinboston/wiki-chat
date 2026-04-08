import { auth } from "@/app/(auth)/auth";
import { deleteFileById, getFileById } from "@/app/db";

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await auth();

  if (!session) {
    return Response.redirect("/login");
  }

  const { user } = session;

  if (!user || !user.email) {
    return Response.redirect("/login");
  }

  const idParam = searchParams.get("id");

  if (idParam === null) {
    return new Response("File ID not provided", { status: 400 });
  }

  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    return new Response("Invalid file ID", { status: 400 });
  }

  const file = await getFileById({ id });
  if (!file || file.userEmail !== user.email) {
    return new Response("File not found", { status: 404 });
  }

  await deleteFileById({ id });

  return Response.json({});
}
