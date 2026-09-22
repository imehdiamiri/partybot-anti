# Local Git recovery

Run `powershell -ExecutionPolicy Bypass -File scripts/backup-local.ps1` from this
repository after committing a release. It creates a dated, verified offline Git
bundle and SHA-256 checksum in `.backups/`, excluded from Git and publishing.
Bundles retain committed history, branches and tags. They do not include ignored
credentials, dependencies or uncommitted edits. Keep local credentials separately.

The snapshot before Whitney restoration is
`checkpoint/2026-09-22-before-whitney-restore` (60862d2).
The restored source is tagged `release/2026-09-22-whitney-restored`.

To inspect the prior version without changing current work:

```powershell
git worktree add --detach .backups/previous-version checkpoint/2026-09-22-before-whitney-restore
```

To recover from a bundle into a NEW directory, substitute its actual dated name:

```powershell
git clone .backups/playbot-DATE.bundle .backups/recovered-repository
```

To undo a specific source change in the current repository, use `git revert` after
reviewing that commit. Do not use `reset --hard` or force-push. Reverting Git does
not revert Firebase Hosting or EAS Update: rebuild and republish the selected
revision separately with its compatible runtime. These are local backups on the
same disk; a disk failure also affects them. Remote Git push remains unapproved.
