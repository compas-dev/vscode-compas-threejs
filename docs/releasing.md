# Releasing

Releases are prepared by Release Please and published to the Visual Studio
Marketplace by GitHub Actions.

1. Merge conventional commits into `main` through reviewed pull requests.
2. Review and merge the release pull request maintained by Release Please.
3. Release Please creates the version tag and GitHub release.
4. The release workflow builds and verifies the VSIX, publishes it to the
   Marketplace, and attaches the same VSIX to the GitHub release.

The initial manifest version is `0.0.0`, so the first feature release proposed
by Release Please is `0.1.0`. After that release, the manifest records the last
published version automatically.

If GitHub release creation succeeds but Marketplace publication fails, dispatch
the `release` workflow with `publish` enabled. The workflow requires the matching
tagged GitHub release and safely skips a Marketplace version that already exists.

## Commit messages

Release Please derives versions and release notes from conventional commits:

- `fix:` produces a patch release.
- `feat:` produces a minor release.
- `feat!:` or a `BREAKING CHANGE:` footer produces a major release.
- `chore:`, `docs:`, `test:`, and `refactor:` do not create a release unless
  they contain a breaking-change footer.

Do not manually bump `package.json`, edit the version manifest, create release
tags, or publish from a workstation.

## One-time organization setup

Before the first release:

1. Create or confirm the `compas-dev` publisher in the Visual Studio
   Marketplace and grant the maintainers who approve releases access to it.
2. Create an Azure DevOps personal access token for all accessible
   organizations with the **Marketplace → Manage** scope. Store it only as the
   `VSCE_PAT` secret in a protected GitHub environment named `marketplace`.
3. Restrict the `marketplace` environment to `main` and add required reviewers
   if desired.
4. Create a fine-grained GitHub token for a release automation account with
   access to this repository and read/write access to contents, issues, and pull
   requests. Store it as the repository secret `RELEASE_PLEASE_TOKEN`.
5. In **Settings → Actions → General**, allow GitHub Actions to create pull
   requests and give workflows read/write repository permission.
6. Protect `main` and require the `ci / checks` job before merging normal and
   release pull requests.

Release Please uses `RELEASE_PLEASE_TOKEN` instead of the built-in
`GITHUB_TOKEN` so creating or updating its release pull request triggers the
normal CI workflow and required status check.

The Marketplace is retiring global Azure DevOps PATs on 2026-12-01. Replace the
`VSCE_PAT` step with Microsoft Entra ID or Marketplace trusted publishing before
that date once the organization has configured the supported identity flow.
