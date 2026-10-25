import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedProfiles,initializeProfiles,initializeWorkspaces} from '../profiles.js';
import {defaultProfile} from '../data.js';
import {extractCategories,inferLocation,normalizeOpportunity,sourceOutsideRadius} from '../opportunity-facts.js';
import {distanceMiles,visibleNearby,geographicStatus} from '../locations.js';
import {evaluate} from '../matching.js';
const daybreak=approvedProfiles[0],clay=approvedProfiles[1],refill=approvedProfiles[2];
function live(overrides={}){return normalizeOpportunity({id:'test',name:'A market',live:true,sourceUrl:'https://example.com/apply',status:'Unknown',fee:null,categories:[],description:'',evidence:{},...overrides});}
test('approved profiles have the exact agreed offering, city, radius and budget',()=>{
 assert.deepEqual(approvedProfiles.map(({name,category,baseCity,radius,budget})=>({name,category,baseCity,radius,budget})),[
  {name:'Daybreak Coffee',category:'Coffee & beverages',baseCity:'Berkeley',radius:30,budget:200},
  {name:'East Bay Clay Studio',category:'Art & handmade',baseCity:'Oakland',radius:20,budget:100},
  {name:'Loop & Leaf Refill',category:'Retail & gifts',baseCity:'San Francisco',radius:25,budget:150},
 ]);
 assert.equal(Object.keys(initializeProfiles(null,defaultProfile,null).profiles).length,3);
});
test('profile migration preserves customized legacy profiles and independent later edits',()=>{
 const migrated=initializeProfiles(null,{...defaultProfile,name:'Existing business',budget:500},null);
 assert.equal(migrated.active,'previous');assert.equal(migrated.profiles.previous.budget,500);assert.equal(migrated.profiles.daybreak.budget,200);
 migrated.profiles.clay.budget=90;
 const restored=initializeProfiles(migrated.profiles,{},'clay');assert.equal(restored.active,'clay');assert.equal(restored.profiles.clay.budget,90);assert.equal(restored.profiles.refill.budget,150);
});
test('legacy drafts migrate once to the original business and do not leak on a switch',()=>{
 const drafts=initializeWorkspaces(null,{event:'Original draft'},'daybreak');
 drafts.clay={event:'Clay draft'};
 const restored=initializeWorkspaces(drafts,{event:'Legacy fallback'},'refill');
 assert.equal(restored.daybreak.event,'Original draft');assert.equal(restored.clay.event,'Clay draft');assert.equal(restored.refill,undefined);
});
test('negative service statements are exclusions and mixed positive/negative clauses stay separate',()=>{
 const facts=extractCategories("We don’t typically accept vendors providing services (massages, tarot reading).\nWe welcome food vendors, but not artists.");
 assert.ok(!facts.categories.includes('Wellness & services'));assert.ok(facts.excludedCategories.includes('Wellness & services'));
 assert.ok(facts.categories.includes('Food & bakery'));assert.ok(facts.excludedCategories.includes('Art & handmade'));
});
test('exceptions, producer-only conditions and market-specific capacity remain conditional',()=>{
 const facts=extractCategories('We do not accept non-local products. We make an exception for locally roasted coffee.\nHollywood & Atwater are at capacity for food & artisan/craft vendors.');
 assert.ok(!facts.categories.includes('Coffee & beverages'));assert.ok(facts.conditionalCategories.includes('Coffee & beverages'));
 assert.ok(facts.conditionalCategories.includes('Food & bakery'));assert.ok(facts.conditionalCategories.includes('Art & handmade'));
});
test('category headings support lists without treating requirements as accepted vendor types',()=>{
 const facts=extractCategories('Accepted vendor types:\n- Coffee vendors\n- Handmade ceramics\n# Requirements\n- Bring food and beverages for your staff.\nNot accepted:\n- Wellness services');
 assert.ok(facts.categories.includes('Coffee & beverages'));assert.ok(facts.categories.includes('Art & handmade'));assert.ok(!facts.categories.includes('Food & bakery'));assert.ok(facts.excludedCategories.includes('Wellness & services'));
});
test('old false positive tags are reprocessed and normalized records are idempotent',()=>{
 const event=live({categories:['Wellness & services'],description:'',evidence:{categories:'We do not accept vendors providing services (massages, tarot reading).'}});
 assert.deepEqual(event.categories,[]);assert.deepEqual(event.excludedCategories,['Wellness & services']);assert.deepEqual(normalizeOpportunity(event),event);
});
test('known Virginia and Los Angeles sources cannot masquerade as nearby unknown locations',()=>{
 for(const event of [live({sourceUrl:'https://www.fairfaxcounty.gov/parks/farmersmarkets/become-vendor'}),live({description:'The farmers markets have provided Los Angeles with sustainably sourced foods.'})]){
  for(const profile of approvedProfiles){assert.equal(geographicStatus(event,profile),'outside');assert.equal(visibleNearby(event,profile,true),false);assert.equal(evaluate(event,profile,'2026-10-24').blocked,true);}
 }
 assert.equal(sourceOutsideRadius({url:'https://www.fairfaxcounty.gov/parks',title:'Vendors'},daybreak),true);
});
test('Fairfield differentiates the three approved radii and does not invent coffee acceptance',()=>{
 const event=live({sourceUrl:'https://www.fairfield.ca.gov/news/market',description:'The market is seeking food trucks, artisans, and retail pop-ups.'});
 assert.ok(Math.abs(distanceMiles(event,daybreak)-29)<0.1);assert.equal(visibleNearby(event,daybreak),true);assert.equal(visibleNearby(event,clay),false);assert.equal(visibleNearby(event,refill),false);
 assert.equal(evaluate(event,daybreak).categoryState,'unknown');assert.equal(evaluate(event,clay).categoryState,'accepted');assert.equal(evaluate(event,refill).categoryState,'accepted');
});
test('unverified title locations and absent facts never become confirmed compatibility',()=>{
 const event=live({name:'Berkeley Juneteenth Vendor Application'});
 assert.equal(event.locationQuality,'title');assert.equal(visibleNearby(event,daybreak),false);assert.equal(visibleNearby(event,daybreak,true),true);assert.equal(evaluate(event,daybreak).eligible,false);
 assert.equal(inferLocation({name:'Vendor application',description:'Search for any festival'}).city,null);
});
test('explicit category rejection overrides score even with matching interests and other known criteria',()=>{
 const event=live({city:'Berkeley',status:'Open',fee:10,feeIncludesSpace:true,organizationTypes:['Small business'],description:'We do not accept coffee vendors. Families and neighborhood gatherings welcome.'});
 const result=evaluate(event,daybreak,'2026-10-24');assert.equal(result.categoryState,'excluded');assert.equal(result.eligible,false);assert.equal(result.blocked,true);assert.equal(result.label,'Outside your brief');
});
test('conjunctions and except clauses preserve separate acceptance rules',()=>{
 const mixed=extractCategories('We accept food vendors and do not accept artists.');
 assert.ok(mixed.categories.includes('Food & bakery'));assert.ok(mixed.excludedCategories.includes('Art & handmade'));
 const exception=extractCategories('We accept food vendors except coffee vendors.');
 assert.ok(exception.categories.includes('Food & bakery'));assert.ok(exception.excludedCategories.includes('Coffee & beverages'));
});
test('a published event city takes precedence over an organizer domain and conflicting locations stay unknown',()=>{
 assert.equal(inferLocation({city:'Berkeley',sourceUrl:'https://www.fairfaxcounty.gov/events',evidence:{city:'City: Berkeley'}}).city,'Berkeley');
 const location=inferLocation({description:'Location: Oakland, CA\nLocation: Berkeley, CA'});
 assert.equal(location.city,null);assert.equal(location.locationConflict,true);
});
test('incidental mentions and word fragments do not become accepted categories',()=>{
 assert.deepEqual(extractCategories('Insurance documents including food permits must be provided.').categories,[]);
 assert.deepEqual(extractCategories('We welcome steak vendors.').categories,[]);
});
