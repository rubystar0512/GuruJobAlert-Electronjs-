const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const axios = require('axios');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let jobScrapingInterval;
let tokenReminderInterval;
let previousJobs = [];
let tokenExpiredNotified = false;
let lastTokenExpiredTime = null;

// Get the correct icon path for both dev and production
function getIconPath() {
  if (isDev) {
    return path.join(__dirname, 'icon.png');
  } else {
    // In production, the icon is in the same directory as electron.js (build folder)
    return path.join(__dirname, 'icon.png');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: getIconPath(),
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, 'index.html')}`
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (jobScrapingInterval) {
      clearInterval(jobScrapingInterval);
      jobScrapingInterval = null;
    }
    if (tokenReminderInterval) {
      clearInterval(tokenReminderInterval);
      tokenReminderInterval = null;
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

// Function to check if error is token-related
function isTokenExpiredError(error) {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.message || '';
    
    return (
      status === 401 || 
      status === 403 || 
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('invalid token') ||
      message.toLowerCase().includes('token expired') ||
      message.toLowerCase().includes('authentication failed')
    );
  }
  return false;
}

// Function to show enhanced system notification for token issues
function showTokenExpiredNotification() {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: '🚨 Guru Job Alert - Token Expired!',
      body: 'Your Bearer token has expired. Click here to update it and resume job monitoring.',
      icon: getIconPath(),
      sound: true,
      urgency: 'critical',
      timeoutType: 'never', // Keep notification until clicked
      actions: [
        {
          type: 'button',
          text: 'Update Token Now'
        },
        {
          type: 'button', 
          text: 'Remind Me Later'
        }
      ]
    });

    notification.on('click', () => {
      // Focus the main window and show token update modal
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
        mainWindow.webContents.send('show-token-update-modal');
      }
      notification.close();
    });

    notification.on('action', (event, index) => {
      if (index === 0) { // Update Token Now
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
          mainWindow.show();
          mainWindow.webContents.send('show-token-update-modal');
        }
      } else if (index === 1) { // Remind Me Later
        // Set up reminder in 30 minutes
        startTokenReminderInterval(30 * 60 * 1000); // 30 minutes
      }
      notification.close();
    });

    notification.show();
  }
}

// Function to show token update success notification
function showTokenUpdateSuccessNotification() {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: '✅ Token Updated Successfully!',
      body: 'Your Bearer token has been updated and validated. Job monitoring will resume automatically.',
      icon: getIconPath(),
      sound: true,
      urgency: 'normal',
      timeoutType: 'default'
    });

    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
      }
    });

    notification.show();

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }
}

// Function to start token reminder interval
function startTokenReminderInterval(delay = 15 * 60 * 1000) { // Default 15 minutes
  if (tokenReminderInterval) {
    clearInterval(tokenReminderInterval);
    tokenReminderInterval = null;
  }

  setTimeout(() => {
    // Set up reminder every 15 minutes
    tokenReminderInterval = setInterval(() => {
      if (tokenExpiredNotified && lastTokenExpiredTime) {
        const timeSinceExpired = Date.now() - lastTokenExpiredTime;
        const hoursExpired = Math.floor(timeSinceExpired / (1000 * 60 * 60));
        
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: '⏰ Token Still Expired',
            body: `Your token has been expired for ${hoursExpired > 0 ? hoursExpired + ' hours' : 'some time'}. Update it to continue monitoring jobs.`,
            icon: getIconPath(),
            sound: true,
            urgency: 'normal'
          });

          notification.on('click', () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) {
                mainWindow.restore();
              }
              mainWindow.focus();
              mainWindow.show();
              mainWindow.webContents.send('show-token-update-modal');
            }
          });

          notification.show();

          setTimeout(() => {
            notification.close();
          }, 8000);
        }
      }
    }, 15 * 60 * 1000); // Every 15 minutes
  }, delay);
}

// Function to handle token expiration
function handleTokenExpiration(error) {
  console.log('Token expired or invalid:', error.message);
  
  // Stop scraping
  if (jobScrapingInterval) {
    clearInterval(jobScrapingInterval);
    jobScrapingInterval = null;
  }

  // Reset state
  previousJobs = [];
  
  // Show system notification if not already notified
  if (!tokenExpiredNotified) {
    lastTokenExpiredTime = Date.now();
    showTokenExpiredNotification();
    tokenExpiredNotified = true;
    
    // Start reminder interval after 15 minutes
    startTokenReminderInterval();
  }

  // Send token expiration event to renderer
  mainWindow.webContents.send('token-expired', {
    error: error.message,
    statusCode: error.response?.status || 0,
    timestamp: lastTokenExpiredTime
  });
}

// Function to show system notification
function showSystemNotification(title, body, newJobs) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: getIconPath(),
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
  // Reset token expiration flag when new token is saved
  tokenExpiredNotified = false;
  lastTokenExpiredTime = null;
  
  // Stop reminder interval
  if (tokenReminderInterval) {
    clearInterval(tokenReminderInterval);
    tokenReminderInterval = null;
  }
  
  // Show success notification
  showTokenUpdateSuccessNotification();
  
  return { success: true };
});

ipcMain.handle('get-token', async () => {
  return store.get('bearerToken', '');
});

ipcMain.handle('validate-token', async (event, token) => {
  try {
    const response = await fetchGuruJobs(token);
    if (response && response.data) {
      tokenExpiredNotified = false; // Reset flag on successful validation
      lastTokenExpiredTime = null;
      
      // Stop reminder interval on successful validation
      if (tokenReminderInterval) {
        clearInterval(tokenReminderInterval);
        tokenReminderInterval = null;
      }
      
      return { success: true, valid: true };
    }
    return { success: true, valid: false };
  } catch (error) {
    if (isTokenExpiredError(error)) {
      return { 
        success: true, 
        valid: false, 
        expired: true,
        error: error.message,
        statusCode: error.response?.status || 0
      };
    }
    return { 
      success: false, 
      valid: false, 
      error: error.message 
    };
  }
});

ipcMain.handle('dismiss-token-reminders', async () => {
  if (tokenReminderInterval) {
    clearInterval(tokenReminderInterval);
    tokenReminderInterval = null;
  }
  return { success: true };
});

ipcMain.handle('start-job-scraping', async (event, token) => {
  // Stop existing scraping interval if it exists
  if (jobScrapingInterval) {
    clearInterval(jobScrapingInterval);
    jobScrapingInterval = null;
  }

  // Reset previous jobs when starting scraping
  previousJobs = [];
  tokenExpiredNotified = false;
  lastTokenExpiredTime = null;

  // Stop any reminder intervals
  if (tokenReminderInterval) {
    clearInterval(tokenReminderInterval);
    tokenReminderInterval = null;
  }

  // Validate token before starting scraping
  try {
    await fetchGuruJobs(token);
  } catch (error) {
    if (isTokenExpiredError(error)) {
      handleTokenExpiration(error);
      return { success: false, error: 'Token expired or invalid' };
    }
    throw error;
  }

  // Start interval job every 5 seconds
  try {
    jobScrapingInterval = setInterval(async () => {
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
          
          // Reset token expired flag on successful fetch
          tokenExpiredNotified = false;
          lastTokenExpiredTime = null;
        }
      } catch (error) {
        console.error('Job scraping error:', error);
        
        if (isTokenExpiredError(error)) {
          handleTokenExpiration(error);
        } else {
          mainWindow.webContents.send('scraping-error', error.message);
        }
      }
    }, 5000); // Every 5 seconds

    return { success: true };
  } catch (error) {
    console.error('Error starting job scraping:', error);
    return { success: false, error: 'Failed to start job scraping' };
  }
});

ipcMain.handle('stop-job-scraping', async () => {
  if (jobScrapingInterval) {
    clearInterval(jobScrapingInterval);
    jobScrapingInterval = null;
  }
  // Clear previous jobs when stopping
  previousJobs = [];
  tokenExpiredNotified = false;
  lastTokenExpiredTime = null;
  
  // Stop reminder interval
  if (tokenReminderInterval) {
    clearInterval(tokenReminderInterval);
    tokenReminderInterval = null;
  }
  
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
      
      // Reset token expired flag on successful fetch
      tokenExpiredNotified = false;
      lastTokenExpiredTime = null;
      
      // Stop reminder interval on successful fetch
      if (tokenReminderInterval) {
        clearInterval(tokenReminderInterval);
        tokenReminderInterval = null;
      }
      
      return { success: true, jobs: programmingJobs };
    }
    return { success: false, error: 'No data received' };
  } catch (error) {
    if (isTokenExpiredError(error)) {
      handleTokenExpiration(error);
      return { 
        success: false, 
        error: 'Token expired or invalid',
        tokenExpired: true,
        statusCode: error.response?.status || 0
      };
    }
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