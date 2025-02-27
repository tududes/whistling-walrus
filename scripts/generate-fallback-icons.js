import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define all icon sizes needed for PWA
const iconSizes = [
    // Apple touch icons
    { size: 152, name: 'apple-touch-icon-152x152' },
    { size: 167, name: 'apple-touch-icon-167x167' },
    { size: 180, name: 'apple-touch-icon-180x180' },
    { size: 192, name: 'apple-touch-icon' }, // Default size

    // Standard PWA icons
    { size: 72, name: 'icon-72x72' },
    { size: 96, name: 'icon-96x96' },
    { size: 128, name: 'icon-128x128' },
    { size: 144, name: 'icon-144x144' },
    { size: 152, name: 'icon-152x152' },
    { size: 192, name: 'icon-192x192' },
    { size: 384, name: 'icon-384x384' },
    { size: 512, name: 'icon-512x512' }
];

// Background color
const BG_COLOR = '#0F172A'; // Dark blue background
const CIRCLE_COLOR = '#7CFBFF'; // Teal circle

// Make sure the icons directory exists
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Function to create a PNG icon with the walrus character
async function createPNGIcon(size, outputPath) {
    // Create a canvas with the specified size
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Fill background with dark blue
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);

    // Draw a circle with the walrus teal color
    const circleRadius = size * 0.4; // Circle takes up 80% of the icon
    ctx.fillStyle = CIRCLE_COLOR;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    try {
        // Try to load the walrus SVG as an image
        // Since we can't directly load SVG with canvas in Node.js, we'll use a PNG version if available
        const walrusImagePath = path.join(__dirname, '..', 'public', 'walrus-fallback.png');

        if (fs.existsSync(walrusImagePath)) {
            const walrusImage = await loadImage(walrusImagePath);

            // Calculate size to maintain aspect ratio
            const walrusSize = size * 0.6; // Walrus takes up 60% of the icon
            const walrusX = (size - walrusSize) / 2;
            const walrusY = (size - walrusSize) / 2;

            // Draw the walrus image
            ctx.drawImage(walrusImage, walrusX, walrusY, walrusSize, walrusSize);
        } else {
            // If no walrus image is available, draw "WW" text as a fallback
            const fontSize = size / 3;
            ctx.fillStyle = '#000';
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('WW', size / 2, size / 2);

            console.warn(`Warning: Walrus image not found at ${walrusImagePath}. Using text fallback.`);
        }
    } catch (err) {
        console.error('Error loading walrus image:', err);

        // Fallback to text
        const fontSize = size / 3;
        ctx.fillStyle = '#000';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WW', size / 2, size / 2);
    }

    // Save the canvas as a PNG file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated ${path.basename(outputPath)} (${size}x${size})`);
}

// Generate a simple PNG version of the walrus for use in the fallback icons
async function createWalrusFallbackImage() {
    const size = 512; // Large size for better quality when scaling down
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw a walrus silhouette
    ctx.fillStyle = '#000';

    // Head
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size / 3, size / 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sunglasses
    ctx.fillStyle = '#000';
    ctx.fillRect(size / 3, size / 2.5, size / 3, size / 10);

    // Tusks
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.ellipse(size / 2.5, size / 1.6, size / 20, size / 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(size / 1.7, size / 1.6, size / 20, size / 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Save the walrus image
    const outputPath = path.join(__dirname, '..', 'public', 'walrus-fallback.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated walrus fallback image at ${outputPath}`);

    return outputPath;
}

// Main function to generate all icons
async function generateAllIcons() {
    try {
        // First create the walrus fallback image
        await createWalrusFallbackImage();

        // Then generate all the icons
        for (const icon of iconSizes) {
            const outputPath = path.join(iconsDir, `${icon.name}.png`);
            await createPNGIcon(icon.size, outputPath);
        }

        console.log('All fallback icons generated successfully!');
        return true;
    } catch (error) {
        console.error('Error generating fallback icons:', error);
        return false;
    }
}

// Run the icon generation
generateAllIcons().then(success => {
    if (!success) {
        process.exit(1);
    }
}); 