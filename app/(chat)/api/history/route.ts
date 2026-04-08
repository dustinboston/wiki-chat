import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, getChatsByUser } from "@/app/db";

export async function GET() {
  let session = await auth();

  if (!session || !session.user) {
    return Response.json("Unauthorized!", { status: 401 });
  }

  const chats = await getChatsByUser({ email: session.user.email! });
  return Response.json(chats);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const session = await auth();

  if (!session || !session.user) {
    return Response.json("Unauthorized!", { status: 401 });
  }

  const id = searchParams.get("id");

  if (!id) {
    return new Response("Chat ID not provided", { status: 400 });
  }

  const chat = await getChatById({ id });
  if (!chat || chat.author !== session.user.email) {
    return new Response("Chat not found", { status: 404 });
  }

  await deleteChatById({ id });

  return Response.json({});
}
