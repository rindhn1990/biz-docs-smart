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

- Tender export order persists separately per tender; module-filtered suggestions never query other modules, and selecting a shared signer copies signer/authorization fields into the tender JSON snapshot so directory edits cannot silently change other tenders.

- Tender export resolves verified Word aliases in a browser-safe helper, reads only the selected tender's shared data plus its selected document, and records tender linkage; explicit empty document values and template examples must not become fallback data.
- Region and document-field ordering persists existing sort_order values without changing Word content or field values.
- Tender Data Center reuses tender-only template mappings filtered by the tender's procurement method and optionally by template, and saves before direct export; invalidate the whole template_mappings query family after definition changes so shared fields refresh; explicit blank JSON values suppress metadata fallback, and keyed forms isolate package state without clearing data when methods change.

- Contractor notices use browser-safe value/export helpers and module-scoped template mappings; per-link received dates persist while per-export overrides stay isolated, and opt-in contractor saves conditionally fill only empty columns to avoid overwriting concurrent updates.
- Business registration extraction uses scoped accent-insensitive labels before generic rules so foreign names, signatures, bank fields and payment extraction cannot contaminate registry results.

- Salary batch orchestration uses injected delivery/log/wait adapters and a shared 10-recipient limit; server functions re-read authoritative data after an admin check so tests cannot deliver email and client values cannot override salaries or recipients.

- Per-region Word date formatting and automatic label resolution live in browser-safe format/template-values helpers and run only at preview/export boundaries; query mappings with labels, leave editable source dates unchanged, and never inherit another region's format.

- Payment scan field selection and result partitioning live in a browser-safe helper; template sources and default core fields drive one shared scan/edit list without mixing contractor and payment state.

- Document scan navigation uses native scrolling with image-relative region coordinates; shared scrollbar styling and tab visibility behavior keep overflow consistent across screens.

- Field examples use a module-scoped React Query cache separate from document values; only input placeholders consume it so persistence, synchronization and exports cannot inherit examples.

- All Vietnamese money-to-words output uses `src/lib/money.ts`'s `readVietnameseMoney` so forms, scripts and Word exports stay consistent.

- Document scan cropping lives in `DocumentRegionSelector`; it outputs one composite image so local OCR and AI fallback share the same selected-region input.
- Incremental scan merging and whole-file OCR caching live in browser-safe scan-session helpers; manual edits are protected and region OCR bypasses the per-dialog cache.
- Role-check functions `has_role`/`can_write` live in the `private` schema (not exposed via API); RLS policies and triggers call `private.*` so signed-in users cannot invoke them directly.
- The HR summary table reads the security_invoker view `employee_summary_view` with server-side filter/sort/range, so large datasets load one page per query without N+1 calls.
- HR unit view rows are narrowed and nullable counts/order normalized in the shared hook so selectors and mutation controls use valid keys.
- HR deletion uses database cascades for employee-linked records and a server-authorized storage cleanup queue with shared-file reference checks so unrelated originals survive.
- The template content editor edits paragraph text in place inside the original document.xml (no HTML round-trip), so Word formatting, tables, images and headers survive saves.
- Word text mutations use exact w:t matching and verify intended paragraph text, XML structure and unchanged package bytes; shared template-file-save backs up authoritative storage bytes before overwrites, while explicit whole-file replacement validates the new package independently because its layout may intentionally differ.
