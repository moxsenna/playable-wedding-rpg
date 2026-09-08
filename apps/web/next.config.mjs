/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    distDir: 'dist',
    transpilePackages: ['@wedding-rpg/game', '@wedding-rpg/contracts', '@wedding-rpg/wedding-core']
};

export default nextConfig;
