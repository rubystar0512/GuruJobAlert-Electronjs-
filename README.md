# Guru Job Alert - Desktop Application

A beautiful desktop application built with React.js, Electron, and Ant Design for scraping and monitoring programming jobs from Guru.com.

## Features

- 🔍 **Real-time Job Scraping**: Automatically fetches programming jobs every 5 seconds
- 🎯 **Programming Jobs Only**: Filters and displays only programming & development jobs
- 🔑 **Token Management**: Secure Bearer token storage and management
- 🎨 **Beautiful UI**: Modern, responsive design with Ant Design components
- 📱 **Desktop Notifications**: Real-time alerts for new job postings
- 📊 **Statistics Dashboard**: Track total jobs and new job notifications
- 🌐 **Direct Links**: One-click access to job details on Guru.com

## Screenshots

The application features a clean, modern interface with:
- Left sidebar for controls and statistics
- Main content area for job listings
- Real-time status indicators
- Responsive design for various screen sizes

## Tech Stack

- **Frontend**: React.js 18.x
- **Desktop Framework**: Electron 27.x
- **UI Library**: Ant Design 5.x
- **API Client**: Axios
- **Task Scheduling**: Node-cron
- **Date Handling**: Moment.js
- **State Persistence**: Electron Store

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm or yarn package manager

### Setup

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run electron-dev
   ```

4. **Build for production**:
   ```bash
   npm run electron-pack
   ```

## Usage

### Getting Started

1. **Launch the application**
2. **Enter your Guru.com Bearer Token** in the API Configuration section
3. **Save the token** for future use
4. **Click "Fetch Jobs Now"** to manually fetch jobs or enable auto-scraping

### Bearer Token Setup

To get your Bearer Token from Guru.com:

1. Log in to your Guru.com account
2. Open Developer Tools (F12)
3. Go to Network tab
4. Make a search request on Guru.com
5. Find the API request and copy the Bearer token from the Authorization header

### Auto-Scraping

- Toggle the **Auto Scraping** switch to enable/disable automatic job fetching
- The application will check for new jobs every 5 seconds when enabled
- New jobs will trigger desktop notifications

### Job Management

- **View Job Details**: Click "View Job" to open the job posting in your browser
- **Job Statistics**: Monitor total jobs and new job counts in the sidebar
- **Real-time Updates**: Jobs are automatically updated in the background

## Application Structure

```
guru-job-alert/
├── public/
│   ├── electron.js          # Main Electron process
│   └── index.html           # HTML template
├── src/
│   ├── App.js              # Main React component
│   ├── App.css             # Custom styles
│   ├── index.js            # React entry point
│   └── index.css           # Base styles
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## API Integration

The application integrates with Guru.com's job search API:

- **Endpoint**: `https://www.guru.com/api/search/job`
- **Method**: GET
- **Authentication**: Bearer token required
- **Filtering**: Automatically filters for "Programming & Development" category
- **Rate Limiting**: Respects API limits with 5-second intervals

## Development

### Available Scripts

- `npm start` - Start React development server
- `npm run electron` - Start Electron with built files
- `npm run electron-dev` - Start both React and Electron in development
- `npm run build` - Build React for production
- `npm run electron-pack` - Build desktop application

### Building for Distribution

To create distributable packages:

```bash
npm run electron-pack
```

This will create platform-specific builds in the `dist/` folder.

## Customization

### UI Theming

The application uses Ant Design's theming system. You can customize:

- Colors and gradients in `src/App.css`
- Component styles and animations
- Layout and spacing

### Job Filtering

Currently filters for "Programming & Development" jobs. You can modify the filter in:

- `public/electron.js` - Line with `job.CategoryName === 'Programming & Development'`

### Scraping Interval

The default 5-second interval can be changed in:

- `public/electron.js` - Cron schedule: `'*/5 * * * * *'`

## Troubleshooting

### Common Issues

1. **Token Authentication Errors**
   - Verify your Bearer token is valid
   - Check if the token has expired
   - Ensure proper API access permissions

2. **Network Errors**
   - Check internet connection
   - Verify Guru.com API availability
   - Review firewall/proxy settings

3. **Application Won't Start**
   - Ensure Node.js is properly installed
   - Clear node_modules and reinstall dependencies
   - Check for port conflicts (3000)

### Logs and Debugging

- Enable Developer Tools in the Electron window
- Check console for error messages
- Review network requests in Developer Tools

## Contributing

This is a self-contained project. To contribute:

1. Make your changes
2. Test thoroughly
3. Ensure all features work as expected
4. Update documentation if needed

## License

This project is for personal/educational use. Please respect Guru.com's terms of service and API usage guidelines.

## Support

For issues or questions:
- Check the troubleshooting section
- Review the code comments
- Test with a fresh installation

---

**Note**: This application is not affiliated with Guru.com. Please use responsibly and in accordance with Guru.com's terms of service. 