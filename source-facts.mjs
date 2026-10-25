// Source-backed event facts. No model guesses, current-year assumptions, or search-query geocoding.
import {validDate} from './matching.js';
import {cities} from './locations.js';
import {inferLocation,outsideRegionEvidence} from './opportunity-facts.js';
export const extractionVersion=9;
export const cleanLine=value=>String(value||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').replace(/^\s*#+\s*/,'').replace(/^\s*[-*•]\s*/,'').replace(/&amp;/g,'&').trim();
export const eventBody=markdown=>String(markdown||'').split(/(?:^|\n)#{1,3}\s+(?:More (?:pop-ups|events)|Related events|You (?:may|might) also|Other events)/i)[0];
const monthNames='January February March April May June July August September October November December'.split(' ');
const monthPattern='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const datePattern=new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:[–—&+-]|and|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?,?\\s+(20\\d{2})\\b`,'ig');
const iso=(year,month,day)=>{const value=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return validDate(value)?value:null;};
export function datesIn(value,explicitYear=null){
 const text=cleanLine(value),matches=[];
 for(const match of text.matchAll(datePattern)){
  const month=monthNames.findIndex(name=>name.slice(0,3).toLowerCase()===match[1].slice(0,3).toLowerCase())+1;
  const date=iso(match[4],month,match[2]),endDate=match[3]?iso(match[4],month,match[3]):null;
  if(date&&(!match[3]||endDate&&endDate>=date))matches.push({date,endDate: endDate||date,quote:match[0]});
 }
 if(!matches.length && explicitYear){
  const yearless=new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:[–—&+-]|and|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?!\\d)\\b`,'ig');
  for(const match of text.matchAll(yearless)){
   const month=monthNames.findIndex(name=>name.slice(0,3).toLowerCase()===match[1].slice(0,3).toLowerCase())+1;
   const date=iso(explicitYear,month,match[2]),endDate=match[3]?iso(explicitYear,month,match[3]):null;
   if(date&&(!match[3]||endDate&&endDate>=date))matches.push({date,endDate:endDate||date,quote:match[0]});
  }
 }
 return matches;
}
export function structuredEvents(page){
 const result=[];
 function visit(value){
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(!value||typeof value!=='object')return;
  const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
  if(types.some(type=>/^(?:Event|Festival|FoodEvent|BusinessEvent|SocialEvent|SaleEvent|ExhibitionEvent)$/.test(type||''))){result.push(value);return;}
  if(value['@graph'])visit(value['@graph']);if(value.itemListElement)visit(value.itemListElement);if(value.item)visit(value.item);
 }
 let data=page.metadata?.jsonLd||page.jsonLd;
 if(typeof data==='string'){try{data=JSON.parse(data);}catch{data=null;}}
 visit(data);return result;
}
export function sourceFacts(page,{structured=null,retrievedAt=new Date().toISOString()}={}){
 const title=cleanLine(structured?.name||page.metadata?.title||page.title||'');
 const markdown=String(page.markdown||page.text||'');
 const openGraph=(page.metadata?.openGraph||[]).filter(item=>item.property==='og:description').map(item=>item.content);
 const mainText=eventBody(markdown);
 const lines=[...mainText.split(/\n+/),page.metadata?.description,...openGraph].filter(Boolean).map(cleanLine).filter(Boolean);
 const evidence={},facts={kind:/festival/i.test(title)?'Festival':/pop.?up/i.test(title)?'Pop-up':/market|fair|show|expo|bazaar/i.test(title)?'Market':'Community',extractionVersion,...(structured?.name?{name:cleanLine(structured.name).slice(0,200)}:{})};
 const relevant=lines.slice(0,90);
 const locationLines=[...relevant,...lines.filter(line=>/\b(?:takes place|event location|venue|address|located|held at|Street|St\.|Road|Avenue)\b/i.test(line))];
 const sourceText=locationLines.join('\n');
 facts.locationText=sourceText.slice(0,12000);
 const out=outsideRegionEvidence([title,sourceText].join('\n'),page.url);
 const location=structured?.location;
 const address=location?.address;
 const locality=typeof address==='object'?address.addressLocality:null;
 const region=typeof address==='object'?address.addressRegion:null;
 const country=typeof address==='object'?address.addressCountry:null;
 if(locality){
  const city=Object.keys(cities).find(name=>name.toLowerCase()===String(locality).toLowerCase());
  const inCA=!region||/^(?:CA|California)$/i.test(region);
  if(city&&inCA&&(!country||/^(?:US|USA|United States)$/i.test(typeof country==='object'?country.name:country))){
   facts.city=city;facts.venue=location.name||address.streetAddress||city;facts.address=[address.streetAddress,city,region,address.postalCode].filter(Boolean).join(', ');evidence.city=JSON.stringify(address);evidence.venue=JSON.stringify(location);
  }else{facts.region='outside-bay-area';facts.locationQuality='outside';facts.locationEvidence=JSON.stringify(address);}
 }
 if(!facts.city&&!facts.region){
  const explicit=relevant.find(line=>/^(?:location|venue|address)\s*:/i.test(line))||relevant.find(line=>/^city\s*:/i.test(line));
  const street=relevant.find(line=>/\b\d{1,5}\s+[A-Za-z][^\n]{0,90}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Blvd|Boulevard|Drive|Dr\.)/i.test(line));
  const inferred=inferLocation({name:title,locationText:sourceText,description:page.metadata?.description,venue:explicit||street,sourceUrl:page.url});
  if(inferred.locationQuality==='unknown'&&street){
   const intro=relevant.slice(0,15).join('\n');
   const cityNames=Object.keys(cities).filter(city=>intro.includes(city));
   if(cityNames.length===1 && /proud to host|takes place|held at|here in|Recreation and Parks/i.test(intro)){
    inferred.city=cityNames[0];inferred.region='bay-area';inferred.locationQuality='source';inferred.locationEvidence=`${street}\n${relevant.slice(0,15).find(line=>line.includes(cityNames[0]))}`;
   }
  }
  if(inferred.locationQuality==='source'&&street&&!inferred.locationEvidence?.includes(street))inferred.locationEvidence=`${street}\n${inferred.locationEvidence}`;
  Object.assign(facts,inferred);
  if(inferred.locationQuality==='source'){
   evidence.city=inferred.locationEvidence;
   facts.venue=explicit?.replace(/^(?:city|location|venue|address)\s*:\s*/i,'')||street?.slice(0,250)||inferred.city;
   evidence.venue=explicit||street||inferred.locationEvidence;
  }
 }
 if(out&&!locality){facts.city=null;facts.coordinates=null;facts.region='outside-bay-area';facts.locationQuality='outside';facts.locationEvidence=out;}
 let date=null,endDate=null,dateEvidence=null;
 if(structured?.startDate){
  const start=String(structured.startDate).slice(0,10),end=String(structured.endDate||'').slice(0,10);
  if(validDate(start)&&(!validDate(end)||Date.parse(end)-Date.parse(start)<=60*86400000)){date=start;endDate=validDate(end)&&end>=start?end:start;dateEvidence=`Event startDate: ${structured.startDate}${structured.endDate?`; endDate: ${structured.endDate}`:''}`;}
 }
 const titleYears=[...new Set(title.match(/\b20\d{2}\b/g)||[])];
 const headingYear=relevant.slice(0,10).filter(line=>/^20\d{2}$/.test(line));
 const explicitYear=titleYears.length===1?titleYears[0]:headingYear.length===1?headingYear[0]:null;
 const deadlineLine=/\b(?:application deadline|deadline|apply by|applications? (?:are )?(?:due|close|closes|must be received|open until)|must be received by|applications? must be received by)\b/i;
 const notEvent=/\b(?:applications?|deadline|apply by|received by|contract|last updated|date (?:published|modified)|next class|next workshop|refund|copyright)\b/i;
 let candidates=[];
 for(let index=0;index<relevant.length;index++){
  const line=relevant[index];
  if(deadlineLine.test(line)){
   const dates=datesIn(line,explicitYear);const isoDate=line.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
   const found=dates[0]?.date||(validDate(isoDate)?isoDate:null);
   if(found&&!facts.deadline){facts.deadline=found;evidence.deadline=line;}
   continue;
  }
  if(notEvent.test(line))continue;
  const dates=datesIn(line,explicitYear);
  const isoDate=/^(?:event date|market date|festival date|date|when)\s*:/i.test(line)?line.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0]:null;
  if(validDate(isoDate))dates.push({date:isoDate,endDate:isoDate});
  const rank=/^(?:event dates?|market date|festival date|dates?|when)\s*:/i.test(line)?4:/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)|^(?:January|February|March|April|May|June|July|August|September|October|November|December|Dec\b|Nov\b)/i.test(line)?3:/\b(?:event|fair|market|festival).{0,100}\b(?:on|takes place|held)\b/i.test(line)?2:index<15?1:0;
  for(const item of dates)if(rank)candidates.push({...item,rank,evidence:line});
 }
 if(!date&&candidates.length){
  const best=Math.max(...candidates.map(item=>item.rank));
  const unique=[...new Map(candidates.filter(item=>item.rank===best).map(item=>[`${item.date}/${item.endDate}`,item])).values()];
  if(unique.length===1){({date,endDate}=unique[0]);dateEvidence=unique[0].evidence;}
  else{facts.dateConflict=true;evidence.date='Multiple event dates on this page; open the source to choose the correct event.';}
 }
 if(date){facts.date=date;facts.endDate=endDate;evidence.date=dateEvidence;facts.dateQuality='source';}
 else{facts.date=null;facts.endDate=null;facts.dateQuality=facts.dateConflict?'conflict':'unknown';}
 const timeLine=dateEvidence&&relevant.find(line=>line===dateEvidence&&/\d\s*(?:am|pm)/i.test(line))||relevant.find(line=>/^(?:time|hours|sat\b|sun\b)/i.test(line)&&/\d\s*(?:am|pm)\b/i.test(line));
 const time=timeLine?.match(/\b(?:Sat\s+|Sun\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*\/\s*Sun\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?/i)?.[0];
 if(time){facts.timeText=time;evidence.time=timeLine;}
 else if(structured?.startDate?.includes('T')){facts.timeText=`${structured.startDate}${structured.endDate?` to ${structured.endDate}`:''}`;evidence.time=dateEvidence;}
 const feeLine=relevant.find(line=>/\b(?:vendor|booth|stall|participation)\s+fees?\s*:\s*\$/i.test(line));
 if(feeLine&&!/\$[\d.]+\s*[-–]|starting|from|per foot/i.test(feeLine)){
  const amount=feeLine.match(/fees?\s*:\s*\$(\d+(?:\.\d{1,2})?)(?![\d,.])/i);
  if(amount){facts.fee=Number(amount[1]);evidence.fee=feeLine;}
 }
 const openingLine=relevant.find(line=>/applications? opens?\b/i.test(line));
 const opening=openingLine?datesIn(openingLine)[0]?.date:null;
 if(opening&&facts.deadline&&opening<=retrievedAt.slice(0,10)&&facts.deadline>=retrievedAt.slice(0,10)){facts.status='Open';evidence.status=`Published application window: ${openingLine}; ${evidence.deadline}`;}
 const statusLine=relevant.find(line=>/\b(?:vendor )?applications? (?:are )?(?:open|closed)\b|accepting (?:vendor )?applications|apply now/i.test(line));
 if(structured?.eventStatus&&/EventCancelled|EventPostponed/i.test(structured.eventStatus)){facts.status='Closed';evidence.status=String(structured.eventStatus);}
 if(statusLine&&!facts.status){facts.status=/closed/i.test(statusLine)?'Closed':'Open';evidence.status=statusLine;}
 for(const [key,value] of Object.entries(evidence)){const raw=mainText.split(/\n+/).find(line=>cleanLine(line)===value);if(raw)evidence[key]=raw.trim();}
 const summary=relevant.find(line=>line.length>=100&&line.length<=2000&&/\b(?:event|fair|market|festival)\b/i.test(line)&&!/application|contract|please submit|privacy|cookie/i.test(line));
 if(summary){facts.description=summary.length>320?summary.slice(0,317).replace(/\s+\S*$/,'')+'…':summary;evidence.description=summary.slice(0,1200);}
 facts.evidence=evidence;
 return facts;
}
