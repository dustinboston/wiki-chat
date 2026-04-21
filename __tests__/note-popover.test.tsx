import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
	render, screen, fireEvent,
} from '@testing-library/react';
import {NotePopover} from '@/components/note-popover';

const {mockUseSWR} = vi.hoisted(() => ({
	mockUseSWR: vi.fn(),
}));

vi.mock('swr', () => ({
	default: mockUseSWR,
}));

function noop() {
	// Intentionally empty
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUseSWR.mockReturnValue({
		data: {
			content: 'The note body', truncated: false, title: 'My note', pathname: 'note.md',
		},
		error: undefined,
		isLoading: false,
	});
});

describe('NotePopover', () => {
	it('renders nothing when noteFileId is null', () => {
		const {container} = render(<NotePopover noteFileId={null} onClose={noop} />);
		expect(container.textContent).toBe('');
	});

	it('renders title and body when noteFileId is set', () => {
		render(<NotePopover noteFileId={42} onClose={noop} />);
		expect(screen.getByText('My note')).toBeTruthy();
		expect(screen.getByText('The note body')).toBeTruthy();
	});

	it('calls onClose when Close button is clicked', () => {
		const onClose = vi.fn<() => void>();
		render(<NotePopover noteFileId={42} onClose={onClose} />);
		fireEvent.click(screen.getByRole('button', {name: /close/iv}));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when Escape is pressed', () => {
		const onClose = vi.fn<() => void>();
		render(<NotePopover noteFileId={42} onClose={onClose} />);
		fireEvent.keyDown(document.body, {key: 'Escape'});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('falls back to pathname when title is missing', () => {
		mockUseSWR.mockReturnValue({
			data: {
				content: 'body', truncated: false, title: null, pathname: 'note.md',
			},
			error: undefined,
			isLoading: false,
		});
		render(<NotePopover noteFileId={7} onClose={noop} />);
		expect(screen.getByText('note.md')).toBeTruthy();
	});
});
