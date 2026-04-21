import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetFileById, mockGetSourcesByFileId, mockGetDerivedFilesByFileId } = vi.hoisted(() => ({
	mockGetFileById: vi.fn(),
	mockGetSourcesByFileId: vi.fn(),
	mockGetDerivedFilesByFileId: vi.fn(),
}));

vi.mock('@/app/db', () => ({
	createFile: vi.fn(),
	insertChunks: vi.fn(),
	insertFileSources: vi.fn(),
	getChunksByFileIds: vi.fn(),
	getFilesByUser: vi.fn(),
	getFileById: mockGetFileById,
	deleteFileById: vi.fn(),
	insertAuditLog: vi.fn(),
	getSourcesByFileId: mockGetSourcesByFileId,
	getDerivedFilesByFileId: mockGetDerivedFilesByFileId,
	getTopChunksForFileIds: vi.fn(),
}));

const { getFileSources } = await import('@/services/file');

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getFileSources', () => {
	it('returns null when file does not belong to user', async () => {
		mockGetFileById.mockResolvedValue({
			id: 1,
			userEmail: 'other@x.com',
			pathname: 'f',
			title: null,
			sourceType: 'upload',
			createdAt: new Date(),
		});
		const result = await getFileSources({ id: 1, userEmail: 'me@x.com' });
		expect(result).toBeNull();
	});

	it('aggregates multiple derived rows for the same file into one entry with highlights array', async () => {
		mockGetFileById.mockResolvedValue({
			id: 1,
			userEmail: 'me@x.com',
			pathname: 'article',
			title: 'Article',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		mockGetSourcesByFileId.mockResolvedValue([]);
		mockGetDerivedFilesByFileId.mockResolvedValue([
			{
				derivedFileId: 10,
				derivedFileTitle: 'Note A',
				derivedFilePathname: 'note-a.md',
				derivedFileSourceType: 'manual',
				sourceChunkId: '1/0',
				quotedText: 'first quote',
			},
			{
				derivedFileId: 10,
				derivedFileTitle: 'Note A',
				derivedFilePathname: 'note-a.md',
				derivedFileSourceType: 'manual',
				sourceChunkId: '1/2',
				quotedText: 'second quote',
			},
			{
				derivedFileId: 11,
				derivedFileTitle: 'Note B',
				derivedFilePathname: 'note-b.md',
				derivedFileSourceType: 'manual',
				sourceChunkId: '1/1',
				quotedText: null,
			},
		]);

		const result = await getFileSources({ id: 1, userEmail: 'me@x.com' });

		expect(result).not.toBeNull();
		expect(result!.derived).toHaveLength(2);

		const noteA = result!.derived.find((d) => d.fileId === 10)!;
		expect(noteA.highlights).toHaveLength(2);
		expect(noteA.highlights[0].quotedText).toBe('first quote');
		expect(noteA.highlights[1].quotedText).toBe('second quote');
		expect(noteA.sourceType).toBe('manual');

		const noteB = result!.derived.find((d) => d.fileId === 11)!;
		expect(noteB.highlights).toHaveLength(1);
		expect(noteB.highlights[0].quotedText).toBeNull();
	});
});
