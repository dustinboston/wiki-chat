import nextAuth from 'next-auth';
import { authConfig } from '@/app/(auth)/auth.config';

const { auth } = nextAuth(authConfig);
export default auth;

export const config = {
	matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
};
