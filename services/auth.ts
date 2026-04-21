import { genSaltSync, hashSync } from 'bcrypt-ts';
import { createUser as dbCreateUser } from '@/app/db';

export async function hashPassword(password: string): Promise<string> {
	const salt = genSaltSync(10);
	return hashSync(password, salt);
}

export async function createUser(email: string, password: string) {
	const hash = await hashPassword(password);
	return dbCreateUser(email, hash);
}

export { getUser } from '@/app/db';
