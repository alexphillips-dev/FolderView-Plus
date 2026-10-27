import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const integration = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-integration.js');

test('theme-only Settings reflow preserves workspace data and refreshes visible theme status', () => {
    const source=fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js','utf8');
    const block=source.slice(source.indexOf('const applySettingsThemeAwareReflow ='),source.indexOf('const queueSettingsThemeAwareReflow ='));
    const calls=[];let active=false;
    const context={applySettingsResolvedThemeTokens:reason=>calls.push(reason),syncCompactMobileLayoutClass:()=>calls.push('layout'),
        enforceNoHorizontalOverflow:()=>calls.push('overflow'),refreshSettingsUx:options=>calls.push(options.renderSecondaryWorkspaces),
        shouldRefreshSecondaryAdvancedGroup:group=>active&&group==='themes',getThemeWorkspaceApi:()=>({renderSummary:()=>calls.push('summary')})};
    vm.runInNewContext(block+';globalThis.reflow=applySettingsThemeAwareReflow;',context);
    context.reflow();assert.deepEqual(calls,['settings-reflow','layout','overflow',false]);
    active=true;calls.length=0;context.reflow();assert.deepEqual(calls,['settings-reflow','layout','overflow',false,'summary']);
});

test('hidden theme summary defers DOM work and renders current host identity when activated', () => {
    const workspace=require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js');
    const host={innerHTML:''};let visible=false, name='Before';
    const doc={getElementById:id=>id==='fv-theme-workspace-summary'?host:null,
        documentElement:{getAttribute:key=>key==='data-fvplus-theme-name'?name:null},body:{getAttribute:()=>null}};
    const api=workspace.createApi({document:doc,shouldRenderSummary:()=>visible});
    api.renderSummary();assert.equal(host.innerHTML,'');
    name='After';visible=true;api.renderSummary();assert.match(host.innerHTML,/After/);assert.doesNotMatch(host.innerHTML,/>Before</);
});

test('system colors use the existing output writer and restore normal or missing outputs on exit', () => {
    const forced={matchMedia:()=>({matches:true})}, normal={matchMedia:()=>({matches:false})};
    const outputs={'--fvplus-ui-page':'#123456'};
    integration.applySystemColors(outputs,forced);
    assert.equal(outputs['--fvplus-ui-page'],'Canvas');
    assert.equal(outputs['--fvplus-system-control-border'],'1px solid ButtonText');
    const restored={'--fvplus-ui-page':'#123456'};integration.applySystemColors(restored,normal);
    assert.equal(restored['--fvplus-ui-page'],'#123456');
    assert.equal(restored['--fvplus-system-control-border'],'');
});

test('host identity uses explicit declaration or enabled known stylesheets without guessing from arbitrary URLs', () => {
    let declared='', base='black';
    const link={href:'https://theme.test/plugins/Aurora-Theme/styles/theme-2.css?v=1',disabled:false,media:''};
    const doc={baseURI:'https://theme.test/Settings',documentElement:{getAttribute:name=>name==='data-fvplus-theme-name'?declared:base},querySelectorAll:()=>[link]};
    const win={matchMedia:()=>({matches:false})};
    assert.deepEqual(integration.readHostIdentity(doc,win),{name:'Aurora Theme',source:'recognized'});
    link.disabled=true;assert.equal(integration.readHostIdentity(doc,win).source,'native-base');
    link.disabled=false;link.media='print';assert.equal(integration.readHostIdentity(doc,win).name,'Unraid Black');
    link.media='';link.href='https://foreign.test/plugins/Aurora-Theme/styles/theme.css';assert.equal(integration.readHostIdentity(doc,win).source,'native-base');
    base='';assert.equal(integration.readHostIdentity(doc,win).source,'unknown');
    declared='<Example theme>';assert.deepEqual(integration.readHostIdentity(doc,win),{name:declared,source:'declared'});
});

test('adaptation status separates unknown identity from working palette and recovery reasons', () => {
    const document={querySelectorAll:()=>[]}, window={matchMedia:()=>({matches:false})};
    const input={document,window,hostColors:{source:'computed'},applied:true,requestedMode:'auto',appliedMode:'auto'};
    assert.deepEqual(integration.describeIntegration(input),{identitySource:'unknown',paletteSource:'computed',reason:'none'});
    assert.equal(integration.describeIntegration({...input,applied:false,appliedMode:'highcontrast'}).reason,'contrast-recovery');
    assert.equal(integration.describeIntegration({...input,applied:false,requestedMode:'safe',appliedMode:'safe'}).reason,'requested-recovery');
    assert.equal(integration.describeIntegration({...input,applied:false}).reason,'missing-host-inputs');
    assert.equal(integration.describeIntegration({...input,window:{matchMedia:()=>({matches:true})}}).paletteSource,'system');
});

