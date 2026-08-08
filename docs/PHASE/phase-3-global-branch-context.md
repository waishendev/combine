# Phase 3: CRM Global Branch Context and Selector

## Why Phase 3 is required

Phase 2 established which StoreLocations an authenticated Admin may access, but it did not give the CRM a shared current-Branch state. Without that state, each future Branch-aware page would have to load access independently and could disagree about which Branch the user is viewing.

Phase 3 adds one dashboard-wide Branch context and a Header selector. It is intentionally a **frontend context and selection phase**, not business-data scoping: Orders, Bookings, POS, Products, Inventory, Reports, Staff, Services, and other modules are still unchanged and unfiltered.

## What Phase 3 completed

- Added `BranchProvider` around the authenticated dashboard. The provider is created only after `/api/me` returns a valid numeric user ID, so persisted selection is isolated per user.
- Loaded the user's current accessible StoreLocations from `GET /api/me/store-locations` with credentials and `cache: no-store`.
- Kept only active StoreLocations in the selectable client state. The backend remains the authority for access.
- Added a responsive Branch selector to the CRM Header, including loading, retry, no-active-Branch, single-Branch, and multi-Branch states.
- Added the virtual **All Branches** selection only when the user currently has more than one accessible active Branch. It is UI/query intent and is not a StoreLocation row.
- Added typed StoreLocation capability fields needed by the shared context and future Branch-aware modules.
- Added deterministic parsing and resolution helpers plus tests for missing, invalid, stale, single-Branch, multi-Branch, and All-Branches selections.

The follow-up multi-Branch assignment work also replaced the Admin Create/Edit native multi-select with a checkbox checklist, preserves all existing assignments while adding or removing one Branch, and verifies that the Header offers all accessible Branches. This makes it practical to prepare multi-Branch users for the selector without relying on Ctrl/Cmd multi-select behavior.

## Selection and persistence rules

The preference is stored in browser `localStorage` under:

```text
gentlegurls:selected-branch:<authenticated-user-id>
```

The stored value is either a positive StoreLocation ID or the literal `all`. Resolution follows these rules:

1. With no active accessible Branches, selection is empty and the stored preference is removed.
2. With exactly one active accessible Branch, that Branch is selected automatically; `all` is not offered.
3. With multiple active accessible Branches, a still-accessible stored Branch is restored.
4. With multiple active accessible Branches and no valid stored Branch, **All Branches** is selected.
5. A malformed, non-positive, unsafe, inactive, removed, or no-longer-accessible stored ID is never retained as the current Branch.
6. A user switch uses a different storage key and triggers a fresh access request.

The context exposes `accessibleBranches`, `selectedBranchId`, `selectedBranch`, `isAllBranches`, loading/error state, `setSelectedBranch`, `refreshBranches`, and `resetBranch` for future page integrations.

## Security boundary

`localStorage` is a user-interface preference, **not authorization**. The provider revalidates it against every fresh `GET /api/me/store-locations` response and clears the displayed selection if that request fails. It also rejects attempts to select an ID absent from the freshly loaded accessible set.

Future business API requests must send an explicit `store_location_id` (or a deliberately designed aggregate query mode), and the backend must independently verify the authenticated user's access before scoping queries or writes. A caller must never gain access by changing `localStorage`, manipulating the selector, or sending `all` as though it were a real StoreLocation ID.

## Failure and lifecycle behavior

- Failed Branch loading displays **Branches unavailable** / **Retry** instead of continuing with a possibly stale selection.
- An empty successful response displays **No active branches** and removes the persisted preference.
- In-flight responses are numbered so an obsolete response cannot overwrite state after a refresh, user change, reset, or unmount.
- The selector renders desktop and compact mobile variants from the same context state.
- Logging out removes the authenticated dashboard tree; the next authenticated user receives a new provider keyed by that user's ID.

## Multi-Branch Admin assignment follow-up

The follow-up fix associated with this phase keeps Admin assignment and selector behavior consistent:

- Create/Edit Admin uses individual Branch checkboxes and submits the complete selected ID list.
- Editing an Admin converts every existing `store_locations` assignment into a selected checkbox, so adding Branch 2 does not silently discard Branch 1.
- Normal `superAdmin` users remain assignment-scoped; only `infra_core_x1` has the permanent all-Branch bypass.
- The optional `branch-access:backfill --all-active-super-admins` correction is additive and idempotent, excludes inactive Branches and platform users, and grants only the active Branches that exist when it runs. It does not grant future Branches automatically.
- Permission rollout and production commands remain documented in the [Phase 2 production runbook](phase-2-branch-access-production-runbook.md).

## Verification

CRM selection/helper coverage can be run from `frontend/ecommerce_gentlegurl_crm`:

```bash
npx tsx --test src/contexts/branch-selection.test.ts src/components/BranchSelector.test.ts src/components/BranchAccessChecklist.test.ts
npm run lint
```

Backend access, assignment, and backfill coverage can be run from `backend/ecommerce_gentlegurl_backend_api`:

```bash
php artisan test --filter=BranchAccessPhase2Test
```

Manual verification should cover:

1. A single-Branch user sees that Branch selected and cannot choose **All Branches**.
2. A multi-Branch user sees **All Branches** and every active assigned Branch on desktop and mobile.
3. A chosen Branch survives reload for the same user.
4. Removing/deactivating access makes a formerly persisted Branch fall back safely after refresh.
5. A Branch endpoint failure shows retry state and does not leave stale Branch state visible.
6. Editing an Admin from one assignment to two preserves the first assignment.

## Deferred to later phases

Phase 3 does not automatically append the selected Branch to `fetch` calls, filter pages, attribute writes, or change backend business records. Each module still needs an explicit contract for single-Branch versus aggregate behavior, backend authorization, query scoping, mutation attribution, empty/error states, and tests.

Do not introduce a global fetch interceptor that silently adds a Branch. Integrate modules deliberately so endpoints that are company-wide remain global and operational endpoints cannot accidentally accept **All Branches** for a single-Branch write.
