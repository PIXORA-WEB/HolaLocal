// Deliberately exclude detail IDs, all account/admin routes, queries and fragments.
const pages = Object.freeze({
  '/': 'Home', '/services': 'Services', '/events': 'Events', '/community': 'Community',
  '/contact': 'Contact', '/privacy': 'Privacy', '/terms': 'Terms',
})
export function analyticsPage(pathname) {
  return Object.hasOwn(pages, pathname)
    ? { page_title: pages[pathname], page_location: `https://www.holalocal.es${pathname}` }
    : null
}
// Referral categories only: never forward arbitrary URLs, paths or campaigns.
const referralHosts = new Set(['google.com', 'www.google.com', 'google.es', 'www.google.es',
  'bing.com', 'www.bing.com', 'duckduckgo.com', 'facebook.com', 'www.facebook.com',
  'l.facebook.com', 'lm.facebook.com', 'instagram.com', 'www.instagram.com',
  'linkedin.com', 'www.linkedin.com', 't.co'])
export function analyticsReferrer(referrer) {
  try {
    const url = new URL(referrer)
    return url.protocol === 'https:' && referralHosts.has(url.hostname) ? `${url.origin}/` : ''
  } catch { return '' }
}
export function privacyControlBlocksAnalytics(navigator) {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1'
}
export function clearAnalyticsCookies(document, hostname, pathname) {
  const names = document.cookie.split(';').map(part => part.trim().split('=')[0])
    .filter(name => /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name))
  const parts = hostname.split('.')
  const domains = ['', ...parts.map((_, i) => parts.slice(i).join('.'))]
  const paths = new Set(['/'])
  let path = ''
  for (const part of pathname.split('/').filter(Boolean)) { path += `/${part}`; paths.add(path); paths.add(path + '/') }
  for (const name of names) for (const domain of domains) for (const path of paths) {
    document.cookie = `${name}=; Max-Age=0; path=${path};${domain ? ` domain=${domain};` : ''} SameSite=Lax`
  }
}
