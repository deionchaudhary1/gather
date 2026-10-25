import { createHash } from 'node:crypto';
import {validDate} from './matching.js';
import {cities} from './locations.js';
import {extractCategories,normalizeOpportunity,sourceOutsideRadius,factsVersion} from './opportunity-facts.js';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
export const testQueries = ['Bay Area holiday market vendor applications 2026','Oakland market "vendor application" November 2026','Berkeley holiday fair "call for vendors"'];
export function queriesFor(profile, pilot = false) {
 if (pilot) return testQueries;
 const year = new Date().getFullYear();
 const category = String(profile.category || 'small business').slice(0,80);
 const city=Object.keys(cities).includes(profile.baseCity)?profile.baseCity:'Berkeley';
 const organization=['Nonprofit','Club'].includes(profile.organizationType)?profile.organizationType.toLowerCase():'small business';
 return [`${city} California ${category} farmers market vendor applications ${year}`,`${city} California ${category} festival "vendor application" ${year}`,`${city} California ${organization} ${category} "call for vendors" ${year}`];
}
export function safeUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } }
export function shortlist(items,{profile}={}) {
 const candidates = new Map();
 for (const item of items) for (const result of item.organicResults || []) {
  const url = safeUrl(result.url); if (!url) continue;
  if(profile && sourceOutsideRadius(result,{...profile,radius:Number.isFinite(Number(profile.radius))?Number(profile.radius):30}))continue;
  const u = new URL(url); u.hash = '';
  if (/(^|\.)(facebook\.com|instagram\.com|youtube\.com|google\.com|yelp\.com|reddit\.com)$/.test(u.hostname)) continue;
  const text = `${result.title || ''} ${result.description || ''} ${u.pathname}`;
  const score = (/vendor|exhibitor|maker/i.test(text)?4:0)+(/application|apply|call for/i.test(text)?4:0)+(/market|fair|festival/i.test(text)?2:0);
  if (score >= 6 && !candidates.has(u.href)) candidates.set(u.href,{url:u.href,title:result.title || u.hostname,score});
 }
 return [...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,5);
}
export function extractPage(page, retrievedAt = new Date().toISOString()) {
 const sourceUrl = safeUrl(page.url); const text = String(page.markdown || page.text || '').slice(0,200000);
 if (!sourceUrl || !/vendor|exhibitor|call for makers/i.test(text)) return null;
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
 return normalizeOpportunity({id:`live-${createHash('sha256').update(sourceUrl).digest('hex').slice(0,16)}`,name:String(page.metadata?.title || page.title || new URL(sourceUrl).hostname).slice(0,200),kind:'Unknown',city,venue,audienceSize,distance:null,date:eventDate,deadline,vendorFee,spaceFee,feeIncludesSpace,fee:amount && !/\$[\d.]+\s*(?:[-–]|to)|starting|from|per day|per foot/i.test(feeLine)?Number(amount[1]):null,...categoryFacts,status:closed || (deadline && deadline < retrievedAt.slice(0,10))?'Closed':'Unknown',audience,description,needs:vendorLine?.slice(0,1200) || 'Accepted vendor types need confirmation.',requirements,color:'sage',art:'market',sourceUrl,applicationUrl,retrievedAt,evidence,live:true,factsVersion});
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
 return async function discover(profile={},pilot=false,{onProgress=()=>{}}={}) {
  const started=performance.now(),timings={searchMs:0,crawlMs:0,extractionMs:0};
  const progress=(stage,message,extra={})=>onProgress({stage,message,...extra});
  progress('cache','Checking for saved search results.');
  const queries=queriesFor(profile,pilot),searchKey=createHash('sha256').update(JSON.stringify(queries)).digest('hex');
  const key=createHash('sha256').update(JSON.stringify({queries,origin:profile.baseCity||'Berkeley',radius:Number.isFinite(Number(profile.radius))?Number(profile.radius):30})).digest('hex');
  const file=new URL(`${key}.json`,cacheDir);
  try {const cached=JSON.parse(await readFile(file,'utf8'));if(Date.now()-Date.parse(cached.retrievedAt)<86400000)return {...cached,events:cached.events.map(normalizeOpportunity),cached:true};}catch{}
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
   search=await run('apify/google-search-scraper',{queries:queries.join('\n'),maxPagesPerQuery:1,resultsPerPage:10,aiOverview:{scrapeFullAiOverview:false},aiModeSearch:{enableAiMode:false},geminiSearch:{enableGemini:false},perplexitySearch:{enablePerplexity:false},chatGptSearch:{enableChatGpt:false},copilotSearch:{enableCopilot:false},maximumLeadsEnrichmentRecords:0,verifyLeadsEnrichmentEmails:false,websiteContentScraper:{enable:false},focusOnPaidAds:false},run=>progress('search',run.status==='READY'?'Waiting for Apify to start the Google searches.':'Searching Google for organizer and vendor application pages.',{runStatus:run.status}));
   timings.searchMs=performance.now()-searchStarted;
   await mkdir(cacheDir,{recursive:true});await writeFile(searchFile,JSON.stringify({retrievedAt:new Date().toISOString(),search}));
   }
   progress('shortlist','Selecting relevant organizer and application pages.');
   const selected=shortlist(search.items,{profile});const runs=[search.run];let pages=[];
   if(selected.length){
    const crawlMessage=`Reading up to ten pages from ${selected.length} selected sources.`;
    progress('crawl',crawlMessage);
    const crawlStarted=performance.now();
    const crawl=await run('apify/website-content-crawler',{crawlerType,startUrls:selected.map(({url})=>({url})),maxCrawlPages:10,maxCrawlDepth:1,maxConcurrency:2,useSitemaps:false,useLlmsTxt:false,respectRobotsTxtFile:true,saveMarkdown:true,saveHtml:false,saveScreenshots:false},run=>progress('crawl',run.status==='READY'?'Waiting for Apify to start reading the selected pages.':crawlMessage,{runStatus:run.status}));
    timings.crawlMs=performance.now()-crawlStarted;pages=crawl.items;runs.push(crawl.run);
   }
   progress('extract',`Checking dates, fees, and vendor requirements from ${pages.length} pages locally.`);
   const extractionStarted=performance.now();
   const retrievedAt=new Date().toISOString();const records=pages.map(p=>extractPage(p,retrievedAt)).filter(Boolean);
   timings.extractionMs=performance.now()-extractionStarted;timings.totalMs=performance.now()-started;
   const result={queries,selected,runs,retrievedAt,timings,events:[...new Map(records.map(e=>[e.sourceUrl,e])).values()],pagesRead:pages.length,cached:false};
   await mkdir(cacheDir,{recursive:true});await writeFile(new URL(`${key}.pages.json`,cacheDir),JSON.stringify({retrievedAt,pages}));await writeFile(file,JSON.stringify(result));return result;
  } finally {active=false;}
 };
}

export async function loadLatestDiscovery(cacheDir=new URL('./.cache/',import.meta.url)) {
 try {
  const files=(await readdir(cacheDir)).filter(name=>name.endsWith('.json') && !name.endsWith('.search.json'));
  const results=await Promise.all(files.map(async name=>{try{const result=JSON.parse(await readFile(new URL(name,cacheDir),'utf8'));return Array.isArray(result.events)&&Array.isArray(result.runs)&&Array.isArray(result.queries)&&Number.isFinite(Date.parse(result.retrievedAt))?result:null;}catch{return null;}}));
  const latest=results.filter(Boolean).sort((a,b)=>Date.parse(b.retrievedAt)-Date.parse(a.retrievedAt))[0];
  return latest ? {...latest,events:latest.events.map(normalizeOpportunity),cached:true} : null;
 }catch{return null;}
}
