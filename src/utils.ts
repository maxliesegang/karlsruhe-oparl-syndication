/** Corrects OParl URLs to use the /ris/oparl/ path */
export function correctUrl(url: string): string {
  if (url.includes('/ris/')) {
    return url;
  }
  return url.replace('/oparl/', '/ris/oparl/');
}
