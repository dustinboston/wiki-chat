import {auth} from '@/app/(auth)/auth';
import {getFileById, getSourcesByFileId, getDerivedFilesByFileId} from '@/app/db';

export async function GET(request: Request) {
	const {searchParams} = new URL(request.url);

	const session = await auth();

	if (!session) {
		return Response.redirect('/login');
	}

	const {user} = session;

	if (!user?.email) {
		return Response.redirect('/login');
	}

	const idParameter = searchParams.get('id');

	if (idParameter === null) {
		return new Response('File ID not provided', {status: 400});
	}

	const id = Number.parseInt(idParameter, 10);
	if (Number.isNaN(id)) {
		return new Response('Invalid file ID', {status: 400});
	}

	const file = await getFileById({id});
	if (file?.userEmail !== user.email) {
		return new Response('File not found', {status: 404});
	}

	// Aggregate sources by file (max similarity per source file)
	const rawSources = await getSourcesByFileId({fileId: id});
	const sourceMap = new Map<number, {
		fileId: number;
		title: string | null;
		pathname: string;
		similarity: number;
	}>();

	for (const row of rawSources) {
		const existing = sourceMap.get(row.sourceFileId);
		if (!existing || row.similarity > existing.similarity) {
			sourceMap.set(row.sourceFileId, {
				fileId: row.sourceFileId,
				title: row.sourceFileTitle,
				pathname: row.sourceFilePathname,
				similarity: row.similarity,
			});
		}
	}

	const sources = [...sourceMap.values()]
		.toSorted((a, b) => b.similarity - a.similarity);

	// Get files that were derived from this file
	const derived = await getDerivedFilesByFileId({fileId: id});

	return Response.json({
		sourceType: file.sourceType,
		sources,
		derived: derived.map(d => ({
			fileId: d.derivedFileId,
			title: d.derivedFileTitle,
			pathname: d.derivedFilePathname,
		})),
	});
}
