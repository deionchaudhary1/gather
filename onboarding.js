// Local demo credentials only. This is not a server authentication boundary.
const encoder = new TextEncoder();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const normalizeUsername = value => String(value).trim().toLowerCase();
export function validUsername(value) { return /^[a-z0-9_-]{3,30}$/i.test(String(value).trim()); }
async function derive(password, salt) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:210000,hash:'SHA-256'},key,256)));
}
export async function createCredential(password) {
 if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('Use a password between 8 and 128 characters.');
 const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
 return {salt,hash:await derive(password,salt)};
}
export async function verifyCredential(password, credential) {
 if (!credential || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{64}$/.test(credential.hash)) return false;
 return await derive(password,credential.salt) === credential.hash;
}
export function startOnboarding({read,createProfile,selectProfile,editProfile,onEnter}) {
 const $ = selector => document.querySelector(selector);
 let accounts = read('gather-demo-accounts',{});
 if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) accounts = {};
 let current = null, mode = 'signup', splashTimer;
 const steps = ['role','account','profile'];
 const store = (key,value) => { localStorage.setItem(key,JSON.stringify(value)); };
 function step(name) {
  for (const item of steps) $(`#welcome-${item}`).hidden = item !== name;
  $('#welcome-tabs').hidden = name === 'profile' || name === 'market';
  const heading = $(`#welcome-${name} h2`); heading?.focus({preventScroll:true});
 }
 function error(message) { $('#account-error').textContent = message; }
 function accountForm(nextMode) {
  mode = nextMode;
  $('#account-form').reset(); error('');
  $('#account-password').type='password';$('#toggle-password').textContent='Show';$('#toggle-password').setAttribute('aria-label','Show password');
  const login = mode === 'login';
  $('#account-eyebrow').textContent = login ? 'GOOD TO HAVE YOU BACK' : '02 / MAKE YOURSELF AT HOME';
  $('#account-title').innerHTML = login ? 'Welcome back to <em>Gather.</em>' : 'A fresh start, <em>together.</em>';
  $('#account-description').textContent = login ? 'Your neighborhood of opportunities is waiting.' : 'Create your account. Then we’ll get to know your business.';
  $('#account-submit').textContent = login ? 'Log in →' : 'Create account →';
  $('#account-password').autocomplete = login ? 'current-password' : 'new-password';
  document.querySelectorAll('[data-auth-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.authMode===mode)));
  step('account');
 }
 function enter() {
  $('#welcome').hidden=true;$('#workspace').hidden=false;
  onEnter();$('#page-title').setAttribute('tabindex','-1');$('#page-title').focus({preventScroll:true});
 }
 function resume(username) {
  const account = Object.hasOwn(accounts,username) ? accounts[username] : null;
  if (!account || !selectProfile(account.profileId)) return false;
  current=username;
  if(account.complete) enter(); else step('profile');
  return true;
 }
 function showWelcome(splash=false) {
  clearTimeout(splashTimer); current=null;
  try{localStorage.removeItem('gather-demo-session');}catch{}
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  $('#workspace').hidden=true;$('#welcome').hidden=false;
  $('#welcome-content').hidden=splash;$('#welcome-splash').hidden=!splash;
  $('#welcome-splash').classList.remove('splash-leaving');
  $('#account-form').reset();error('');
  mode='signup';document.querySelectorAll('[data-auth-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.authMode==='signup')));
  step('role');
  if(splash){
   splashTimer=setTimeout(()=>{
    $('#welcome-content').hidden=false;$('#welcome-splash').classList.add('splash-leaving');
    splashTimer=setTimeout(()=>{$('#welcome-splash').hidden=true;$('#role-title').focus({preventScroll:true});},450);
   },1100);
  }
 }
 $('#choose-small').onclick=()=>accountForm('signup');
 $('#account-back').onclick=()=>step('role');
 document.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>{
  if(button.dataset.authMode==='login')accountForm('login');
  else{mode='signup';step('role');document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode==='signup')));}
 });
 $('#toggle-password').onclick=()=>{
  const show=$('#account-password').type==='password';$('#account-password').type=show?'text':'password';$('#toggle-password').textContent=show?'Hide':'Show';$('#toggle-password').setAttribute('aria-label',show?'Hide password':'Show password');
 };
 $('#account-form').onsubmit=async event=>{
  event.preventDefault();error('');
  const username=normalizeUsername($('#account-username').value),password=$('#account-password').value;
  if(!validUsername(username)){error('Use 3–30 letters, numbers, underscores, or hyphens.');return;}
  const button=$('#account-submit');button.disabled=true;
  try{
   if(mode==='login'){
    const account=Object.hasOwn(accounts,username)?accounts[username]:null;
    if(!await verifyCredential(password,account?.credential)){error('That username and password don’t match. Try again or sign up in this browser.');return;}
    store('gather-demo-session',username);
    if(!resume(username)){localStorage.removeItem('gather-demo-session');error('This demo profile is unavailable. Create a new demo account.');}
   }else{
    if(Object.hasOwn(accounts,username)){error('This username is already here. Log in or choose another username.');return;}
    const credential=await createCredential(password);
    const account={credential,profileId:`member-${crypto.randomUUID()}`,complete:false};
    // Verify storage is writable before adding a profile to the shared demo workspace.
    store('gather-demo-accounts',{...accounts,[username]:account});
    accounts={...accounts,[username]:account};
    createProfile(account.profileId);
    store('gather-demo-session',username);current=username;step('profile');
   }
   $('#account-password').value='';
  }catch{error('Unable to save this demo account. Allow browser storage and use localhost, then try again.');}
  finally{button.disabled=false;}
 };
 $('#setup-profile').onclick=()=>editProfile(true);
 $('#setup-signout').onclick=()=>showWelcome();
 $('#sign-out').onclick=()=>showWelcome();$('#replay-welcome').onclick=()=>showWelcome(true);
 const session=read('gather-demo-session',null);
 showWelcome(true);
 if(typeof session==='string' && resume(session)){
  clearTimeout(splashTimer);$('#welcome-splash').hidden=true;$('#welcome-content').hidden=false;
  try{store('gather-demo-session',session);}catch{}
 }
 return {
  completeProfile(){
   if(!current || !accounts[current] || accounts[current].complete)return;
   accounts[current].complete=true;
   try{store('gather-demo-accounts',accounts);}catch{accounts[current].complete=false;throw new Error('Unable to save profile setup. Allow browser storage and try again.');}
   enter();
  },
  get needsProfile(){return Boolean(current && accounts[current] && !accounts[current].complete);}
 };
}
