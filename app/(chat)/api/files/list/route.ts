import { auth } from "@/app/(auth)/auth";
import { getFilesByUser } from "@/app/db";

export async function GET() {
  const session = await auth();

  if (!session) {
    return Response.redirect("/login");
  }

  const { user } = session;

  if (!user || !user.email) {
    return Response.redirect("/login");
  }

  const files = await getFilesByUser({ email: user.email });

  return Response.json(
    files.map((f) => ({
      id: f.id,
      pathname: f.pathname,
      title: f.title,
    })),
  );
}
