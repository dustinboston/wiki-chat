export class AppError extends Error {
	info = '';
	status = 0;
}

function assertJsonType<T>(value: unknown): asserts value is T {
	// Generic T cannot be validated at runtime; callers provide type safety
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
	const response = await fetch(url);

	if (!response.ok) {
		const error = new AppError('An error occurred while fetching the data.');

		error.info = await response.text();
		error.status = response.status;

		throw error;
	}

	const json: unknown = await response.json();
	assertJsonType<T>(json);
	return json;
}
