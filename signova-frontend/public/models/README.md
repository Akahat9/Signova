# Signova realistic avatar contract

Place the two licensed production avatars at:

- `public/models/signova-coach-female.glb`
- `public/models/signova-coach-male.glb`

Then set:

`REACT_APP_SIGNOVA_FEMALE_AVATAR_URL=/models/signova-coach-female.glb`

`REACT_APP_SIGNOVA_MALE_AVATAR_URL=/models/signova-coach-male.glb`

Both GLBs must use the same skeleton, scale, bind pose, morph-target naming and
animation clip naming so every sign can be shared between coaches. Each GLB must contain:

- One humanoid skinned mesh with a stable root bone.
- Shoulder, upper-arm, forearm, wrist and complete finger bones for both hands.
- Head, neck, spine and eye bones.
- PBR materials and embedded or colocated textures.
- Named, self-contained animation clips such as `idle`, `sign_hello`, `sign_help`, `sign_okay` and `sign_name`.
- Facial morph targets. Recommended names include `smile`, `browInnerUp`, `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthFrownLeft` and `mouthFrownRight`.
- Neutral bind pose and consistent metric scale.

Required hand hierarchy on both sides:

- `UpperArm`
- `LowerArm`
- `Hand`
- `Thumb1`, `Thumb2`, `Thumb3`
- `Index1`, `Index2`, `Index3`
- `Middle1`, `Middle2`, `Middle3`
- `Ring1`, `Ring2`, `Ring3`
- `Pinky1`, `Pinky2`, `Pinky3`

The male and female files must not use different bone names. Sign clips should be
authored against this shared armature and tested for wrist twisting, finger penetration,
shoulder deformation, facial timing and smooth 0.16–0.24 second transitions.

Recommended web budget:

- 25k–60k triangles.
- 1K mobile and up to 2K desktop textures.
- Less than 12 MB after Meshopt or Draco compression.
- No cameras, lights or unused animation tracks in the exported file.

When the environment variable is absent, Signova intentionally uses its procedural coach as a development fallback.
