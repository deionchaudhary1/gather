import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {extractPage,extractPageRecords,loadLatestDiscovery,queriesFor} from '../discovery.mjs';
import {datesIn} from '../source-facts.mjs';
import {hasBayAreaLocation,hasConfirmedDate,matchesScope,discoveryScope,scopeKey,verificationCounts} from '../discovery-scope.js';
import {visibleNearby,geographicStatus} from '../locations.js';
import {approvedProfiles} from '../profiles.js';
import {applicationStatus} from '../matching.js';
import {createDiscoveryService} from '../discovery-service.mjs';
const checked='2026-10-25T12:00:00Z';
const page=(markdown,title='Holiday Market 2026',url='https://organizer.example/market')=>({url,metadata:{title},markdown});
// Minimal factual excerpts from the actual cached Apify pages that reproduced the bug.
const sf=page('Holiday Craft Fair\nSunday, Dec 13, 2026, 11am – 4pm\nHMCA & HMPC 50 Scott St.\nVendor Application Opens Thursday September 3, 2026\nVendor Applications are due Tuesday, November 3, 2026\nHarvey Milk Center for the Arts, part of San Francisco Recreation and Parks Department is proud to host its Holiday Craft Fair on Sunday, December 13th, 2026.\n[Link to vendor application](https://docs.google.com/forms/d/e/real-example/viewform)','Holiday Craft Fair 2026 - Harvey Milk Photo Center','https://www.harveymilkphotocenter.org/events/holiday-craft-fair-3/');
test('real fair date, time, application deadline, and street/city context survive extraction',()=>{
 const event=extractPage(sf,checked);
 assert.equal(event.date,'2026-12-13');assert.equal(event.timeText,'11am – 4pm');assert.equal(event.deadline,'2026-11-03');assert.equal(event.city,'San Francisco');assert.equal(event.status,'Open');
 assert.ok(hasBayAreaLocation(event)&&hasConfirmedDate(event));assert.ok(event.evidence.date.includes('Dec 13'));assert.ok(event.locationEvidence.includes('50 Scott'));
 for(const profile of approvedProfiles)assert.equal(visibleNearby(event,profile),true);
});
test('multi-day ranges and application received-by deadlines distinguish real closed applications',()=>{
 const event=extractPage(page('Vendor application\n**Dates:** November 21 & 22, 2026 **Time:** 11:00 – 4:00 PM\n**Vendor Fees:** $85 for one table for two days; second table for additional $40\n**Location:** Concord Museum & Event Center, 1928 Clayton Road, Concord, CA 94520\nApplication must be received by September 4, 2026'),checked);
 assert.equal(event.city,'Concord');assert.equal(event.date,'2026-11-21');assert.equal(event.endDate,'2026-11-22');assert.equal(event.timeText,'11:00 – 4:00 PM');assert.equal(event.fee,85);assert.equal(applicationStatus(event,'2026-10-25'),'Closed');
});
test('Oakland in Florida and Michigan never pass even when incomplete listings are enabled',()=>{
 const records=[page('Market vendors in Oakland, located in Northwest Orange County. Welcome to the Florida of Yesterday.','OBMco. - Oakland','https://www.orangeblossommarketco.com/oakland'),page('Farmers Market vendor application','Farmers Market | Oakland County, MI','https://www.oaklandcountymi.gov/community/farmers-market')];
 for(const record of records){const event=extractPage(record,checked);assert.equal(event.region,'outside-bay-area');assert.equal(hasBayAreaLocation(event),false);for(const profile of approvedProfiles){assert.equal(visibleNearby(event,profile,true),false);assert.equal(geographicStatus(event,profile),'outside');}}
});
test('yearless dates need a source year; invalid and conflicting dates are not confirmed',()=>{
 assert.deepEqual(datesIn('November 31, 2026'),[]);assert.deepEqual(datesIn('February 30, 2026'),[]);
 assert.equal(extractPage(page('Vendor application\nSaturday, December 5','Holiday Market'),checked).date,null);
 assert.equal(extractPage(page('Vendor application\nSaturday, December 5','Holiday Market 2026'),checked).date,'2026-12-05');
 const conflict=extractPage(page('Market vendor application\nDate: November 14, 2026\nDate: November 21, 2026\nLocation: Oakland, CA'),checked);assert.equal(hasConfirmedDate(conflict),false);assert.equal(conflict.dateQuality,'conflict');
 assert.equal(extractPage(page('Vendor application\nLast updated: November 14, 2026','Market'),checked).date,null);
});
test('structured Events split multiple markets without mixing locations; publication metadata is never an event date',()=>{
 const record=page('Vendor market applications','Apply to our events');record.metadata.jsonLd=[{'@type':'WebPage',datePublished:'2026-10-25'},{'@type':'Event',name:'Oakland Makers Market',startDate:'2026-11-14T10:00:00-08:00',location:{name:'Oakland Hall',address:{addressLocality:'Oakland',addressRegion:'CA'}}},{'@type':'Event',name:'Berkeley Gift Fair',startDate:'2026-11-21T11:00:00-08:00',location:{address:{addressLocality:'Berkeley',addressRegion:'CA'}}}];
 const events=extractPageRecords(record,checked);assert.equal(events.length,2);assert.equal(new Set(events.map(e=>e.id)).size,2);assert.deepEqual(events.map(e=>[e.name,e.city,e.date]),[['Oakland Makers Market','Oakland','2026-11-14'],['Berkeley Gift Fair','Berkeley','2026-11-21']]);
 assert.ok(events.every(e=>hasBayAreaLocation(e)&&hasConfirmedDate(e)));
 const annual=structuredClone(record);annual.metadata.jsonLd=[{'@type':'Event',name:'Year-round market',startDate:'2026-01-01',endDate:'2026-12-31'}];assert.equal(hasConfirmedDate(extractPage(annual,checked)),false);
});
test('a directory’s related cards cannot supply the main event’s location or date',()=>{
 const event=extractPage(page('Vendor applications for a market\n## More pop-ups nearby\nLocation: Oakland, CA\nDate: November 14, 2026','Market'),checked);assert.equal(hasBayAreaLocation(event),false);assert.equal(hasConfirmedDate(event),false);
});
test('city scopes vary by offering and city, not radius; queries do not use the obsolete pilot flag',()=>{
 assert.equal(scopeKey({...approvedProfiles[0],radius:5}),scopeKey({...approvedProfiles[0],radius:500}));
 assert.notEqual(scopeKey(approvedProfiles[0]),scopeKey(approvedProfiles[1]));
 assert.deepEqual(queriesFor(approvedProfiles[1],true),queriesFor(approvedProfiles[1],false));assert.ok(queriesFor(approvedProfiles[1]).slice(0,2).every(query=>query.includes('Oakland')&&query.includes('California')));
 assert.ok(matchesScope({scope:discoveryScope(approvedProfiles[0])},approvedProfiles[0]));
});
test('filter diagnostics distinguish unverified, outside-Bay-Area, closed, and outside-radius records',()=>{
 const event=extractPage(sf,checked),closed={...event,id:'closed',status:'Closed'},unknown={...event,id:'unknown',region:'unknown'},outside={...event,id:'outside',region:'outside-bay-area'};
 const counts=verificationCounts([event,closed,unknown,outside],approvedProfiles[0],'2026-10-25');assert.equal(counts.confirmed,2);assert.equal(counts.pastOrClosed,1);assert.equal(counts.unverifiedLocation,1);assert.equal(counts.outsideBayArea,1);
});
test('service keeps scopes isolated, deduplicates concurrent requests, and does not launch paid work for cached results',async()=>{
 let calls=0,finish;const pending=new Promise(resolve=>{finish=resolve});
 const service=createDiscoveryService({load:async()=>null,discover:async(profile)=>{calls++;await pending;return {scope:discoveryScope(profile),retrievedAt:checked,events:[]};},now:()=>Date.parse(checked)});
 const first=await service.start(approvedProfiles[0]);assert.equal(first.status,'running');assert.equal((await service.start(approvedProfiles[0])).status,'running');assert.equal((await service.start(approvedProfiles[1])).status,'busy');assert.equal(calls,1);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal((await service.status(approvedProfiles[0])).status,'complete');assert.equal((await service.status(approvedProfiles[1])).status,'idle');
 await service.start(approvedProfiles[0]);assert.equal(calls,1);
});
test('cached raw pages are reprocessed after parser upgrades without losing the actual retrieval time',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-verify-`),cacheDir=pathToFileURL(`${dir}/`);
 try{
  await writeFile(new URL('old.json',cacheDir),JSON.stringify({scope:discoveryScope(approvedProfiles[0]),queries:['query'],events:[{id:'old'}],runs:[],retrievedAt:checked,extractionVersion:0}));
  await writeFile(new URL('old.pages.json',cacheDir),JSON.stringify({pages:[sf],retrievedAt:checked}));
  const result=await loadLatestDiscovery(cacheDir,approvedProfiles[0]);assert.equal(result.events[0].date,'2026-12-13');assert.equal(result.retrievedAt,checked);assert.equal(result.cached,true);assert.equal(await loadLatestDiscovery(cacheDir,approvedProfiles[1]),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('directory JSON-LD does not turn entertainment listings into vendor opportunities or share fees/forms',()=>{
 const record=page('Vendor fee: $500\n[Apply here](https://wrong.example/apply)\nMarket information','Event directory');
 record.metadata.jsonLd=[{'@type':'Event',name:'Secret Comedy Show',startDate:'2026-11-14',location:{address:{addressLocality:'San Francisco',addressRegion:'CA'}}},{'@type':'Event',name:'Holiday Craft Market',url:'https://events.example/holiday-market',startDate:'2026-11-21',location:{address:{addressLocality:'Oakland',addressRegion:'CA'}}}];
 const events=extractPageRecords(record,checked);assert.equal(events.length,1);assert.equal(events[0].name,'Holiday Craft Market');assert.equal(events[0].fee,null);assert.equal(events[0].applicationUrl,null);assert.equal(events[0].eventUrl,'https://events.example/holiday-market');
});
test('same-name cities in other states remain outside the Bay Area, including state names and abbreviations',()=>{
 for(const location of ['Concord, NC','Concord, Massachusetts','Richmond, VA','Albany, NY']){const event=extractPage(page(`Vendor applications\nDate: November 14, 2026\nLocation: ${location}`),checked);assert.equal(hasBayAreaLocation(event),false,location);assert.equal(event.region,'outside-bay-area',location);}
});
test('refresh is explicit and one completed refresh is reused instead of charging again',async()=>{
 let calls=0;const cached={scope:discoveryScope(approvedProfiles[0]),retrievedAt:checked,events:[]};
 const service=createDiscoveryService({load:async()=>cached,now:()=>Date.parse(checked),discover:async()=>{calls++;return {...cached,cached:false};}});
 assert.equal((await service.start(approvedProfiles[0])).status,'complete');assert.equal(calls,0);
 assert.equal((await service.start(approvedProfiles[0],{refresh:true})).status,'running');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal((await service.start(approvedProfiles[0])).status,'complete');assert.equal(calls,1);
});

test('event header years support published plus-sign date ranges and venue/city lines',()=>{
 const event=extractPage(page('Vendor application\n## 2027\nFebruary 27 + 28, 2027\nFort Mason Center, San Francisco','Craft Application'),checked);
 assert.equal(event.date,'2027-02-27');assert.equal(event.endDate,'2027-02-28');assert.equal(event.city,'San Francisco');assert.ok(hasBayAreaLocation(event));
});
test('the same event in two directory pages has one stable identity',()=>{
 const nodes=[{'@type':'Event',name:'Holiday Market',url:'https://event.example/123',startDate:'2026-11-21',location:{address:{addressLocality:'Oakland',addressRegion:'CA'}}},{'@type':'Event',name:'Comedy Show',startDate:'2026-11-21'}];
 const first={...page('Market vendors','Markets','https://directory.example/one'),metadata:{jsonLd:nodes}};
 const second={...first,url:'https://directory.example/two'};assert.equal(extractPageRecords(first,checked)[0].id,extractPageRecords(second,checked)[0].id);
});
