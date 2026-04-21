'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

const STORAGE_KEY = 'wiki-chat:recent-notes';
const UPDATE_EVENT = 'wiki-chat:recent-notes-updated';
const MAX_ENTRIES = 20;

export type RecentNote = {
	fileId: number;
	title: string;
};

const recentSchema = z.array(
	z.object({
		fileId: z.number().int().positive(),
		title: z.string(),
	}),
);

function readStorage(): RecentNote[] {
	if (typeof globalThis === 'undefined' || globalThis.localStorage === undefined) {
		return [];
	}

	const raw = globalThis.localStorage.getItem(STORAGE_KEY);
	if (raw === null) {
		return [];
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		const result = recentSchema.safeParse(parsed);
		return result.success ? result.data : [];
	} catch {
		return [];
	}
}

function writeStorage(entries: RecentNote[]) {
	if (typeof globalThis === 'undefined' || globalThis.localStorage === undefined) {
		return;
	}

	globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	globalThis.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function pushRecentNote(note: RecentNote) {
	const current = readStorage();
	const filtered = current.filter((n) => n.fileId !== note.fileId);
	const next = [note, ...filtered].slice(0, MAX_ENTRIES);
	writeStorage(next);
}

export function useRecentlyViewed() {
	const [entries, setEntries] = useState<RecentNote[]>([]);
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setEntries(readStorage());
		setIsHydrated(true);

		const handler = () => {
			setEntries(readStorage());
		};

		globalThis.addEventListener(UPDATE_EVENT, handler);
		globalThis.addEventListener('storage', handler);
		return () => {
			globalThis.removeEventListener(UPDATE_EVENT, handler);
			globalThis.removeEventListener('storage', handler);
		};
	}, []);

	const push = useCallback((note: RecentNote) => {
		pushRecentNote(note);
	}, []);

	return { entries, isHydrated, push };
}
