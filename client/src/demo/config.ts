/**
 * Demo Mode Configuration
 * 
 * Set DEMO_MODE to true to use mock/demo data throughout the application.
 * Set to false for production mode where all data comes from backend APIs.
 * 
 * This can also be controlled via environment variable VITE_DEMO_MODE
 */

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || false;

/**
 * Helper function to get data based on demo mode
 * @param demoData - The demo/mock data to use when DEMO_MODE is true
 * @param productionData - The production data (usually from API) to use when DEMO_MODE is false
 */
export function getDemoOrProduction<T>(demoData: T, productionData: T): T {
  return DEMO_MODE ? demoData : productionData;
}

/**
 * Helper function to conditionally return demo data or undefined
 * Useful for optional demo data that should be empty in production
 */
export function getDemoDataOrEmpty<T>(demoData: T): T | undefined {
  return DEMO_MODE ? demoData : undefined;
}

/**
 * Helper function to merge demo data with production data
 * Demo data is prepended to production data when in demo mode
 */
export function mergeDemoData<T>(demoData: T[], productionData: T[]): T[] {
  return DEMO_MODE ? [...demoData, ...productionData] : productionData;
}
