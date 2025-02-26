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
    { pattern: "/*", script: null, serve: "/index.html" }
  ]
};