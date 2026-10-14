# Ownership and release policy

The `rinspacehq` organization maintains the `rinspacehq/rinspace-editor-markdown` repository and `@rinspacehq/markdown-writer` package. Milkdown and Crepe remain upstream projects; Rinspace owns only its original page, adapters, and writing enhancements. The package is the editable source for the public writing surface. Rinspace's private product consumes an exact reviewed release and owns account, upload, Quiver, draft, save, and publication adapters.

The repository was renamed from `rinspacehq/markdown-writer` to `rinspacehq/rinspace-editor-markdown` before `v0.3.4`; the package name remains stable throughout the `v0.3.x` line. Keep all old package and release assets available for existing consumers. Do not republish old assets under new bytes.

Releases require maintainer review, clean `npm ci`, type/build/test checks, inspection of `npm pack` contents, third-party license review, and isolated validation in the Rinspace Markdown article and book editors. A public contribution is never applied to the private product automatically. A change to Markdown semantics or the public API needs tests, a migration note, and an appropriate version bump.

Releases use GitHub Releases. Build and test from a reviewed commit, then attach the exact `npm pack` `.tgz` and a SHA-256 checksum to a draft release. Publish only after both assets are attached and release immutability is enabled. Consumers install by versioned release URL and lockfile integrity; GitHub's generated source archives are not package artifacts.
