import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const outputDir = path.resolve(process.env.FVPLUS_RUNTIME_FIXTURE_DIR || path.join(repoRoot, 'tmp', 'runtime-fixture'));
const outputPath = path.join(outputDir, 'index.html');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const runtimeSharedCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FolderView Plus Runtime Fixture</title>
<style>
    :root {
        --text: #dbe4f0;
        --fvplus-runtime-theme-foreground: #dbe4f0;
        --fvplus-preview-divider-width: 1px;
        --fvplus-preview-border-width: 1px;
        --fvplus-preview-border-color: rgba(223, 228, 238, 0.52);
        color-scheme: dark;
        background: #16181c;
    }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        font: 13px/1.35 "Segoe UI", sans-serif;
        background:
            radial-gradient(circle at top left, rgba(255, 154, 60, 0.08), transparent 30%),
            linear-gradient(180deg, #171a1e 0%, #121417 100%);
        color: var(--text);
    }
    .fixture-shell {
        width: min(1500px, calc(100vw - 32px));
        margin: 24px auto 40px;
        display: grid;
        gap: 16px;
    }
    .fixture-card {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(20, 24, 29, 0.92);
        border-radius: 14px;
        padding: 16px 18px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.28);
    }
    .fixture-card h2 {
        margin: 0 0 4px;
        font-size: 15px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .fixture-card p {
        margin: 0 0 14px;
        color: rgba(219,228,240,0.72);
    }
    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }
    td {
        padding: 8px 10px;
        border-top: 1px solid rgba(255,255,255,0.04);
        vertical-align: middle;
    }
    td.versioncolumn, td.updatecolumn, td.descriptioncolumn {
        color: rgba(219,228,240,0.72);
    }
    tr.folder > td {
        background: rgba(255,255,255,0.015);
    }
    .folder-name {
        color: var(--text);
    }
    .folder-hand {
        opacity: 0.6;
        margin-right: 6px;
    }
    .folder-state {
        font-size: 11px;
        opacity: 0.84;
    }
    .img.folder-img {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        object-fit: cover;
        background: linear-gradient(135deg, #56657e 0%, #293445 100%);
    }
    .img.folder-icon {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        background: linear-gradient(135deg, #ff9a3c 0%, #f15a2c 100%);
    }
    .folder-element-custom-btn a {
        color: inherit;
        text-decoration: none;
    }
${runtimeSharedCss}
${dockerCss}
${vmCss}
</style>
</head>
<body>
<main class="fixture-shell">
    <section class="fixture-card">
        <h2>Docker Single Row</h2>
        <p>Baseline single-row compact cards with a missing WebUI placeholder and chevron alignment.</p>
        <table>
            <tbody id="docker_view">
                <tr class="folder hover">
                    <td class="ct-name folder-name">
                        <div class="folder-name-sub">
                            <span class="folder-hand">☰</span>
                            <span class="folder-outer">
                                <img class="img folder-icon" alt="">
                                <span class="folder-inner">
                                    <span class="folder-appname">Plex</span>
                                    <span class="folder-state">8/10 started</span>
                                </span>
                            </span>
                            <button type="button" class="folder-dropdown"><i>⌄</i></button>
                        </div>
                    </td>
                    <td class="versioncolumn folder-version">
                        <div class="folder-preview">
                            <div class="folder-preview-wrapper">
                                <span class="outer">
                                    <span class="inner">
                                        <img class="img folder-img" alt="">
                                        <span class="appname">Plex-Media-Server</span>
                                        <span class="folder-state">started</span>
                                        <span class="folder-element-custom-btn"><a href="#">↗</a></span>
                                        <span class="folder-element-custom-btn"><a href="#">≡</a></span>
                                    </span>
                                </span>
                            </div>
                            <div class="folder-preview-divider"></div>
                            <div class="folder-preview-wrapper">
                                <span class="outer">
                                    <span class="inner">
                                        <img class="img folder-img" alt="">
                                        <span class="appname">Wizard</span>
                                        <span class="folder-state">started</span>
                                        <span class="fv-preview-webui-placeholder"><span class="fv-preview-webui-placeholder-icon">↗</span></span>
                                        <span class="folder-element-custom-btn"><a href="#">≡</a></span>
                                    </span>
                                </span>
                            </div>
                        </div>
                    </td>
                    <td class="updatecolumn folder-update">up-to-date</td>
                </tr>
            </tbody>
        </table>
    </section>

    <section class="fixture-card">
        <h2>Docker Multi Row</h2>
        <p>Multi-row compact preview with vertical bars and mixed WebUI availability.</p>
        <table>
            <tbody>
                <tr class="folder hover">
                    <td class="ct-name folder-name">
                        <div class="folder-name-sub">
                            <span class="folder-hand">☰</span>
                            <span class="folder-outer">
                                <img class="img folder-icon" alt="">
                                <span class="folder-inner">
                                    <span class="folder-appname">Media Stack</span>
                                    <span class="folder-state">10/12 started</span>
                                </span>
                            </span>
                            <button type="button" class="folder-dropdown"><i>⌄</i></button>
                        </div>
                    </td>
                    <td class="versioncolumn folder-version">
                        <div class="folder-preview fv-preview-multirow" style="height:auto;">
                            <div class="folder-preview-row">
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">Plex-Media-Server</span><span class="folder-state">started</span><span class="folder-element-custom-btn"><a href="#">↗</a></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                                <div class="folder-preview-divider"></div>
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">Tautulli</span><span class="folder-state">started</span><span class="folder-element-custom-btn"><a href="#">↗</a></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                                <div class="folder-preview-divider"></div>
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">Wizard</span><span class="folder-state">started</span><span class="fv-preview-webui-placeholder"><span class="fv-preview-webui-placeholder-icon">↗</span></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                                <div class="folder-preview-divider"></div>
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">PlexWatch</span><span class="folder-state">started</span><span class="fv-preview-webui-placeholder"><span class="fv-preview-webui-placeholder-icon">↗</span></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                            </div>
                            <div class="folder-preview-row">
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">SeekAndWatch</span><span class="folder-state">stopped</span><span class="folder-element-custom-btn"><a href="#">↗</a></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                                <div class="folder-preview-divider"></div>
                                <div class="folder-preview-wrapper fv-docker-preview-card fv-docker-preview-card-compact">
                                    <span class="outer"><span class="inner"><img class="img folder-img" alt=""><span class="appname">Overseerr</span><span class="folder-state">started</span><span class="fv-preview-webui-placeholder"><span class="fv-preview-webui-placeholder-icon">↗</span></span><span class="folder-element-custom-btn"><a href="#">≡</a></span></span></span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="updatecolumn folder-update">up-to-date</td>
                </tr>
            </tbody>
        </table>
    </section>

    <section class="fixture-card">
        <h2>VM Single Row</h2>
        <p>VM preview row using the same shared wrapper/dropdown contract with VM-specific gutter sizing.</p>
        <table>
            <tbody id="kvm_view">
                <tr class="folder hover">
                    <td class="vm-name folder-name">
                        <div class="folder-name-sub">
                            <span class="folder-hand">☰</span>
                            <span class="folder-outer">
                                <img class="img folder-icon" alt="">
                                <span class="folder-inner">
                                    <span class="folder-appname">Windows Servers</span>
                                    <span class="folder-state">1/1 stopped</span>
                                </span>
                            </span>
                            <button type="button" class="folder-dropdown"><i>⌄</i></button>
                        </div>
                    </td>
                    <td class="descriptioncolumn">
                        <div class="folder-preview">
                            <div class="folder-preview-wrapper">
                                <span class="outer">
                                    <span class="inner">
                                        <img class="img folder-img" alt="">
                                        <a href="#">Windows Server 2022</a>
                                        <span class="folder-state">stopped</span>
                                        <span class="folder-element-custom-btn"><a href="#">≡</a></span>
                                    </span>
                                </span>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </section>
</main>
</body>
</html>
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Runtime fixture generated: ${outputPath}`);
