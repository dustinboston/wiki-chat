import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteComposer } from '@/components/note-composer';

type UploadOptionsArg = {
	title?: string;
	sourceType?: string;
	parentFileId?: number;
	quotedText?: string;
};

type UploadFn = (
	name: string,
	content: string,
	options?: UploadOptionsArg,
) => Promise<number | null>;

const { mockUploadFile } = vi.hoisted(() => ({
	mockUploadFile: vi.fn<UploadFn>(),
}));

vi.mock('@/components/sidebar-context', () => ({
	useSidebar: () => ({ uploadFile: mockUploadFile }),
}));

function noop() {
	// Intentionally empty
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUploadFile.mockResolvedValue(1);
});

describe('NoteComposer', () => {
	it('disables Save when body is empty', () => {
		render(<NoteComposer onClose={noop} />);
		const save = screen.getByRole('button', { name: /save/iv });
		expect(save).toBeDisabled();
	});

	it('prefills body with blockquote when quotedText is provided', () => {
		render(<NoteComposer onClose={noop} quotedText="hello world" />);
		const textarea = screen.getByPlaceholderText(/write your note/iv);
		expect(textarea).toHaveValue('> hello world\n\n');
	});

	it('calls uploadFile with expected options on save', async () => {
		const onClose = vi.fn<() => void>();
		render(<NoteComposer parentFileId={7} parentLabel="Doc" quotedText="snip" onClose={onClose} />);
		const textarea = screen.getByPlaceholderText(/write your note/iv);
		fireEvent.change(textarea, { target: { value: '> snip\n\nmy thoughts' } });
		const save = screen.getByRole('button', { name: /save/iv });
		fireEvent.click(save);

		await waitFor(() => {
			expect(mockUploadFile).toHaveBeenCalledTimes(1);
		});
		const lastCall = mockUploadFile.mock.calls.at(-1);
		if (!lastCall) {
			throw new Error('uploadFile was not called');
		}

		const [filename, content, options] = lastCall;
		expect(filename).toMatch(/^note-\d+\.md$/v);
		expect(content).toBe('> snip\n\nmy thoughts');
		expect(options).toMatchObject({
			title: 'Note on Doc',
			sourceType: 'manual',
			parentFileId: 7,
			quotedText: 'snip',
		});
		expect(onClose).toHaveBeenCalled();
	});

	it('uses default title for standalone note', async () => {
		render(<NoteComposer onClose={noop} />);
		const textarea = screen.getByPlaceholderText(/write your note/iv);
		fireEvent.change(textarea, { target: { value: 'freestanding' } });
		fireEvent.click(screen.getByRole('button', { name: /save/iv }));

		await waitFor(() => {
			expect(mockUploadFile).toHaveBeenCalledTimes(1);
		});
		const lastCall = mockUploadFile.mock.calls.at(-1);
		if (!lastCall) {
			throw new Error('uploadFile was not called');
		}

		const options = lastCall[2];
		expect(options).toMatchObject({
			title: 'Note',
			sourceType: 'manual',
		});
		expect(options?.parentFileId).toBeUndefined();
		expect(options?.quotedText).toBeUndefined();
	});
});
