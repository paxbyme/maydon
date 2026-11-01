export function validateEnvironment(env: NodeJS.ProcessEnv): number {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Application is not production-ready; production startup is disabled',
    );
  }
  const value = env.PORT ?? '3000';
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer');
  const port = Number(value);
  if (port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535');
  return port;
}
