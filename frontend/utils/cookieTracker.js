// ============================================================
//  ClickSafe — cookieTracker.js
//  Cookie Tracker Detection Module
// ============================================================

const KNOWN_TRACKER_DOMAINS = [
  'doubleclick.net', 'google-analytics.com', 'googleadservices.com',
  'googlesyndication.com', 'googletagmanager.com', 'facebook.com',
  'facebook.net', 'fbcdn.net', 'adnxs.com', 'adsrvr.org',
  'amazon-adsystem.com', 'criteo.com', 'rubiconproject.com',
  'pubmatic.com', 'openx.net', 'mixpanel.com', 'segment.com',
  'quantserve.com', 'scorecardresearch.com', 'chartbeat.com',
  'hotjar.com', 'twitter.com', 'linkedin.com', 'pinterest.com',
  'reddit.com', 'snapchat.com', 'tiktok.com', 'addthis.com',
  'sharethis.com', 'outbrain.com', 'taboola.com'
];

function cleanDomain(domain) {
  return domain.replace(/^\./, '');
}

function isKnownTracker(cookieDomain) {
  const cleaned = cleanDomain(cookieDomain);
  for (let tracker of KNOWN_TRACKER_DOMAINS) {
    if (cleaned.includes(tracker)) return true;
  }
  return false;
}

function isThirdPartyCookie(cookieDomain, currentDomain) {
  const cleanedCookie = cleanDomain(cookieDomain);
  const cleanedCurrent = cleanDomain(currentDomain);
  // Strip subdomains to compare base domains
  const cookieBase = cleanedCookie.split('.').slice(-2).join('.');
  const currentBase = cleanedCurrent.split('.').slice(-2).join('.');
  return cookieBase !== currentBase;
}

function hasLongExpiration(expirationDate) {
  if (!expirationDate) return false;
  const now = Date.now() / 1000;
  const ninetyDaysInSeconds = 90 * 24 * 60 * 60;
  return (expirationDate - now) > ninetyDaysInSeconds;
}

function analyzeCookie(cookie, currentDomain) {
  const cookieDomain = cookie.domain;
  const result = {
    isTracker: false,
    reasons: [],
    cookie: {
      name: cookie.name,
      domain: cookieDomain,
      expirationDate: cookie.expirationDate
    }
  };

  if (isKnownTracker(cookieDomain)) {
    result.isTracker = true;
    result.reasons.push('Known tracking domain');
  }

  const isThirdParty = isThirdPartyCookie(cookieDomain, currentDomain);
  if (isThirdParty) result.reasons.push('Third-party cookie');

  const hasLongLife = hasLongExpiration(cookie.expirationDate);
  if (hasLongLife) result.reasons.push('Long expiration (>90 days)');

  if (isThirdParty && hasLongLife && !result.isTracker) {
    result.isTracker = true;
  }

  return result;
}

async function scanAllCookiesForUrl(currentUrl, tabId) {
  try {
    if (!currentUrl ||
        currentUrl.startsWith('chrome://') ||
        currentUrl.startsWith('chrome-extension://')) {
      return { error: 'Unsupported URL' };
    }

    const urlObj = new URL(currentUrl);
    const currentDomain = urlObj.hostname;

    // BUG FIX: Do NOT filter by url — that only returns first-party cookies.
    // We need ALL cookies so we can detect third-party trackers loaded by this page.
    // Then we count how many total were set for this domain vs third-party ones.
    const allCookies = await chrome.cookies.getAll({});

    // First-party cookies: belong to the current site
    const firstPartyCookies = allCookies.filter(c => {
      const base = cleanDomain(c.domain).split('.').slice(-2).join('.');
      const currentBase = currentDomain.split('.').slice(-2).join('.');
      return base === currentBase;
    });

    // All cookies visible to this page (first-party + known trackers)
    const pageCookies = allCookies.filter(c => {
      const base = cleanDomain(c.domain).split('.').slice(-2).join('.');
      const currentBase = currentDomain.split('.').slice(-2).join('.');
      return base === currentBase || isKnownTracker(c.domain);
    });

    const trackingCookies = [];
    const allCookieDetails = [];

    for (let cookie of pageCookies) {
      const analysis = analyzeCookie(cookie, currentDomain);
      allCookieDetails.push(analysis);
      if (analysis.isTracker) trackingCookies.push(analysis);
    }

    return {
      pageUrl: currentUrl,
      pageDomain: currentDomain,
      timestamp: new Date().toISOString(),
      totalCookies: firstPartyCookies.length,   // show first-party count (matches what browser shows)
      trackingCookies: trackingCookies.length,
      trackers: trackingCookies,
      allCookies: allCookieDetails
    };

  } catch (error) {
    console.error('[ClickSafe Cookie Tracker] Error scanning cookies:', error);
    return { error: error.message };
  }
}

async function scanAllCookies() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return { error: 'No active tab found' };
    return scanAllCookiesForUrl(tabs[0].url, tabs[0].id);
  } catch (error) {
    return { error: error.message };
  }
}