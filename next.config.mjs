/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      // Achievement evidence is uploaded through a Server Action, and the
      // default body limit is 1 MB — below the 5 MB the storage bucket
      // itself accepts. Left slightly above 5 MB to cover multipart overhead,
      // so the bucket's limit stays the one that actually rejects a file.
      bodySizeLimit: "6mb",
    },
  },

  webpack: (config, { dev }) => {
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        agentation: false,
      };
    }
    return config;
  },
};

export default nextConfig;
