# Fancy Webcam

An Electron-based application for creating desktop webcam overlays with customizable shapes and titles, designed for streamers, presenters, and video conferencing.

## Features

- Live webcam with real-time filters
- Custom window shapes (circle, square, rounded rectangle)
- Pinnable overlay window that stays on top of other applications
- Draggable webcam overlay that can be positioned anywhere on screen
- Custom title display with configurable text (name, role, website)
- Style customization (text color, background color, opacity)
- Zoom feature to magnify selected screen areas

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm

### Installation

```bash
# Clone the repository
git clone https://your-repository-url/fancy-webcam.git
cd fancy-webcam

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm start
```

### Building

```bash
# Build for production
npm run build
```

## Usage

1. Start the application and click "Start Camera" to initialize your webcam
2. Use the window shape options to select your preferred style (circle, square, rounded)
3. Enter your custom title information (name, role, website)
4. Customize text and background colors as needed
5. Click "Pin to Desktop" to create a separate, always-on-top webcam overlay
6. Drag the pinned window to position it anywhere on your screen
7. Click "Unpin from Desktop" in the main window to close the overlay
8. You can minimize the main control window while keeping the overlay visible

## Project Structure

```
fancy-webcam/
├── src/                  # Application source code
│   ├── main.js           # Main process
│   └── preload.js        # Preload script
├── public/               # Static assets
│   ├── index.html        # Main UI
│   ├── pinned.html       # Pinned webcam overlay
│   ├── zoom.html         # Zoom window UI
│   ├── styles.css        # Application styles
│   └── renderer.js       # Renderer process code
└── package.json          # Project configuration
```

## License

ISC
