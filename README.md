# Whistling Walrus

A Progressive Web App (PWA) for recording audio and storing it on Walrus decentralized storage.

## Features

- Record audio from your microphone
- Play back recordings
- Save recordings to Walrus decentralized storage
- Share recordings via links
- View and manage your recording history
- Progressive Web App (PWA) support for mobile devices
- Offline functionality

## Project Setup

This project uses React and Tailwind CSS for the frontend, and Walrus for decentralized storage.

### Prerequisites

- Node.js (v16 or higher, v22 recommended)
- npm (v8 or higher, v10 recommended)

### Node.js Setup

For the best experience, we recommend using Node.js v22. You can install it using nvm (Node Version Manager):

```bash
# Download and install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Source nvm in your current shell
. "$HOME/.nvm/nvm.sh"

# Install Node.js v22
nvm install 22

# Use Node.js v22
nvm use 22

# Verify installation
node -v  # Should show v22.x.x
npm -v   # Should show v10.x.x
```

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Development

```bash
# Make sure you're using Node.js v22
nvm use 22

# Start the development server
npm run dev
```

Then open your browser to http://localhost:3000/

## Building for Production

```bash
# Make sure you're using Node.js v22
nvm use 22

# Build the application
npm run build
```

This will create a `dist` directory with the built application.

## PWA Support

This application is configured as a Progressive Web App (PWA), which means it can be installed on mobile devices and used offline. To fully enable PWA support:

1. Generate PWA icons (or create them manually):

```bash
npm run generate-pwa-icons
```

2. Make sure all the icons are placed in the `public/icons` directory
3. Build the application:

```bash
npm run build
```

### Installing on iOS (Safari)

1. Visit the deployed application in Safari
2. Tap the Share button (box with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Give the app a name (or keep the default) and tap "Add"
5. The app will now appear on your home screen as a full-size application

### Installing on Android (Chrome)

1. Visit the deployed application in Chrome
2. Tap the menu button (three dots)
3. Tap "Add to Home Screen"
4. Follow the prompts to add the app to your home screen

## Deployment to Cloudflare Pages

This project includes configuration for deployment to Cloudflare Pages.

### Prerequisites

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:

```bash
wrangler login
```

### Deployment Steps

1. Build the application:

```bash
npm run build
```

2. Deploy to Cloudflare Pages:

```bash
npm run deploy
```

Alternatively, you can deploy manually:

```bash
wrangler pages publish dist
```

### Updating the Cloudflare Instance

When you make changes to the code and want to update the deployed application, follow these steps:

1. Make and test your changes locally:

```bash
npm run dev
```

2. Once you're satisfied with the changes, build the updated application:

```bash
npm run build
```

3. Deploy the updated build to Cloudflare Pages:

```bash
npm run deploy
```

4. Verify your changes on the deployed site (typically available at `https://your-project-name.pages.dev`).

### Continuous Deployment Workflow

For a more efficient workflow when making frequent updates:

1. Set up a Git repository for your project if you haven't already.
2. Connect your Cloudflare Pages project to your Git repository:
   - Log in to the Cloudflare dashboard
   - Go to Pages > Your Project > Settings > Builds & deployments
   - Connect to your Git provider (GitHub, GitLab, etc.)
   - Select your repository

3. Configure automatic deployments:
   - Cloudflare will automatically build and deploy your application when you push changes to your repository
   - You can configure which branches trigger deployments (e.g., only deploy from the `main` branch)

4. With this setup, your workflow becomes:
   - Make changes locally and test with `npm run dev`
   - Commit your changes to your Git repository
   - Push to your configured branch
   - Cloudflare automatically builds and deploys your application

### Cloudflare Pages Configuration

The project includes a `cloudflare-config.js` file with the following settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: 16 (minimum)
- Routes: All routes are directed to `index.html` for SPA support

### Custom Domain Setup

1. Log in to the Cloudflare dashboard
2. Go to Pages > Your Project
3. Click on "Custom domains"
4. Add your custom domain and follow the instructions

## License

MIT