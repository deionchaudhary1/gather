import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createDiscovery,extractPage,shortlist,testQueries,queriesFor,loadLatestDiscovery} from '../discovery.mjs';
import {evaluate} from '../matching.js';
import {defaultProfile} from '../data.js';
const page={url:'https://organizer.example/apply',metadata:{title:'Holiday fair'},markdown:'Welcoming vendors\nWe welcome food and coffee vendors\nVendor fee: $85\nApplication deadline: November 5, 2026\nInsurance required.\n[Apply here](/form)'};
test('extraction preserves evidence, unknowns, and application source',()=>{
 const event=extractPage(page,'2026-10-24T12:00:00Z');
 assert.equal(event.fee,85);assert.equal(event.deadline,'2026-11-05');
 assert.deepEqual(event.categories,['Coffee & beverages','Food & bakery']);
 assert.equal(event.applicationUrl,'https://organizer.example/form');
 assert.equal(event.status,'Unknown');assert.equal(event.distance,null);assert.equal(event.date,null);
 assert.equal(event.evidence.fee,'Vendor fee: $85');assert.equal(evaluate(event,defaultProfile).eligible,false);
 assert.equal(extractPage({...page,markdown:'Vendor information. Admission $20. Apply by November 5.'}).fee,null);
 assert.equal(extractPage({...page,markdown:'Vendor fee: $50–100'}).fee,null);
 assert.equal(extractPage({...page,markdown:'Vendor fee: $1,000'}).fee,null);
 assert.equal(extractPage({...page,markdown:'Vendor application\nEvent date: 2026-11-14\nCity: Oakland'}).date,'2026-11-14');
 assert.equal(extractPage({...page,url:'javascript:alert(1)'}),null);
 assert.equal(extractPage({...page,markdown:'General tourism page'}),null);
 assert.equal(extractPage(page,'2026-12-01T00:00:00Z').status,'Closed');
 assert.equal(extractPage({...page,markdown:'All vendor spaces have been sold out for this event and the waitlist is currently full.'}).status,'Closed');
});
test('shortlist ranks relevant links, deduplicates, rejects unsafe and social URLs, caps at five',()=>{
 const organicResults=Array.from({length:9},(_,i)=>({url:`https://organizer${i}.example/apply`,title:'Vendor application market'}));
 organicResults.push(organicResults[0],{url:'javascript:alert(1)',title:'Vendor application'},{url:'https://instagram.com/a',title:'Vendor application'});
 assert.equal(shortlist([{organicResults}]).length,5);assert.equal(shortlist([{organicResults:[{url:'https://example.com',title:'Travel guide'}]}]).length,0);
 assert.deepEqual(queriesFor(defaultProfile,true),testQueries);assert.ok(queriesFor(defaultProfile).every(q=>q.includes(defaultProfile.category)));
});
test('pipeline submits bounded Actors, reports usage, and caches without repeating paid calls',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-test-`);const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});let result;
  if(url.includes('/acts/')) result={data:{id:url.includes('google')?'search':'crawl',status:'SUCCEEDED',defaultDatasetId:url.includes('google')?'search-data':'crawl-data',usageTotalUsd:0.01}};
  else result=url.includes('search-data')?[{organicResults:[{url:page.url,title:'Vendor application market'}]}]:[page];
  return {ok:true,json:async()=>result};
 };
 try{
  const discover=createDiscovery({token:'secret',fetchImpl,cacheDir:pathToFileURL(`${dir}/`)});
  const progress=[];
  const first=await discover(defaultProfile,true,{onProgress:update=>progress.push(update)});
  assert.deepEqual([...new Set(progress.map(p=>p.stage))],['cache','search','shortlist','crawl','extract']);
  assert.ok(progress.some(p=>p.stage==='crawl' && p.message.includes('1 selected sources')));
  for(const key of ['searchMs','crawlMs','extractionMs','totalMs'])assert.ok(Number.isFinite(first.timings[key]) && first.timings[key]>=0);
  assert.equal(first.events.length,1);assert.equal(first.runs.length,2);
  const inputs=calls.filter(c=>c.url.includes('/acts/')).map(c=>JSON.parse(c.options.body));
  assert.equal(inputs[0].queries.split('\n').length,3);assert.equal(inputs[0].maxPagesPerQuery,1);assert.equal(inputs[0].aiModeSearch.enableAiMode,false);
  assert.equal(inputs[1].maxCrawlPages,10);assert.equal(inputs[1].maxCrawlDepth,1);
  const count=calls.length,cachedProgress=[];assert.equal((await discover(defaultProfile,true,{onProgress:p=>cachedProgress.push(p.stage)})).cached,true);assert.equal(calls.length,count);assert.deepEqual(cachedProgress,['cache']);
  assert.ok(!JSON.stringify(first).includes('secret'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing credentials and API failure are explicit',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-error-`);const cacheDir=pathToFileURL(`${dir}/`);
 try{
  await assert.rejects(createDiscovery({cacheDir})(defaultProfile),/APIFY_TOKEN/);
  await assert.rejects(createDiscovery({token:'bad',cacheDir,fetchImpl:async()=>({ok:false,status:401})})(defaultProfile),/401/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('running Actors are polled and unsuccessful runs do not trigger crawling',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-poll-`);let calls=0;
 const fetchImpl=async()=>({ok:true,json:async()=>({data:{id:'failed-run',status:++calls===1?'RUNNING':'FAILED'}})});
 try {await assert.rejects(createDiscovery({token:'token',cacheDir:pathToFileURL(`${dir}/`),fetchImpl,pollMs:0})(defaultProfile),/failed-run ended with FAILED/);assert.equal(calls,2);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('no relevant search results skips the crawler',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-empty-`);let calls=0;
 const fetchImpl=async()=>({ok:true,json:async()=>++calls===1?{data:{id:'empty',status:'SUCCEEDED',defaultDatasetId:'empty-data'}}:[]});
 try {const result=await createDiscovery({token:'token',cacheDir:pathToFileURL(`${dir}/`),fetchImpl})(defaultProfile);assert.equal(calls,2);assert.deepEqual(result.events,[]);assert.equal(result.runs.length,1);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('a failed crawl can reuse the successful search cache',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-retry-`);let searchRuns=0,crawlRuns=0;
 const fetchImpl=async(url,options)=>{
  let result;
  if(url.includes('/acts/apify~google')){searchRuns++;result={data:{id:'search',status:'SUCCEEDED',defaultDatasetId:'search-data'}};}
  else if(url.includes('/acts/apify~website')){crawlRuns++;assert.equal(JSON.parse(options.body).crawlerType,'cheerio');result={data:{id:'crawl',status:crawlRuns===1?'FAILED':'SUCCEEDED',defaultDatasetId:'crawl-data'}};}
  else result=url.includes('search-data')?[{organicResults:[{url:page.url,title:'Vendor application market'}]}]:[page];
  return {ok:true,json:async()=>result};
 };
 try {
  const discover=createDiscovery({token:'token',cacheDir:pathToFileURL(`${dir}/`),fetchImpl,crawlerType:'cheerio'});
  await assert.rejects(discover(defaultProfile,true),/FAILED/);
  const result=await discover(defaultProfile,true);assert.equal(result.events.length,1);assert.equal(searchRuns,1);assert.equal(crawlRuns,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('organization searches use the selected city without sending revenue or device coordinates',()=>{
 const queries=queriesFor({...defaultProfile,baseCity:'Fairfield',organizationType:'Nonprofit',revenue:'REVENUE-SECRET',latitude:38.123456});
 assert.ok(queries.every(query=>query.includes('Fairfield')));assert.ok(queries[2].includes('nonprofit'));assert.ok(!queries.join(' ').includes('REVENUE-SECRET'));assert.ok(!queries.join(' ').includes('38.123456'));
});
test('labeled source facts retain exact markdown evidence and invalid dates stay unknown',()=>{
 const event=extractPage({...page,markdown:'Vendor information\n**Date**: 2026-11-14\n**City**: Fairfield\n**Venue**: Downtown plaza\nExpected attendance: 500 visitors\nTypical audience: Families and local shoppers'});
 assert.equal(event.date,'2026-11-14');assert.equal(event.city,'Fairfield');assert.equal(event.venue,'Downtown plaza');assert.equal(event.audienceSize,'500 visitors');assert.equal(event.audience,'Families and local shoppers');assert.equal(event.evidence.date,'**Date**: 2026-11-14');
 assert.equal(extractPage({...page,markdown:'Vendor information\nEvent date: 2026-02-30\nApplication deadline: 2026-02-30'}).date,null);
 assert.equal(extractPage({...page,markdown:'Vendor information\nLast updated date: 2026-11-14'}).date,null);
});

test('server restart loads the latest completed discovery without starting paid work',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-cache-`),cacheDir=pathToFileURL(`${dir}/`);
 try {
  await writeFile(new URL('broken.json',cacheDir),'invalid');
  await writeFile(new URL('search.search.json',cacheDir),JSON.stringify({search:{items:[]}}));
  await writeFile(new URL('completed.json',cacheDir),JSON.stringify({queries:['query'],events:[],runs:[],retrievedAt:'2026-10-24T12:00:00Z'}));
  const result=await loadLatestDiscovery(cacheDir);assert.equal(result.cached,true);assert.deepEqual(result.queries,['query']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('published vendor and rental fees remain separate and source descriptions are preserved',()=>{
 const event=extractPage({...page,metadata:{title:'A market',description:'A seasonal market for local makers.'},markdown:'Vendor fee: $50\nSpace rental: $25\nWe welcome food vendors'});
 assert.equal(event.vendorFee,50);assert.equal(event.spaceFee,25);assert.equal(event.feeIncludesSpace,true);assert.equal(event.description,'A seasonal market for local makers.');assert.equal(event.evidence.spaceFee,'Space rental: $25');
});
test('application deadlines in source metadata close stale listings; image markdown is not a summary',()=>{
 const stale=extractPage({...page,metadata:{title:'Vendor application',description:'Deadline: April 03, 2025 - Food Vendor Application'},markdown:'Vendor application requirements'},'2026-10-24T00:00:00Z');
 assert.equal(stale.deadline,'2025-04-03');assert.equal(stale.status,'Closed');
 const summary=extractPage({...page,metadata:{title:'Market'},markdown:'![market image](https://example.com/market.png)\nVendor applications are open for the seasonal market that brings local makers and neighbors together.'});
 assert.ok(summary.description.startsWith('Vendor applications'));
});
test('shortlisting skips source-located distant organizers before consuming crawl slots',()=>{
 const results=[{url:'https://www.fairfaxcounty.gov/parks/farmersmarkets',title:'Market vendor applications',description:'Fairfax County, Virginia vendor opportunities'},{url:'https://foodaccessla.org/vendors',title:'Food vendors application',description:'Our markets serve Los Angeles vendors.'},{url:'https://www.fairfield.ca.gov/news/market',title:'Fairfield market vendor applications'}];
 const selected=shortlist([{organicResults:results}],{profile:{...defaultProfile,radius:30}});
 assert.equal(selected.length,1);assert.equal(selected[0].url,results[2].url);
});
test('changing radius reuses the search stage but does not reuse a differently scoped crawl',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/gather-scope-`),cacheDir=pathToFileURL(`${dir}/`);let searches=0,crawls=0;
 const fetchImpl=async(url)=>{
  let data;
  if(url.includes('/acts/apify~google')){searches++;data={data:{id:'search',status:'SUCCEEDED',defaultDatasetId:'search-data'}};}
  else if(url.includes('/acts/')){crawls++;data={data:{id:'crawl',status:'SUCCEEDED',defaultDatasetId:'crawl-data'}};}
  else data=url.includes('search-data')?[{organicResults:[{url:page.url,title:'Vendor application market'}]}]:[page];
  return {ok:true,json:async()=>data};
 };
 try{const discover=createDiscovery({token:'token',fetchImpl,cacheDir});await discover(defaultProfile,true);await discover({...defaultProfile,radius:20},true);assert.equal(searches,1);assert.equal(crawls,2);}
 finally{await rm(dir,{recursive:true,force:true});}
});
