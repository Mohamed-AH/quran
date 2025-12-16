# PWA Icons for Hafiz App

## Required Icons

The manifest.json references two icon sizes:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

## Design Specifications

### Icon Design
- **Background**: Forest green (#0a3a2a)
- **Accent**: Gold (#d4af37)
- **Symbol**: Book/Quran icon (📖) or Arabic calligraphy for "حافظ"
- **Style**: Flat design with rounded corners
- **Safe area**: Keep important elements within 80% of icon size

### Icon Sizes
1. **192x192**: Used for app shortcuts and home screen
2. **512x512**: Used for splash screens and high-res displays

## Generating Icons

### Option 1: Using an online tool
1. Go to https://realfavicongenerator.net/ or similar
2. Upload a square image (512x512 recommended)
3. Generate PWA icons
4. Download and place in `/assets/`

### Option 2: Using design software
1. Create 512x512 canvas
2. Background: #0a3a2a (forest green)
3. Add centered icon/text in #d4af37 (gold)
4. Export as PNG
5. Resize to 192x192 for smaller version

### Option 3: Using Figma/Canva template
Use the provided design specifications to create icons with consistent branding.

## Placeholder Icons

For development, you can use the emoji favicon currently in use:
```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📖%3C/text%3E%3C/svg%3E">
```

Convert this to PNG at required sizes using any SVG to PNG converter.

## Installation

Once icons are generated:
1. Place `icon-192.png` in `/assets/`
2. Place `icon-512.png` in `/assets/`
3. Verify paths in `manifest.json`
4. Test PWA installation on mobile device
