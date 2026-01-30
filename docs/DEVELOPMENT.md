# Development Guide

## Setup

```bash
# Install dependencies
npm install

# Run in watch mode
npm run watch

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
src/
├── background/        # Service worker & tracking logic
├── popup/             # Extension popup UI
├── options/           # Settings page
├── utils/             # Helper functions
└── assets/            # Icons and images
```

## Testing

Load the extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `src/` folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.
