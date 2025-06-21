// OneSignal configuration for different environments
export const getOneSignalConfig = () => {
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('webcontainer') ||
                       window.location.hostname.includes('local-credentialless');
  
  if (isDevelopment) {
    // For development, we'll use a mock configuration or disable OneSignal
    return {
      appId: "development-mode", // This will prevent OneSignal from initializing
      safariWebId: "development-mode",
      allowLocalhostAsSecureOrigin: true,
      disabled: true
    };
  }
  
  // Production configuration
  return {
    appId: "679d7ff4-7abc-4969-a967-adc4b1639c1f",
    safariWebId: "web.onesignal.auto.679d7ff4-7abc-4969-a967-adc4b1639c1f",
    allowLocalhostAsSecureOrigin: false,
    disabled: false
  };
};