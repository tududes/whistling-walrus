import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is installed, if not, use fallback method
let useSharp = false;
try {
    // Dynamic import for sharp
    await import('sharp').then(module => {
        useSharp = true;
        console.log('Using sharp for SVG to PNG conversion');
    }).catch(err => {
        console.log('Sharp not found, using fallback method (copying existing PNG files)');
    });
} catch (e) {
    console.log('Sharp not found, using fallback method (copying existing PNG files)');
}

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

// Source SVG file with the walrus character
const SOURCE_SVG = path.join(__dirname, '..', 'public', 'walrus-icon.svg');

async function convertWithSharp() {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;

    // Make sure the icons directory exists
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Check if source SVG exists
    if (!fs.existsSync(SOURCE_SVG)) {
        console.error(`Source SVG file not found: ${SOURCE_SVG}`);
        return false;
    }

    for (const icon of iconSizes) {
        const pngPath = path.join(__dirname, '..', 'public', 'icons', `${icon.name}.png`);

        try {
            // Convert SVG to PNG with proper sizing
            await sharp(SOURCE_SVG)
                .resize(icon.size, icon.size, {
                    fit: 'contain',
                    background: { r: 15, g: 23, b: 42, alpha: 1 } // #0F172A background color
                })
                .png()
                .toFile(pngPath);

            console.log(`Generated ${icon.name}.png (${icon.size}x${icon.size})`);
        } catch (err) {
            console.error(`Error converting to ${icon.name}.png:`, err);
        }
    }

    return true;
}

function generateFallbackIcons() {
    console.log('Generating fallback icons using canvas...');

    try {
        // Execute the fallback script
        const fallbackScript = path.join(__dirname, 'generate-fallback-icons.js');
        if (fs.existsSync(fallbackScript)) {
            execSync(`node ${fallbackScript}`, { stdio: 'inherit' });
            return true;
        } else {
            console.error(`Fallback script not found: ${fallbackScript}`);
            return false;
        }
    } catch (err) {
        console.error('Error executing fallback script:', err);
        return false;
    }
}

async function main() {
    console.log('Generating PWA icons...');

    let success = false;

    if (useSharp) {
        success = await convertWithSharp();
    }

    if (!success) {
        console.log('Attempting fallback icon generation method...');
        success = generateFallbackIcons();
    }

    if (success) {
        console.log('✅ Icon generation completed successfully!');
    } else {
        console.error('❌ Icon generation failed. Please install sharp or check the error messages above.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Error in icon generation:', err);
    process.exit(1);
}); 