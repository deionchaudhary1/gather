import {validDate} from './matching.js';
export const applicationStages=['Interested','Preparing','Applied','Accepted','Not attending'];
export function checklistFor(event) {
 return [
  {id:'verify',text:'Confirm dates, full fees, and application availability with the organizer'},
  {id:'apply',text:'Complete the organizer’s application and record your confirmation'},
  ...(event.requirements || []).map((text,index)=>({id:`requirement-${index}-${hash(text)}`,text,source:true})),
  {id:'documents',text:'Pack the permits, insurance, and documents requested by the organizer'},
  {id:'setup',text:'Plan transport, setup time, table, canopy, and power needs'},
  {id:'outreach',text:'Bring signage, contact details, and a way for visitors to follow up'},
 ];
}
function hash(text){let result=0;for(const char of text)result=((result<<5)-result+char.charCodeAt(0))|0;return (result>>>0).toString(36);}
export function applicationPacket(event,profile,note='') {
 return `APPLICATION PREPARATION — NOT SUBMITTED\n\nEvent: ${event.name}\nSource: ${event.sourceUrl || 'Gather vendor catalog'}\nApplication: ${event.applicationUrl || 'Confirm application details with the organizer'}\nDeadline: ${event.deadline || 'Unknown'}\n\nOrganization: ${profile.name}\nType: ${profile.organizationType || 'Small business'}\nOffering: ${profile.category}\nDescription: ${profile.description}\nTarget audience: ${profile.targetAudience || 'Not specified'}\nInterests: ${profile.interests || 'Not specified'}\nYears operating: ${profile.yearsOperating === '' || profile.yearsOperating == null ? 'Not specified' : profile.yearsOperating}\n\nOrganizer requirements:\n${(event.requirements || []).map(r=>`- ${r}`).join('\n') || 'Confirm with organizer.'}\n\nPreparation notes:\n${note}\n\nCopy these materials into the organizer’s own form. This document does not submit an application.`;
}
const icsEscape=value=>String(value || '').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const compact=date=>date.replaceAll('-','');
function nextDay(date){const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);return next.toISOString().slice(0,10);}
export function calendarExport(events,{deadlines=true}={}) {
 const entries=[];
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 for(const event of events){
  const add=(date,title,suffix,end)=>{
   if(!validDate(date))return;
   entries.push('BEGIN:VEVENT',`UID:${encodeURIComponent(event.id)}-${suffix}@gather.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${compact(date)}`,`DTEND;VALUE=DATE:${compact(nextDay(validDate(end)&&end>=date?end:date))}`,`SUMMARY:${icsEscape(title)}`,`LOCATION:${icsEscape(event.venue || event.city || 'Location to be confirmed')}`,`DESCRIPTION:${icsEscape(`${event.live?'Public source — confirm details':'Gather vendor catalog'}\n${event.sourceUrl || ''}\n${event.description || ''}`)}`,'END:VEVENT');
  };
  add(event.date,event.name,'event',event.endDate);
  if(deadlines)add(event.deadline,`Apply by: ${event.name}`,'deadline');
 }
 return {count:entries.filter(l=>l==='BEGIN:VEVENT').length,text:['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Gather//Saved opportunities//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',...entries,'END:VCALENDAR',''].map(foldLine).join('\r\n')};
}
export function monthDays(month) {
 if(!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`))return [];
 const first=new Date(`${month}-01T12:00:00`),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 return [...Array(first.getDay()).fill(null),...Array.from({length:days},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}

function foldLine(line) {
 const encoder=new TextEncoder();let result='',part='',bytes=0;
 for(const character of line){const length=encoder.encode(character).length;if(bytes+length>75){result+=part+'\r\n';part=' ';bytes=1;}part+=character;bytes+=length;}
 return result+part;
}
