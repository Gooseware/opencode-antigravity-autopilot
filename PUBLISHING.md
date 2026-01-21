# Publishing Checklist

## Pre-publish

- [x] Update version in `package.json` (v2.0.0)
- [x] Update `CHANGELOG.md` with release notes
- [x] All tests pass (`npm test`)
- [x] Build succeeds (`npm run build`)
- [x] Type checking passes (`npm run typecheck`)
- [x] README.md is up-to-date
- [x] LICENSE file exists
- [x] `.npmignore` configured correctly
- [x] Examples are working

## Publish Steps

### 1. Final Verification

```bash
# Clean build
rm -rf dist node_modules package-lock.json
npm install
npm run build
npm run typecheck

# Test installation locally
npm pack
npm install -g opencode-antigravity-autopilot-2.0.0.tgz
```

### 2. Git Release

```bash
# Ensure on main branch
git checkout main
git pull origin main

# Tag release
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin v2.0.0
```

### 3. NPM Publish

```bash
# Login to npm (if needed)
npm login

# Publish
npm publish

# Or dry-run first
npm publish --dry-run
```

### 4. GitHub Release

1. Go to GitHub Releases
2. Click "Draft a new release"
3. Select tag `v2.0.0`
4. Release title: `v2.0.0 - Plugin-Only Implementation`
5. Copy content from CHANGELOG.md
6. Publish release

### 5. Post-publish Verification

```bash
# Verify on npm
npm view opencode-antigravity-autopilot

# Test installation
npm install -g opencode-antigravity-autopilot
quota_status --help  # or whatever CLI you have
```

## Rollback (if needed)

```bash
# Unpublish within 72 hours
npm unpublish opencode-antigravity-autopilot@2.0.0

# Or deprecate
npm deprecate opencode-antigravity-autopilot@2.0.0 "Use v2.0.1 instead"
```

## Post-Release

- [ ] Announce on GitHub Discussions
- [ ] Update documentation site (if any)
- [ ] Tweet/share announcement
- [ ] Monitor GitHub issues for bug reports
- [ ] Bump version to 2.0.1-dev in package.json
