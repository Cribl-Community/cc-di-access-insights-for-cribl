export {};

declare global {
  interface Window {
    /** Base URL for all Cribl API calls, e.g. "https://localhost:9000/api/v1". Set by the platform. */
    CRIBL_API_URL: string;
    /** The base path this app is mounted at, e.g. "/app-ui/my-app". Set by the platform. */
    CRIBL_BASE_PATH: string;
    /** Identity of the signed-in Cribl user. Set by the platform; absent outside Cribl. */
    getCriblUser?: () => Promise<{
      id: string;
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      initials?: string;
    }>;
  }
}
