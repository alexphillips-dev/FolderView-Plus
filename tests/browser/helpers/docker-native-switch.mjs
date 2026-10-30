import fs from 'node:fs';

// Only the widget-factory adapter is synthetic. The switch's DOM, events and
// jQuery animation run the pinned Unraid widget unchanged (see vendor header).
const adapter = `
jQuery.easing.easeInOutCubic = value => value < .5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
jQuery.widget = (name, definition) => {
    if (name !== 'sylightsUI.switchButton') throw new Error('Unexpected fixture widget');
    jQuery.fn.switchButton = function(options = {}) {
        return this.each(function() {
            let widget = jQuery(this).data('fixture-native-switch');
            if (widget) { for (const [key, value] of Object.entries(options)) widget._setOption(key, value); return; }
            widget = Object.create(definition); widget.element = jQuery(this);
            widget.options = { ...definition.options, ...options };
            jQuery(this).data('fixture-native-switch', widget);
            window.fixtureSwitchCreates = (window.fixtureSwitchCreates || 0) + 1;
            widget._create();
        });
    };
};
`;
const widget = fs.readFileSync(new URL('../fixtures/vendor/unraid-switchbutton.js', import.meta.url), 'utf8');
export const nativeSwitchHost = source => source.replace('window.loadlist = () => window.listview();', `
const nativeRows = document.getElementById('docker_list').innerHTML
    .replaceAll('<input type="checkbox">', '<input type="checkbox" class="autostart" checked>');
window.loadlist = () => {
    window.fixtureNativeRefreshCount = (window.fixtureNativeRefreshCount || 0) + 1;
    jQuery('#docker_list').html(nativeRows);
    jQuery('.autostart').switchButton({ labels_placement: 'right' });
    window.listview();
};
`) + '\n' + adapter + '\n' + widget;
export const nativeSwitchCss = '.switch-button-background{position:relative;width:25px;height:11px;border:1px solid #aaa;background:#ccc;display:inline-block}.switch-button-background.checked{background:#486dba}.switch-button-button{position:absolute;left:-1px;top:-1px;width:12px;height:11px;border:1px solid #aaa;background:#fafafa}';
