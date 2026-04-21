'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Form } from '@/components/form';
import { SubmitButton } from '@/components/submit-button';
import { type LoginActionState, login } from '../actions';

export default function Page() {
	const router = useRouter();
	const searchParameters = useSearchParams();

	const [state, formAction] = useActionState<LoginActionState, FormData>(login, {
		status: 'idle',
	});

	useEffect(() => {
		if (state.status === 'failed') {
			toast.error('Invalid credentials!');
		} else if (state.status === 'success') {
			router.refresh();
			const callbackUrl = searchParameters.get('callbackUrl') ?? '/';
			router.push(callbackUrl);
		}
	}, [state.status, router, searchParameters]);

	return (
		<div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-zinc-900">
			<div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
				<div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
					<h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
					<p className="text-gray-500 text-sm dark:text-zinc-400">
						Use your email and password to sign in
					</p>
				</div>
				<Form action={formAction}>
					<SubmitButton>Sign in</SubmitButton>
					<p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
						{"Don't have an account? "}
						<Link
							href="/register"
							className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
						>
							Sign up
						</Link>
						{' for free.'}
					</p>
				</Form>
			</div>
		</div>
	);
}
