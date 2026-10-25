import {scopeKey,discoveryScope,loadLatestDiscovery,discoveryFresh} from './discovery.mjs';
export function createDiscoveryService({discover,load=profile=>loadLatestDiscovery(undefined,profile),now=()=>Date.now()}){
 const jobs=new Map();let activeKey=null;
 async function status(profile){
  const key=scopeKey(profile);let job=jobs.get(key);
  if(!job){
   const result=await load(profile);
   // A concurrent POST may have started while the cache was being read.
   job=jobs.get(key)|| (result?{status:'complete',result,scope:discoveryScope(profile)}:{status:'idle',scope:discoveryScope(profile)});
   jobs.set(key,job);
  }
  if(job.status==='complete'&&!discoveryFresh(job.result,now()))return {...job,status:'stale'};
  if(activeKey&&activeKey!==key&&['idle','stale'].includes(job.status))return {...job,status:'busy',message:'Another city search is finishing. Your search will start next.'};
  return job;
 }
 async function start(profile,{refresh=false}={}){
  const key=scopeKey(profile),previous=await status(profile);
  if(activeKey)return activeKey===key?jobs.get(key):{status:'busy',scope:discoveryScope(profile),message:'Another city search is finishing. Your search will start next.'};
  if(previous.status==='complete'&&!refresh)return previous;
  activeKey=key;
  const scope=discoveryScope(profile);
  jobs.set(key,{status:'running',scope,startedAt:new Date(now()).toISOString(),progress:{stage:'cache',message:`Finding opportunities near ${scope.city}.`}});
  Promise.resolve().then(()=>discover(profile,false,{force:refresh,onProgress:progress=>jobs.set(key,{...jobs.get(key),progress})}))
   .then(result=>jobs.set(key,{status:'complete',scope,result}))
   .catch(error=>jobs.set(key,{status:'failed',scope,error:error.message}))
   .finally(()=>{activeKey=null;});
  return jobs.get(key);
 }
 return {status,start};
}
