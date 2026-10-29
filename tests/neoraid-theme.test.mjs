import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const integration = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-integration.js');
const fixture = () => {
    const classes = new Set(['nr', 'nr-dark']);
    const attrs = { 'data-fvplus-host-theme':'black', 'data-nr-density':'compact', 'data-nr-radius':'round', 'data-nr-font':'inter' };
    const link = { href:'https://fixture.test/plugins/neoraid/sheets/Neoraid.css?v=private-token', disabled:false, media:'' };
    const doc = { baseURI:'https://fixture.test/Settings', documentElement:{ classList:{ contains:name => classes.has(name) }, getAttribute:name => attrs[name] }, querySelectorAll:() => [link] };
    const win = { matchMedia:media => ({ matches:media === 'screen' }) };
    const describe = () => integration.describeIntegration({document:doc, window:win, applied:true, requestedMode:'auto', appliedMode:'auto'});
    return {classes, attrs, link, doc, win, describe};
};
test('NeoRaid identity requires its active marker and an enabled same-origin color stylesheet', () => {
    const {classes, attrs, link, doc, win} = fixture();
    assert.deepEqual(integration.readHostIdentity(doc,win), {name:'NeoRaid',source:'recognized'});
    for (const href of ['https://foreign.test/plugins/neoraid/sheets/Neoraid.css', '/plugins/example/neoraid.css', '/plugins/neoraid/sheets/Neoraid.css.backup']) {
        link.href=href;assert.equal(integration.readHostIdentity(doc,win).source,'native-base');
    }
    link.href='/plugins/neoraid/sheets/Neoraid.css?v=123';
    link.disabled=true;assert.equal(integration.readHostIdentity(doc,win).name,'Unraid Black');
    link.disabled=false;link.media='print';assert.equal(integration.readHostIdentity(doc,win).source,'native-base');
    link.media='screen';assert.equal(integration.readHostIdentity(doc,win).name,'NeoRaid');
    classes.delete('nr');assert.equal(integration.readHostIdentity(doc,win).source,'native-base');
    classes.add('nr');attrs['data-fvplus-theme-name']='Declared theme';
    assert.deepEqual(integration.readHostIdentity(doc,win),{name:'Declared theme',source:'declared'});
});
test('NeoRaid diagnostics expose only bounded active options and clear on stylesheet removal', () => {
    const {classes,attrs,link,describe}=fixture();
    assert.deepEqual(describe().neoraid,{active:true,mode:'dark',density:'compact',radius:'round',font:'inter'});
    classes.delete('nr-dark');classes.add('nr-light');attrs['data-nr-font']='system';
    assert.equal(describe().neoraid.mode,'light');assert.equal(describe().neoraid.font,'system');
    classes.delete('nr-light');assert.equal(describe().neoraid.mode,'native');
    attrs['data-nr-density']='/mnt/user/private';attrs['data-nr-radius']='https://private.invalid/';
    assert.equal(describe().neoraid.density,'unknown');assert.equal(describe().neoraid.radius,'unknown');
    assert.equal(JSON.stringify(describe()).includes('private'),false);
    link.disabled=true;
    assert.deepEqual(describe().neoraid,{active:false,mode:'unknown',density:'unknown',radius:'unknown',font:'unknown'});
});
