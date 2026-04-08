import { auth } from "@/app/(auth)/auth";
import { getChunksByFileIds, getFileById } from "@/app/db";

const WORD_LIMIT = 5000;

export async function GET(request: Request) {
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

  const chunks = await getChunksByFileIds({ fileIds: [id] });

  let fullContent = chunks.map((c) => c.content).join("\n\n");

  const words = fullContent.split(/\s+/);
  const truncated = words.length > WORD_LIMIT;
  if (truncated) {
    fullContent = words.slice(0, WORD_LIMIT).join(" ");
  }

  return Response.json({ content: fullContent, truncated });
}
