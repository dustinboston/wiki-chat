import { auth } from "@/app/(auth)/auth";
import { createFile, deleteFileById, insertChunks } from "@/app/db";
import { getPdfContentFromUrl } from "@/utils/pdf";
import { openai } from "@ai-sdk/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { del, put } from "@vercel/blob";
import { embedMany } from "ai";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const titleParam = searchParams.get("title");

  const session = await auth();

  if (!session) {
    return Response.redirect("/login");
  }

  const { user } = session;

  if (!user || !user.email) {
    return Response.redirect("/login");
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  const contentType = request.headers.get("content-type") || "";
  let content: string;

  if (contentType.includes("application/pdf")) {
    const { downloadUrl, url } = await put(
      `${user.email}/${filename}`,
      request.body,
      {
        access: "public",
      },
    );
    content = await getPdfContentFromUrl(downloadUrl);
    await del(url);
  } else {
    content = await request.text();
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
  });
  const chunkedContent = await textSplitter.createDocuments([content]);

  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunkedContent.map((chunk) => chunk.pageContent),
  });

  const fileRecord = await createFile({
    pathname: filename!,
    title: titleParam || null,
    userEmail: user.email,
  });

  await insertChunks({
    chunks: chunkedContent.map((chunk, i) => ({
      id: `${fileRecord.id}/${i}`,
      fileId: fileRecord.id,
      content: chunk.pageContent,
      embedding: embeddings[i],
    })),
  });

  return Response.json({ id: fileRecord.id });
}
