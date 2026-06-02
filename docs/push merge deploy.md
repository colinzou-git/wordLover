# Keep using this pattern:

feature branch → main → copy public folder → gh-pages

And always use the separate folder:

WordFan-gh-pages

That avoids the deletion/locked-folder errors you had when switching branches inside the same working directory.

Best future workflow: **keep source work on `main` / feature branches, and keep deployment in a separate `gh-pages` worktree**. Do **not** keep switching the same folder between `main` and `gh-pages`; that caused the locked-folder cleanup problems.

## One-time setup

From your normal repo folder:

```plaintext
cd C:\Users\colin\Documents\WordFan

git fetch origin
git worktree add ..\WordFan-gh-pages gh-pages

```

After this, you have two folders:

```plaintext
C:\Users\colin\Documents\WordFan          # source repo: main / feature branches
C:\Users\colin\Documents\WordFan-gh-pages # publish repo: gh-pages only

```

## Normal future workflow

### 1. Work on a feature branch

```plaintext
cd C:\Users\colin\Documents\WordFan

git checkout main
git pull origin main

git checkout -b feat/my-new-feature

```

Do your coding. Then test locally.

### 2. Commit and push feature branch

```plaintext
git status
git add .
git commit -m "Describe the feature"
git push -u origin feat/my-new-feature

```

### 3. Merge feature branch into `main`

You can merge locally:

```plaintext
git checkout main
git pull origin main
git merge feat/my-new-feature
git push origin main

```

Or use a GitHub PR. For your current personal workflow, local merge is okay.

### 4. Deploy `main` public folder to `gh-pages`

Stay in the source repo first:

```plaintext
cd C:\Users\colin\Documents\WordFan
git checkout main
git pull origin main
```

Then copy the app’s public folder into your `gh-pages` worktree:

```plaintext
cd C:\Users\colin\Documents\WordFan

robocopy .\apps\wordlover-pwa\public ..\WordFan-gh-pages /MIR /XD .git /XF .git
"wordfan.app" | Set-Content ..\WordFan-gh-pages\CNAME -NoNewline

```

Then publish from the `gh-pages` worktree:

```plaintext
cd ..\WordFan-gh-pages

git status
git add .
git commit -m "Publish WordFan app"
git push origin gh-pages

```

That final push publishes to:

```plaintext
https://wordfan.app/

```

## Best full command template

Use this after your feature branch is ready:

```plaintext
cd C:\Users\colin\Documents\WordFan

# Push feature branch
git status
git add .
git commit -m "Your feature summary"
git push -u origin HEAD

# Merge to main
$feature = git branch --show-current
git checkout main
git pull origin main
git merge $feature
git push origin main

# Deploy public folder to gh-pages worktree
robocopy .\apps\wordlover-pwa\public ..\WordFan-gh-pages /MIR /XD .git /XF .git
"wordfan.app" | Set-Content ..\WordFan-gh-pages\CNAME -NoNewline

cd ..\WordFan-gh-pages
git status
git add .
git commit -m "Publish WordFan app"
git push origin gh-pages
cd ..\WordFan\

```

## After deploy, verify

```plaintext
gh api repos/colinzou-git/wordLover/pages --jq "{status: .status, html_url: .html_url, source: .source}"
gh api repos/colinzou-git/wordLover/pages/builds --jq ".[0] | {status: .status, error: .error, created_at: .created_at, updated_at: .updated_at}"

```

## My recommendation

Keep using this pattern:

```plaintext
feature branch → main → copy public folder → gh-pages

```

And always use the separate folder:

```plaintext
WordFan-gh-pages

```

That avoids the deletion/locked-folder errors you had when switching branches inside the same working directory.
