# Charybdis Coach

Browser-based keyboard layout coach for the Charybdis layout.

## Dynamic Layer Assignment

Only L0 and L7 have stable semantic roles. L0 is base typing/thumb access. L7 is frozen fallback/game/system-safe space.

Every other layer is dynamically assigned by the optimizer for the current generation. The coach must infer layer type from the active CSV, binding behaviors, shortcut metadata, app names, categories, usage notes, and mouse/button clusters. Do not hardcode or document any non-L0/non-L7 layer as mouse, scroll, travel, system, app, code, Excel, DMS, or navigation based on layer number.

Behavior names such as `coach_l2_hold`, `coach_l6_toggle`, `coach_mouse_lock`, and `coach_travel_toggle` are transport/access/beacon names. They do not define semantic layer roles.
