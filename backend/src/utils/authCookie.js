export const AUTH_COOKIE_NAME = 'vconf_token';

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === 'production';

export const authCookieOptions = {
  httpOnly: true,
  // TODO: Switch back to sameSite: 'none' and secure: true (or isProduction) when running over HTTPS
  sameSite: 'lax', 
  secure: false, // TEMPORARY: Allow cookies over plain HTTP. 
  maxAge: ONE_WEEK_IN_MS,
  path: '/',
};

export const clearAuthCookieOptions = {
  httpOnly: true,
  // TODO: Switch back to sameSite: 'none' and secure: true (or isProduction) when running over HTTPS
  sameSite: 'lax',
  secure: false, // TEMPORARY: Allow cookies over plain HTTP.
  path: '/',
};

export const parseCookies = (cookieHeader = '') => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
};

export const getTokenFromCookieHeader = (cookieHeader) => {
  const cookies = parseCookies(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] || null;
};

export const getTokenFromRequest = (req) => {
  const cookieToken = getTokenFromCookieHeader(req.headers.cookie);
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};
