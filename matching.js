import {distanceMiles,geographicStatus} from './locations.js';
export function today() {
 const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function applicationStatus(event,on=today()) {
 if (validDate(event.endDate || event.date) && (event.endDate || event.date)<on) return 'Past';
 if (event.status==='Closed' || validDate(event.deadline) && event.deadline<on) return 'Closed';
 return event.status==='Open'?'Open':'Unknown';
}
export function totalFee(event) {
 if (Number.isFinite(event.vendorFee) && Number.isFinite(event.spaceFee)) return event.vendorFee+event.spaceFee;
 return Number.isFinite(event.fee) ? event.fee : null;
}
const stopWords=new Set('the and for with that this your our are from into local business small nonprofit club vendors event community people'.split(' '));
function words(text) {return [...new Set(String(text || '').toLowerCase().match(/[a-z]{3,}/g) || [])].filter(w=>!stopWords.has(w));}
export function interestMatch(event,profile) {
 const wanted=words(`${profile.interests || ''} ${profile.targetAudience || ''}`);
 const available=new Set(words(`${event.interests || ''} ${event.audience || ''} ${event.description || ''} ${event.needs || ''}`));
 return wanted.filter(w=>available.has(w)).slice(0,8);
}
export function evaluate(event, profile, on=today()) {
 const reasons=[],issues=[],distance=distanceMiles(event,profile),fee=totalFee(event),status=applicationStatus(event,on);
 const excluded=(event.excludedCategories || []).includes(profile.category);
 const conditional=(event.conditionalCategories || []).includes(profile.category);
 const category=(event.categories || []).includes(profile.category)&&!excluded&&!conditional;
 const categoryState=excluded?'excluded':conditional?'conditional':category?'accepted':'unknown';
 const geography=geographicStatus(event,profile);
 const organizationType=profile.organizationType || 'Small business';
 const organization=Array.isArray(event.organizationTypes) ? event.organizationTypes.includes(organizationType) : null;
 let score=0;
 if(category){reasons.push(`Welcomes ${profile.category.toLowerCase()} vendors`);score+=35;}else issues.push(excluded?'Your offering category is explicitly excluded':conditional?'Your offering category has conditions; confirm eligibility':'Your offering category is not confirmed');
 if(organization===true){reasons.push(`Welcomes ${organizationType.toLowerCase()} organizations`);score+=10;}else issues.push(organization===false?'Your organization type is not listed':'Organization eligibility needs confirmation');
 if(distance===null) issues.push('Travel distance needs confirmation');
 else if(geography==='unknown') issues.push('City inferred from listing title; confirm the event location');
 else if(distance<=Number(profile.radius)){reasons.push(`About ${distance.toFixed(1)} miles away · within your radius`);score+=25;}else issues.push('Outside your travel radius');
 if(fee===null) issues.push('Vendor fee needs confirmation');
 else if(fee<=Number(profile.budget)){reasons.push(`$${fee} published fee · within your budget`);score+=20;}else issues.push('Vendor fee exceeds your budget');
 if(event.live && !event.feeIncludesSpace && !Number.isFinite(event.spaceFee)) issues.push('Space rental or additional charges need confirmation');
 if(status==='Unknown') issues.push('Application availability needs confirmation');
 if(status==='Closed') issues.push('Applications are closed');
 if(status==='Past') issues.push('This event has already ended');
 const interests=interestMatch(event,profile);
 if(interests.length){score+=10;reasons.push(`Shared interests or audience: ${interests.join(', ')}`);}
 const eligible=status==='Open' && category && geography==='inside' && organization!==false && distance!==null && distance<=Number(profile.radius) && (fee===null || fee<=Number(profile.budget));
 const uncertain=organization===null || fee===null || event.live && !event.feeIncludesSpace && !Number.isFinite(event.spaceFee);
 const blocked=excluded||organization===false||geography==='outside'||fee!==null&&fee>Number(profile.budget)||['Closed','Past'].includes(status);
 return {reasons,issues,eligible,distance,fee,status,score,interests,categoryState,geography,blocked,label:!eligible?(blocked?'Outside your brief':'Needs review'):uncertain?(fee===null?'Needs a fee check':'Needs review'):'Strong fit'};
}
export function sortEvents(events,profile,sort='recommended',on=today()) {
 const optional=(a,b)=>a==null?b==null?0:1:b==null?-1:a<b?-1:a>b?1:0;
 return [...events].sort((a,b)=>{
  const am=evaluate(a,profile,on),bm=evaluate(b,profile,on);
  if(sort==='distance')return optional(am.distance,bm.distance)||a.name.localeCompare(b.name);
  if(sort==='date' || sort==='deadline')return optional(validDate(a[sort])?a[sort]:null,validDate(b[sort])?b[sort]:null)||a.name.localeCompare(b.name);
  if(sort==='fee')return optional(totalFee(a),totalFee(b))||a.name.localeCompare(b.name);
  return Number(bm.eligible)-Number(am.eligible)||bm.score-am.score||optional(a.date,b.date)||a.name.localeCompare(b.name);
 });
}
export function createDraft(event,profile) {
 return `Subject: Vendor inquiry — ${event.name}\n\nHello ${event.name} team,\n\nI’m reaching out from ${profile.name}, a ${(profile.organizationType || 'Small business').toLowerCase()}. ${profile.description}\n\nWe’re interested in joining your event in ${event.city || 'your community'}. ${profile.targetAudience?`We hope to connect with ${profile.targetAudience}. `:''}\n\nCould you confirm whether applications are still open, ${totalFee(event)===null?'the vendor fee and space rental charges, ':''}and what documentation and setup details you need from us?\n\nThank you,\n${profile.name}`;
}
