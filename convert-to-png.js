import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');

// Define icon sizes
const sizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

// Function to create a simple PNG icon
function createPNGIcon(size) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    // Create a canvas with the specified size
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Draw a circle with the walrus teal color
    ctx.fillStyle = '#7CFBFF';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw "WW" text in the center
    const fontSize = size / 3;
    ctx.fillStyle = '#000';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WW', size / 2, size / 2);

    // Save the canvas as a PNG file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated ${size}x${size} PNG icon`);
}

// Generate all PNG icons
async function generateAllPNGIcons() {
    for (const size of sizes) {
        createPNGIcon(size);
    }
    console.log('All PNG icons generated successfully!');
}

generateAllPNGIcons().catch(console.error); 