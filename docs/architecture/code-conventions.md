# Production Code Conventions

1. **Feature API:** cross-feature runtime imports use `@/features/<feature>` or its public index. Direct imports of another feature’s `application`, `domain`, `infrastructure`, or `components` are forbidden.
2. **Layer responsibility:** `domain` is pure; `application` orchestrates use cases and hooks; `infrastructure` owns browser, Pixi, storage, worker, or network integration; `components` renders React UI.
3. **File naming:** React components, React context/provider modules, and class-defining modules use PascalCase. Hooks, functions, contracts, constants, and data modules use camelCase.
4. **Directory naming:** directories use lowercase kebab-case when multiple words are required. Layer directories retain their standard single-word names.
5. **Relative imports:** every relative production import includes an extension. Use `.js` when target source is `.js`, `.ts`, or `.tsx`; use `.jsx` when target source is `.jsx`; preserve asset extensions such as `.json`. Package imports and `@/` aliases remain extensionless.
6. **Import order:** Node built-ins → third-party packages → `@kukla2d/*` → `@/platform` → `@/store` → `@/domain` and `@/runtime` → `@/features/*` → `@/lib` → `@/components/ui` → parent/sibling/index relative imports → type-only imports. Exactly one blank line separates groups; entries within a group sort case-insensitively by specifier.
7. **Exports:** feature/package indices expose stable APIs only. Internal barrels require a named submodule boundary and may not bypass feature-boundary checks.
8. **Public TypeScript:** exported production functions, hooks, and public class methods have explicit return types. Enforce with `@typescript-eslint/explicit-module-boundary-types` for `.ts/.tsx` production files.
9. **IDs:** persisted JSON and migration DTOs use validated strings. After schema validation or ID creation, application/domain/store APIs use appropriate branded ID. Do not cast arbitrary input into a brand.
10. **Names:** identifiers `ed`, `proj`, `anim`, `kfOv`, and `drOv` are forbidden in production code outside Live2D. Use `editorState`, `project`/`projectDraft`, `animation`/`animationState`/`animationStore`, `keyframeOverride`, and `draftOverride` according to type and mutation role. Enforce with ESLint `id-denylist`.
11. **Comments:** English only. Comments explain an invariant, lifecycle, compatibility reason, or non-obvious trade-off. In TypeScript, JSDoc must not duplicate parameter/return types.
12. **Errors:** state-changing or user-visible failures retain diagnostic context. Best-effort cleanup may suppress errors only when cleanup cannot change primary result; such catches include a short English rationale.
