import {cities,destinationCoordinates,distanceMiles} from './locations.js';
export const factsVersion=2;
const categoryPatterns=[
 ['Coffee & beverages',/\b(?:coffee|tea|beverages?|drinks?)\b/i],
 ['Food & bakery',/\b(?:food|bakery|bakeries|bakers?|baked goods|farmers?|produce)\b/i],
 ['Art & handmade',/\b(?:handmade|artists?|artisans?|crafts?|ceramics|pottery|makers?)\b/i],
 ['Retail & gifts',/\b(?:retail|gifts?|household products|refill(?:able)? products)\b/i],
 ['Wellness & services',/\b(?:wellness|services|massages?|tarot)\b/i],
 ['Community & advocacy',/\b(?:nonprofits?|non-profits?|clubs|advocacy|community organizations)\b/i],
];
const clean=text=>String(text||'').replace(/\*\*|__/g,'').replace(/[’‘]/g,"'").replace(/^[*#-]+\s*/,'').trim();
export function extractCategories(text){
 const evidence={accepted:{},excluded:{},conditional:{}};
 const add=(type,category,source)=>{const values=evidence[type][category] ||= [];if(!values.includes(source))values.push(source.slice(0,1200));};
 let listContext=null,contextHeading='';
 for(const raw of String(text||'').split(/\n+/)){
  const line=clean(raw);if(!line)continue;
  if(/^(?:accepted vendors?(?: types?| categories)?|vendor (?:types|categories)|eligible vendors|we (?:accept|welcome))\s*:?$/i.test(line)){listContext='accepted';contextHeading=raw;continue;}
  if(/^(?:not accepted|not accepting|we (?:do not|don't) accept|excluded|prohibited|ineligible)(?: vendors?(?: types?| categories)?)?\s*:?$/i.test(line)){listContext='excluded';contextHeading=raw;continue;}
  const bullet=/^\s*[-*•]\s+/.test(raw);
  if(!bullet)listContext=null;
  const citation=listContext&&bullet?`${contextHeading}\n${raw}`:raw;
  const clauses=line.split(/(?<=[.!?;])\s+|;\s*|\b(?:but|however)\b|\s+(?=except(?: for)?\b)|\band\s+(?=(?:we\s+)?(?:do not|don't|not|cannot|can't|will not|won't|accept|welcome))/i);
  for(const fragment of clauses){
   const clause=fragment.trim();if(!clause)continue;
   const categories=categoryPatterns.filter(([,pattern])=>pattern.test(clause)).map(([category])=>category);
   if(!categories.length)continue;
   const exception=/^except\b/i.test(clause);
   const negativeContext=/\b(?:not|no|don't|cannot|can't)\b/i.test(line.slice(0,line.indexOf(clause)));
   const negative=exception&&!negativeContext || listContext==='excluded'&&bullet || /\b(?:not|no|never|cannot|can't|don't|doesn't|won't|aren't|isn't|prohibited|prohibit|excluded|exclude)\b/i.test(clause);
   const conditional=exception&&negativeContext || /\b(?:exception|only|limited to|at capacity|waitlist|waiting list|full|subject to|case.by.case)\b/i.test(clause);
   const accepting=exception || listContext==='accepted'&&bullet || /\b(?:accept(?:s|ed|ing)?|welcom\w*|seeking|looking for|open to|vendor (?:types|categories)|vendors? include)\b/i.test(clause);
   const inheritedNegative=/^\s*(?:not|no)\b/i.test(clause);
   for(const category of categories){
    if(negative&&(accepting||inheritedNegative||listContext==='excluded'&&bullet||/\bprohibit|\bexclude/i.test(clause)))add('excluded',category,citation);
    else if(conditional&&(accepting||/exception|capacity|waitlist|full/i.test(clause)))add('conditional',category,citation);
    else if(accepting&&!negative)add('accepted',category,citation);
   }
  }
 }
 // Conflicting evidence requires review; broad mentions never erase a restriction.
 const excluded=Object.keys(evidence.excluded);
 const conditional=Object.keys(evidence.conditional);
 for(const category of excluded)if(evidence.accepted[category]&&!conditional.includes(category))conditional.push(category);
 return {categories:Object.keys(evidence.accepted).filter(c=>!excluded.includes(c)&&!conditional.includes(c)),excludedCategories:excluded.filter(c=>!evidence.accepted[c]&&!evidence.conditional[c]),conditionalCategories:conditional,categoryEvidence:evidence};
}
function locationResult(city,quality,evidence){return {city,coordinates:destinationCoordinates(city),locationQuality:quality,locationEvidence:evidence,locationConflict:false,region:Object.hasOwn(cities,city)?'bay-area':'outside-bay-area'};}
export function outsideRegionEvidence(text,url=''){
 let host='';try{host=new URL(url).hostname;}catch{}
 if(/(^|\.)oaklandcountymi\.gov$/.test(host))return 'Source is Oakland County, Michigan, not Oakland, California.';
 if(/Oakland County.{0,40}(?:Michigan|\bMI\b)|Oakland,?\s+(?:Florida|FL)\b|Northwest Orange County|Florida of Yesterday/i.test(text))return 'Source describes Oakland in Michigan or Florida, outside the Bay Area.';
 const otherState=/(?:,\s*(?:AL|AK|AZ|AR|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b)/;
 const namedState=/,\s*(?:Alabama|Alaska|Arizona|Arkansas|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;
 const line=String(text).split('\n').find(line=>/\b(?:location|address|venue|located|takes place|held in)\b/i.test(line)&&(otherState.test(line)||namedState.test(line)));
 return line?.slice(0,1200)||null;
}
export function inferLocation(event){
 if(event.locationQuality && event.locationEvidence && event.factsVersion===factsVersion)return {city:event.city||null,coordinates:event.coordinates||null,locationQuality:event.locationQuality,locationEvidence:event.locationEvidence,locationConflict:event.locationConflict||false,region:event.region||(event.locationQuality==='source'&&Object.hasOwn(cities,event.city)?'bay-area':'unknown')};
 const evidence=event.evidence||{};
 const text=[evidence.city,evidence.venue,event.venue,event.address,event.locationText,event.description,evidence.description].filter(Boolean).join('\n');
 let host='';try{host=new URL(event.sourceUrl||event.url).hostname;}catch{}
 // An explicit event city wins over an organizer's unrelated navigation/footer city.
 if(event.city && !['title','unknown','outside'].includes(event.locationQuality) && destinationCoordinates(event.city))return locationResult(event.city,'source',evidence.city||`Published city: ${event.city}`);
 const outside=outsideRegionEvidence(text,event.sourceUrl||event.url);
 if(outside)return {city:null,coordinates:null,locationQuality:'outside',locationEvidence:outside,region:'outside-bay-area'};
 if(/(^|\.)fairfaxcounty\.gov$/i.test(host)||/Fairfax(?: County)?,?\s+(?:Virginia|VA)\b/i.test(text))return locationResult('Fairfax County','source',/Fairfax[^\n]{0,120}/i.exec(text)?.[0]||`Source host: ${host}`);
 if(/\bLos Angeles\b/i.test(text))return locationResult('Los Angeles','source',text.split('\n').find(line=>/Los Angeles/i.test(line))?.slice(0,1200));
 const matches=[];
 for(const city of Object.keys(cities)){
  const name=city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const labeled=new RegExp(`(?:^|\\n)(?:city|location|venue|address)\\s*:\\s*[^\\n]*\\b${name}\\b`,'i');
  const regional=new RegExp(`\\b${name},?\\s+(?:CA|California)\\b`,'i');
  const street=new RegExp(`(?:\\b\\d{1,5}\\s+[^\\n]{0,100}\\b${name}\\b|\\b${name}\\b[^\\n]{0,100}\\b\\d{1,5}\\s+[^\\n]*(?:street|st\\.|avenue|ave\\.|road|rd\\.|blvd))`,'i');
  const venueCity=new RegExp(`(?:Center|Pavilion|Hall|Fairgrounds|Plaza)[^\\n]{0,100}\\b${name}\\b`,'i');
  const line=text.split('\n').find(line=>labeled.test(clean(line))||regional.test(clean(line))||street.test(clean(line))||venueCity.test(clean(line)));
  if(line)matches.push(locationResult(city,'source',line.slice(0,1200)));
 }
 if(matches.length===1)return matches[0];
 if(matches.length>1)return {city:null,coordinates:null,locationQuality:'unknown',locationConflict:true,locationEvidence:'Multiple possible event locations; confirm the venue.',region:'unknown'};
 if(/(^|\.)fairfield\.ca\.gov$/i.test(host))return locationResult('Fairfield','source',`Source host: ${host}`);
 const title=String(event.name||event.title||'');
 const titles=Object.keys(cities).filter(city=>new RegExp(`\\b${city}\\b`,'i').test(title));
 if(titles.length===1)return {...locationResult(titles[0],'title',`Listing title: ${title}`),region:'unknown'};
 return {city:null,coordinates:null,locationQuality:'unknown',locationEvidence:null,region:'unknown'};
}
export function normalizeOpportunity(event){
 if(!event?.live)return event;
 const sourceText=[event.evidence?.categories,event.evidence?.description,event.needs,event.description].filter(Boolean).join('\n');
 const facts=event.factsVersion===factsVersion&&event.categoryEvidence?{categories:event.categories,excludedCategories:event.excludedCategories,conditionalCategories:event.conditionalCategories,categoryEvidence:event.categoryEvidence}:extractCategories(sourceText);
 const location=inferLocation(event);
 return {...event,...facts,...location,factsVersion,evidence:{...event.evidence,...(location.locationEvidence?{location:location.locationEvidence}:{})}};
}
export function sourceOutsideRadius(result,profile){
 const location=inferLocation({name:result.title,description:result.description,sourceUrl:result.url});
 const distance=distanceMiles(location,profile);
 return location.region==='outside-bay-area' || location.locationQuality==='source' && distance!==null && distance>Number(profile.radius);
}
