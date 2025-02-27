// This file should only contain Cloudflare-specific configuration
// Let's create a proper Cloudflare Pages configuration

export default {
  // Cloudflare Pages configuration
  build: {
    command: "npm run build",
    directory: "dist",
    environment: {
      NODE_VERSION: "16"
    }
  },
  // Optional: Add any Cloudflare-specific settings here
  routes: [
    // Serve PWA assets with caching allowed
    {
      pattern: "/icons/*",
      script: null,
      headers: {
        "Cache-Control": "public, max-age=86400" // Cache for 1 day
      }
    },
    {
      pattern: "/manifest.json",
      script: null,
      headers: {
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      }
    },
    // Disable caching for all other resources
    {
      pattern: "/*",
      script: null,
      serve: "/index.html",
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
      }
    }
  ]
};