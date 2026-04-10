// ============================================================
//  ClickSafe — httpsMonitor.js
//  HTTPS Monitor Detection Module
//
//  NOTE: This module provides helper functions used by other
//  parts of the extension. The actual mixed content detection
//  happens in two places:
//
//  1. DOM scan (content.js → scanForMixedContent)
//     Checks img/script/iframe/link tags with http:// src/href.
//     Results sent via MIXED_CONTENT_DETECTED message →
//     stored in mixedContent_${tabId} by background.js.
//
//  2. Future: webRequest listener (not yet implemented)
//     Would catch dynamically loaded HTTP resources that aren't
//     in the initial DOM. Would write to httpResources_${tabId}.
//
//  The sidebar reads mixedContent_${tabId} which is always
//  populated by the DOM scan.
// ============================================================

const ACTIVE_MIXED_CONTENT_TYPES = ['script', 'iframe', 'stylesheet', 'object'];

function isHttpUrl(url) {
  return typeof url === 'string' && url.startsWith('http://');
}

function isSecurePage(pageUrl) {
  return typeof pageUrl === 'string' && pageUrl.startsWith('https://');
}

function getResourceType(tagName) {
  const map = {
    IMG: 'image', SCRIPT: 'script', IFRAME: 'iframe',
    LINK: 'stylesheet', AUDIO: 'media', VIDEO: 'media',
    SOURCE: 'media', OBJECT: 'object'
  };
  return map[tagName] || 'resource';
}

function getSeverity(resourceType) {
  return ACTIVE_MIXED_CONTENT_TYPES.includes(resourceType) ? 'high' : 'low';
}

function analyzeResource(resourceUrl, resourceType, pageUrl) {
  const result = {
    isMixedContent: false,
    reasons: [],
    resource: { url: resourceUrl, type: resourceType, severity: null }
  };

  if (!isSecurePage(pageUrl)) return result;

  if (isHttpUrl(resourceUrl)) {
    result.isMixedContent      = true;
    result.resource.severity   = getSeverity(resourceType);
    result.reasons.push('HTTP resource on HTTPS page (mixed content)');
    if (result.resource.severity === 'high') {
      result.reasons.push(`Active mixed content: ${resourceType}`);
    }
  }

  return result;
}

// Summarise mixed content results from a list of resource entries.
// Used if/when a webRequest listener is added in the future.
function summariseMixedContent(resources, pageUrl) {
  const analysed = resources.map(r => analyzeResource(r.url, r.type, pageUrl));
  const mixed    = analysed.filter(r => r.isMixedContent);
  return {
    pageUrl,
    pageIsSecure:      isSecurePage(pageUrl),
    totalChecked:      resources.length,
    mixedContentCount: mixed.length,
    highSeverityCount: mixed.filter(r => r.resource.severity === 'high').length,
    lowSeverityCount:  mixed.filter(r => r.resource.severity === 'low').length,
    mixedResources:    mixed
  };
}
