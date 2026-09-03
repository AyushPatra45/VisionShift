# VisionShift Team Work Board

This is the project's shared coordination file. **Every contributor must read and update it before starting work and before handing work to someone else.** Its purpose is to prevent two people from editing the same feature or high-conflict file at the same time.

Last remote check: **2026-09-03** — GitHub contains only `main`, no collaborator branches, and no pull-request refs. All five published commits are authored by `AyushPatra45`. Palak's and Ayana's local, unpushed work cannot be inspected from GitHub and must be declared below before anyone edits overlapping areas.

## Active work board

Update one row before writing code. Do not write “working everywhere”; claim a specific feature and file area.

| Person | GitHub username | Branch | Task | Files or area claimed | Status | Last updated |
| --- | --- | --- | --- | --- | --- | --- |
| Ayush | `AyushPatra45` | `main` | Project owner and review | Final review and releases | Available | 2026-09-03 |
| Palak | Add username | Add branch | **Confirm any local work before continuing** | Not declared | Unknown | 2026-09-03 |
| Ayana | Add username | Add branch | **Confirm any local work before continuing** | Not declared | Unknown | 2026-09-03 |

Allowed status values: `Planned`, `In progress`, `Ready for review`, `Blocked`, `Complete`, or `Unknown`.

## Rules that prevent clashes

1. **Never share a working branch.** Each person creates a separate branch from the latest `main`.
2. **Do not push feature work directly to `main`.** Push the personal branch and open a pull request.
3. **Claim the task and files in the table first.** If another row already claims the same area, coordinate before editing.
4. Treat `app.js`, `index.html`, and `styles.css` as high-conflict files. Only one active task should own each of them at a time.
5. Keep feature code and its tests in the same branch and pull request.
6. Before requesting review, merge the latest `origin/main`, resolve conflicts on the feature branch, and run the full checks.
7. Never use `git push --force` on `main` or another person's branch.
8. After a pull request is merged, move its entry to the completed-work log and clear the active row.

## Starting a task

Replace `palak` and `feature-name` with the contributor and task name:

```bash
git switch main
git pull --ff-only origin main
git switch -c palak/feature-name
```

Then update the active work board on that branch, commit the claim with the work, and tell the team which files are being changed. For highly contested work, create a small coordination pull request first or use a GitHub Issue assigned to the contributor.

## Before opening a pull request

```bash
git fetch origin
git merge origin/main
npm test
npm run build
git push -u origin palak/feature-name
```

Open a pull request into `main`. The owner should merge only after the automated tests pass and the affected experience has been checked in a browser.

## Handoff template

Copy this section to the bottom of the file when work is paused or transferred:

```md
### YYYY-MM-DD — Person — Task name

- Branch:
- Files changed:
- Finished:
- Still needed:
- Tests run:
- Known problems or decisions:
```

## Completed-work log

| Date | Contributor | Commit | Work completed |
| --- | --- | --- | --- |
| 2026-09-01 | Ayush (`AyushPatra45`) | `2ba1330` | Created the VisionShift repository |
| 2026-09-02 | Ayush (`AyushPatra45`) | `b67f510` | Built the six-experience camera lab |
| 2026-09-02 | Ayush (`AyushPatra45`) | `2965052` | Added safe GitHub Pages setup handling |
| 2026-09-02 | Ayush (`AyushPatra45`) | `b98347e` | Fixed startup and made mode navigation resilient |
| 2026-09-02 | Ayush (`AyushPatra45`) | `21acb0f` | Made launcher tests portable and completed the public deployment workflow |

## Recommended GitHub protection

The repository owner should protect `main` in **GitHub → Settings → Branches** and require a pull request before merging. This turns the rules above into repository safeguards instead of relying only on memory.
