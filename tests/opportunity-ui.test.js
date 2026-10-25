import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationDestination,directionsUrl,stockPhoto,safeExternal,matchTone} from '../opportunity-ui.js';
import {initializeProfiles} from '../profiles.js';
import {sortEvents} from '../matching.js';
import {events,defaultProfile} from '../data.js';

test('application links prefer the real application, safely fall back to source, and label demos as examples',()=>{
 assert.equal(applicationDestination({applicationUrl:'https://organizer.test/form',sourceUrl:'https://source.test'}).url,'https://organizer.test/form');
 assert.equal(applicationDestination({applicationUrl:'javascript:alert(1)',sourceUrl:'https://source.test'}).url,'https://source.test/');
 assert.equal(applicationDestination({}).url,null);
 for(const event of events){const target=applicationDestination(event);assert.equal(target.example,true);assert.match(target.label,/Example/);assert.ok(safeExternal(target.url));}
 assert.equal(safeExternal('https://user:password@example.test'),null);
});
test('Maps URLs request driving and do not misrepresent fictional venues or transmit device coordinates',()=>{
 const demo=new URL(directionsUrl(events[0],defaultProfile));
 assert.equal(demo.searchParams.get('travelmode'),'driving');assert.equal(demo.searchParams.get('destination'),'Oakland, California');
 const live=new URL(directionsUrl({city:'Oakland',address:'123 Main St'},defaultProfile));assert.equal(live.searchParams.get('destination'),'123 Main St, Oakland, California');
 const device=directionsUrl(events[0],{locationMode:'device',latitude:37.123456,longitude:-122.123456});assert.ok(!device.includes('37.123456'));assert.ok(!new URL(device).searchParams.has('origin'));
 assert.equal(directionsUrl({},defaultProfile),null);
});
test('profile cleanup removes only the two requested names, including the legacy path',()=>{
 const result=initializeProfiles({one:{name:'test'},two:{name:'2345678'},keep:{name:'Test Coffee'}},{},'one');
 assert.ok(!result.profiles.one&&!result.profiles.two);assert.equal(result.profiles.keep.name,'Test Coffee');assert.equal(result.active,'daybreak');
 assert.ok(!initializeProfiles(null,{...defaultProfile,name:'test'},null).profiles.previous);
});
test('recommended sorting places strong fits first, earliest events before higher-scoring later events, and unknown dates last',()=>{
 const base={...events[0],status:'Open',deadline:'2026-12-31'};
 const soon={...base,id:'soon',date:'2026-11-01',interests:'',audience:'',description:'',needs:''};
 const later={...base,id:'later',date:'2026-11-20',interests:'neighborhood food community'};
 const unknown={...base,id:'unknown',date:null};
 const blocked={...base,id:'blocked',date:'2026-10-26',fee:999,vendorFee:999,spaceFee:0};
 assert.deepEqual(sortEvents([later,blocked,unknown,soon],defaultProfile,'recommended','2026-10-25').map(e=>e.id),['soon','later','unknown','blocked']);
});
test('fit states and all photo assets have distinct presentation and a source credit',()=>{
 assert.equal(matchTone({label:'Strong fit'}),'positive');assert.equal(matchTone({label:'Needs a fee check'}),'review');assert.equal(matchTone({label:'Outside your brief',blocked:true}),'blocked');
 for(const event of events){const photo=stockPhoto(event);assert.equal(new URL(photo.url).hostname,'images.unsplash.com');assert.ok(photo.credit&&photo.alt&&photo.source);}
});
