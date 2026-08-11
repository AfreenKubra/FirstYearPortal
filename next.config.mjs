/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config, { dev }) => {
    if (!dev) {
      /**
       * Resolve the Agentation dev toolbar to an empty module in production
       * builds.
       *
       * Neither a `process.env.NODE_ENV` guard nor a dynamic `import()` is
       * enough on its own: the guard runs at render time, long after the
       * client manifest is built, and webpack still emits a chunk for a
       * dynamic import it cannot prove unreachable. Both were measured
       * shipping ~430 KB of toolbar to every route.
       *
       * Aliasing at the resolver is the only step that actually removes it,
       * and it is verifiable — grep `.next/static` for "agentation" after a
       * production build and it should return nothing.
       */
      config.resolve.alias = {
        ...config.resolve.alias,
        agentation: false,
      };
    }
    return config;
  },
};

export default nextConfig;
