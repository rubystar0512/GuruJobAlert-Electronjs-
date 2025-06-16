# Build Instructions for Guru Job Alert

## 🚀 Building the Application

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run electron-dev
```

### Production Build
```bash
# Build the application
npm run electron-pack
```

This will:
1. Build the React app (`npm run build`)
2. Copy electron files to build directory (`npm run copy-electron`)
3. Package the application with electron-builder

### Output
- **Installer**: `dist/Guru Job Alert Setup 1.0.0.exe`
- **Unpacked**: `dist/win-unpacked/`

### Build Process Details

1. **React Build**: Creates optimized production build in `build/` directory
2. **File Copy**: Copies `electron.js` and `icon.png` from `public/` to `build/`
3. **Electron Builder**: Packages everything into a Windows installer

### Troubleshooting

If you encounter file loading errors:
- Ensure all files are copied to the build directory
- Check that paths in electron.js are correct for production
- Verify the main entry point in package.json points to `build/electron.js`

### File Structure After Build
```
build/
├── electron.js          # Main electron process
├── icon.png            # Application icon
├── index.html          # React app entry point
├── static/             # React app assets
└── asset-manifest.json # Asset manifest
``` 