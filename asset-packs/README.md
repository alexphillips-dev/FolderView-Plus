# Versioned asset packs

FolderView Plus ships the large third-party icon library separately from the core plugin archive. The plugin manifest pins an immutable icon-pack version, MD5, SHA-256, and branch-specific URL. Normal plugin builds exclude `images/third-party-icons`; the installer activates the downloaded pack at the existing runtime path.

## Publishing an icon-library change

1. Update the source icons under `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`.
2. Increment the semantic version in `asset-packs/icon-pack.version`. Never replace an archive that has already been published under the same version.
3. Run `bash scripts/build_icon_asset_pack.sh`.
4. Copy the printed MD5 and SHA-256 into `iconPackMd5` and `iconPackSha256` in `folderview.plus.plg`.
5. Run `bash scripts/icon_asset_pack_guard.sh` and the icon asset-pack regression test before packaging the plugin.

The builder produces a deterministic `folderview.plus-icons-<version>.txz` archive and SHA-256 sidecar. The guard fails if the source library changes without a rebuilt, newly versioned pack, if manifest checksums drift, or if the archive contains unsupported or unsafe entries.

At install time, the archive is retained under `/boot/config/plugins/folderview.plus` and extracted into a checksum-marked `/tmp/folderview.plus-assets/icons-<version>` cache. The public `images/third-party-icons` path is a symlink to that cache, preserving all existing icon URLs. Reinstalling the same pack reuses the verified extracted cache; rebooting rebuilds the RAM cache from the persistent archive.
