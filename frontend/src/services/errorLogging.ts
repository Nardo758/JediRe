export function logErrorToBackend(errorData: {
  component: string;
  error: string;
  stack?: string;
  dealId?: string;
  context?: string;
  [key: string]: any;
}) {
  console.error(`[${errorData.component}]`, errorData.error, errorData);
}
