import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsername,validUsername,createCredential,verifyCredential} from '../onboarding.js';

test('demo usernames normalize consistently and reject unsupported characters',()=>{
 assert.equal(normalizeUsername('  Local_Maker  '),'local_maker');
 for(const name of ['ab','space name','<script>','x'.repeat(31),''])assert.equal(validUsername(name),false,name);
 for(const name of ['local-maker','Maker_2026','a'.repeat(30)])assert.equal(validUsername(name),true,name);
});
test('local credentials use unique salts, verify the password, and never retain plaintext',async()=>{
 const password='ThrowawayDemoOnly!';
 const first=await createCredential(password),second=await createCredential(password);
 assert.notEqual(first.salt,second.salt);assert.notEqual(first.hash,second.hash);
 assert.equal(JSON.stringify(first).includes(password),false);
 assert.equal(await verifyCredential(password,first),true);
 assert.equal(await verifyCredential('WrongPassword!',first),false);
 assert.equal(await verifyCredential(password,null),false);
 assert.equal(await verifyCredential(password,{salt:'broken',hash:'broken'}),false);
});
test('credential creation enforces demo password bounds',async()=>{
 for(const value of ['short','x'.repeat(129),null])await assert.rejects(()=>createCredential(value),/between 8 and 128/);
});
