# Sway — The wanderer and the living dungeon

Implemented expansion, November 15, 2026. This document distinguishes the playable mechanics from further creative directions.

## The playable rules

The wanderer begins with a wooden stick and a manual **Slash (J)**. Each press performs one short melee sweep with an animated arm and visible arc. There are no automatic player attacks or player attack projectiles. Clicking a creature approaches melee distance; selecting it tells followers to leave that intended capture alone. Deliberately pressing Slash can still finish it. Sway remains a sustained hostile encounter, visually expressed as five outward-moving, undulating circles rather than a narrow beam. The circles show the spell’s reach; recruitment still focuses on one chosen creature.

**Mend (H)** restores 35% of maximum health to injured followers within five tiles, with a fourteen-second cooldown. It heals followers, not the wanderer. **Fusion (M)** combines two nearby creatures of the same species and rank into one higher-rank creature. The survivor gains 80% maximum health and stronger attacks, occupies more space, and appears larger. Fusion preserves the average health percentage of its ingredients; it cannot repeatedly manufacture full health. Frozen creatures must be released before fusion. A larger army and a smaller army of veterans support different tactics.

Nine breakable objects are placed per floor: pots usually yield a coin, chests several coins. Deterministically rare drops grant a Sunwood Knot (+2 slash damage), Whisper Thread (+0.3 Sway reach), or Amber Heart (+8 maximum vitality). These are immediate relic upgrades, rather than an inventory or equipment screen. A broken object cannot reward twice, including after reload.

The player collides with creatures and intact loot objects. Starting in an overlap is recoverable by moving away. Followers retain their existing separation and navigation; this is not a full rigid-body crowd simulation.

The first chamber replenishes a basic jackal if its previous replenishing creature has been defeated or recruited. It receives an attack grace period. These jackals award no defeat loot, and their presence does not close a cleared exit. The room supplies replacement recruits rather than an endless coin farm.

## Creatures as dungeon tools

Sanctuaries rotate through optional challenges:

- **Weight seals:** Petrify a follower on the marked seal. Later weight rooms require two distinct seals held together.
- **Laser interruption:** Place a statue in the marked red beam. Until interrupted, the beam damages the player on contact. Blocking it unlocks the sanctuary reward.
- **Living bridge:** Anchor two creatures near the broken northern gallery. Their combined presence supports a temporary walkable bridge. Release or expiry removes it. If the player is still on the bridge, return them to nearby safe ground rather than strand them in a void.

These challenges reward useful capture and placement without requiring a specific rare species. An ordinary ground route remains available. The replenishing room provides another chance after losses. Bridge supports are currently a local two-creature requirement, not individually simulated bodies forming each plank.

Floors gradually add connected side galleries and vary corridor widths. Growth is bounded by the current 43 × 18 footprint; this edition does not grow indefinitely or generate arbitrary room graphs. Regional art direction changes every ten floors: sandstone ruins, ember chambers, submerged cisterns, suspended storms, and deep gates, then cycles.

## Further creative directions

These are proposed next designs, not implemented features:

1. **The procession’s shadow:** A door reads the combined shadows of petrified beasts. Move a brazier or choose creatures of different heights to complete a constellation.
2. **The breathless kiln:** Anchor fire beasts around a ceramic guardian to temper its armor. Too much heat closes its recruitment window; cooling it with cloud creatures produces a rare recruit.
3. **A bridge with a heartbeat:** Each petrified creature supplies one actual bridge segment. Crossing forces a choice between a short safe bridge and a longer route to treasure. Distinct silhouettes indicate load-bearing parts.
4. **The caravan scales:** A heavy veteran can replace several small followers on a counterweight. Fusion becomes an environmental decision, with weight values shown directly on the floor.
5. **The mirror well:** Statue orientation redirects beams rather than merely blocking them. Ordinary beasts block, stone beasts reflect, and cloud beasts scatter. Reflected beams never silently hit offscreen followers.
6. **The nursery covenant:** Heal a wounded neutral beast to awaken the replenishing chamber. Its replenishing function remains permanent afterward; losing your army never removes your recovery route.
7. **The divided choir:** Leave part of the army holding two distant resonators while the remainder protects a difficult Sway attempt. Rally remains the universal way to abandon the arrangement.
8. **Ten-floor thresholds:** Each regional boundary gains a guardian whose recruitment teaches the next region’s environmental rule. Recruit the gatekeeper and its former defenses become tools for the next descent.

The next major level-generation step should be connected room graphs with tested return routes, explicit puzzle prerequisites, sanctuary placement, and guaranteed replenishment access. More floor area alone will not supply that variety.
