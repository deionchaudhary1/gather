import {organizerFallbacks} from './organizer-sources.mjs';
import {discoveryScope,scopeKey,matchesScope,discoveryFresh} from './discovery-scope.js';
export {discoveryScope,scopeKey,matchesScope,discoveryFresh} from './discovery-scope.js';
import {sourceFacts,structuredEvents,extractionVersion,eventBody} from './source-facts.mjs';
import { createHash } from 'node:crypto';
import {validDate,applicationStatus} from './matching.js';
import {cities} from './locations.js';
import {extractCategories,normalizeOpportunity,sourceOutsideRadius,factsVersion,outsideRegionEvidence} from './opportunity-facts.js';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
export function queriesFor(profile) {
 const year=new Date().getFullYear();
 const city=Object.hasOwn(cities,profile.baseCity)?profile.baseCity:'Berkeley';
 const offering={'Coffee & beverages':'coffee food beverage','Food & bakery':'food bakery','Art & handmade':'handmade craft makers','Retail & gifts':'retail gifts makers','Wellness & services':'wellness community','Community & advocacy':'community nonprofit'}[profile.category]||'small business';
 const organization=['Nonprofit','Club'].includes(profile.organizationType)?profile.organizationType.toLowerCase():'vendor';
 const season=new Date().getMonth()>=8?'holiday':'craft';
 return [`${city} California market vendor applications ${year}`,`${city} California ${offering} fair ${organization} ${year}`,`"San Francisco Bay Area" ${season} market vendor applications ${year}`];
}
export function safeUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } }
export function shortlist(items,{profile,excludeUrls=new Set()}={}) {
 const candidates = new Map();
 for (const item of items) for (const result of item.organicResults || []) {
  const url = safeUrl(result.url); if (!url||excludeUrls.has(url)) continue;
  if(/mobile.vending.permit|business.*licenses|vendor.*directory/i.test(url)||/Mobile Vending Permit|How to (?:start|become)|Business (?:Licenses|Permits)/i.test(result.title||''))continue;
  if(profile && sourceOutsideRadius(result,{...profile,radius:Number.isFinite(Number(profile.radius))?Number(profile.radius):30}))continue;
  const u = new URL(url); u.hash = '';
  for(const key of [...u.searchParams.keys()])if(/^(?:utm_|srsltid|fbclid|gclid)/.test(key))u.searchParams.delete(key);
  if(/eventeny\.com$/.test(u.hostname)&&/^\/events\/[a-z-]+-ca\/?$/.test(u.pathname))continue;
  if (/(^|\.)(facebook\.com|instagram\.com|youtube\.com|google\.com|yelp\.com|reddit\.com)$/.test(u.hostname)) continue;
  const text = `${result.title || ''} ${result.description || ''} ${u.pathname}`;
  const upcoming=/(?:Nov(?:ember)?|Dec(?:ember)?|Jan(?:uary)?)\s+\d|holiday|winter|christmas/i.test(text)?3:0;
  const score = upcoming+(/vendorsmap\.com|canopyseason\.com|eventeny\.com/.test(u.hostname)?-4:2)+(/California|Bay Area|San Francisco|Berkeley|Oakland,? CA/i.test(text)?3:0)+(/vendor|exhibitor|maker/i.test(text)?4:0)+(/application|apply|call for/i.test(text)?4:0)+(/market|fair|festival/i.test(text)?2:0);
  if (score >= 6 && !candidates.has(u.href)) candidates.set(u.href,{url:u.href,title:result.title || u.hostname,description:result.description||'',score});
 }
 return [...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,5);
}
export function extractPage(page, retrievedAt = new Date().toISOString()) {
 const sourceUrl = safeUrl(page.url); const text = eventBody(String(page.markdown || page.text || '').slice(0,200000));
 if (!sourceUrl || !/vendor|exhibitor|call for makers|craft fair|artisan|market|\bfair\b|expo/i.test(text)) return null;
 const lines = [...text.split(/\n+/),String(page.metadata?.description || '')].map(s=>s.trim()).filter(Boolean);
 const evidence = {};
 const plain=line=>line.replace(/\*\*|__/g,'').replace(/^[*#-]+\s*/,'');
 const find = (key,re) => { const line = lines.find(s=>re.test(plain(s))); if(line) evidence[key]=line.slice(0,1200); return line?plain(line):null; };
 const feeLine = find('fee', /(?:vendor|booth|stall)\s+(?:fee|cost|price)\s*[:–-]?\s*\$\d+(?:\.\d{1,2})?(?![\d,.])/i);
 const amount = feeLine?.match(/(?:vendor|booth|stall)\s+(?:fee|cost|price)\s*[:–-]?\s*\$(\d+(?:\.\d{1,2})?)(?![\d,.])/i);
 const rentalLine=find('spaceFee', /(?:space rental|booth rental|stall rental)(?: fee| cost)?\s*[:–-]?\s*\$\d+(?:\.\d{1,2})?(?![\d,.])/i);
 const rentalAmount=rentalLine?.match(/(?:space rental|booth rental|stall rental)(?: fee| cost)?\s*[:–-]?\s*\$(\d+(?:\.\d{1,2})?)(?![\d,.])/i);
 const spaceFee=rentalAmount && !/\$[\d.]+\s*(?:[-–]|to)|starting|from|per day|per foot/i.test(rentalLine)?Number(rentalAmount[1]):null;
 const vendorFee=amount && /vendor\s+(?:fee|cost|price)/i.test(feeLine) && !/\$[\d.]+\s*(?:[-–]|to)|starting|from|per day|per foot/i.test(feeLine)?Number(amount[1]):null;
 const feeIncludesSpace=Number.isFinite(vendorFee)&&Number.isFinite(spaceFee) || Boolean(feeLine && /includes? (?:the )?(?:booth|space|stall)/i.test(feeLine));
 const deadlineLine = find('deadline', /(?:application deadline|^deadline|applications? (?:close|due)|apply by)\s*[:–-]?\s*(?:\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2},? \d{4})/i);
 const dateText = deadlineLine?.match(/(?:application deadline|^deadline|applications? (?:close|due)|apply by)\s*[:–-]?\s*(\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2},? \d{4})/i)?.[1];
 const rawDeadline = dateText && (!/^\d{4}-/.test(dateText) || validDate(dateText)) && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText).toISOString().slice(0,10) : null;
 const deadline = rawDeadline && !Number.isNaN(Date.parse(rawDeadline)) && new Date(rawDeadline).toISOString().slice(0,10)===rawDeadline ? rawDeadline : null;
 const eventDateLine = find('date', /^(?:event date|market date|festival date|date)\s*[:–-]\s*(?:\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2},? \d{4})/i);
 const eventDateText = eventDateLine?.match(/(?:event date|market date|festival date|date)\s*[:–-]\s*(\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2},? \d{4})/i)?.[1];
 const eventDate = eventDateText && (!/^\d{4}-/.test(eventDateText) || validDate(eventDateText)) && !Number.isNaN(Date.parse(eventDateText)) ? new Date(eventDateText).toISOString().slice(0,10) : null;
 const cityLine = find('city', /^(?:city|location)\s*:\s*(Berkeley|Oakland|Alameda|San Francisco|Santa Clara|San Jose|Fairfield|Fremont|Richmond|Walnut Creek)(?:,|$)/i);
 const city = cityLine?.match(/^(?:city|location)\s*:\s*(Berkeley|Oakland|Alameda|San Francisco|Santa Clara|San Jose|Fairfield|Fremont|Richmond|Walnut Creek)(?:,|$)/i)?.[1] || null;
 const venueLine=find('venue', /^(?:venue|address|location)\s*:\s*\S/i);
 const venue=venueLine?.replace(/^(?:venue|address|location)\s*:\s*/i,'').slice(0,250) || null;
 const audienceLine=find('audience', /^(?:audience|typical audience|target audience)\s*:\s*\S/i);
 const audience=audienceLine?.replace(/^(?:audience|typical audience|target audience)\s*:\s*/i,'').slice(0,500) || null;
 const sizeLine=find('audienceSize', /^(?:expected attendance|estimated attendance|audience size)\s*:\s*\S/i);
 const audienceSize=sizeLine?.replace(/^(?:expected attendance|estimated attendance|audience size)\s*:\s*/i,'').slice(0,150) || null;
 const descriptionText=String(page.metadata?.description || page.description || lines.find(line=>line.length>=60 && line.length<=1500 && /market|festival|fair|community event/i.test(line) && !/cookie|privacy|copyright|permit only/i.test(line) && !line.startsWith('#') && !line.startsWith('![') && !line.startsWith('[')) || '');
 if(descriptionText)evidence.description=descriptionText.slice(0,1200);
 const description=descriptionText?(descriptionText.length>320?descriptionText.slice(0,317).replace(/\s+\S*$/,'')+'…':descriptionText):'Discovered vendor opportunity. Review the source and confirm details with the organizer.';
 const categoryFacts=extractCategories(text);
 const categorySources=[...new Set(Object.values(categoryFacts.categoryEvidence).flatMap(group=>Object.values(group).flat()))];
 if(categorySources.length)evidence.categories=categorySources.join('\n').slice(0,5000);
 const vendorLine=Object.values(categoryFacts.categoryEvidence.accepted).flat()[0] || null;
 const requirements = lines.filter(s=>/permit|insurance|canopy|documentation|must provide|required/i.test(s)).slice(0,8).map(s=>s.slice(0,1200));
 const link = [...text.matchAll(/\[([^\]]+)\]\(([^\s)]+)\)/g)].find(m=>/apply|application/i.test(m[1]));
 let applicationUrl = null; try { applicationUrl = link ? safeUrl(new URL(link[2],sourceUrl).href) : null; } catch {}
 const closed = find('status', /applications? (?:are )?closed|no longer accepting applications|all vendor (?:spaces|booths).{0,40}sold out|waitlist (?:is )?(?:currently )?full/i);
 const structured=structuredEvents(page);
 const extra=sourceFacts(page,{structured:structured.length===1?structured[0]:null,retrievedAt});
 const combinedEvidence={...evidence,...extra.evidence};
 delete extra.evidence;
 const finalDeadline=extra.deadline||deadline;
 const searchClosed=/applications?.{0,75}(?:are (?:now )?closed|have closed|sold out)/i.test(page.searchDescription||'');
 if(searchClosed&&!extra.evidence?.status&&extra.status!=='Open')combinedEvidence.status=`Search excerpt (confirm at source): ${page.searchDescription}`;
 const finalStatus=closed||searchClosed&&extra.status!=='Open'||finalDeadline&&finalDeadline<retrievedAt.slice(0,10)?'Closed':extra.status||'Unknown';
 return normalizeOpportunity({id:`live-${createHash('sha256').update(sourceUrl).digest('hex').slice(0,16)}`,name:String(page.metadata?.title || page.title || new URL(sourceUrl).hostname).slice(0,200),kind:'Unknown',city,venue,audienceSize,distance:null,date:eventDate,deadline,vendorFee,spaceFee,feeIncludesSpace,fee:amount && !/\$[\d.]+\s*(?:[-–]|to)|starting|from|per day|per foot/i.test(feeLine)?Number(amount[1]):null,...categoryFacts,status:closed || (deadline && deadline < retrievedAt.slice(0,10))?'Closed':'Unknown',audience,description,needs:vendorLine?.slice(0,1200) || 'Accepted vendor types need confirmation.',requirements,color:'sage',art:'market',sourceUrl,applicationUrl,retrievedAt,...extra,name:extra.name||String(page.metadata?.title||page.title||new URL(sourceUrl).hostname).slice(0,200),deadline:finalDeadline,status:finalStatus,evidence:combinedEvidence,live:true,factsVersion});
}
export function extractPageRecords(page,retrievedAt){
 const structured=structuredEvents(page);
 if(structured.length<2)return [extractPage(page,page.fetchedAt||retrievedAt)].filter(Boolean);
 return structured.slice(0,40).filter(node=>/vendor|exhibitor|artisan|craft|market|festival|faire?\b|bazaar|trade show|fabric show|gift show|expo|pop.?up/i.test(`${node.name||''} ${node.description||''}`)).map(node=>{
  const description=String(node.description||'').replace(/<\/(?:p|div)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ');
  // A directory's other cards must never provide this event's fees, applications, or availability.
  const scoped={...page,markdown:`# ${node.name||'Market opportunity'}\n${description}`,text:description,metadata:{title:node.name||'Market opportunity',description,jsonLd:[node]}};
  const event=extractPage(scoped,page.fetchedAt||retrievedAt);
  return event?{...event,id:`live-${createHash('sha256').update(`${safeUrl(node.url||node['@id'])||page.url}|${event.date||node.startDate}`).digest('hex').slice(0,16)}`,eventUrl:safeUrl(node.url||node['@id']),applicationUrl:null}:null;
 }).filter(Boolean);
}
export function processPages(pages,retrievedAt){
 const records=pages.flatMap(page=>extractPageRecords(page,retrievedAt));
 const unique=new Map();for(const event of records){const previous=unique.get(event.id);if(!previous||Date.parse(event.retrievedAt)>=Date.parse(previous.retrievedAt))unique.set(event.id,event);}
 const events=[...unique.values()];
 const checks=[Date.parse(retrievedAt),...events.map(event=>Date.parse(event.retrievedAt))].filter(Number.isFinite);
 return {events,expiresAt:new Date(Math.min(...checks)+86400000).toISOString(),verification:{pagesRead:pages.length,extracted:events.length,confirmed:events.filter(event=>event.region==='bay-area'&&event.locationQuality==='source'&&event.dateQuality==='source').length,outsideBayArea:events.filter(event=>event.region==='outside-bay-area').length,needsLocation:events.filter(event=>event.region!=='outside-bay-area'&&(event.region!=='bay-area'||event.locationQuality!=='source')).length,needsDate:events.filter(event=>event.region==='bay-area'&&event.dateQuality!=='source').length,blockedPages:pages.filter(page=>/just a moment|one moment, please|verify you are human|access denied/i.test(page.metadata?.title||'')||String(page.markdown||page.text||'').length<100).length}};
}
async function recentSourcePool(cacheDir,profile){
 const regional=new Map(),excludeUrls=new Set(),runs=new Map(),searchDescriptions=new Map();
 try{
  const names=await readdir(cacheDir);
  for(const name of names.filter(name=>name.endsWith('.search.json'))){try{const record=JSON.parse(await readFile(new URL(name,cacheDir),'utf8'));if(Date.now()-Date.parse(record.retrievedAt)<86400000)for(const group of record.search?.items||[])for(const item of group.organicResults||[]){if(item.url&&item.description&&/applications?.{0,75}(?:are (?:now )?closed|have closed|sold out)/i.test(item.description))searchDescriptions.set(item.url,item.description);}}catch{}}
  for(const name of names.filter(name=>name.endsWith('.pages.json'))){
   try{
    const raw=JSON.parse(await readFile(new URL(name,cacheDir),'utf8'));
    if(Date.now()-Date.parse(raw.retrievedAt)>=86400000)continue;
    for(const original of raw.pages||[]){
     const page={...original,searchDescription:original.searchDescription||searchDescriptions.get(original.url)};
     if(Date.now()-Date.parse(page.fetchedAt||raw.retrievedAt)>=86400000)continue;
     const text=[page.metadata?.title,page.markdown||page.text].join('\n');
     if(outsideRegionEvidence(text,page.url)){excludeUrls.add(page.url);continue;}
     const records=extractPageRecords(page,raw.retrievedAt);
     if(records.some(event=>event.region==='bay-area'&&event.locationQuality==='source'&&event.dateQuality==='source'&&!['Closed','Past'].includes(applicationStatus(event)))){
      if(!regional.has(page.url)||Date.parse(raw.retrievedAt)>Date.parse(regional.get(page.url).fetchedAt))regional.set(page.url,{...page,fetchedAt:page.fetchedAt||raw.retrievedAt});
      try{const prior=JSON.parse(await readFile(new URL(name.replace('.pages.json','.json'),cacheDir),'utf8'));for(const run of prior.runs||[])if(run.actor==='apify/website-content-crawler')runs.set(run.id,{...run,reused:true});}catch{}
     }
    }
   }catch{}
  }
 }catch{}
 return {regional:[...regional.values()].slice(0,5),excludeUrls,runs:[...runs.values()],searchDescriptions};
}
async function cachedSourcePages(cacheDir,selected){
 const wanted=new Set(selected.map(item=>item.url)),pages=new Map();
 try{
  const names=(await readdir(cacheDir)).filter(name=>name.endsWith('.pages.json'));
  for(const name of names){
   try{
    const raw=JSON.parse(await readFile(new URL(name,cacheDir),'utf8'));
    if(Date.now()-Date.parse(raw.retrievedAt)>=86400000)continue;
    for(const page of raw.pages||[]){
     if(!wanted.has(page.url)||String(page.markdown||page.text||'').length<100||/just a moment|one moment, please|verify you are human|access denied/i.test(page.metadata?.title||''))continue;
     const fetchedAt=page.fetchedAt||raw.retrievedAt;
     if(Date.now()-Date.parse(fetchedAt)>=86400000)continue;
     if(!pages.has(page.url)||Date.parse(fetchedAt)>Date.parse(pages.get(page.url).fetchedAt))pages.set(page.url,{...page,fetchedAt});
    }
   }catch{}
  }
 }catch{}
 return [...pages.values()];
}
export function createDiscovery({token,fetchImpl=fetch,cacheDir=new URL('./.cache/',import.meta.url),pollMs=2000,crawlerType=process.env.APIFY_CRAWLER_TYPE || 'cheerio'}={}) {
 let active = false;
 async function api(route, options={}) {
  const response = await fetchImpl(`https://api.apify.com/v2/${route}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`Apify request failed (${response.status}). Check your token, account credits, and Actor access.`);
  return response.json();
 }
 async function run(actor,input,onStatus=()=>{}) {
  let {data:run} = await api(`acts/${actor.replace('/','~')}/runs?timeout=180&memory=1024`,{method:'POST',body:JSON.stringify(input)});
  onStatus(run);
  const end = Date.now()+240000;
  while(['READY','RUNNING','TIMING-OUT','ABORTING'].includes(run.status) && Date.now()<end) { await new Promise(r=>setTimeout(r,pollMs)); ({data:run}=await api(`actor-runs/${run.id}`)); onStatus(run); }
  if(run.status!=='SUCCEEDED') throw new Error(`Actor ${run.id} ended with ${run.status}. Inspect it in Apify Console before retrying.`);
  const items = await api(`datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=100`);
  return {items,run:{id:run.id,actor,url:`https://console.apify.com/actors/runs/${run.id}`,usageTotalUsd:run.usageTotalUsd ?? null}};
 }
 return async function discover(profile={},_legacyOption=false,{onProgress=()=>{},force=false}={}) {
  const started=performance.now(),timings={searchMs:0,crawlMs:0,extractionMs:0};
  const progress=(stage,message,extra={})=>onProgress({stage,message,...extra});
  progress('cache','Checking for saved search results.');
  const queries=queriesFor(profile),scope=discoveryScope(profile),searchKey=createHash('sha256').update(JSON.stringify(queries)).digest('hex');
  const key=createHash('sha256').update(JSON.stringify({queries,scope,extractionVersion})).digest('hex');
  const file=new URL(`${key}.json`,cacheDir);
  try {const cached=JSON.parse(await readFile(file,'utf8'));if(!force&&discoveryFresh(cached))return {...cached,events:cached.events.map(normalizeOpportunity),cached:true};}catch{}
  if(!force){const previous=await loadLatestDiscovery(cacheDir,profile);if(previous&&discoveryFresh(previous))return previous;}
  if(!token) throw new Error('Set APIFY_TOKEN on the server to enable live discovery.');
  if(active) throw new Error('Discovery is already running. Wait for it to finish.');
  active=true;
  try {
   const searchFile=new URL(`${searchKey}.search.json`,cacheDir);
   let search;
   try {const cachedSearch=JSON.parse(await readFile(searchFile,'utf8'));if(Date.now()-Date.parse(cachedSearch.retrievedAt)<86400000)search=cachedSearch.search;}catch{}
   if(!search) {
   progress('search','Searching Google for organizer and vendor application pages.');
   const searchStarted=performance.now();
   search=await run('apify/google-search-scraper',{queries:queries.join('\n'),maxPagesPerQuery:1,resultsPerPage:10,countryCode:'us',searchLanguage:'en',aiOverview:{scrapeFullAiOverview:false},aiModeSearch:{enableAiMode:false},geminiSearch:{enableGemini:false},perplexitySearch:{enablePerplexity:false},chatGptSearch:{enableChatGpt:false},copilotSearch:{enableCopilot:false},maximumLeadsEnrichmentRecords:0,verifyLeadsEnrichmentEmails:false,websiteContentScraper:{enable:false},focusOnPaidAds:false},run=>progress('search',run.status==='READY'?'Waiting for Apify to start the Google searches.':'Searching Google for organizer and vendor application pages.',{runStatus:run.status}));
   timings.searchMs=performance.now()-searchStarted;
   await mkdir(cacheDir,{recursive:true});await writeFile(searchFile,JSON.stringify({retrievedAt:new Date().toISOString(),search}));
   }
   progress('shortlist','Selecting relevant organizer and application pages.');
   const pool=await recentSourcePool(cacheDir,profile);
   const searchSelected=shortlist(search.items,{profile:{...profile,radius:500},excludeUrls:pool.excludeUrls});
   const fallbacks=organizerFallbacks(profile,searchSelected);
   const selected=[...searchSelected,...fallbacks];const runs=[search.run];let pages=force?[]:await cachedSourcePages(cacheDir,selected);
   const reusedPages=pages.length,remaining=selected.filter(item=>!pages.some(page=>page.url===item.url));
   if(remaining.length){
    const crawlMessage=`Reading up to ten pages from ${remaining.length} selected sources.`;
    progress('crawl',crawlMessage);
    const crawlStarted=performance.now();
    const crawl=await run('apify/website-content-crawler',{crawlerType,startUrls:remaining.map(({url})=>({url})),maxCrawlPages:10,maxCrawlDepth:0,maxConcurrency:3,excludeUrlGlobs:['**/recipes/**','**/privacy*','**/cart*','**/shop/**','**/product/**'],useSitemaps:false,useLlmsTxt:false,respectRobotsTxtFile:true,saveMarkdown:true,saveHtml:false,saveScreenshots:false},run=>progress('crawl',run.status==='READY'?'Waiting for Apify to start reading the selected pages.':crawlMessage,{runStatus:run.status}));
    timings.crawlMs=performance.now()-crawlStarted;pages=[...pages,...crawl.items];runs.push(crawl.run);
   }
   const regionalPages=pool.regional.filter(page=>!pages.some(current=>current.url===page.url));
   pages=[...pages,...regionalPages].map(page=>({...page,searchDescription:selected.find(item=>item.url===page.url)?.description||page.searchDescription}));
   if(regionalPages.length)for(const run of pool.runs)if(!runs.some(current=>current.id===run.id))runs.push(run);
   progress('extract',`Checking dates, fees, and vendor requirements from ${pages.length} pages locally.`);
   const extractionStarted=performance.now();
   const retrievedAt=new Date().toISOString();const processed=processPages(pages,retrievedAt);
   timings.extractionMs=performance.now()-extractionStarted;timings.totalMs=performance.now()-started;
   const result={scope,extractionVersion,fallbackSources:fallbacks.length,reusedPages:reusedPages+regionalPages.length,regionalSources:regionalPages.length,queries,selected,runs,retrievedAt,timings,...processed,pagesRead:pages.length,cached:false};
   await mkdir(cacheDir,{recursive:true});await writeFile(new URL(`${key}.pages.json`,cacheDir),JSON.stringify({retrievedAt,pages}));await writeFile(file,JSON.stringify(result));return result;
  } finally {active=false;}
 };
}

export async function loadLatestDiscovery(cacheDir=new URL('./.cache/',import.meta.url),profile=null) {
 try {
  const files=(await readdir(cacheDir)).filter(name=>name.endsWith('.json')&&!name.endsWith('.search.json')&&!name.endsWith('.pages.json'));
  const results=await Promise.all(files.map(async name=>{
   try{
    let result=JSON.parse(await readFile(new URL(name,cacheDir),'utf8'));
    if(!Array.isArray(result.events)||!Array.isArray(result.runs)||!Array.isArray(result.queries)||!Number.isFinite(Date.parse(result.retrievedAt))||profile&&!matchesScope(result,profile))return null;
    if(result.extractionVersion!==extractionVersion){
     try{
      const raw=JSON.parse(await readFile(new URL(name.replace(/\.json$/,'.pages.json'),cacheDir),'utf8'));
      const pool=await recentSourcePool(cacheDir,profile||{});
      const regional=pool.regional.filter(page=>!raw.pages.some(current=>current.url===page.url));
      const pages=[...raw.pages,...regional].map(page=>({...page,searchDescription:page.searchDescription||pool.searchDescriptions.get(page.url)}));
      result={...result,...processPages(pages,result.retrievedAt),extractionVersion,regionalSources:regional.length,reusedPages:(result.reusedPages||0)+regional.length};
      if(regional.length)for(const run of pool.runs)if(!result.runs.some(current=>current.id===run.id))result.runs.push(run);
      await writeFile(new URL(name.replace(/\.json$/,'.pages.json'),cacheDir),JSON.stringify({...raw,pages}));
      await writeFile(new URL(name,cacheDir),JSON.stringify(result));
     }catch{if(result.events.length)return null;}
    }
    return result;
   }catch{return null;}
  }));
  const latest=results.filter(Boolean).sort((a,b)=>Date.parse(b.retrievedAt)-Date.parse(a.retrievedAt))[0];
  return latest?{...latest,events:latest.events.map(normalizeOpportunity),cached:true}:null;
 }catch{return null;}
}