test('Aurora environment reports independent active assets and Plus ownership without exporting URLs', () => {
    const classes = new Set(['tp-enhance', 'tp-sidebar', 'tp-fvplus']);
    const links = ['theme-123.css', 'enhance.css', 'layout-sidebar.css'].map(file => ({
        href: `https://theme.test/plugins/Aurora-Theme/styles/${file}?private=value`, disabled: false }));
    const doc = { baseURI: 'https://theme.test/Docker', documentElement: { classList: { contains: token => classes.has(token) } },
        querySelectorAll: selector => selector === 'script[src]' ? [{ src: 'https://theme.test/plugins/Aurora-Theme/scripts/enhance.js' }] : links };
    const state = integration.readAuroraEnvironment(doc, { auroraDockerView: { plus: true } });
    assert.equal(state.detected, true); assert.equal(state.colors, true);
    assert.equal(state.enhancements, true); assert.equal(state.sidebar, true); assert.equal(state.enhancementScript, true);
    assert.equal(state.plusMarker, true); assert.equal(state.plusView, true); assert.equal(state.sidebarCollapsed, false);
    assert.equal(JSON.stringify(state).includes('theme.test'), false);
    links[1].disabled = true;
    assert.equal(integration.readAuroraEnvironment(doc, {}).enhancements, false);
});

const fixture = () => {
    const style = { fontFamily:'Example, sans-serif', fontSize:'14px', fontWeight:'600', lineHeight:'20px',
        letterSpacing:'1px', textTransform:'none', padding:'8px 16px', borderRadius:'12px', display:'inline-block', visibility:'visible' };
    const node = { closest:()=>false, getClientRects:()=>[{}], getBoundingClientRect:()=>({height:38}) };
    const doc = { querySelectorAll:()=>[node] };
    const win = { getComputedStyle:()=>style };
    return { style,node,doc,win };
};

test('native control metrics preserve host font, padding and height without a theme name', () => {
    const {doc,win} = fixture();
    const tokens = integration.controlTokens(true,{document:doc,window:win});
    assert.equal(tokens['--fvplus-host-control-font-family'],'Example, sans-serif');
    assert.equal(tokens['--fvplus-host-control-font-size'],'14px');
    assert.equal(tokens['--fvplus-host-control-padding'],'8px 16px');
    assert.equal(tokens['--fvplus-host-control-height'],'38px');
    assert.equal(tokens['--fvplus-host-control-radius'],'12px');
});

test('owned, hidden and disabled controls never become the source of host metrics', () => {
    for (const kind of ['owned','hidden','disabled','display','visibility','rect']) {
        const {node,style,doc,win} = fixture();
        if(kind==='owned') node.closest=()=>({});
        if(kind==='hidden') node.hidden=true;
        if(kind==='disabled') node.disabled=true;
        if(kind==='display') style.display='none';
        if(kind==='visibility') style.visibility='hidden';
        if(kind==='rect') node.getClientRects=()=>[];
        assert.equal(integration.readNativeControls(doc,win),null,kind);
    }
});

test('missing controls, recovery modes and pathological metrics clear every previous output', () => {
    const {doc,win,node,style} = fixture();
    for(const enabled of [false,true]) {
        if(enabled) doc.querySelectorAll=()=>[];
        const tokens=integration.controlTokens(enabled,{document:doc,window:win});
        assert.equal(Object.keys(tokens).length,9);
        assert.ok(Object.values(tokens).every(value=>value===''));
    }
    doc.querySelectorAll=()=>[node]; style.fontSize='70px';
    assert.equal(integration.readNativeControls(doc,win),null);
    style.fontSize='14px'; node.getBoundingClientRect=()=>({height:200});
    assert.equal(integration.readNativeControls(doc,win),null);
});

