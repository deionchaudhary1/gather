import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceMiles,coordinates} from '../locations.js';
import {applicationStatus,evaluate,interestMatch,sortEvents,totalFee} from '../matching.js';
import {calendarExport,monthDays,applicationPacket,checklistFor} from '../planning.js';
import {events,defaultProfile} from '../data.js';
const event=events[0];
const on='2026-10-24';
test('distance is calculated from the current origin, including device coordinates',()=>{
 const miles=distanceMiles(event,defaultProfile);assert.ok(miles>4&&miles<6);
 assert.equal(distanceMiles(event,{...defaultProfile,baseCity:'Oakland'}),0);
 assert.equal(distanceMiles(event,{...defaultProfile,locationMode:'device',latitude:37.8044,longitude:-122.2712}),0);
 assert.equal(distanceMiles({...event,city:null},defaultProfile),null);
 assert.equal(coordinates({latitude:null,longitude:null}),null);
 assert.equal(coordinates({latitude:91,longitude:0}),null);
});
test('a radius boundary and changed origin alter matches without trusting fixture miles',()=>{
 const distance=distanceMiles(event,defaultProfile);
 assert.equal(evaluate(event,{...defaultProfile,radius:distance},on).eligible,true);
 assert.equal(evaluate(event,{...defaultProfile,radius:distance-0.001},on).eligible,false);
 assert.equal(evaluate(event,{...defaultProfile,baseCity:'Fairfield',radius:10},on).eligible,false);
});
test('closed deadlines, ended events, and excluded organization types do not qualify',()=>{
 assert.equal(applicationStatus({...event,deadline:'2026-10-23'},on),'Closed');
 assert.equal(applicationStatus({...event,date:'2026-10-23',endDate:null},on),'Past');
 assert.equal(applicationStatus({...event,deadline:on},on),'Open');
 assert.equal(evaluate({...event,organizationTypes:['Small business']},{...defaultProfile,organizationType:'Nonprofit'},on).eligible,false);
 assert.equal(evaluate({...event,organizationTypes:['Nonprofit']},{...defaultProfile,organizationType:'Nonprofit'},on).eligible,true);
 assert.equal(evaluate({...event,status:'Unknown'},defaultProfile,on).eligible,false);
});
test('interests provide transparent word overlap, without revenue affecting matches',()=>{
 assert.ok(interestMatch(event,{...defaultProfile,interests:'families music'}).includes('music'));
 assert.deepEqual(evaluate(event,{...defaultProfile,revenue:'Under $25,000'},on),evaluate(event,{...defaultProfile,revenue:'Over $500,000'},on));
 assert.equal(totalFee({...event,vendorFee:20,spaceFee:65,fee:20}),85);
});
test('sorts put unknown distances, fees, and dates last without changing input',()=>{
 const list=[{...event,id:'unknown',name:'Unknown',city:null,date:null,fee:null,vendorFee:null,spaceFee:null},{...event,id:'known',name:'Known'}];
 for(const sort of ['distance','date','fee'])assert.equal(sortEvents(list,defaultProfile,sort,on)[0].id,'known');
 assert.equal(list[0].id,'unknown');
});
test('calendar export includes event and deadline dates, safely escapes text, skips missing dates',()=>{
 const result=calendarExport([{...event,name:'Market, art; gifts\nNew line'}, {...event,id:'undated',date:null,deadline:null}]);
 assert.equal(result.count,2);assert.match(result.text,/DTSTART;VALUE=DATE:20261114/);assert.match(result.text,/DTEND;VALUE=DATE:20261115/);
 assert.ok(result.text.includes('Market\\, art\\; gifts\\nNew line'));assert.ok(!result.text.includes('UID:undated'));
 assert.ok(result.text.includes('Gather vendor catalog'));
 assert.equal(calendarExport([{...event,date:null,deadline:null}]).count,0);
});
test('calendar month handles leap years and month transitions',()=>{
 assert.equal(monthDays('2028-02').filter(Boolean).length,29);
 assert.equal(monthDays('2026-02').filter(Boolean).length,28);
 assert.deepEqual(monthDays('2026-13'),[]);
});
test('application packets exclude revenue and keep organizer requirements; task IDs remain stable',()=>{
 const packet=applicationPacket(event,{...defaultProfile,revenue:'SENSITIVE-REVENUE'},'Bring reusable cups');
 assert.ok(!packet.includes('SENSITIVE-REVENUE'));assert.ok(packet.includes('NOT SUBMITTED'));assert.ok(packet.includes('Bring reusable cups'));
 assert.ok(packet.includes(event.requirements[0]));assert.deepEqual(checklistFor(event),checklistFor(event));
 assert.ok(checklistFor(event).some(task=>task.source));
});

test('calendar lines fold within the byte limit and cannot inject CR-separated properties',()=>{
 const result=calendarExport([{...event,name:'é'.repeat(100)+'\rLOCATION:Injected'}]);
 assert.ok(result.text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
 assert.ok(!result.text.includes('\r\nLOCATION:Injected'));
 assert.ok(!result.text.includes('DTSTAMP:20260101T000000Z'));
});
