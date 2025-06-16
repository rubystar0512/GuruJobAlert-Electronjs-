const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const cron = require('node-cron');
const axios = require('axios');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let jobScrapingInterval;
let previousJobs = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (jobScrapingInterval) {
      jobScrapingInterval.destroy();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Function to show system notification
function showSystemNotification(title, body, newJobs) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'icon.png'),
      sound: true,
      urgency: 'normal',
      timeoutType: 'default'
    });

    notification.on('click', () => {
      // Focus the main window when notification is clicked
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
      }
    });

    notification.show();

    // Auto-close notification after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  }
}

// IPC handlers
ipcMain.handle('save-token', async (event, token) => {
  store.set('bearerToken', token);
  return { success: true };
});

ipcMain.handle('get-token', async () => {
  return store.get('bearerToken', '');
});

ipcMain.handle('start-job-scraping', async (event, token) => {
  if (jobScrapingInterval) {
    jobScrapingInterval.destroy();
  }

  // Reset previous jobs when starting scraping
  previousJobs = [];

  // Start cron job every 5 seconds
  jobScrapingInterval = cron.schedule('*/5 * * * * *', async () => {
    try {
      const response = await fetchGuruJobs(token);
      if (response && response.data && response.data.Data && response.data.Data.Results) {
        // Filter for programming jobs only
        const programmingJobs = response.data.Data.Results.filter(job => 
          job.CategoryName === 'Programming & Development'
        );
        
        // Check for new jobs
        const previousJobIds = previousJobs.map(job => job.ProjectID);
        const newJobs = programmingJobs.filter(job => !previousJobIds.includes(job.ProjectID));
        
        if (newJobs.length > 0 && previousJobs.length > 0) {
          // Show system notification for new jobs
          const jobTitles = newJobs.slice(0, 3).map(job => `• ${job.Title}`).join('\n');
          const moreText = newJobs.length > 3 ? `\n...and ${newJobs.length - 3} more jobs` : '';
          
          showSystemNotification(
            `🎉 ${newJobs.length} New Programming Job${newJobs.length > 1 ? 's' : ''} Found!`,
            `${jobTitles}${moreText}`,
            newJobs
          );

          // Send detailed notification data to renderer
          mainWindow.webContents.send('new-jobs-notification', {
            count: newJobs.length,
            jobs: newJobs,
            titles: newJobs.map(job => job.Title)
          });
        }
        
        // Update previous jobs for next comparison
        previousJobs = [...programmingJobs];
        
        // Send jobs to renderer process
        mainWindow.webContents.send('jobs-updated', programmingJobs);
      }
    } catch (error) {
      console.error('Job scraping error:', error);
      mainWindow.webContents.send('scraping-error', error.message);
    }
  });

  return { success: true };
});

ipcMain.handle('stop-job-scraping', async () => {
  if (jobScrapingInterval) {
    jobScrapingInterval.destroy();
    jobScrapingInterval = null;
  }
  // Clear previous jobs when stopping
  previousJobs = [];
  return { success: true };
});

ipcMain.handle('fetch-jobs-manual', async (event, token) => {
  try {
    const response = await fetchGuruJobs(token);
    if (response && response.data && response.data.Data && response.data.Data.Results) {
      const programmingJobs = response.data.Data.Results.filter(job => 
        job.CategoryName === 'Programming & Development'
      );
      
      // Update previous jobs for comparison
      previousJobs = [...programmingJobs];
      
      return { success: true, jobs: programmingJobs };
    }
    return { success: false, error: 'No data received' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle notification preferences
ipcMain.handle('get-notification-settings', async () => {
  return {
    systemNotifications: store.get('systemNotifications', true),
    soundEnabled: store.get('soundEnabled', true),
    showJobTitles: store.get('showJobTitles', true)
  };
});

ipcMain.handle('save-notification-settings', async (event, settings) => {
  store.set('systemNotifications', settings.systemNotifications);
  store.set('soundEnabled', settings.soundEnabled);
  store.set('showJobTitles', settings.showJobTitles);
  return { success: true };
});

async function fetchGuruJobs(token) {
  const config = {
    method: 'get',
    url: 'https://www.guru.com/api/search/job',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    params: {
      'Category.Id': 1, // Programming & Development category
      'SortOrder': 'recent',
      'Page': 1
    }
  };

  return await axios(config);
} 