
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Fix for "Server Disconnected" / Cross Origin Error */
  /* Moved to top-level in Next.js 15+ */
  allowedDevOrigins: ["*"],

  /* Your existing config options */
  typescript: {
    ignoreBuildErrors: false,
  },
  
  /* Note: 'eslint' option removed - now configured via ESLint CLI */
  
  images: {
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
