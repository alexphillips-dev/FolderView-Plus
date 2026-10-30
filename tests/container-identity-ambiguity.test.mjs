import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const moduleDir=process.env.FVPLUS_DRAFT_MODEL_DIR || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const model=require(path.join(moduleDir,'docker.runtime.container-model.js'));
const providers=require(path.join(moduleDir,'docker.runtime.providers.js'));
const raw=[
 {id:'server:abcdef1234567890',name:'first-app',state:'running'},
 {id:'server:fedcba0987654321',name:'abcdef1234567890',state:'running'}
];
const entries=raw.map(entry=>model.normalizeContainer(entry));
test('canonical identity refuses conflicting exact name and ID aliases before trying ID prefixes',()=>{
 assert.equal(model.resolveContainerIdentity('abcdef1234567890',entries),null);
 assert.equal(model.resolveContainerIdentity('server:abcdef1234567890',entries),entries[0]);
 assert.equal(model.resolveContainerIdentity('first-app',entries),entries[0]);
 assert.equal(model.resolveContainerIdentity('fedcba098765',entries),entries[1]);
 assert.equal(model.resolveContainerIdentity('abcdef12',entries),entries[0]);
});
test('canonical identity refuses triple alias collisions even with one matching ID prefix',()=>{
 const triple=[...entries,model.normalizeContainer({id:'server:1111111111111111',name:'abcdef1234567890'})];
 assert.equal(model.resolveContainerIdentity('abcdef1234567890',triple),null);
});
test('provider actions and targeted reconciliation reject ambiguous aliases without sending mutations',async()=>{
 const mutations=[];
 const provider=providers.createGraphqlProvider({window:{},transport:{
  probeCapabilities:async()=>({query:{containers:true,container:false},containerFields:{}}),
  query:async()=>({docker:{containers:raw}}),
  runDockerAction:async request=>{mutations.push(request);return {};}
 }});
 await provider.listContainers();
 await assert.rejects(provider.executeAction({action:'stop',container:'abcdef1234567890'}),error=>error.category==='identity-unresolved');
 assert.equal(mutations.length,0);
 assert.equal(await provider.reconcileContainer('abcdef1234567890'),null);
 assert.equal((await provider.getContainer('first-app')).id,entries[0].id);
});
test('merge consumers retain distinct authoritative IDs despite a colliding name alias',()=>{
 const merged=model.mergeContainers([entries[0]],[entries[1]]);
 assert.equal(merged.length,2);
 assert.deepEqual(merged.map(entry=>entry.id),entries.map(entry=>entry.id));
 assert.equal(model.resolveContainerIdentity('abcdef1234567890',merged),null);
});
