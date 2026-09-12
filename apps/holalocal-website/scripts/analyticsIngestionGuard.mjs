// Synthetic probe only. No runtime dependency. Fail closed before forwarding.
export function validateProbeRequest(url, packets, attempted, stopped) {
 if(stopped)throw new Error('Probe already stopped')
 if(url.protocol!=='https:'||!['www.google-analytics.com','region1.google-analytics.com'].includes(url.hostname)||url.pathname!=='/g/collect'||url.searchParams.get('tid')!=='G-FKFR4SFML9')throw new Error('Unexpected measurement endpoint')
 if(!packets.length||attempted+packets.length>8)throw new Error('Eight-page-view ceiling')
 for(const p of packets)if(p.event!=='page_view'||!['accepted','public-navigation','return-public'].includes(p.phase)||!['https://www.holalocal.es/events','https://www.holalocal.es/services'].includes(p.location)||p.referrer||p.hasPrivateMarker||!p.noAccountUserId||!p.advertisingDisabled)throw new Error('Unexpected or unsafe measurement')
}
