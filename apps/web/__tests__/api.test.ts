describe('apiUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: originalNodeEnv });
    if (originalApiBaseUrl === undefined) Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_API_BASE_URL');
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    jest.resetModules();
  });

  it('uses the configured API origin and removes trailing slashes', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' });
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test/';
    jest.resetModules();
    const { apiUrl } = require('../lib/api');

    expect(apiUrl('/api/v1/auth/me')).toBe('https://api.example.test/api/v1/auth/me');
  });

  it('fails explicitly instead of targeting localhost when production API config is absent', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' });
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_API_BASE_URL');
    jest.resetModules();
    const { apiBaseUrl } = require('../lib/api');

    expect(() => apiBaseUrl(true)).toThrow('NEXT_PUBLIC_API_BASE_URL must be configured for production.');
  });
});
