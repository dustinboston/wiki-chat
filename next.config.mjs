/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	experimental: {},
	serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
