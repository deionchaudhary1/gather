import test from 'node:test';
import assert from 'node:assert/strict';
import {events} from '../data.js';
import {approvedProfiles} from '../profiles.js';
import {cities} from '../locations.js';
import {applicationStatus,evaluate,totalFee,validDate} from '../matching.js';

const on='2026-10-24';
const find=id=>{const event=events.find(event=>event.id===id);assert.ok(event,`Missing catalog listing: ${id}`);return event;};
const verdicts=id=>approvedProfiles.map(profile=>evaluate(find(id),profile,on).label);

test('catalog preserves stable IDs, valid dates, complete preparation details, and consistent booth totals',()=>{
 assert.equal(new Set(events.map(event=>event.id)).size,events.length);
 for(const id of ['harvest','makers','winter','wellness','design','autumn'])find(id);
 for(const event of events){
  assert.ok(Object.hasOwn(cities,event.city),event.id);
  assert.ok(validDate(event.date)&&validDate(event.deadline),event.id);
  assert.ok(event.deadline<=event.date,event.id);
  if(event.endDate)assert.ok(validDate(event.endDate)&&event.endDate>=event.date,event.id);
  assert.ok(event.categories.length&&event.requirements.length&&event.applicationSteps.length,event.id);
  assert.ok(event.venue&&event.audience&&event.description&&event.needs,event.id);
  assert.ok(Array.isArray(event.organizationTypes)&&event.organizationTypes.length,event.id);
  for(const category of event.categories){
   assert.ok(!(event.excludedCategories || []).includes(category),event.id);
   assert.ok(!(event.conditionalCategories || []).includes(category),event.id);
  }
  if(event.fee!==null){
   assert.ok(event.vendorFee>=0&&event.spaceFee>=0,event.id);
   assert.equal(totalFee(event),event.fee,event.id);
  }
  if(event.status==='Open')assert.equal(applicationStatus(event,on),'Open',event.id);
  assert.equal(event.sample,true);assert.ok(!event.live);
  assert.ok(!event.sourceUrl&&!event.applicationUrl&&!event.organizerEmail,event.id);
 }
});

test('offering-specific applications give each approved business a distinct strong fit',()=>{
 assert.deepEqual(verdicts('morning-commons'),['Strong fit','Outside your brief','Outside your brief']);
 assert.deepEqual(verdicts('clay-and-kiln'),['Outside your brief','Strong fit','Outside your brief']);
 assert.deepEqual(verdicts('refill-weekend'),['Outside your brief','Outside your brief','Strong fit']);
 assert.deepEqual(verdicts('neighborhood-gift-fair'),['Strong fit','Strong fit','Strong fit']);
 assert.deepEqual(verdicts('makers-and-mugs'),['Strong fit','Strong fit','Outside your brief']);
});

test('shared applications distinguish budget, travel, and conditional category requirements',()=>{
 assert.deepEqual(verdicts('lantern-evening'),['Strong fit','Outside your brief','Strong fit']);
 assert.deepEqual(verdicts('solano-family-fair'),['Strong fit','Outside your brief','Outside your brief']);
 assert.deepEqual(verdicts('south-bay-gift-market'),['Outside your brief','Outside your brief','Outside your brief']);
 assert.deepEqual(verdicts('circular-living'),['Outside your brief','Needs review','Strong fit']);
 assert.equal(evaluate(find('circular-living'),approvedProfiles[1],on).categoryState,'conditional');
});

test('unknown fees, free spaces, closed applications and organization restrictions stay distinct',()=>{
 assert.deepEqual(verdicts('bayview-gathering'),['Needs a fee check','Needs a fee check','Needs a fee check']);
 assert.equal(totalFee(find('bayview-gathering')),null);
 assert.equal(totalFee(find('repair-and-reuse')),0);
 assert.equal(evaluate(find('repair-and-reuse'),approvedProfiles[2],on).label,'Strong fit');
 assert.equal(applicationStatus(find('holiday-gift-waitlist'),on),'Closed');
 assert.ok(verdicts('holiday-gift-waitlist').every(label=>label==='Outside your brief'));
 const community=find('community-wellness-circle');
 assert.ok(verdicts(community.id).every(label=>label==='Outside your brief'));
 assert.equal(evaluate(community,{...approvedProfiles[1],organizationType:'Nonprofit',category:'Community & advocacy'},on).label,'Strong fit');
});
