import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Input,
  Button,
  List,
  Typography,
  Space,
  Badge,
  Tag,
  Divider,
  Row,
  Col,
  Statistic,
  Switch,
  notification,
  Avatar,
  Tooltip,
  Alert,
  Modal,
  Checkbox,
  Drawer,
  Result
} from 'antd';
import {
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  GlobalOutlined,
  CodeOutlined,
  BellOutlined,
  SettingOutlined,
  SoundOutlined,
  NotificationOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import './App.css';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { ipcRenderer } = window.require('electron');

function App() {
  const [bearerToken, setBearerToken] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scrapingActive, setScrapingActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [totalJobs, setTotalJobs] = useState(0);
  const [newJobsCount, setNewJobsCount] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState({
    systemNotifications: true,
    soundEnabled: true,
    showJobTitles: true
  });
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [recentNewJobs, setRecentNewJobs] = useState([]);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [tokenExpiredModalVisible, setTokenExpiredModalVisible] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState({ valid: null, message: '' });

  useEffect(() => {
    // Load saved token and settings on startup
    loadSavedToken();
    loadNotificationSettings();
    
    // Listen for job updates
    ipcRenderer.on('jobs-updated', (event, updatedJobs) => {
      setJobs(updatedJobs);
      setTotalJobs(updatedJobs.length);
      setLastUpdated(moment());
      // Reset token expired state when jobs are successfully updated
      setTokenExpired(false);
      setTokenStatus({ valid: true, message: 'Token is working correctly' });
    });

    // Listen for new job notifications with enhanced details
    ipcRenderer.on('new-jobs-notification', (event, data) => {
      setNewJobsCount(prev => prev + data.count);
      setRecentNewJobs(prev => [...data.jobs.slice(0, 5), ...prev.slice(0, 10)]);
      
      // Show enhanced in-app notification
      notification.success({
        message: `🎉 ${data.count} New Programming Job${data.count > 1 ? 's' : ''} Found!`,
        description: (
          <div>
            {data.titles.slice(0, 2).map((title, index) => (
              <div key={index} style={{ fontSize: '12px', marginBottom: '2px' }}>
                • {title.length > 50 ? title.substring(0, 50) + '...' : title}
              </div>
            ))}
            {data.count > 2 && (
              <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#666' }}>
                ...and {data.count - 2} more jobs
              </div>
            )}
          </div>
        ),
        icon: <BellOutlined style={{ color: '#52c41a' }} />,
        duration: 8,
        placement: 'topRight',
        onClick: () => {
          // Scroll to top of job list
          document.querySelector('.ant-layout-content')?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      // Play notification sound if enabled
      if (notificationSettings.soundEnabled) {
        playNotificationSound();
      }
    });

    // Listen for token expiration events
    ipcRenderer.on('token-expired', (event, data) => {
      setTokenExpired(true);
      setScrapingActive(false);
      setTokenStatus({ 
        valid: false, 
        message: `Token expired (Status: ${data.statusCode})` 
      });
      
      // Show token expiration modal
      setTokenExpiredModalVisible(true);
      
      // Show urgent in-app notification with enhanced details
      notification.error({
        message: '🚨 Token Expired!',
        description: (
          <div>
            <div>Your Bearer token has expired and job monitoring has stopped.</div>
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              Status Code: {data.statusCode} | Time: {moment(data.timestamp).format('HH:mm:ss')}
            </div>
          </div>
        ),
        duration: 0, // Don't auto-dismiss
        icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
        key: 'token-expired',
        btn: (
          <Button 
            type="primary" 
            size="small" 
            danger
            onClick={() => {
              notification.destroy('token-expired');
              setTokenExpiredModalVisible(true);
            }}
          >
            Update Token Now
          </Button>
        )
      });
    });

    // Listen for system notification trigger to show token update modal
    ipcRenderer.on('show-token-update-modal', () => {
      setTokenExpiredModalVisible(true);
      // Also show a subtle in-app notification
      notification.info({
        message: 'Token Update Required',
        description: 'Please update your Bearer token to continue monitoring jobs.',
        icon: <WarningOutlined style={{ color: '#faad14' }} />,
        duration: 4
      });
    });

    ipcRenderer.on('scraping-error', (event, error) => {
      notification.error({
        message: 'Scraping Error',
        description: error,
        duration: 6
      });
    });

    return () => {
      ipcRenderer.removeAllListeners('jobs-updated');
      ipcRenderer.removeAllListeners('new-jobs-notification');
      ipcRenderer.removeAllListeners('token-expired');
      ipcRenderer.removeAllListeners('show-token-update-modal');
      ipcRenderer.removeAllListeners('scraping-error');
    };
  }, [notificationSettings.soundEnabled]);

  const loadSavedToken = async () => {
    try {
      const token = await ipcRenderer.invoke('get-token');
      setBearerToken(token);
      
      // Validate token if it exists
      if (token) {
        validateToken(token);
      }
    } catch (error) {
      console.error('Error loading token:', error);
    }
  };

  const validateToken = async (token) => {
    if (!token) return;
    
    setTokenValidating(true);
    try {
      const result = await ipcRenderer.invoke('validate-token', token);
      
      if (result.success) {
        if (result.valid) {
          setTokenStatus({ valid: true, message: 'Token is valid and working' });
          setTokenExpired(false);
        } else {
          setTokenStatus({ 
            valid: false, 
            message: result.expired ? 'Token has expired' : 'Token is invalid' 
          });
          setTokenExpired(true);
        }
      } else {
        setTokenStatus({ valid: false, message: result.error });
        setTokenExpired(true);
      }
    } catch (error) {
      setTokenStatus({ valid: false, message: 'Failed to validate token' });
    } finally {
      setTokenValidating(false);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings = await ipcRenderer.invoke('get-notification-settings');
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async (newSettings) => {
    try {
      await ipcRenderer.invoke('save-notification-settings', newSettings);
      setNotificationSettings(newSettings);
      notification.success({
        message: 'Settings Saved',
        description: 'Notification preferences updated successfully',
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to save notification settings',
      });
    }
  };

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const saveToken = async () => {
    try {
      await ipcRenderer.invoke('save-token', bearerToken);
      
      // Enhanced success notification with more details
      notification.success({
        message: '✅ Bearer Token Updated!',
        description: (
          <div>
            <div>Token has been saved and validated successfully.</div>
            <div style={{ marginTop: 8, fontSize: '12px', color: '#52c41a' }}>
              Job monitoring will resume automatically if auto-scraping was enabled.
            </div>
          </div>
        ),
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        duration: 6,
        placement: 'topRight'
      });
      
      // Validate the new token
      validateToken(bearerToken);
      
      // Close token expired modal if open
      setTokenExpiredModalVisible(false);
      
      // Dismiss the persistent token expired notification
      notification.destroy('token-expired');
      
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to save token',
        duration: 5
      });
    }
  };

  const dismissTokenReminders = async () => {
    try {
      await ipcRenderer.invoke('dismiss-token-reminders');
      notification.info({
        message: 'Reminders Dismissed',
        description: 'Token expiration reminders have been turned off.',
        duration: 3
      });
    } catch (error) {
      console.error('Error dismissing reminders:', error);
    }
  };

  const fetchJobsManually = async () => {
    if (!bearerToken) {
      notification.warning({
        message: 'Token Required',
        description: 'Please enter your Bearer token first',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('fetch-jobs-manual', bearerToken);
      if (result.success) {
        setJobs(result.jobs);
        setTotalJobs(result.jobs.length);
        setLastUpdated(moment());
        setTokenExpired(false);
        setTokenStatus({ valid: true, message: 'Token is working correctly' });
        notification.success({
          message: 'Jobs Fetched',
          description: `Found ${result.jobs.length} programming jobs`,
        });
      } else {
        if (result.tokenExpired) {
          setTokenExpired(true);
          setTokenStatus({ valid: false, message: 'Token has expired' });
          setTokenExpiredModalVisible(true);
        }
        notification.error({
          message: 'Fetch Failed',
          description: result.error,
        });
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to fetch jobs',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleScraping = async () => {
    if (!bearerToken) {
      notification.warning({
        message: 'Token Required',
        description: 'Please enter your Bearer token first',
      });
      return;
    }

    if (tokenExpired) {
      notification.warning({
        message: 'Token Expired',
        description: 'Please update your Bearer token before starting auto-scraping',
      });
      setTokenExpiredModalVisible(true);
      return;
    }

    try {
      if (scrapingActive) {
        await ipcRenderer.invoke('stop-job-scraping');
        setScrapingActive(false);
        notification.info({
          message: 'Scraping Stopped',
          description: 'Job scraping has been stopped',
        });
      } else {
        const result = await ipcRenderer.invoke('start-job-scraping', bearerToken);
        if (result.success) {
          setScrapingActive(true);
          setNewJobsCount(0); // Reset new jobs count
          setRecentNewJobs([]); // Clear recent new jobs
          setTokenExpired(false);
          notification.success({
            message: 'Scraping Started',
            description: 'Job scraping is now active (every 5 seconds)',
          });
        } else {
          if (result.error === 'Token expired or invalid') {
            setTokenExpired(true);
            setTokenExpiredModalVisible(true);
          }
          notification.error({
            message: 'Failed to Start Scraping',
            description: result.error,
          });
        }
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to toggle scraping',
      });
    }
  };

  const clearNewJobsCount = () => {
    setNewJobsCount(0);
    setRecentNewJobs([]);
  };

  const formatBudget = (budget) => {
    if (!budget) return 'Not specified';
    return budget;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return moment(parseInt(timestamp)).fromNow();
  };

  const getSkillTags = (skills) => {
    if (!skills || skills.length === 0) return null;
    return skills.slice(0, 5).map((skill, index) => (
      <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
        {skill}
      </Tag>
    ));
  };

  const getTokenStatusColor = () => {
    if (tokenStatus.valid === null) return 'default';
    return tokenStatus.valid ? 'success' : 'error';
  };

  const getTokenStatusIcon = () => {
    if (tokenValidating) return <ReloadOutlined spin />;
    if (tokenStatus.valid === null) return <UserOutlined />;
    return tokenStatus.valid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <CodeOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }} />
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            Guru Job Alert
          </Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
            style={{ color: 'rgba(255, 255, 255, 0.65)' }}
          />
          {tokenExpired && (
            <Badge dot color="red">
              <WarningOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
            </Badge>
          )}
          {scrapingActive && !tokenExpired && (
            <Badge dot color="green">
              <BellOutlined style={{ fontSize: 20, color: 'white' }} />
            </Badge>
          )}
          {lastUpdated && (
            <Text style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
              Last updated: {lastUpdated.format('HH:mm:ss')}
            </Text>
          )}
        </div>
      </Header>

      <Layout>
        <Sider width={400} style={{ background: '#fff', padding: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card title="API Configuration" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.Password
                  placeholder="Enter Bearer Token"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  prefix={getTokenStatusIcon()}
                  status={getTokenStatusColor()}
                />
                {tokenStatus.message && (
                  <Alert
                    message={tokenStatus.message}
                    type={tokenStatus.valid ? 'success' : 'error'}
                    showIcon
                    size="small"
                    style={{ 
                      fontSize: '12px',
                      animation: tokenStatus.valid === false ? 'pulse 2s infinite' : 'none'
                    }}
                    action={
                      tokenStatus.valid === false && (
                        <Button 
                          size="small" 
                          type="link" 
                          onClick={() => setTokenExpiredModalVisible(true)}
                          style={{ padding: 0 }}
                        >
                          Fix Now
                        </Button>
                      )
                    }
                  />
                )}
                <Space style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    onClick={saveToken}
                    style={{ flex: 1 }}
                  >
                    Save Token
                  </Button>
                  <Button 
                    onClick={() => validateToken(bearerToken)}
                    loading={tokenValidating}
                    disabled={!bearerToken}
                  >
                    Validate
                  </Button>
                </Space>
              </Space>
            </Card>

            {tokenExpired && (
              <Alert
                message="Token Expired"
                description="Your Bearer token has expired. Please update it to continue monitoring jobs."
                type="error"
                showIcon
                icon={<WarningOutlined />}
                action={
                  <Button 
                    size="small" 
                    type="primary" 
                    danger
                    onClick={() => setTokenExpiredModalVisible(true)}
                  >
                    Update Token
                  </Button>
                }
              />
            )}

            <Card title="Controls" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchJobsManually}
                  loading={loading}
                  style={{ width: '100%' }}
                  disabled={tokenExpired}
                >
                  Fetch Jobs Now
                </Button>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text>Auto Scraping (5s)</Text>
                  <Switch
                    checked={scrapingActive}
                    onChange={toggleScraping}
                    checkedChildren={<PlayCircleOutlined />}
                    unCheckedChildren={<PauseCircleOutlined />}
                    disabled={tokenExpired}
                  />
                </div>
              </Space>
            </Card>

            <Card title="Statistics" size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Total Jobs"
                    value={totalJobs}
                    prefix={<CodeOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="New Jobs"
                    value={newJobsCount}
                    prefix={<BellOutlined />}
                    valueStyle={{ color: '#cf1322' }}
                    suffix={
                      newJobsCount > 0 && (
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={clearNewJobsCount}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          Clear
                        </Button>
                      )
                    }
                  />
                </Col>
              </Row>
            </Card>

            {recentNewJobs.length > 0 && (
              <Card title="Recent New Jobs" size="small">
                <div style={{ maxHeight: 150, overflow: 'auto' }}>
                  {recentNewJobs.slice(0, 5).map((job, index) => (
                    <div key={job.ProjectID} style={{ marginBottom: 8, fontSize: '12px' }}>
                      <Text strong style={{ color: '#1890ff' }}>
                        {job.Title.length > 40 ? job.Title.substring(0, 40) + '...' : job.Title}
                      </Text>
                      <br />
                      <Text type="secondary">{formatDate(job.DatePosted)}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {scrapingActive && !tokenExpired && (
              <Alert
                message="Auto-scraping is active"
                description="The app will check for new jobs every 5 seconds and send notifications"
                type="success"
                showIcon
                icon={<PlayCircleOutlined />}
              />
            )}
          </Space>
        </Sider>

        <Content style={{ padding: 24, background: '#f0f2f5' }}>
          <div style={{ marginBottom: 16 }}>
            <Title level={2}>Programming Jobs ({jobs.length})</Title>
            <Text type="secondary">Latest programming and development opportunities from Guru</Text>
          </div>

          <List
            dataSource={jobs}
            renderItem={(job) => (
              <List.Item style={{ marginBottom: 16 }}>
                <Card
                  hoverable
                  style={{ width: '100%' }}
                  bodyStyle={{ padding: '20px' }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <Title level={4} style={{ marginBottom: 8, color: '#1890ff' }}>
                      {job.Title}
                    </Title>
                    <Space wrap>
                      <Tag color="green">{job.CategoryName}</Tag>
                      <Tag color="gold">{formatBudget(job.BudgetAmountShortDescription)}</Tag>
                      <Tag color="blue">{job.EmployerCountryName}</Tag>
                    </Space>
                  </div>

                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                    style={{ marginBottom: 16 }}
                  >
                    {job.Description}
                  </Paragraph>

                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Skills: </Text>
                    <div style={{ marginTop: 8 }}>
                      {getSkillTags(job.Skills)}
                    </div>
                  </div>

                  <Divider style={{ margin: '16px 0' }} />

                  <Row gutter={16} align="middle">
                    <Col flex="auto">
                      <Space>
                        <Tooltip title="Posted">
                          <Space>
                            <CalendarOutlined />
                            <Text type="secondary">{formatDate(job.DatePosted)}</Text>
                          </Space>
                        </Tooltip>
                        <Tooltip title="Employer">
                          <Space>
                            <UserOutlined />
                            <Text type="secondary">{job.DisplayName}</Text>
                          </Space>
                        </Tooltip>
                        <Tooltip title="Applied">
                          <Badge count={job.TotalApplied} color="blue" />
                        </Tooltip>
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => window.open(`https://www.guru.com/d/${job.SeoUrl}`, '_blank')}
                      >
                        View Job
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </List.Item>
            )}
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <CodeOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                  <Title level={4} type="secondary">No jobs found</Title>
                  <Text type="secondary">
                    {tokenExpired 
                      ? 'Please update your Bearer token to fetch jobs'
                      : 'Enter your Bearer token and click "Fetch Jobs Now" to get started'
                    }
                  </Text>
                </div>
              )
            }}
          />
        </Content>
      </Layout>

      {/* Token Expired Modal */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>Bearer Token Expired</span>
          </Space>
        }
        open={tokenExpiredModalVisible}
        onCancel={() => setTokenExpiredModalVisible(false)}
        footer={[
          <Button key="dismiss" onClick={dismissTokenReminders}>
            Dismiss Reminders
          </Button>,
          <Button key="cancel" onClick={() => setTokenExpiredModalVisible(false)}>
            Later
          </Button>,
          <Button key="save" type="primary" onClick={saveToken}>
            Save & Validate New Token
          </Button>
        ]}
        width={600}
        maskClosable={false}
      >
        <Result
          status="warning"
          title="Your Bearer token has expired"
          subTitle="To continue monitoring jobs, please update your Bearer token below."
        />
        
        <div style={{ marginTop: 24 }}>
          <Text strong>Enter New Bearer Token:</Text>
          <Input.Password
            placeholder="Enter your new Bearer token"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            style={{ marginTop: 8 }}
            size="large"
          />
          
          {tokenStatus.message && (
            <Alert
              message={tokenStatus.message}
              type={tokenStatus.valid ? 'success' : 'error'}
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </div>
        
        <div style={{ marginTop: 24 }}>
          <Title level={5}>How to get a new Bearer token:</Title>
          <ol style={{ paddingLeft: 20 }}>
            <li>Log in to your Guru.com account</li>
            <li>Open Developer Tools (F12)</li>
            <li>Go to the Network tab</li>
            <li>Make a search request on Guru.com</li>
            <li>Find the API request and copy the Bearer token from the Authorization header</li>
          </ol>
        </div>
      </Modal>

      {/* Settings Drawer */}
      <Drawer
        title="Notification Settings"
        placement="right"
        onClose={() => setSettingsVisible(false)}
        open={settingsVisible}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="Notification Preferences" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <NotificationOutlined />
                  <Text>System Notifications</Text>
                </Space>
                <Switch
                  checked={notificationSettings.systemNotifications}
                  onChange={(checked) => saveNotificationSettings({
                    ...notificationSettings,
                    systemNotifications: checked
                  })}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <SoundOutlined />
                  <Text>Sound Alerts</Text>
                </Space>
                <Switch
                  checked={notificationSettings.soundEnabled}
                  onChange={(checked) => saveNotificationSettings({
                    ...notificationSettings,
                    soundEnabled: checked
                  })}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <BellOutlined />
                  <Text>Show Job Titles</Text>
                </Space>
                <Switch
                  checked={notificationSettings.showJobTitles}
                  onChange={(checked) => saveNotificationSettings({
                    ...notificationSettings,
                    showJobTitles: checked
                  })}
                />
              </div>
            </Space>
          </Card>

          <Card title="Test Notification" size="small">
            <Button
              type="primary"
              block
              onClick={() => {
                notification.success({
                  message: '🎉 Test Notification',
                  description: 'This is how new job notifications will appear!',
                  icon: <BellOutlined style={{ color: '#52c41a' }} />,
                });
                if (notificationSettings.soundEnabled) {
                  playNotificationSound();
                }
              }}
            >
              Test Notification
            </Button>
          </Card>

          <Alert
            message="Notification Info"
            description="System notifications will appear even when the app is minimized. You can click on them to bring the app to focus."
            type="info"
            showIcon
          />
        </Space>
      </Drawer>
    </Layout>
  );
}

export default App; 