import {
	describe, it, expect, vi,
} from 'vitest';
import {render, fireEvent} from '@testing-library/react';
import {HighlightedBody, computeHighlightSpans} from '@/components/file-viewer';

vi.mock('@/components/sidebar-context', () => ({
	useSidebar: () => ({viewFile: vi.fn()}),
	fileContentSchema: {
		safeParse: () => ({success: false}),
	},
}));

vi.mock('swr', () => ({
	default: () => ({data: undefined, error: undefined, isLoading: false}),
}));

function noop() {
	// Intentionally empty
}

describe('computeHighlightSpans', () => {
	it('finds a single match', () => {
		const spans = computeHighlightSpans(
			'the quick brown lorem ipsum jumps',
			[{quotedText: 'lorem ipsum', noteFileId: 1}],
		);
		expect(spans).toEqual([{start: 16, end: 27, noteFileId: 1}]);
	});

	it('matches case-insensitively', () => {
		const spans = computeHighlightSpans(
			'Hello WORLD',
			[{quotedText: 'world', noteFileId: 2}],
		);
		expect(spans).toHaveLength(1);
		expect(spans[0].noteFileId).toBe(2);
	});

	it('finds multiple non-overlapping matches of the same needle', () => {
		const spans = computeHighlightSpans(
			'foo bar foo baz foo',
			[{quotedText: 'foo', noteFileId: 1}],
		);
		expect(spans).toHaveLength(3);
	});

	it('drops highlights that overlap an earlier span (first-win)', () => {
		const spans = computeHighlightSpans(
			'abcdefghij',
			[
				{quotedText: 'abcdef', noteFileId: 1},
				{quotedText: 'cdefgh', noteFileId: 2},
			],
		);
		expect(spans).toHaveLength(1);
		expect(spans[0].noteFileId).toBe(1);
	});

	it('skips a highlight whose text is not in the body', () => {
		const spans = computeHighlightSpans(
			'hello world',
			[{quotedText: 'unfindable', noteFileId: 1}],
		);
		expect(spans).toEqual([]);
	});

	it('returns empty when highlights list is empty', () => {
		const spans = computeHighlightSpans('anything', []);
		expect(spans).toEqual([]);
	});
});

describe('HighlightedBody', () => {
	it('renders plain text when no highlights', () => {
		const {container} = render(<HighlightedBody
			content='the quick brown fox'
			highlights={[]}
			onHighlightClick={noop}
		/>);
		expect(container.textContent).toBe('the quick brown fox');
		expect(container.querySelector('mark')).toBeNull();
	});

	it('wraps a matched span in <mark>', () => {
		const {container} = render(<HighlightedBody
			content='the quick brown lorem ipsum jumps'
			highlights={[{quotedText: 'lorem ipsum', noteFileId: 42}]}
			onHighlightClick={noop}
		/>);
		const marks = container.querySelectorAll('mark');
		expect(marks).toHaveLength(1);
		expect(marks[0].textContent).toBe('lorem ipsum');
	});

	it('renders multiple non-overlapping matches', () => {
		const {container} = render(<HighlightedBody
			content='alpha beta gamma'
			highlights={[
				{quotedText: 'alpha', noteFileId: 1},
				{quotedText: 'gamma', noteFileId: 2},
			]}
			onHighlightClick={noop}
		/>);
		expect(container.querySelectorAll('mark')).toHaveLength(2);
	});

	it('calls onHighlightClick with the correct noteFileId when clicked', () => {
		const handler = vi.fn<(id: number) => void>();
		const {container} = render(<HighlightedBody
			content='click the target here'
			highlights={[{quotedText: 'target', noteFileId: 99}]}
			onHighlightClick={handler}
		/>);
		const mark = container.querySelector('mark');
		expect(mark).not.toBeNull();
		fireEvent.click(mark!);
		expect(handler).toHaveBeenCalledWith(99);
	});

	it('silently skips a highlight whose text is not found', () => {
		const {container} = render(<HighlightedBody
			content='present text only'
			highlights={[{quotedText: 'absent', noteFileId: 1}]}
			onHighlightClick={noop}
		/>);
		expect(container.textContent).toBe('present text only');
		expect(container.querySelector('mark')).toBeNull();
	});
});