test('computed host sampling uses native surfaces and rejects invalid variable contracts', () => {
    const body={}, html={}, surface={ closest:()=>null, getClientRects:()=>[{}] };
    const styles=new Map([[body,{backgroundColor:'#111111',color:'#eeeeee'}], [html,{backgroundColor:'transparent'}],
        [surface,{backgroundColor:'#222222',color:'#dddddd',borderTopColor:'#777777'}]]);
    const doc={body,documentElement:html,querySelectorAll:selector=>selector==='[data-fvplus-theme-native="surface"]'?[surface]:[]};
    const win={getComputedStyle:node=>styles.get(node)};
    const parseColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?{value,a:1}:null;
    const isColorUsable=color=>color?.a===1;
    const options={document:doc,window:win,parseColor,isColorUsable};
    const palette=integration.readComputedPalette([],options);
    assert.equal(palette.source,'computed'); assert.equal(palette.page.value,'#111111');
    assert.equal(palette.card.value,'#222222'); assert.equal(palette.text.value,'#dddddd');
    assert.equal(integration.readComputedPalette([{getPropertyValue:()=> 'var(--missing)'}],options),null);
    surface.closest=()=>({});
    assert.equal(integration.readComputedPalette([],options),null,'owned surfaces must not feed resolved output back');
});

const observerFixture = () => {
    class Target {
        listeners=new Map();
        once=new Set();
        addEventListener(name,callback,options) { if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(callback);if(options?.once)this.once.add(callback); }
        removeEventListener(name,callback) { this.listeners.get(name)?.delete(callback);this.once.delete(callback); }
        emit(name,properties={}) { for(const callback of [...(this.listeners.get(name)||[])]) { callback({type:name,target:this,...properties});if(this.once.has(callback))this.removeEventListener(name,callback); } }
        count() { return [...this.listeners.values()].reduce((sum,items)=>sum+items.size,0); }
    }
    const timers=new Map(), observers=[], media=[];let next=0,resolveFonts;
    const doc=new Target();Object.assign(doc,{documentElement:{},body:{},head:{},fonts:new Target()});
    doc.fonts.status='loading';doc.fonts.ready=new Promise(resolve=>{resolveFonts=resolve;});
    const win=new Target();Object.assign(win,{document:doc,
        setTimeout(callback){timers.set(++next,callback);return next;},clearTimeout(id){timers.delete(id);},
        MutationObserver:class { constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;observers.push(this);}observe(target){this.targets.push(target);}disconnect(){this.disconnected=true;} },
        matchMedia(){const target=new Target();media.push(target);return target;}
    });
    const flush=()=>{let passes=0;while(timers.size){assert.ok(++passes<20,'observers must settle');const work=[...timers.values()];timers.clear();for(const callback of work)callback();}};
    return {doc,win,observers,media,flush,resolveFonts,timers};
};

test('one document watcher shares stylesheet font media and explicit events and removes all listeners', async () => {
    const f=observerFixture(), changes=[];
    const one=integration.observeThemeChanges(reason=>changes.push('one:'+reason),{document:f.doc,window:f.win});
    const two=integration.observeThemeChanges(reason=>changes.push('two:'+reason),{document:f.doc,window:f.win});
    assert.equal(f.observers.length,1);assert.equal(f.observers[0].targets.length,3);
    const style={nodeType:1,tagName:'STYLE'};
    f.observers[0].callback([{type:'childList',addedNodes:[{nodeType:1,tagName:'SCRIPT'}]}]);f.flush();assert.equal(changes.length,0);
    f.observers[0].callback([{type:'childList',addedNodes:[style]}]);f.flush();assert.deepEqual(changes,['one:observer','two:observer']);
    f.doc.emit('load',{target:{nodeType:1,tagName:'LINK'}});f.doc.fonts.emit('loadingdone');f.win.emit('folderviewplus:theme-change');f.flush();
    assert.equal(changes.at(-1),'two:theme-event','bursts must coalesce');
    one();assert.equal(f.observers[0].disconnected,false);
    f.win.emit('folderviewplus:theme-change');two();f.resolveFonts();await Promise.resolve();f.flush();
    assert.equal(f.observers[0].disconnected,true);assert.equal(f.win.count(),0);assert.equal(f.doc.count(),0);assert.equal(f.doc.fonts.count(),0);
    assert.ok(f.media.every(target=>target.count()===0));assert.equal(changes.length,4);
});

