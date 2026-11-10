<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Branches and deploys: only `dev` and production

The repository keeps exactly two long-lived branches:

- **`dev`**: where all work happens. Commit and push here first. Every push builds a
  Vercel preview (and the `preview.yml` workflow aliases it to
  `vertex-rental-cars-dev.vercel.app`). Test there before promoting.
- **`claude/vertex-rental-cars-setup-qfvbwx`**: **production**. It is the GitHub default
  branch and the branch Vercel deploys to `vertexrentalcar.com`. Only fast-forward it from
  `dev` (`git push origin dev:claude/vertex-rental-cars-setup-qfvbwx`) once `dev` is tested,
  and only when the owner asks to go to production.

Do not create other branches (no feature branches, no `main`/`master`). If a session is
assigned another branch, still deliver the work to `dev`, and delete that branch once its
commits are on `dev`. Preview and production share the same Supabase database and Stripe
keys, so testing on `dev` touches real data.
