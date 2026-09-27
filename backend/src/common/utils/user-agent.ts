export interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
}

/** Small, dependency-free user-agent classifier for the "active sessions" list. */
export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ua
              ? 'Browser'
              : 'Unknown';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown OS';
  const device = /iPad|Tablet/.test(ua)
    ? 'Tablet'
    : /Mobile|iPhone|Android/.test(ua)
      ? 'Mobile'
      : 'Desktop';
  return { device, browser, os };
}