test('page suspension cancels pending work and restoration reconnects without stale font completions', async () => {
    const f=observerFixture(), changes=[];let suspended=0;
    const off=integration.observeThemeChanges(reason=>changes.push(reason),{document:f.doc,window:f.win,onSuspend:()=>suspended++});
    f.win.emit('folderviewplus:theme-change');f.win.emit('pagehide',{persisted:true});f.resolveFonts();await Promise.resolve();f.flush();
    assert.equal(suspended,1);assert.deepEqual(changes,[]);assert.equal(f.observers[0].disconnected,true);
    f.doc.fonts.status='loaded';f.win.emit('pageshow',{persisted:true});f.flush();
    assert.equal(f.observers.length,2);assert.deepEqual(changes,['pageshow']);
    off();assert.equal(f.win.count(),0);
    const next=integration.observeThemeChanges(()=>{}, {document:f.doc,window:f.win});
    const count=f.observers.length;off();
    const another=integration.observeThemeChanges(()=>{}, {document:f.doc,window:f.win});
    assert.equal(f.observers.length,count,'repeated old cleanup must not delete the active registry');
    next();another();assert.equal(f.win.count(),0);
});

test('surface bindings and native runtime consumers dispose and rebind the actual shared watcher', () => {
    const f=observerFixture(), applied=[];
    const binding=integration.createBinding({document:f.doc,window:f.win,applyResolvedThemeTokens:reason=>applied.push(reason)});
    binding.bind();binding.bind();assert.equal(f.observers.length,1);
    f.win.emit('folderviewplus:theme-change');binding.disconnect();f.flush();assert.equal(applied.length,2);
    binding.bind();assert.equal(f.observers.length,2);
    f.win.emit('folderviewplus:theme-change');f.flush();assert.equal(applied.at(-1),'surface:theme-event');binding.disconnect();
    const state=require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.state-observers.js');
    const reflows=[];const controller=state.createThemeReflowController({document:f.doc,window:f.win,scheduleReflow:reason=>reflows.push(reason)});
    controller.bindThemeReflow();controller.bindThemeReflow();
    f.win.emit('folderviewplus:theme-change');f.flush();assert.deepEqual(reflows,['theme:theme-event']);
    controller.dispose();f.flush();assert.equal(f.win.count(),0);
});

for(const surface of ['settings','dashboard']) test(`${surface} production listener initializer delegates events and tears down subscriptions`, () => {
    const f=observerFixture(), changes=[];
    f.win.FolderViewPlusFoundationModules={themeIntegration:integration};
    const file=surface==='settings'?'folderviewplus.js':'dashboard.js';
    const source=fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/'+file,import.meta.url),'utf8');
    const name=surface==='settings'?'initThemeAwareSettingsReflow':'bindDashboardThemeReflowHandlers';
    const start=source.indexOf(`const ${name} =`), end=source.indexOf(surface==='settings'?'\nconfigureThemeResolverRuntimeApi':'\nbindDashboardThemeReflowHandlers();',start);
    assert.ok(start>0&&end>start);
    const prefix=surface==='settings'?'settings':'dashboard';
    const context={window:f.win,document:f.doc,applySettingsThemeAwareReflow:()=>{},
        queueSettingsThemeAwareReflow:reason=>changes.push(reason),queueDashboardThemeReflow:reason=>changes.push(reason),
        clearTimeout:f.win.clearTimeout,queuedLoadlistTimer:null,dashboardStorageWriter:null,
        dashboardLiveRefreshController:{dispose(){}},dashboardHostAdapterModule:null,runtimeHostAdapters:null,dashboardDockerProviderRegistry:null};
    const scope=`let ${prefix}ThemeReflowBound=false, ${prefix}ThemeReflowUnsubscribe=null, ${prefix}ThemeReflowTimer=null;\n`;
    let cleanup='';
    if(surface==='dashboard') {
        const a=source.lastIndexOf("window.addEventListener('pagehide',"), suffix='\n});';
        const b=source.indexOf(suffix,a)+suffix.length;assert.ok(a>0&&b>a);cleanup=source.slice(a,b);
    }
    vm.runInNewContext(scope+source.slice(start,end)+'\n'+cleanup+`\nglobalThis.bindPage=${name};`,context);
    context.bindPage();context.bindPage();assert.equal(f.observers.length,1);
    f.win.emit('folderviewplus:theme-change');f.flush();assert.deepEqual(changes,['theme-event']);
    f.win.emit('pagehide',{persisted:true});f.win.emit('pageshow',{persisted:true});f.flush();assert.equal(changes.at(-1),'pageshow');
    f.win.emit('pagehide',{persisted:false});f.flush();assert.equal(f.win.count(),0);assert.equal(f.doc.count(),0);
});
