/**
 * Configuration for the API endpoints.
 * This class automatically detects if the application is running locally
 * or in production and switches the base URL accordingly.
 */
export const API_CONFIG = {
  localUrl: 'http://localhost:8080',
  productionUrl: 'https://rentsmart-core.onrender.com', // Change this in production

  get baseUrl(): string {
    const override = typeof window !== 'undefined' ? localStorage.getItem('API_BASE_URL') : null;
    if (override) {
      return override;
    }

    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
      return isLocal ? this.localUrl : this.productionUrl;
    }

    return this.productionUrl;
  }
};
