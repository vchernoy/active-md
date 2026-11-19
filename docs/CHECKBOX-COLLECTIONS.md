# Checkbox collections: research and proposed boundaries

Status: **proposal for #86, not an approved API or implementation**. No checkbox
control, collection declaration, encoding, package release or TypeBridge support
is introduced by this document. Radio #85 and select #87 remain separate numeric
scalar work. Control names/labels follow #89; the illustrated checkbox syntax in
#86 does not establish a supported model declaration.

## What exists

The evidence baseline is ActiveMD
[`53e2827`](https://github.com/vchernoy/active-md/tree/53e2827a0f7e0e7419fcd6e7cbb57aeed2777941)
and TypeBridge
[`f78bc8a`](https://github.com/vchernoy/typebridge/tree/f78bc8a4460deef6b11d5a8ed7d0f69059584e6b).
DESIGN's later list/bool/text examples are intent, not current language support.

| Boundary | Current implementation | Consequence |
| --- | --- | --- |
| [Calc types](https://github.com/vchernoy/active-md/blob/53e2827a0f7e0e7419fcd6e7cbb57aeed2777941/packages/calc/src/types.ts) | `Result.value`, input defaults and literal expression nodes are numbers. Comparisons/logic use numeric 1/0. | There is no collection or independent boolean input type to bind. |
| [Evaluation](https://github.com/vchernoy/active-md/blob/53e2827a0f7e0e7419fcd6e7cbb57aeed2777941/packages/calc/src/evaluate.ts) and [sessions](https://github.com/vchernoy/active-md/blob/53e2827a0f7e0e7419fcd6e7cbb57aeed2777941/packages/calc/src/session.ts) | Numeric overrides, numeric result comparison, input maps and setters; incremental recomputation and bounded expression evaluation. | A DOM array cannot simply be passed through the current setter. Value comparison, validation, dependencies and folding must understand the new type. |
| [Runtime](https://github.com/vchernoy/active-md/blob/53e2827a0f7e0e7419fcd6e7cbb57aeed2777941/packages/runtime/src/index.ts) | `initialInputs` and `inputValues()` use numeric maps; restore validates model/control bounds; reset uses authored defaults. | Collection initialization and synchronized controls need an explicit public contract, including model-only values. |
| [Host numeric validation](https://github.com/vchernoy/typebridge/blob/f78bc8a4460deef6b11d5a8ed7d0f69059584e6b/src/editor/numeric-inputs.ts) and [snapshot envelope](https://github.com/vchernoy/typebridge/blob/f78bc8a4460deef6b11d5a8ed7d0f69059584e6b/src/editor/input-snapshot.ts) | Version-1 numeric envelopes; at most 256 unique bindings, names up to 128 code units and 64 KiB UTF-8 serialized state. | Arrays/sets must not be inserted into the existing numeric envelope. |
| [Share codec](https://github.com/vchernoy/typebridge/blob/f78bc8a4460deef6b11d5a8ed7d0f69059584e6b/src/editor/share-link.ts) | Outer v1 source links and capability-gated v2 numeric-snapshot links; 48,000 encoded payload characters and 2,000,000 decompressed bytes. | A new inner field alone cannot provide old-reader compatibility for typed state. |
| [Editable state](https://github.com/vchernoy/typebridge/blob/f78bc8a4460deef6b11d5a8ed7d0f69059584e6b/src/editor/editable-input-state.ts) | Numeric sidecar records with revision/CAS and document privacy epochs. | New types need versioned records without bypassing conflicts, privacy, deletion or cross-document isolation. |

Read-only executable probes against these sources/builds confirmed: `input extras = []`
is rejected; passing an array to a numeric session setter is rejected without changing
its input; the host rejects `[['extras', []]]` while accepting `[['x', 0]]`. These
are compatibility observations, not new collection tests or proof of a future API.

## Representations compared

| Representation | Strength | Cost or failure mode | Recommendation |
| --- | --- | --- | --- |
| General numeric list | Reusable ordered sequence; can support duplicates and future tables/maps/folds. | A checkbox selection has neither order nor duplicates. Must separately enforce selection invariants; general list operators, bounds and type behavior substantially enlarge the first slice. | Useful future substrate, but do not require the whole general-list language to ship a selection control. |
| Native selection/set value | Equality reflects membership; empty selection is explicit; UI order is independent. | Still requires typed calc values/APIs, bounded operations and a serialized representation. A JS `Set` is mutable and is not a JSON wire format. | Preferred semantic model for this use case, pending review. |
| One scalar input per independent checkbox | Fixed known extras can drive formulas such as `10 * insurance + 20 * tracking`; current numeric state can persist each input. | A future ordinary toggle control and strict 0/1 policy are still needed. This does not provide one collection binding, generic membership, dynamic options or a sorted selected-value result. More inputs and authored formulas grow with option count. | Credible separate feature for independent flags; not an implementation or approved simulation of #86. |
| Numeric bitmask or packed decimal | Appears to reuse numeric APIs. | Bit positions tie meaning to presentation/order; JS bitwise operations are 32-bit, while exact integers have a different 53-bit bound. Large/dynamic sets and migrations fail; snapshots look valid while meaning changes. | Reject. No implementation or migration based on numeric packing. |
| JSON/string inside a scalar | Familiar serialized array. | Numeric calc/snapshots reject strings today; repeated parsing, ambiguous types and new limits still need design. A string is not a usable calc collection. | Reject as an escape hatch. A future typed wire envelope is different from storing JSON in an input value. |

A numeric selection can use an immutable/copied **canonical array internally and on
the wire while retaining set semantics**. That is a proposed representation choice,
not a new language syntax or permission to extend today's scalar envelope. If general
lists later ship, ordered lists and selections must remain semantically distinguishable;
canonicalizing an arbitrary list would destroy meaningful order and duplicates.

## Recommended first contract, subject to review

- Start with finite numeric option values. Defer strings, mixed types, nested collections,
  implicit numeric coercion and arbitrary records. Compare values exactly, not with a
  tolerance. Normalize negative zero to zero; reject duplicate option values such as
  `1` and `1.0`. Option values identify selected data independently of label/display order.
  A separate stable author option identity may support future editing/migration; it
  must not be a shuffled index, and changing a value changes the selected data.
- Represent selections as unique values sorted numerically ascending, independent of
  authored or displayed option order. A host setter may accept an unordered ordinary
  array and canonicalize it; reject malformed members and duplicate members rather
  than silently repairing uncertain imported state. Return independent copies; never
  expose mutable internal arrays/sets through defaults, sessions, events or snapshots.
- An empty selection is a normal empty collection, not missing/null/unanswered. No
  missing-value design is needed for this slice. Defaults belong in a typed calc model
  declaration, including an explicit empty default, not `::option` or control order.
  A default must be a valid subset of the declared allowed values. No first-option
  inference; mount does not select a default by writing to the model.
- Define the allowed option domain at the model/validated-program boundary, not only
  in the DOM. Multiple controls for one binding must agree on the allowed value set;
  they may use different display order/labels. Otherwise a session value or one
  control could leave another showing an impossible selection. Radio/select #85/#87
  need the analogous scalar-domain decision, separately from this collection work.
- For restore, distinguish invalid wire data from incompatible current-document data.
  Reject malformed/duplicate/oversized typed envelopes before applying any values.
  Skip unknown bindings or bindings with changed types. Proposed policy for a known
  selection with a removed/out-of-domain member: reject that binding atomically and
  retain its authored default, while restoring unrelated compatible bindings. Do not
  silently trim a meaningful selection or overwrite accepted restored state with a
  widget default. Partial intersection restore could be a later explicit policy.
- Reset restores fresh copies of model defaults, including empty defaults. Existing
  document-wide `resetInputs()` keeps its all-input semantics. If a future binding-local
  reset is exposed, it must affect only that binding. Neither reset rewrites source,
  chooses the first checkbox or draws entropy. This is ordinary calc state, not quiz
  correctness or attempt state.

### Operations needed to consume a selection

The smallest useful operation family is **membership, cardinality, numeric total and
membership equality**. Names below are descriptive requirements, not approved built-ins.
For the extras example, authors need to ask whether insurance is selected, count selected
extras, and sum numeric costs. Summation must detect nonfinite/overflow results and charge
its element work to the evaluation budget. Empty cardinality/total are zero. Membership
returns existing numeric truth (1/0); equality compares canonical membership, not object
identity. Reordering an equivalent selection must not trigger incremental recomputation.

Do not implicitly allow collection arithmetic, concatenate via `+`, index by display
order or use JS array truthiness in `when`. Conditions should consume a numeric result
of membership/cardinality/equality. Wrong-type operators and incompatible `if` branches
need positioned errors, not JS coercion. Typed definitions, constant folding and compiled
bindings must preserve dependencies and type semantics through simplification. A future
list API may add ordered indexing, map/fold, union/intersection/difference or weighted
lookups; none is a prerequisite until a concrete author use case justifies it. Numeric
options whose values are opaque IDs cannot be priced via a numeric total alone; that
use case needs explicit lookup/model formulas and must not overload IDs as prices.

### Bounds and validation

Retain existing source/definition/depth/step budgets. Proposed additional caps for review:
at most 256 options/members per binding and 2,000 total option/member entries per document
or snapshot, plus the current overall text/byte limits. These are **new proposed caps**,
not limits implemented or implied by current `maxDefinitions`. Count both declarations
and values; avoid an input-count × member-count amplification loophole.

Check actual array lengths and primitive finite members before sorting/hashing/copying;
reject holes, nested structures and duplicate members. A public unknown-data inspector
must use controlled traversal rather than input-supplied methods (see #83). Budget sorting,
set comparison, copying, membership and aggregation. Bound labels, names and typed envelopes
before building DOM or serializing. Large signed magnitudes, decimal values, -0, total
overflow and repeated equivalent updates need explicit tests. No document code, network,
telemetry or unbounded callback-based loops are introduced.

## API and host compatibility cost

Widening `Result.value`, `Session.set`, `inputValues()` and `MountOptions.initialInputs`
in place would break callers that assume numbers, including format/math code and
TypeBridge. Silently dropping collections from an old getter is worse: a host could save
a partial state while claiming success. Before implementation choose a negotiated typed
session/snapshot entry point, or an explicitly breaking release with migration. Recommended:
keep numeric-only programs/callers working unchanged; typed programs require an explicit
capability and fail clearly on a legacy path. Exact method names and declarations remain
open design decisions, not APIs established here.

Typed snapshots need per-binding type tags, a schema/algorithm identity, bounded member
arrays, structural inspection and current model/control validation. Negotiation must
occur before visible mount; initialize controls/results/math together, with no synthetic
input/change writes. Cache/change detection must use canonical content, not array identity.
Runtime destroy, subscriptions, multiple synchronized controls and independent mounts
must preserve current lifecycle/privacy expectations. Formatting a selection and placing
it inside numeric math must have explicit supported/error behavior.

TypeBridge can adopt only an actually published upstream contract. It must separately:

1. Introduce a versioned typed snapshot and sidecar schema, preserving numeric records,
   revisions, privacy epochs, read timeouts, conflict handling and empty reset intent.
2. Choose an outer share version beyond today's v2 numeric format, with capability checks
   so older readers reject unsupported state rather than ignoring it. Retain v1/v2 decode
   behavior and existing byte/decompression limits; count typed members too.
3. Keep immutable incoming variants separate from reader-local sidecars. Preserve the
   existing whole-local-baseline > incoming snapshot > authored-default precedence and
   explicit reset-to-authored-default policy. Extend search/summaries without leaking
   private/local-only values or mutating the original link/library identity.
4. Test private-period memory, explicit sharing without persistence, CAS conflicts,
   deletion/clear/recreation fences, opt-out, cross-document isolation and source-only
   paths that must not load the renderer. Do not retrofit arrays into numeric version 1.

Quiz multiple responses already use stable **choice IDs** in separate self-check helpers.
They are not ordinary numeric inputs. Sharing a canonicalization utility may be useful,
but quiz draft/submitted state, seeds, frozen variants and scores remain #48/#327 contracts;
a checkbox collection cannot substitute for them.

## Work sequence and review decisions

1. Review this comparison and decide numeric selection vs general-list-first, option/value
   identity, model option-domain ownership, restore policy and compatibility strategy.
   No checkbox implementation is authorized by this proposal alone.
2. Specify typed calc values/declarations, diagnostics, minimal operations and budgets;
   test pure canonicalization/equality, empty/default/type errors, invalid setters leaving
   state unchanged, dependencies, folding and bounded computation before DOM work.
3. Specify and test the public typed initialization/reset/snapshot contract with a model-only
   collection. Prove copies, no mount-time writes, equivalent updates producing no change,
   and clear legacy capability failure before adding a checkbox widget.
4. Add a sanitizer-safe native fieldset/legend and checkbox labels. Use visible group/option
   labels consistent with #85/#87 (not #89's accessible-only edit/slider bracket semantics).
   Test pointer/Space/Tab, focus, long/Unicode labels, 320px layouts, independent group names,
   synchronized controls, hidden branches, defaults, reset and restore in both engines.
5. Independently review, run required CI and publish only via a separately authorized release.
   Host typed persistence/sharing work follows the published API, with its own review/CI
   and deployment acceptance. Numeric radio/select work need not wait for this research.

No benchmark or real-device/assistive-technology verification is claimed. The cost estimate
is qualitative: this touches the core value model, evaluator, compiler, runtime APIs and
host protocols, whereas a scalar toggle mainly adds control/domain validation. It is not
a UI-only patch and cannot safely be hidden behind a numeric encoding.
