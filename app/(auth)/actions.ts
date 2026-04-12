'use server';

import {createUser, getUser} from '../db';
import {signIn, signOut} from './auth';

export async function logout(): Promise<void> {
	await signOut();
}

export type LoginActionState = {
	status: 'idle' | 'in_progress' | 'success' | 'failed';
};

export const login = async (
	data: LoginActionState,
	formData: FormData,
): Promise<LoginActionState> => {
	try {
		const email = formData.get('email');
		const password = formData.get('password');

		if (typeof email !== 'string' || typeof password !== 'string') {
			return {status: 'failed'};
		}

		await signIn('credentials', {
			email,
			password,
			redirect: false,
		});

		return {status: 'success'};
	} catch {
		return {status: 'failed'};
	}
};

export type RegisterActionState = {
	status: 'idle' | 'in_progress' | 'success' | 'failed' | 'user_exists';
};

export const register = async (
	data: RegisterActionState,
	formData: FormData,
): Promise<RegisterActionState> => {
	const email = formData.get('email');
	const password = formData.get('password');

	if (typeof email !== 'string' || typeof password !== 'string') {
		return {status: 'failed'};
	}

	const existingUser = await getUser(email);

	if (existingUser.length > 0) {
		return {status: 'user_exists'};
	}

	await createUser(email, password);
	await signIn('credentials', {
		email,
		password,
		redirect: false,
	});
	return {status: 'success'};
};
