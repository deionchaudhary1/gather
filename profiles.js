import {defaultProfile} from './data.js';
const base={organizationType:'Small business',locationMode:'city',yearsOperating:'',revenue:''};
export const approvedProfiles = [
 {id:'daybreak',...base,name:'Daybreak Coffee',category:'Coffee & beverages',baseCity:'Berkeley',radius:30,budget:200,description:'A mobile coffee cart serving specialty espresso, seasonal drinks, and a warm neighborhood welcome.',interests:'families, neighborhood gatherings, food festivals',targetAudience:'Families and neighborhood visitors'},
 {id:'clay',...base,name:'East Bay Clay Studio',category:'Art & handmade',baseCity:'Oakland',radius:20,budget:100,description:'A small ceramics studio making handmade mugs, planters, and functional pottery for everyday use.',interests:'art, design, ceramics, handmade gifts, craft markets',targetAudience:'Art collectors, gift shoppers, and design enthusiasts'},
 {id:'refill',...base,name:'Loop & Leaf Refill',category:'Retail & gifts',baseCity:'San Francisco',radius:25,budget:150,description:'A sustainable household goods shop offering refillable cleaning products and reusable everyday essentials.',interests:'sustainability, zero waste, reusable products, community events',targetAudience:'Eco-conscious shoppers and sustainability-minded neighbors'},
];
const object=value=>value && typeof value==='object' && !Array.isArray(value);
export function initializeProfiles(storedProfiles,legacyProfile,storedActive){
 const profiles=Object.fromEntries(approvedProfiles.map(({id,...profile})=>[id,{...profile}]));
 const existing=object(storedProfiles)&&Object.keys(storedProfiles).length>0;
 if(existing){for(const [id,value] of Object.entries(storedProfiles)){if(/^[a-z0-9-]+$/.test(id)&&object(value)&&typeof value.name==='string')profiles[id]={...defaultProfile,...value};}}
 let active=Object.hasOwn(profiles,storedActive)?storedActive:'daybreak';
 if(!existing&&object(legacyProfile)&&Object.keys(legacyProfile).length){
  const comparable=Object.keys(defaultProfile);
  const customized=comparable.some(key=>(legacyProfile[key]??defaultProfile[key])!==defaultProfile[key]);
  if(customized){profiles.previous={...defaultProfile,...legacyProfile};active='previous';}
 }
 return {profiles,active};
}
export function initializeWorkspaces(stored,legacy,active){
 if(object(stored))return Object.fromEntries(Object.entries(stored).filter(([,value])=>object(value)));
 return {[active]:object(legacy)?legacy:{}};
}
