import {distanceMiles} from './locations.js';
// Crawl starting points only, not event records. All dates, fees, locations, and application
// availability must still come from freshly crawled content or a fresh source cache.
const organizers=[
 {city:'San Francisco',url:'https://www.harveymilkphotocenter.org/events/holiday-craft-fair-3/'},
 {city:'San Francisco',url:'https://www.westcoastcraft.com/wcc-application'},
 {city:'San Francisco',url:'https://www.renegadecraft.com/event/san-francisco-winter/'},
 {city:'Oakland',url:'https://www.thecrucible.org/gifty/'},
 {city:'Berkeley',url:'https://ecologycenter.org/food-farming/berkeley-farmers-markets/'},
];
export function organizerFallbacks(profile,selected=[]){
 const urls=new Set(selected.map(item=>item.url));
 return organizers.filter(item=>!urls.has(item.url)).sort((a,b)=>{
  // Event-specific pages take priority over recurring calendars and general organizer pages.
  const priority=item=>/wcc-application|harveymilk|san-francisco-winter/.test(item.url)?0:1;
  return priority(a)-priority(b)||(distanceMiles(a,profile)||0)-(distanceMiles(b,profile)||0);
 }).slice(0,3).map(item=>({url:item.url,title:new URL(item.url).hostname,fallback:true}));
}
