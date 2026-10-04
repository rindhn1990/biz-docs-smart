<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions

- Document scan cropping lives in `DocumentRegionSelector`; it outputs one composite image so local OCR and AI fallback share the same selected-region input.
- Role-check functions `has_role`/`can_write` live in the `private` schema (not exposed via API); RLS policies and triggers call `private.*` so signed-in users cannot invoke them directly.
- The HR summary table reads the security_invoker view `employee_summary_view` with server-side filter/sort/range, so large datasets load one page per query without N+1 calls.
