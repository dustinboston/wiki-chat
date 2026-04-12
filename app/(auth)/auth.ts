import nextAuth from 'next-auth';
import credentials from 'next-auth/providers/credentials';
import {compare} from 'bcrypt-ts';
import {authConfig} from './auth.config';
import {getUser} from '@/app/db';

export const {
	handlers: {GET, POST},
	auth,
	signIn,
	signOut,
} = nextAuth({
	...authConfig,
	providers: [
		credentials({
			credentials: {
				email: {label: 'Email', type: 'email'},
				password: {label: 'Password', type: 'password'},
			},
			async authorize(credentialValues) {
				if (
					typeof credentialValues.email !== 'string'
					|| typeof credentialValues.password !== 'string'
				) {
					return null;
				}

				const users = await getUser(credentialValues.email);
				if (users.length === 0) {
					return null;
				}

				const foundUser = users[0];
				if (!foundUser.password) {
					return null;
				}

				const passwordsMatch = await compare(
					credentialValues.password,
					foundUser.password,
				);
				if (passwordsMatch) {
					return {id: foundUser.email, email: foundUser.email};
				}

				return null;
			},
		}),
	],
});
