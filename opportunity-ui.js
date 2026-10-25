
export function safeExternal(value) {
 try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null; } catch { return null; }
}
// Fictional demo scenarios link to clearly labeled, real example application pages.
// These URLs are NOT represented as the application for the fictional event.
export function applicationDestination(event) {
 if(event.sample) {
  const food=(event.categories || []).some(category=>/Coffee|Food/.test(category));
  return {url:food?'https://summer-2026.offthegrid.com/':'https://headwestmarketplace.squarespace.com/apply',label:'Example organizer application',example:true};
 }
 const application=safeExternal(event.applicationUrl),source=safeExternal(event.eventUrl)||safeExternal(event.sourceUrl);
 return {url:application || source,label:application?'Apply on organizer’s site':'View source & application details',example:false};
}
export function directionsUrl(event,profile) {
 const destination=event.sample?`${event.city || ''}, California`:[event.address || event.venue,event.city,'California'].filter(Boolean).join(', ');
 if(!event.city && !event.address && !event.venue)return null;
 const device=profile.locationMode==='device';
 // Let Maps request a starting point for device mode; never put saved device coordinates in a URL.
 const origin=device?null:`${profile.baseCity || 'Berkeley'}, California`;
 const params=new URLSearchParams({api:'1',destination,travelmode:'driving'});
 if(origin)params.set('origin',origin);
 return `https://www.google.com/maps/dir/?${params}`;
}
export function stockPhoto(event) {
 if((event.categories || []).includes('Coffee & beverages') && !(event.categories || []).includes('Art & handmade'))return {
  url:'https://images.unsplash.com/photo-1776604198818-7b6a90e40a81?auto=format&fit=crop&w=800&q=80',
  source:'https://unsplash.com/photos/man-preparing-drinks-at-a-mobile-coffee-van-yWICG2j7rkE',credit:'Quan Jing',alt:'Barista preparing drinks at a mobile coffee van',
 };
 if((event.categories || []).includes('Art & handmade') && !(event.categories || []).includes('Coffee & beverages'))return {
  url:'https://images.unsplash.com/photo-1465631494067-3e0491e95bd1?auto=format&fit=crop&w=800&q=80',
  source:'https://unsplash.com/photos/person-making-pot-vBxlL1xpSdc',credit:'Quino Al',alt:'Artisan shaping a ceramic pot at a pottery wheel',
 };
 if(event.kind==='Community' || event.art==='sun')return {
  url:'https://images.unsplash.com/photo-1567306295427-94503f8300d7?auto=format&fit=crop&w=800&q=80',
  source:'https://unsplash.com/photos/kuR1Kwo4my4',credit:'Shelley Pauls',alt:'Fresh produce displayed in a wooden market crate',
 };
 return {
  url:'https://images.unsplash.com/photo-1526399743290-f73cb4022f48?auto=format&fit=crop&w=800&q=80',
  source:'https://unsplash.com/photos/eE-ffApg7oI',credit:'Kyle Nieber',alt:'Shoppers browsing an outdoor market with plants and local goods',
 };
}
export function matchTone(match) { return match.label==='Strong fit'?'positive':match.blocked?'blocked':'review'; }
