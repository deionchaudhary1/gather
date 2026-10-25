import {scopeKey,matchesScope,hasBayAreaLocation,hasConfirmedDate,verificationCounts} from './discovery-scope.js';
import {applicationDestination,directionsUrl,stockPhoto,matchTone} from './opportunity-ui.js';
import {startOnboarding} from './onboarding.js';
import {events as samples,defaultProfile} from './data.js';
import {evaluate,createDraft,sortEvents,today,validDate,applicationStatus,totalFee} from './matching.js';
import {cities,coordinates,locationLabel,geographicStatus,visibleNearby} from './locations.js';
import {applicationStages,checklistFor,applicationPacket,calendarExport,monthDays} from './planning.js';
import {approvedProfiles,initializeProfiles,initializeWorkspaces} from './profiles.js';
import {normalizeOpportunity} from './opportunity-facts.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
const record=value=>value && typeof value==='object' && !Array.isArray(value);
const stored=read('gather-profile',{});
const profileState=initializeProfiles(read('gather-profiles',null),stored,read('gather-active-profile',null));
let profiles=profileState.profiles,profileId=profileState.active,profile=profiles[profileId];
let saved=read('gather-saved',[]);if(!Array.isArray(saved))saved=[];
const draftWorkspaces=initializeWorkspaces(read('gather-drafts-by-profile',null),read('gather-drafts',{}),profileId);
const planWorkspaces=initializeWorkspaces(read('gather-plans-by-profile',null),read('gather-plans',{}),profileId);
let drafts=draftWorkspaces[profileId] ||= {},plans=planWorkspaces[profileId] ||= {};
function normalizeEvent(e){
 if(!record(e) || typeof e.id!=='string' || typeof e.name!=='string')return null;
 return normalizeOpportunity({...e,live:true,categories:Array.isArray(e.categories)?e.categories:[],requirements:Array.isArray(e.requirements)?e.requirements:[],evidence:record(e.evidence)?e.evidence:{},needs:e.needs || 'Confirm accepted vendor types with the organizer.'});
}
let liveEvents=(Array.isArray(read('gather-live-events',[]))?read('gather-live-events',[]):[]).map(normalizeEvent).filter(Boolean);
let events=[...samples,...liveEvents],liveResult=null;
let liveScope=read('gather-live-scope',null),discoveryIds=read('gather-discovery-ids',[]);if(!Array.isArray(discoveryIds))discoveryIds=[];
let source=read('gather-source','live');if(!['live','samples'].includes(source))source='samples';
let view='discover',type='All',layout='list',activeId=null,activePanel='event',toastTimer,profileLocationDraft=null;
let month=today().slice(0,7),monthChosen=false,searching=false,loadingTimer=null,loadingStartedAt=null;
function persist(){
 profiles[profileId]={...profile};draftWorkspaces[profileId]=drafts;planWorkspaces[profileId]=plans;
 try {for(const [key,value] of Object.entries({'gather-profiles':profiles,'gather-active-profile':profileId,'gather-drafts-by-profile':draftWorkspaces,'gather-plans-by-profile':planWorkspaces,'gather-profile':profile,'gather-saved':saved,'gather-drafts':drafts,'gather-plans':plans,'gather-live-events':liveEvents,'gather-live-scope':liveScope,'gather-discovery-ids':discoveryIds,'gather-source':source}))localStorage.setItem(key,JSON.stringify(value));}
 catch{toast('Browser storage unavailable. Changes last for this session.');}
}
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4000);}
const date=s=>validDate(s)?new Date(`${s}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not published';
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value):'Not published';
function safeLink(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function link(value,label){const url=safeLink(value);return url?`<a class="external-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`:'';}
function selectedEvent(id){return events.find(event=>event.id===id);}
function planFor(id){if(!record(plans[id]))plans[id]={stage:'Interested',checks:{},notes:'',tasks:[]};const p=plans[id];if(!record(p.checks))p.checks={};if(!Array.isArray(p.tasks))p.tasks=[];return p;}
function download(text,filename,type='text/plain') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function applicationLink(event){
 const target=applicationDestination(event);
 return target.url?link(target.url,target.label):'<span class="muted">Application link not published</span>';
}
function renderCard(event){
 const match=evaluate(event,profile),isSaved=saved.includes(event.id),stage=plans[event.id]?.stage,photo=stockPhoto(event);
 return `<article class="card"><div class="art ${escape(event.color || 'sage')}"><img src="${escape(photo.url)}" alt="${escape(photo.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="kind">${escape(event.kind || 'Opportunity')}</span><button class="save" data-save="${escape(event.id)}" aria-label="${isSaved?'Unsave':'Save'} ${escape(event.name)}" aria-pressed="${isSaved}">${isSaved?'♥':'♡'}</button><a class="photo-credit" href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer">${escape(photo.credit)} / Unsplash · illustrative</a></div><div class="card-body">
 <div class="card-labels"><span class="match match-${matchTone(match)}">${match.label==='Strong fit'?'✦ ':match.blocked?'! ':'◒ '}${escape(match.label)}</span><span class="card-score">${match.score}<small>/100 fit</small></span></div>
 <h3>${escape(event.name)}</h3><div class="meta">${date(event.date)}${event.endDate&&event.endDate!==event.date?` – ${date(event.endDate)}`:''} · ${escape(event.city || 'Location unknown')}</div>
 ${event.live?`<div class="source-confidence">${hasConfirmedDate(event)?'✓ City & date published':'Date needs confirmation'}${event.timeText?` · ${escape(event.timeText)}`:''}</div>`:''}
 <p class="card-description">${escape(event.description)}</p>
 <div class="deadline-note">${escape(match.status==='Past'?'Event has ended':match.status==='Closed'?'Applications closed':event.deadline?`Apply by ${date(event.deadline)}`:'Deadline not published')}</div>
 ${stage?`<span class="stage-badge">${escape(stage)} · tracked by you</span>`:''}
 <div class="card-bottom"><span class="fee">${match.fee===null?'Fee to confirm':money(match.fee)}<small>${match.fee===null?'ask the organizer':event.live&&!event.feeIncludesSpace?'confirm additional charges':'including space'}</small></span><button class="details" data-detail="${escape(event.id)}">Why it fits ↗</button></div>
 <div class="card-application">${applicationLink(event)}${event.sample?'<small>Demo scenario · real example form</small>':''}</div>
 </div></article>`;
}
function render(){
 $('#business-name').textContent=profile.name;
 $('.brief').hidden=view==='compare';
 $('#live-controls').hidden=view==='compare';
 $('#compare-profiles').textContent=view==='compare'?'Back to opportunities ↗':'Compare all three ↗';
 $('#profile-switch').innerHTML=Object.entries(profiles).map(([id,item])=>`<option value="${escape(id)}" ${id===profileId?'selected':''}>${escape(item.name || 'Profile setup pending')}${id==='previous'?' (previous profile)':''}</option>`).join('');
 $('.avatar').textContent=profile.name?.charAt(0).toUpperCase() || 'G';
 $('#brief-summary').textContent=`${profile.organizationType} · ${profile.category} · Within ${profile.radius} miles of ${locationLabel(profile)} · Budget ${money(Number(profile.budget))}`;
 $('#saved-count').textContent=saved.length;$('#draft-count').textContent=Object.keys(drafts).length;
 const headings={discover:'Find your next <em>crowd.</em>',saved:'Good things, <em>saved.</em>',drafts:'Make the first <em>hello.</em>',compare:'Find your best <em>fit.</em>'};
 $('#page-title').innerHTML=headings[view];
 $('#page-description').textContent=view==='compare'?'Compare the same listings across all three businesses. Missing facts remain unconfirmed; exclusions take priority over interest scores.':view==='discover'?'Markets, festivals, and community gatherings where your organization can belong.':view==='saved'?'Your shortlist, application progress, and important dates, all in one place.':'Editable inquiry drafts. Review and download when you are ready to contact an organizer.';
 document.querySelectorAll('.nav').forEach(n=>{n.classList.toggle('active',n.dataset.view===view);n.setAttribute('aria-current',n.dataset.view===view?'page':'false');});
 $('#discovery-panel').hidden=!['discover','compare'].includes(view);$('.browse-controls').hidden=view==='compare'||view==='drafts'||view==='saved'&&layout==='calendar';$('.results-header').hidden=view==='drafts';$('#saved-controls').hidden=view!=='saved';
 $('#event-source').value=source;$('#radius-filter').value=String(profile.radius);
 if(!$('#radius-filter').value){const opt=new Option(`${profile.radius} miles`,String(profile.radius));$('#radius-filter').add(opt);$('#radius-filter').value=String(profile.radius);}
 $('.topbar .demo-pill').textContent=['discover','compare'].includes(view)?(source==='live'?'Web-discovered opportunities':'Demo opportunities'):'Your local workspace';
 $('#discovery-summary').hidden=source!=='live'||searching;
 $('#source-summary').textContent=source==='live'?`${discoveryIds.length} opportunities for ${profile.baseCity} · Bay Area only`:`${samples.length} demo opportunities · illustrative data`;
 $('.transparency').textContent=view==='compare'?'Based on listed requirements and local rules. Expand Evidence & checks to verify conditions and missing facts; scores do not override exclusions.':view==='drafts'?'Local templates. Nothing is sent to organizers.':view==='saved'&&layout==='calendar'?'The calendar shows all saved events and deadlines. List filters do not apply.':'Best fit first, then soonest event. Compatibility considers your offering, budget, search area, and audience. Open an opportunity to see why it fits.';
 $('#comparison-panel').hidden=view!=='compare';$('#geography-summary').hidden=view!=='discover';
 $('#results').hidden=view==='compare'||view==='saved'&&layout==='calendar';$('#calendar-panel').hidden=!(view==='saved'&&layout==='calendar');
 if(view==='drafts'){
  const list=events.filter(e=>drafts[e.id]);$('#results').innerHTML=list.length?list.map(e=>`<article class="card draft-card"><span class="eyebrow">UNSENT INQUIRY</span><h3>${escape(e.name)}</h3><p>${escape(drafts[e.id].slice(0,160))}…</p><button class="secondary" data-draft="${escape(e.id)}">Review draft ↗</button> <button class="details" data-delete="${escape(e.id)}">Delete</button></article>`).join(''):empty('A good conversation starts here.','Open an event and prepare an inquiry.');return;
 }
 const base=view==='saved'?events.filter(e=>saved.includes(e.id)):events.filter(e=>source==='live'?e.live&&liveScope===scopeKey(profile)&&discoveryIds.includes(e.id):!e.live);
 $('#uncertain-label').textContent=source==='live'?'Show Bay Area listings with missing dates':'Include unverified locations';
 const query=$('#search').value.toLowerCase().trim();
 if(view==='compare'){renderComparison(source==='live'?base.filter(hasBayAreaLocation):base);return;}
 if(view==='discover'&&source!=='live'){const outside=base.filter(e=>geographicStatus(e,profile)==='outside').length,unknown=base.filter(e=>geographicStatus(e,profile)==='unknown').length;$('#geography-summary').textContent=`${outside} outside your search area · ${unknown} locations to confirm. Search area uses geographic proximity; check Google Maps for driving distance.`;}
 if(view==='discover'&&source==='live'){const counts=verificationCounts(base,profile);$('#geography-summary').textContent=`${counts.confirmed} with source-backed Bay Area cities and dates · ${counts.pastOrClosed} past/closed · ${counts.outsideArea} outside your search area · ${counts.missingDate} missing dates · ${counts.outsideBayArea+counts.unverifiedLocation} location exclusions. Counts can overlap.`;}
 const list=sortEvents(base.filter(e=>(view!=='discover'||source!=='live'||hasBayAreaLocation(e)&&($('#include-unknown-location').checked||hasConfirmedDate(e)))&&(type==='All'||e.kind===type)&&(view==='saved'||visibleNearby(e,profile,$('#include-unknown-location').checked))&&(!$('#fits-only').checked||evaluate(e,profile).eligible)&&(!$('#hide-ended').checked||!['Past','Closed'].includes(applicationStatus(e)))&&`${e.name} ${e.city || ''} ${e.audience || ''} ${e.interests || ''} ${e.description || ''}`.toLowerCase().includes(query)),profile,$('#sort-order').value);
 $('#results-heading').textContent=`${view==='saved'?'Saved opportunities':'Opportunities for you'} (${view==='saved'&&layout==='calendar'?base.length:list.length})`;
 if(view==='saved'&&layout==='calendar'){renderCalendar(base);return;}
 $('#results').innerHTML=view==='discover'&&source==='live'&&!base.length?webEmptyState():list.length?list.map(renderCard).join(''):empty(view==='saved'&&!base.length?'Your shortlist starts here.':source==='live'?'No verified upcoming opportunities match these filters.':'No opportunities in this view.',view==='saved'&&!base.length?'Save an event using its heart button, then return here.':source==='live'&&!liveEvents.length?'Find public listings above, or explore the vendor application catalog.':source==='live'?'Check the location/date counts above, widen your search area, or refresh sources. Out-of-Bay-Area listings are always excluded.':'Clear your filters or widen your search area.');
}
function webEmptyState(){
 $('#live-controls').open=true;
 return `<div class="empty web-empty"><span class="little-star" aria-hidden="true">⌕</span><h2>Find opportunities beyond the demo</h2><p>Apify finds real organizer pages near your selected city, then Gather checks published Bay Area locations and event dates. A new city search starts automatically; saved results load first when available.</p><button class="primary" id="start-web-search" ${searching?'disabled':''}>${searching?'Searching the web…':'Find opportunities online ↗'}</button><button class="text-button" id="show-demo">Explore demo opportunities</button><p class="muted">City searches use Apify credits. Results are reused for 24 hours; filtering does not start another search.</p></div>`;
}
function empty(title,text){return `<div class="empty"><h2>${escape(title)}</h2><p>${escape(text)}</p><button class="secondary" id="reset-filters">${view==='saved'&&!saved.length?'Discover events':'Clear filters'}</button></div>`;}
function renderComparison(list){
 const businesses=approvedProfiles.map(({id})=>({id,...profiles[id]}));
 $('#results-heading').textContent=`Business compatibility (${list.length} listings)`;
 $('#comparison-panel').innerHTML=list.length?`<p class="comparison-note">All ${source==='live'?'public':'catalog'} listings are included, even when distant or closed. Favorites are shared; application drafts and checklists belong to the selected business. Search areas use geographic proximity. Open an event for Google Maps driving directions. Scores count supported criteria, not chances of acceptance.</p><div class="comparison-scroll" tabindex="0" aria-label="Scroll business comparison"><table class="comparison-table"><caption>Offering, search area, fee budget, and listed requirements</caption><thead><tr><th scope="col">Opportunity</th>${businesses.map(b=>`<th scope="col">${escape(b.name)}<small>${escape(b.category)}<br>${escape(b.baseCity)} · ${b.radius} mi · ${money(Number(b.budget))}</small></th>`).join('')}</tr></thead><tbody>${list.map(event=>`<tr><th scope="row"><button class="comparison-event" data-detail="${escape(event.id)}">${escape(event.name)} ↗</button><p>${escape(event.city || 'Location not verified')}${event.locationQuality==='title'?' · inferred from title':''}</p>${link(event.sourceUrl,'Source')}</th>${businesses.map(b=>{
 const match=evaluate(event,b),category={accepted:'Listed as accepted',excluded:'Explicitly excluded',conditional:'Conditions apply',unknown:'Unconfirmed'}[match.categoryState];
 const quotes=[...(event.categoryEvidence?.accepted?.[b.category] || []),...(event.categoryEvidence?.excluded?.[b.category] || []),...(event.categoryEvidence?.conditional?.[b.category] || [])];
 return `<td><strong class="comparison-verdict ${match.blocked?'is-blocked':''}">${escape(match.label)}</strong><small class="criteria-score">${match.score}/100 supported criteria</small><dl><dt>Offering</dt><dd>${category}</dd><dt>Search area</dt><dd>${match.geography==='outside'?'Outside search area':match.geography==='unknown'?'Location to confirm':'Within search area'}</dd><dt>Published fee</dt><dd>${money(match.fee)}${match.fee!==null&&match.fee>Number(b.budget)?' · over budget':''}</dd><dt>Applications</dt><dd>${escape(match.status)}</dd></dl><details><summary>Evidence & checks</summary><ul>${match.issues.map(issue=>`<li>${escape(issue)}</li>`).join('')||'<li>All matching criteria have supporting information.</li>'}</ul>${quotes.map(quote=>`<blockquote>${escape(quote)}</blockquote>`).join('')}${event.locationEvidence?`<p class="muted">Location evidence: ${escape(event.locationEvidence)}</p>`:''}</details><button class="text-button" data-view-business="${escape(b.id)}" data-compare-event="${escape(event.id)}">View as this business ↗</button></td>`;
 }).join('')}</tr>`).join('')}</tbody></table></div>`:empty('No listings to compare.','Choose vendor applications or load public listings to compare the three businesses.');
}
function renderCalendar(list){
 if(!monthChosen){const first=list.map(e=>e.date||e.deadline).filter(validDate).sort().find(d=>d>=today()) || list.map(e=>e.date||e.deadline).filter(validDate).sort()[0];if(first)month=first.slice(0,7);monthChosen=true;}
 $('#calendar-month').value=month;
 const cells=monthDays(month);while(cells.length%7)cells.push(null);
 const inDay=(event,day)=>validDate(event.date)&&event.date<=day&&(validDate(event.endDate)?event.endDate:event.date)>=day;
 let rows='';for(let index=0;index<cells.length;index+=7){rows+=`<tr>${cells.slice(index,index+7).map(day=>!day?'<td class="calendar-blank"></td>':`<td ${day===today()?'aria-current="date"':''}><span class="calendar-day">${Number(day.slice(-2))}</span>${list.length?list.map(e=>`${inDay(e,day)?`<button class="calendar-entry" data-detail="${escape(e.id)}">${escape(e.name)}</button>`:''}${e.deadline===day?`<button class="calendar-entry calendar-deadline" data-detail="${escape(e.id)}">Apply: ${escape(e.name)}</button>`:''}`).join(''):''}</td>`).join('')}</tr>`;}
 $('#calendar-content').innerHTML=`<table class="calendar-table"><caption>${new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</caption><thead><tr>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
 const undated=list.filter(e=>!validDate(e.date));$('#undated-events').innerHTML=undated.length?`<h3>Event date not published (${undated.length})</h3><p class="muted">Any known application deadlines still appear above.</p>${undated.map(e=>`<button class="secondary" data-detail="${escape(e.id)}">${escape(e.name)}</button>`).join(' ')}`:'';
}
function openProfile(setup=false){
 $('#profile-title').textContent=setup ? 'Tell us about your business' : 'Your organization profile';
 $('#profile-form button[type="submit"]').textContent=setup ? 'Find my next crowd →' : 'Save profile & refresh matches ↗';
 const form=$('#profile-form');Object.entries(profile).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value ?? '';});
 profileLocationDraft={locationMode:profile.locationMode,latitude:profile.latitude,longitude:profile.longitude};showLocationStatus();$('#profile-dialog').showModal();
}
function showLocationStatus(message){$('#location-status').textContent=message || (profileLocationDraft?.locationMode==='device'?'Using your saved device location. Save the profile to apply changes.':'Using the selected city center.');}
function openDetail(id,navigate=true){
 const event=selectedEvent(id);if(!event)return;
 activeId=id;activePanel='event';const match=evaluate(event,profile),plan=planFor(id),closed=['Closed','Past'].includes(match.status);
 const tasks=[...checklistFor(event),...plan.tasks],checked=tasks.filter(t=>plan.checks[t.id]).length;
 const fees=Number.isFinite(event.vendorFee)||Number.isFinite(event.spaceFee)?`<dl class="fee-breakdown"><div><dt>Participation fee</dt><dd>${money(event.vendorFee)}</dd></div><div><dt>Space rental</dt><dd>${money(event.spaceFee)}</dd></div><div><dt>Total published</dt><dd>${money(totalFee(event))}</dd></div></dl>`:`<p>Full fees: ${money(totalFee(event))}. Confirm space rental and additional charges.</p>`;
 $('#detail-content').innerHTML=`
 <div class="dialog-head event-heading"><div><span class="eyebrow">${escape(event.kind || 'OPPORTUNITY')} · ${escape(event.city || 'LOCATION TO CONFIRM')}</span><h2 id="event-title">${escape(event.name)}</h2><div class="event-application">${applicationLink(event)}</div></div><button class="icon-button close" aria-label="Close event">×</button></div>
 ${event.sample?'<p class="scenario-note">Demo scenario. The link above is a real example organizer application, not an application for this fictional event.</p>':`<p class="scenario-note">Checked ${escape(date(event.retrievedAt?.slice(0,10)))} · ${link(event.sourceUrl,'Original source')}. Confirm availability with the organizer.</p>`}
 <section class="compatibility-hero" aria-label="Compatibility with your business"><div class="compatibility-heading"><div><span class="eyebrow">WHY THIS OPPORTUNITY FITS YOU</span><h3>A place for ${escape(profile.name)}?</h3><span class="match match-${matchTone(match)}">${match.label==='Strong fit'?'✦ ':''}${escape(match.label)}</span></div><div class="fit-ring" style="--fit:${match.score}%" aria-label="Compatibility ${match.score} out of 100"><span>${match.score}<small>/100</small></span></div></div><ul class="fit-reasons">${match.reasons.map(r=>`<li><span aria-hidden="true">✓</span>${escape(r)}</li>`).join('')||'<li>Not enough source information to confirm a fit yet.</li>'}</ul>${match.issues.length?`<div class="fit-cautions"><strong>Before you apply</strong><ul>${match.issues.map(r=>`<li>${escape(r)}</li>`).join('')}</ul></div>`:''}<details class="score-method"><summary>How this score works</summary><p>35 offering · 25 search area · 20 published fees · 10 organization eligibility · 10 shared interests. This is a transparent rules-based compatibility score, not an AI prediction or acceptance probability. Unknown facts need confirmation. Search area is geographic proximity, not driving mileage.</p></details></section>
 <p class="detail-description">${escape(event.description)}</p>
 <div class="facts event-facts"><div><small>Event date</small>${date(event.date)}${event.endDate&&event.endDate!==event.date?` – ${date(event.endDate)}`:''}<span class="fact-status">${event.timeText?escape(event.timeText)+' · as published':'Time not published'}</span></div><div><small>Apply by</small>${date(event.deadline)}<span class="fact-status">${escape(match.status)}</span></div><div><small>Published fee</small>${money(totalFee(event))}<span class="fact-status">${totalFee(event)===null?'Confirm with organizer':'Confirm additional charges'}</span></div><div><small>Location & travel</small>${escape(event.venue || event.address || event.city || 'Not published')}${directionsUrl(event,profile)?`<div>${link(directionsUrl(event,profile),'Driving directions on Google Maps')}</div><span class="fact-status">${event.sample?'Demo route to city center; exact venue is fictional.':'Check route, driving distance, and travel time in Maps.'}</span>`:'<span class="fact-status">Confirm the location before planning travel.</span>'}</div></div>
 <details class="detail-section compact-detail"><summary>Audience & event details</summary><p>${escape(event.audience || 'Audience not published.')}${event.audienceSize?` · ${escape(event.audienceSize)}`:''}</p><p>${escape(event.needs)}</p>${fees}</details>
 <details class="detail-section next-steps"><summary>Next steps <span>${checked}/${tasks.length} done</span></summary><p class="muted" id="checklist-progress">${checked} of ${tasks.length} completed. Suggestions to help you prepare; confirm requirements with the organizer.</p><div class="task-list">${tasks.map(task=>`<div class="task-row"><label class="task"><input type="checkbox" data-task="${escape(task.id)}" ${plan.checks[task.id]?'checked':''}><span>${escape(task.text)}<small>${task.source?'From listing':task.custom?'Your task':'Planning suggestion'}</small></span></label>${task.custom?`<button class="text-button" data-remove-task="${escape(task.id)}" aria-label="Remove ${escape(task.text)}">Remove</button>`:''}</div>`).join('')}</div><form id="add-task-form" class="add-task"><label for="new-task">Add your own step</label><div><input id="new-task" maxlength="200" required><button class="secondary" type="submit">Add step</button></div></form></details>
 <details class="detail-section compact-detail"><summary>Application requirements & materials</summary><p>${closed?'This listing is closed or past. Check for a future opportunity before applying.':'Apply directly through the organizer’s own form. Gather helps you prepare.'}</p><ul>${(event.requirements || []).map(r=>`<li>${escape(r)}</li>`).join('')||'<li>Confirm requirements with the organizer.</li>'}</ul><ol>${(event.applicationSteps || []).map(step=>`<li>${escape(step)}</li>`).join('')}</ol><div class="detail-actions"><button class="secondary" data-packet="${escape(id)}">Prepare application materials</button><button class="text-button" data-draft="${escape(id)}" ${closed?'disabled':''}>Prepare inquiry</button></div></details>
 <details class="detail-section compact-detail"><summary>Your progress & notes <span>${escape(plan.stage)}</span></summary><label class="field-label">Status <select id="application-stage">${applicationStages.map(s=>`<option ${plan.stage===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="field-label" for="application-notes">Preparation notes</label><textarea id="application-notes" rows="3" maxlength="4000">${escape(plan.notes)}</textarea><p class="muted" id="notes-status" role="status">Notes save in this browser. Status is tracked by you.</p></details>
 ${event.live?`<details class="detail-section compact-detail"><summary>Source evidence</summary>${Object.entries(event.evidence || {}).map(([key,text])=>`<p><strong>${escape(key)}:</strong> ${escape(text)}</p>`).join('')||'<p>Read the original source for details.</p>'}</details>`:''}
 <div class="detail-actions event-bottom-actions"><button class="primary" data-save="${escape(id)}">${saved.includes(id)?'Remove from saved':'♡ Save opportunity'}</button><button class="text-button" data-copy-link="${escape(id)}">Copy event link</button></div>`;
 $('#application-stage').onchange=e=>{plan.stage=e.target.value;persist();render();e.target.closest('details').querySelector('summary span').textContent=plan.stage;toast('Application status updated');};
 $('#application-notes').oninput=e=>{plan.notes=e.target.value;persist();$('#notes-status').textContent='Notes saved in this browser.';};
 $('#add-task-form').onsubmit=e=>{e.preventDefault();const text=$('#new-task').value.trim();if(!text)return;plan.tasks.push({id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text,custom:true});persist();openDetail(id,false);$('.next-steps').open=true;};
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
 if(navigate&&location.hash!==`#event/${encodeURIComponent(id)}`)history.pushState(null,'',`#event/${encodeURIComponent(id)}`);
}
function openDraft(id){
 const event=selectedEvent(id);if(!event)return;activeId=id;activePanel='draft';
 if(!drafts[id]){drafts[id]=createDraft(event,profile);persist();render();}
 $('#detail-content').innerHTML=`<div class="dialog-head"><div><span class="eyebrow">UNSENT INQUIRY</span><h2 id="event-title">Your first hello.</h2></div><button class="icon-button close" aria-label="Close draft">×</button></div><p class="muted">For ${escape(event.name)} · Editable local template. Nothing is sent.</p><label class="field-label" for="draft-text">Inquiry draft</label><textarea class="draft-text" id="draft-text"></textarea><div class="detail-actions"><button class="primary" id="save-draft">Save draft</button><button class="secondary" id="download-draft">Download .txt ↧</button><button class="text-button" data-detail="${escape(id)}">Back to event</button></div>`;
 $('#draft-text').value=drafts[id];
 $('#save-draft').onclick=()=>{drafts[id]=$('#draft-text').value;persist();render();toast('Draft saved');};
 $('#download-draft').onclick=()=>{drafts[id]=$('#draft-text').value;persist();download(drafts[id],`gather-${id}-inquiry.txt`);toast('Inquiry downloaded · nothing sent');};
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
}
function openPacket(id){
 const event=selectedEvent(id);if(!event)return;const plan=planFor(id);activeId=id;activePanel='packet';
 $('#detail-content').innerHTML=`<div class="dialog-head"><div><span class="eyebrow">APPLICATION PREPARATION</span><h2 id="event-title">Ready your application.</h2></div><button class="icon-button close" aria-label="Close application materials">×</button></div><p class="muted">Review these materials, then copy them into the organizer’s form. Revenue is excluded. This does not submit an application.</p><label class="field-label" for="packet-text">Editable application materials</label><textarea class="draft-text" id="packet-text"></textarea><div class="detail-actions"><button class="primary" id="save-packet">Save materials</button><button class="secondary" id="download-packet">Download .txt ↧</button><button class="text-button" data-detail="${escape(id)}">Back to event</button></div>${!['Closed','Past'].includes(applicationStatus(event))?link(event.applicationUrl,'Continue on organizer website'):''}`;
 $('#packet-text').value=plan.packet ?? applicationPacket(event,profile,plan.notes);
 const save=()=>{plan.packet=$('#packet-text').value;if(plan.stage==='Interested')plan.stage='Preparing';persist();render();};
 $('#save-packet').onclick=()=>{save();toast('Application materials saved · not submitted');};
 $('#download-packet').onclick=()=>{save();download(plan.packet,`gather-${id}-application.txt`);toast('Application materials downloaded · not submitted');};
 if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
}
function clearFilters(){type='All';$('#include-unknown-location').checked=false;$('#search').value='';$('#fits-only').checked=false;$('#hide-ended').checked=false;document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t.dataset.type==='All');t.setAttribute('aria-pressed',String(t.dataset.type==='All'));});}
function navigate(viewName){view=viewName;clearFilters();$('#hide-ended').checked=view==='discover';render();if(view==='discover')ensureDiscovery();}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.classList.contains('close'))button.closest('dialog').close();
 if(button.dataset.viewBusiness){persist();profileId=button.dataset.viewBusiness;profile=profiles[profileId];drafts=draftWorkspaces[profileId] ||= {};plans=planWorkspaces[profileId] ||= {};persist();render();if(button.dataset.compareEvent)openDetail(button.dataset.compareEvent);else navigate('discover');}
 if(button.dataset.view)navigate(button.dataset.view);
 if(button.dataset.type){type=button.dataset.type;document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t.dataset.type===type);t.setAttribute('aria-pressed',String(t.dataset.type===type));});render();}
 if(button.dataset.layout){layout=button.dataset.layout;document.querySelectorAll('[data-layout]').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.layout===layout)));render();}
 if(button.dataset.save){const id=button.dataset.save;saved=saved.includes(id)?saved.filter(s=>s!==id):[...saved,id];persist();render();if($('#detail-dialog').open&&activePanel==='event')openDetail(id,false);toast(saved.includes(id)?'Opportunity saved':'Opportunity removed from saved');}
 if(button.dataset.removeTask&&activeId){const plan=planFor(activeId);plan.tasks=plan.tasks.filter(task=>task.id!==button.dataset.removeTask);delete plan.checks[button.dataset.removeTask];persist();openDetail(activeId,false);}
 if(button.dataset.detail)openDetail(button.dataset.detail);
 if(button.dataset.draft)openDraft(button.dataset.draft);
 if(button.dataset.packet)openPacket(button.dataset.packet);
 if(button.dataset.delete){delete drafts[button.dataset.delete];persist();render();toast('Draft deleted');}
 if(button.dataset.copyLink){try{await navigator.clipboard.writeText(`${location.origin}/#event/${encodeURIComponent(button.dataset.copyLink)}`);toast('Event link copied. Live listings must be available in this local workspace.');}catch{toast('Copy the event URL from your browser’s address bar.');}}
 if(button.id==='start-web-search')$('#discover-live').click();
 if(button.id==='show-demo'){source='samples';persist();render();}
 if(button.id==='reset-filters'){if(view==='saved'&&!saved.length)navigate('discover');else{clearFilters();render();}}
});
document.addEventListener('change',event=>{
 if(!event.target.dataset.task||!activeId)return;
 planFor(activeId).checks[event.target.dataset.task]=event.target.checked;persist();
 const tasks=[...checklistFor(selectedEvent(activeId)),...planFor(activeId).tasks];
 const checked=tasks.filter(t=>planFor(activeId).checks[t.id]).length;
 $('#checklist-progress').textContent=`${checked} of ${tasks.length} completed. Confirm requirements with the organizer.`;
 $('.next-steps summary span').textContent=`${checked}/${tasks.length} done`;
});
$('#compare-profiles').onclick=()=>navigate(view==='compare'?'discover':'compare');
$('#profile-switch').onchange=event=>{persist();profileId=event.target.value;profile=profiles[profileId];drafts=draftWorkspaces[profileId] ||= {};plans=planWorkspaces[profileId] ||= {};persist();render();toast(`Now viewing ${profile.name}`);ensureDiscovery();};
$('#profile-button').onclick=()=>openProfile();$('#edit-brief').onclick=()=>openProfile();
for(const selector of ['#search','#sort-order','#fits-only','#hide-ended','#include-unknown-location'])$(selector).addEventListener(selector==='#search'?'input':'change',render);
$('#radius-filter').onchange=e=>{profile.radius=Number(e.target.value);persist();render();};
$('#event-source').onchange=e=>{source=e.target.value;++discoveryRequest;clearTimeout(discoveryTimer);setDiscoveryLoading(false);clearFilters();$('#hide-ended').checked=true;persist();render();if(source==='live')ensureDiscovery();};
$('#base-city').innerHTML=Object.keys(cities).map(name=>`<option>${escape(name)}</option>`).join('');
$('#base-city').onchange=()=>{profileLocationDraft={locationMode:'city'};showLocationStatus();};
$('#use-city').onclick=()=>{profileLocationDraft={locationMode:'city'};showLocationStatus();};
$('#use-location').onclick=()=>{
 if(!navigator.geolocation){showLocationStatus('Location is unavailable. Choose a home city instead.');return;}
 const button=$('#use-location');button.disabled=true;showLocationStatus('Waiting for your browser’s location permission…');
 navigator.geolocation.getCurrentPosition(position=>{button.disabled=false;if(!$('#profile-dialog').open)return;profileLocationDraft={locationMode:'device',latitude:position.coords.latitude,longitude:position.coords.longitude};showLocationStatus();},()=>{button.disabled=false;showLocationStatus('Location could not be read. Choose a home city instead.');},{timeout:10000,maximumAge:300000,enableHighAccuracy:false});
};
$('#profile-form').onsubmit=event=>{
 event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
 if(!values.name.trim()||!values.description.trim()){toast('Add your organization name and description.');return;}
 profile={...values,...profileLocationDraft,name:values.name.trim(),description:values.description.trim(),radius:Number(values.radius),budget:Number(values.budget)};
 if(profile.locationMode!=='device'){delete profile.latitude;delete profile.longitude;}else if(!coordinates(profile)){toast('Choose a valid city or retry your location.');return;}
 persist();render();
 $('#profile-dialog').close();
 try{onboarding.completeProfile();}catch(error){toast(error.message);return;}
 toast('Organization profile updated');ensureDiscovery();
};
$('#calendar-month').value=month;$('#calendar-month').onchange=e=>{if(!validDate(`${e.target.value}-01`))return;month=e.target.value;monthChosen=true;render();};
function changeMonth(delta){const value=new Date(`${month}-01T12:00:00`);value.setMonth(value.getMonth()+delta);if(value.getFullYear()<2000||value.getFullYear()>2100)return;month=`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}`;monthChosen=true;render();}
$('#previous-month').onclick=()=>changeMonth(-1);$('#next-month').onclick=()=>changeMonth(1);
$('#export-calendar').onclick=()=>{const result=calendarExport(events.filter(e=>saved.includes(e.id)));if(!result.count){toast('Save an event with a published date or deadline before exporting.');return;}download(result.text,'gather-saved-events.ics','text/calendar;charset=utf-8');toast(`Exported ${result.count} event dates and deadlines. Unknown dates were skipped.`);};
$('#detail-dialog').addEventListener('close',()=>{activeId=null;if(location.hash.startsWith('#event/'))history.replaceState(null,'',location.pathname+location.search);});
function openRoute(){if($('#workspace').hidden)return;if(location.hash.startsWith('#event/')){try{const id=decodeURIComponent(location.hash.slice(7));if(selectedEvent(id))openDetail(id,false);else toast('This event is not in this workspace. Load its source listings first.');}catch{toast('Invalid event link');}}else if($('#detail-dialog').open)$('#detail-dialog').close();}
window.addEventListener('hashchange',openRoute);window.addEventListener('popstate',openRoute);
function showLive(result,switchSource=false){
 if(!matchesScope(result,profile))return;
 liveResult=result;liveScope=scopeKey(profile);discoveryIds=result.events.map(event=>event.id);
 const retained=liveEvents.filter(e=>saved.includes(e.id)||Object.values(draftWorkspaces).some(workspace=>workspace[e.id])||Object.values(planWorkspaces).some(workspace=>workspace[e.id]));
 liveEvents=[...new Map([...retained,...result.events.map(normalizeEvent).filter(Boolean)].map(e=>[e.id,e])).values()];events=[...samples,...liveEvents];
 if(switchSource){source='live';$('#fits-only').checked=false;}
 $('#discovery-status').textContent=`${result.cached?'Last search (cached)':'Just checked'} · ${result.events.length} listings from ${result.pagesRead} pages · ${date(result.retrievedAt?.slice(0,10))}. Confirm missing details.`;
 $('#discovery-runs').innerHTML=`<p>${result.selected?.filter(item=>!item.fallback).length||0} search-selected sources · ${result.fallbackSources||0} trusted organizer starting pages · ${result.reusedPages||0} previously crawled pages reused. Source facts are extracted from page content, not from the starting-page list.</p>`+(result.timings?`<p>Processing times${result.cached?' from the original run':''}: search ${(result.timings.searchMs/1000).toFixed(1)}s · read pages ${(result.timings.crawlMs/1000).toFixed(1)}s · local field checks ${result.timings.extractionMs.toFixed(1)}ms. Cached stages take no Actor time.</p>`:'')+(result.verification?`<p>${result.verification.confirmed} records with Bay Area locations and dates; ${result.verification.outsideBayArea} outside the Bay Area; ${result.verification.needsLocation} unverified locations; ${result.verification.needsDate} missing dates; ${result.verification.blockedPages} unreadable pages.</p>`:'')+result.runs.map(run=>`<p>${link(run.url,run.reused?'Previous source run (reused)':run.actor+' run')} · ${run.reused?'Reused cached source; original reported usage':'Reported usage'}: ${run.usageTotalUsd===null?'not available':`$${Number(run.usageTotalUsd).toFixed(4)}`} (check Console for final charges)</p>`).join('');
 persist();render();if(location.hash.startsWith('#event/')&&!$('#detail-dialog').open)openRoute();
}
function setDiscoveryLoading(loading,progress={},startedAt){
 searching=loading;
 $('#discover-live').disabled=loading;
 const emptySearch=$('#start-web-search');if(emptySearch){emptySearch.disabled=loading;emptySearch.textContent=loading?'Searching the web…':'Find opportunities online ↗';}
 $('#discover-live').textContent=loading?'Finding opportunities…':'Refresh sources ↗';
 $('#discovery-loading').hidden=!loading;
 $('#discovery-status').hidden=loading;
 $('#discovery-summary').hidden=loading||source!=='live';
 $('#results').setAttribute('aria-busy',String(loading));
 if(!loading){clearInterval(loadingTimer);loadingTimer=null;loadingStartedAt=null;return;}
 $('#discovery-panel').hidden=!['discover','compare'].includes(view);
 loadingStartedAt=Date.parse(startedAt)||loadingStartedAt||Date.now();
 const updateElapsed=()=>{const seconds=Math.max(0,Math.floor((Date.now()-loadingStartedAt)/1000));$('#discovery-elapsed').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} elapsed`;};
 updateElapsed();if(!loadingTimer)loadingTimer=setInterval(updateElapsed,1000);
 const message=progress.message||'Starting discovery…';
 if($('#loading-message').textContent!==message)$('#loading-message').textContent=message;
 if($('#discovery-status').textContent!==message)$('#discovery-status').textContent=message;
 const current={cache:-1,search:0,shortlist:1,crawl:1,extract:2}[progress.stage]??-1;
 document.querySelectorAll('[data-progress-step]').forEach((step,index)=>{step.querySelector('.step-indicator').textContent=index<current?'✓':String(index+1);step.classList.toggle('is-complete',index<current);step.classList.toggle('is-current',index===current);if(index===current)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
}
function discoveryProfile(){return {baseCity:profile.baseCity,category:profile.category,organizationType:profile.organizationType};}
let discoveryTimer=null,discoveryRequest=0;
async function ensureDiscovery(refresh=false){
 if(source!=='live'||view!=='discover')return;
 clearTimeout(discoveryTimer);
 const selectedProfile=discoveryProfile(),key=scopeKey(selectedProfile),request=++discoveryRequest,started=performance.now();
 if(liveScope!==key){liveResult=null;liveScope=key;discoveryIds=[];render();}
 const query=new URLSearchParams(selectedProfile).toString();let hasStarted=false;
 async function check(start=false){
  if(request!==discoveryRequest||key!==scopeKey(discoveryProfile())||source!=='live')return;
  try{
   if(start)hasStarted=true;
   const response=await fetch(`/api/discovery${start?'':`?${query}`}`,start?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:selectedProfile,refresh})}:undefined);
   const job=await response.json();if(!response.ok)throw new Error(job.error||'Unable to check discovery');
   if(request!==discoveryRequest||key!==scopeKey(discoveryProfile())||source!=='live')return;
   if(job.scope&&JSON.stringify(job.scope)!==key)throw new Error('Search scope changed. Choose your city and try again.');
   if(job.status==='complete'){
    if(refresh&&!hasStarted)return check(true);
    setDiscoveryLoading(false);showLive(job.result,false);
    const seconds=(performance.now()-started)/1000,elapsed=seconds<1?`${Math.round(seconds*1000)}ms`:`${seconds.toFixed(1)}s`;
    const status=`${job.result.cached||!hasStarted?`Loaded saved results in ${elapsed}`:`Results ready in ${Math.round(seconds)}s`} · ${job.result.scope.city} · source checks ${date(job.result.retrievedAt.slice(0,10))}.`;
    $('#discovery-status').textContent=status;$('#discovery-summary').textContent=status;
    return;
   }
   if(job.status==='failed'){
    if(refresh&&!hasStarted)return check(true);
    throw new Error(job.error||'Search failed. Try again when ready.');
   }
   if(job.status==='idle'||job.status==='stale'){
    if(job.result)showLive(job.result,false);
    return check(true);
   }
   if(job.status==='busy')hasStarted=false;
   setDiscoveryLoading(true,job.progress||{stage:'cache',message:job.message||'Waiting for the city search to start.'},job.startedAt);
   discoveryTimer=setTimeout(()=>check(false),1500);
  }catch(error){
   if(request!==discoveryRequest)return;
   setDiscoveryLoading(false);render();
   $('#discovery-status').textContent=error.message;$('#discovery-summary').textContent=error.message;
   $('#live-controls').open=true;
  }
 }
 setDiscoveryLoading(true,{stage:'cache',message:`Checking opportunities near ${selectedProfile.baseCity}.`});
 await check(refresh);
}
$('#discover-live').onclick=()=>ensureDiscovery(true);
persist();render();
const onboarding=startOnboarding({
 read,
 createProfile(id){
  persist();profileId=id;
  profile={...defaultProfile,name:'',description:'',interests:'',targetAudience:'',yearsOperating:'',revenue:'',locationMode:'city'};
  delete profile.latitude;delete profile.longitude;
  profiles[id]=profile;drafts=draftWorkspaces[id]={};plans=planWorkspaces[id]={};
  persist();render();
 },
 selectProfile(id){
  if(!Object.hasOwn(profiles,id))return false;
  profileId=id;profile=profiles[id];drafts=draftWorkspaces[id] ||= {};plans=planWorkspaces[id] ||= {};
  persist();render();return true;
 },
 editProfile:openProfile,
 onEnter(){navigate('discover');openRoute();}
});
