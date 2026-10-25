import {cities,geographicStatus} from './locations.js';
import {applicationStatus,validDate} from './matching.js';
export function discoveryScope(profile={}){
 return {city:Object.hasOwn(cities,profile.baseCity)?profile.baseCity:'Berkeley',category:String(profile.category||'small business').slice(0,80),organizationType:['Nonprofit','Club'].includes(profile.organizationType)?profile.organizationType:'Small business'};
}
export const scopeKey=profile=>JSON.stringify(discoveryScope(profile));
export const matchesScope=(result,profile)=>Boolean(result?.scope&&JSON.stringify(result.scope)===scopeKey(profile));
export function hasBayAreaLocation(event){return event.region==='bay-area'&&event.locationQuality==='source'&&!event.locationConflict;}
export function hasConfirmedDate(event){return event.dateQuality==='source'&&validDate(event.date)&&!event.dateConflict;}
export function verificationCounts(events,profile,on){
 return {
  total:events.length,
  outsideBayArea:events.filter(event=>event.region==='outside-bay-area').length,
  unverifiedLocation:events.filter(event=>!hasBayAreaLocation(event)&&event.region!=='outside-bay-area').length,
  missingDate:events.filter(event=>hasBayAreaLocation(event)&&!hasConfirmedDate(event)).length,
  pastOrClosed:events.filter(event=>hasBayAreaLocation(event)&&['Past','Closed'].includes(applicationStatus(event,on))).length,
  outsideArea:events.filter(event=>hasBayAreaLocation(event)&&geographicStatus(event,profile)==='outside').length,
  confirmed:events.filter(event=>hasBayAreaLocation(event)&&hasConfirmedDate(event)).length,
 };
}

export function discoveryFresh(result,now=Date.now()){const expires=Date.parse(result?.expiresAt||'')||Date.parse(result?.retrievedAt||'')+86400000;return Number.isFinite(expires)&&now<expires;}
