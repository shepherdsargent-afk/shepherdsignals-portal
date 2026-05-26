/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse uses canvas optionally — tell webpack to ignore it
      config.resolve.fallback = { ...config.resolve.fallback, canvas: false }
    }
    return config
  },
}
module.exports = nextConfig
