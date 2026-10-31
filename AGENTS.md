# Charybdis Coach

Browser-based keyboard layout coach for the Charybdis layout.

## Layer Roles and Owner Contract

L0 is base typing/thumb access. L1 always owns the mouse/pointer role under `data/layout_contract_v1.json`; the Coach must show L1 as Mouse and independently audit its actual bindings. L7 is frozen fallback/game/system-safe space. Infer roles from content for the remaining mutable layers (L2-L6 and L8-L10).

The contract copy must match the optimizer's versioned source by SHA-256. Keep `owner_contract` metadata in `data/layout_spec.json` aligned with that hash. Do not infer another mouse layer or restore old L5 mouse assumptions.

Behavior names such as `coach_l2_hold`, `coach_l6_toggle`, `coach_mouse_lock`, and `coach_travel_toggle` are transport/access/beacon names. They do not define semantic layer roles; only the owner contract fixes L1's mouse role.
