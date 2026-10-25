# Sway — Formal Game Proposal

**Status:** Concept and gameplay design only; implementation has not started.  
**Revision date:** October 25, 2026.  
**Platforms:** Mobile browsers and desktop web.  
**Intended implementation:** HTML, JavaScript, and CSS, with a suitable browser rendering approach to be selected later.  
**Presentation:** Preferably 2.5D isometric; isometric pixel art is also suitable.  
**Tone:** Mysterious, atmospheric desert fantasy.  
**Structure:** Distinct, connected dungeon levels with no final level and a persistent expedition that can be suspended and resumed.

## 1. Executive proposal

Sway is an action dungeon crawler about turning dangerous enemies into a growing supernatural horde. The player explores buried desert ruins, weakens hostile creatures, and attempts to hypnotize them while combat continues. A successful sway turns that creature into a follower that travels, fights, and takes formation with the player.

Recruitment is an active encounter. A weakened creature still attacks while the player maintains a magical connection, dodges, manages distance, and tries to keep it alive long enough to complete the sway. Stronger creatures demand longer or more difficult attempts. Killing remains an immediate solution; recruiting asks the player to survive a more demanding situation for a lasting advantage.

There is **no designed limit on the number of recruited followers**. The spectacle of crossing a chamber with an expanding procession of beasts, spirits, clouds, armored monsters, and enormous mythical creatures is central to the appeal. Commands let portions of that horde become shield lines, coordinated attack groups, temporary statue walls, and tools for navigating the dungeon.

**Player fantasy:** Enter the buried world alone; descend with a storm of creatures following in your wake.

### Confirmed direction

| Area | Direction |
| --- | --- |
| Recruitment | Weaken, initiate Sway, maintain the attempt for several seconds, and survive the target's continued attacks. |
| Horde size | No party slots, recruitment cap, or mandatory replacement of existing followers. |
| Followers | Persist, follow the player, fight, and respond to group commands. |
| World | Desert dungeons first, with other environments available as the descent expands. |
| Creatures | Djinn, phoenixes, dragons, cloud monsters, armored fire beasts, horned stone beasts, and other mythical or original creatures. |
| Progression | Numbered levels within a continuous, endless dungeon expedition. |
| Mood | Mystery, quiet awe, ancient danger, and atmospheric discovery. |
| Current deliverable | A proposal in Markdown; no playable implementation. |

All numerical values below are starting hypotheses for later playtesting, not approved balance specifications.

## 2. Design pillars

1. **Recruitment creates danger.** The crucial moments happen after an enemy is weakened, while the player is trying to complete the sway.
2. **Growing the horde feels rewarding.** Additional creatures remain useful and visibly present; growth should not be undone by arbitrary capacity rules.
3. **The horde changes the battlefield.** Followers provide protection, pressure, obstacles, and environmental utility as well as damage.
4. **Creature identity matters.** A cloud, an armored beast, and a phoenix should behave differently before and after recruitment.
5. **Commands stay simple as the army grows.** The player directs intentions and formations without managing dozens of individual units.
6. **The descent feels continuous.** Each floor provides a local objective and a stopping point, while the expedition and its surviving creatures carry forward.

## 3. Moment-to-moment gameplay

The player moves freely, attacks, dodges, and directs followers in real time. Basic combat should be understandable without a large ability bar. The player remains capable of defeating ordinary enemies alone, including after losing followers.

A typical encounter follows this sequence:

1. Enter a chamber and read its creatures, hazards, routes, and mechanisms.
2. Fight to create space and weaken a desirable target.
3. Initiate Sway on that target.
4. Maintain the connection while dodging its attacks and reacting to other threats.
5. Use the horde to protect the attempt, interrupt another enemy, or block a route.
6. Complete the sway and add the creature to the procession, or abandon the attempt and finish the fight.
7. Explore, recover where possible, and carry the surviving horde into the next chamber.

The decision has three parts: **Which creature do I want? Can I keep it alive? Can I survive its recruitment?**

## 4. The Sway mechanic

### 4.1 Weakening and eligibility

Ordinary enemies initially become eligible below approximately 30% health. Eligibility is shown by a distinctive outline and symbol rather than color alone. The creature continues moving, attacking, and using its recognizable abilities. Low health does not automatically disable its danger.

Weakening is a prerequisite, not the recruitment itself. The player must explicitly select a target and activate Sway.

More dangerous creatures can add a clear prerequisite, such as breaking an armor plate or interrupting a signature attack. These requirements should be visible before the player commits to an attempt.

### 4.2 Active hypnosis

Activating Sway creates a visible tether between player and target. Progress builds while the player stays within range and maintains an unobstructed connection. The player can move and dodge throughout the attempt.

The target remains hostile until the progress completes. It can chase, charge, breathe fire, cast, or use other attacks while being swayed. Other enemies also remain active.

| Target category | Initial timing hypothesis | Intended challenge |
| --- | --- | --- |
| Small beast or minor spirit | About 2 seconds | Learn to maintain the link through one attack. |
| Standard armored or ranged creature | About 3–5 seconds | Reposition through several attack patterns. |
| Elite beast or powerful djinn | About 6–9 seconds | Prepare space and use followers to manage interference. |
| Major guardian | A longer, staged attempt | Break its defenses first, then survive a final recruitment sequence. |

Lower remaining health can moderately shorten the required time, creating a tempting risk: a nearly defeated creature is easier to sway but easier to accidentally kill. Species and elite status provide most of the timing variation. Show progress and resistance clearly; do not use a hidden random success roll.

### 4.3 Interruptions and recovery

- **Dodging:** Briefly pauses progress during the dodge; preserves the tether and accumulated progress if range remains valid.
- **Taking a hit:** Removes a small amount of progress rather than automatically resetting the attempt.
- **Breaking range or line of sight:** Gives a short grace period, then pauses progress and gradually erodes it. A prolonged break ends the attempt.
- **Deliberately attacking:** Ends the player's channel and returns to ordinary combat.
- **Target death:** Ends the attempt. The creature does not become invulnerable because it was selected.
- **Success:** Immediately changes allegiance, stops hostile actions, and adds the creature to the horde with a clear visual and audio response.

Repeatedly losing the connection should matter, but a single dodge should not make recruitment feel futile. The exact grace periods and progress penalties need testing with real mobile controls.

### 4.4 Keeping the target alive

Beginning Sway also marks the creature for capture. Followers stop deliberately attacking that target and redirect to other threats or guard the player. The player's automatic basic attack pauses during the channel.

This order does not erase projectiles already in flight or environmental damage. Lingering fire, an existing damage effect, or an attack already committed can still kill the target. These threats should be readable and predictable. Selecting an unmarked weakened enemy should not silently grant it damage protection.

This creates useful preparation: recall an aggressive attack group, move the target out of a burning area, or weaken it with a precise strike rather than an indiscriminate blast.

Start with one active Sway target. Do not allow passive mass conversion in the initial design; personally surviving the recruitment is the core interaction.

### 4.5 Joining the horde

A successful recruit keeps its species, scale, movement style, and signature behavior. An ordinary creature receives a modest minimum health floor so it can contribute, rather than joining one incidental hit from death. This is a one-time conversion benefit, not a repeatable healing loop.

Followers remain loyal until defeated. Ongoing loyalty decay or repeated hypnosis maintenance would add busywork to an already demanding combat loop.

Killing grants ordinary loot immediately. Swaying grants the creature instead of its defeat loot. A follower's later death does not award its original enemy loot again.

## 5. An uncapped horde

### 5.1 Growth and persistence

The player can recruit every eligible creature they can successfully sway. There are no follower slots, command-capacity costs, automatic dismissals, or forced army resets at level transitions. Large creatures do not consume extra slots because slots do not exist.

Surviving followers carry between levels with their health and condition. Group recovery is possible at occasional sanctuaries. Followers defeated during ordinary combat are lost from the current expedition; exceptional revival effects may become later content.

The army should feel like a procession, with heavy beasts near the front, ranged creatures finding firing positions, and flying spirits moving above the ground ranks. Players can move through their own followers so the horde cannot imprison its leader.

### 5.2 Keeping growth interesting

A larger army should substantially increase power. The game should let the player enjoy that advantage.

Challenge comes from the expedition's depth, enemy combinations, terrain, and execution demands. Narrow passages limit how many melee creatures can engage at once; open chambers favor a sweeping horde. Area attacks encourage spreading out, while enemy controllers and ranged attackers create tactical priorities.

Avoid unlimited damage amplification from stacking the same support creature. Duplicate support effects can extend coverage or improve resilience without multiplying one another without bound. Additional creatures still contribute their own attacks, bodies, and utility.

Do not secretly multiply every enemy's health whenever a follower joins. Difficulty primarily follows depth and chosen challenge settings. Horde-aware encounter selection can introduce relevant tactics without erasing the benefit of recruitment.

Rooms have finite encounters and reinforcements, preventing a cleared room from becoming a stationary infinite recruitment farm. There is always another level to explore for more creatures.

### 5.3 Readability and scale

Show a compact total and species summary rather than permanent health bars for every follower. Highlight injured creatures, command participants, and immediate dangers when relevant. The player, Sway target, tether, and enemy attack warnings take visual priority over allied effects.

There is no gameplay recruitment cap, but finite devices cannot render or simulate literally unlimited creatures at full detail. Later technical work must test large armies and use scalable movement, rendering, and simulation detail while preserving every recruit's identity and combat contribution. Silently removing creatures, making excess followers inert, or imposing an undisclosed active-party limit would contradict the concept.

## 6. Horde commands and formations

Commands express an intention. Nearby suitable creatures execute it, while the rest continue their existing behavior. The player does not need to select every participant individually.

| Command | Behavior | Tactical purpose | Tradeoff |
| --- | --- | --- | --- |
| **Rally** | Followers disengage and return toward the player; anchored groups release. | Escape, regroup, protect a Sway attempt, recover stragglers. | Gives up attack pressure and held positions. |
| **Rush** | A suitable nearby attack group charges a target or location; additional followers approach in waves. | Interrupt a threat, strike an opening, break a weak obstacle. | Commits the group away from its defensive position. |
| **Line** | Nearby durable creatures form ranks along an aimed segment; overflow supports behind them. | Intercept frontal attacks and hold a passage. | Vulnerable to attacks from the sides, rear, or above. |
| **Anchor** | Creatures occupy a drawn segment and become solid, statue-like obstacles for a short time. | Divide an encounter, hold switches, create temporary cover. | Participants cannot fight or move and continue taking damage. |
| **Spread** | Followers increase spacing and disperse from the command point. | Respond to area attacks and reduce crowding. | Reduces concentrated protection and attack pressure. |

Rally is the universal recovery command. The first playable version needs Rally, Line, and Anchor; Rush follows once movement is dependable. Spread can follow after area attacks are introduced.

### Formations with many followers

Formation size depends on the space the player marks, creature footprints, and available followers. A line across a doorway recruits enough suitable bodies to hold that doorway; it does not summon the whole army into one pile. The preview shows positions and gaps before commitment. Longer segments recruit more participants.

Default selection favors appropriate nearby creatures. Later controls can offer a simple species or role preference. Specialist participation must remain optional, not a requirement to manage every order manually.

### Anchor rules

- Start with a duration around 5–8 seconds, visible on the formation.
- Anchored creatures gain resistance, but can be shattered or defeated by sufficient damage.
- Transforming preserves existing health; it provides neither free healing nor invulnerability.
- Anchored creatures block ordinary ground movement and suitable projectiles. Flying, burrowing, or arcing threats may bypass them.
- Rally releases anchored groups early. Expiry returns survivors to normal behavior.
- A valid deployment cannot trap the player without a release route or cover an essential exit irrecoverably.
- Before leaving a level, all surviving followers are released and gathered. No creature is silently abandoned on a previous floor.

Brief formation transitions and recovery prevent constant switching from becoming a source of free damage immunity.

## 7. Creatures and mythological direction

The visual language combines sand-worn stone, ember light, bronze armor, lapis accents, dust, smoke, feathers, and unnatural weather. Many creatures should be fully bestial or elemental rather than humanoid fighters in costumes.

The requested Typhlosion-like and Rhydon-like references suggest strong silhouettes: a stocky armored fire beast and a heavy horned stone charger. Sway's versions should have original anatomy, armor, names, and behaviors.

### Initial and expanded roster

| Working creature | Identity | Danger while hostile or being swayed | Contribution after recruitment |
| --- | --- | --- | --- |
| **Dune Jackal** | Original desert beast with glassy sand markings. | Fast flanking leaps punish careless retreat. | Flanks targets, pursues ranged enemies, and reacts quickly to Rush. |
| **Cinderback** | Original armored quadruped with furnace-like vents along its shoulders. | Alternates frontal swipes and a short, clearly signaled fire cone. | Anchors a strong front rank and contributes close-range fire. |
| **Basalt Horn** | Original heavy, horned stone beast. | Charges along a visible lane and turns slowly between attacks. | Breaks brittle obstacles, staggers enemies, and forms broad statue cover. |
| **Stormwisp** | Original cloud monster with a shifting face and lightning core. | Drifts around obstacles and marks lightning strikes beneath the player. | Provides ranged pressure and can power suitable mechanisms. |
| **Veiled Djinn** | Fantasy interpretation of djinn, expressed through smoke, cloth, and shifting form. | Repositions and bends projectile paths, forcing the player to manage the tether. | Disrupts enemy fire and creates brief wind cover. |
| **Sun Phoenix** | Original fantasy phoenix with ember feathers and a long, luminous tail. | Swoops and leaves lingering fire, making low-health recruitment dangerous. | Provides aerial attacks and a limited, clearly telegraphed renewal effect. |
| **Dune Drake** | Original desert dragon with mineral scales and buried-wing camouflage. | Combines a breath lane with a sweeping tail attack. | Supplies a large frontline presence and directional breath damage. |
| **Sphinx Sentinel** | Egyptian-inspired guardian creature. | Uses deliberate pounces, heavy paws, and a guarded frontal stance. | Protects a flank or stabilizes a defensive line. |
| **Devourer Beast** | Original creature taking anatomical inspiration from Ammit. | Alternates a lunging bite with a heavy body slam. | Disrupts tightly packed enemies and holds a wide Anchor position. |
| **Gate Bull** | A lamassu-inspired winged guardian. | Defends a threshold and launches a powerful charge. | Protects a broad frontage and resists displacement. |
| **Mirage Simurgh** | Persian-inspired great bird, reserved for later content. | Uses wing gusts and misleading visual echoes. | Offers aerial support and a clear visual signal around protected allies. |
| **River-Shadow Serpent** | A later creature concept drawing on research into the Ninki Nanka traditions of The Gambia. | Proposed moving-water attacks in a buried river region. | Proposed control of wet terrain and concealed routes. |

All attacks, powers, names, and recruitment behaviors above are proposed game inventions. They are not claims that these abilities belong to traditional accounts.

### Inspiration and regional identity

Keep specific sources and regions identifiable. Egyptian imagery, Mesopotamian guardians, Persian legendary birds, djinn traditions, and Gambian folklore should not be presented as one interchangeable mythology.

Useful reference anchors include the lion-bodied guardian imagery of Egyptian sphinxes ([Egyptian Ministry of Tourism and Antiquities](https://egymonuments.gov.eg/en/monuments/the-great-sphinx/)); Ammit's composite crocodile, lion, and hippopotamus anatomy ([British Museum](https://www.britishmuseum.org/learn/schools/ages-7-11/ancient-egypt/ancient-egyptian-gods-and-goddesses)); lamassu as winged guardians of Assyrian doorways ([The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/322608)); and the simurgh as a magical bird from Persian mythology ([The Morgan Library & Museum](https://www.themorgan.org/exhibitions/online/shahzia-sikander/simurgh-study-after-zal-sighted-caravan-attributed-abdul-aziz)).

For a broader African direction beyond Egypt, the Ninki Nanka is a promising research starting point: The Gambia's tourism material connects the legendary beast to Makasutu Forest ([Visit The Gambia](https://visitthegambia.com/?tour-item=makasutu-forest)). Its exact game adaptation should follow more specific local storytelling research. Original creatures can fill the roster while that work develops.

The game's codex can distinguish an original creature from a creature inspired by a named tradition. Preserve a mysterious fictional world without treating its lore as an authoritative account of living beliefs.

## 8. Creature combinations and environmental uses

Combinations should emerge from behavior and placement before introducing memorized recipes.

- **Protected recruitment:** Cinderbacks form a Line between the player and distant attackers while a dangerous target remains inside the Sway tether.
- **A temporary breathing space:** Anchor a segment of followers across one approach, then dodge the target's attacks on the open side of the chamber.
- **Charge and flank:** Basalt Horns stagger an enemy while Dune Jackals approach its exposed sides.
- **A storm channel:** Anchored conductive creatures bridge a broken power route; cloud creatures energize it to reveal a shortcut.
- **A protected firing position:** Heavy creatures hold a frontage while ranged spirits fire from the rear.
- **A living counterweight:** Several beasts occupy a weighted platform, opening an optional passage while the player explores nearby.

Mechanisms should recognize understandable properties such as weight, flight, heat, conductivity, or solidity. Avoid requiring one exact rare creature for essential progress. The player must still have a route after losing followers.

Recruitment difficulty is not just enemy health. A phoenix surrounded by its own fire may be harder to capture than an armored beast with a longer channel time. The best situations ask the player to arrange a favorable encounter.

## 9. Continuous, endless dungeon levels

### Expedition structure

The dungeon contains discrete numbered floors connected by gates, stairs, lifts, wells, or supernatural passages. Completing a floor unlocks the next. There is no final floor, but each floor has a finite objective, encounter budget, and exit.

The player carries their character, surviving horde, upgrades, and expedition state forward. Advancing does not reset the army or require starting a new short run. Sanctuaries provide natural places to save, recover, inspect the horde, and stop playing.

Proposed initial failure rule: player defeat ends the active expedition; the next expedition begins at the surface. Discovered lore and creature records remain. This is a provisional choice to revisit separately from the confirmed endless-floor structure. Closing the browser or choosing Suspend must never count as defeat.

### Floor rhythm

A typical early floor might contain several combat chambers, an optional branch, a utility interaction, and an exit encounter. Later floors can vary the rhythm with open arenas, pursuit chambers, buried settlements, or quieter exploration.

Use authored room patterns with procedural variation in connections, enemies, hazards, and rewards. This offers a basis for endless levels while keeping combat spaces legible. Endless progression does not imply every future room will be entirely unique.

### Region sequence

| Region | Atmosphere | Mechanical emphasis |
| --- | --- | --- |
| **Buried Caravan Halls** | Sand-filled arches, abandoned lamps, distant bells. | Learn weakening, Sway, and basic group control. |
| **Ember Necropolis** | Warm stone, buried furnaces, slow ash. | Fire lanes, armored beasts, and safe capture spaces. |
| **Cisterns of the Unseen** | Dark water, reflections, submerged doors. | Conductivity, alternate routes, and flying creatures. |
| **Palace of Suspended Storms** | Broken ceilings, floating dust, impossible clouds. | Open formations, aerial threats, and tether positioning. |
| **The Deep Gates** | Massive guardian statues and light beneath sealed thresholds. | Large creatures, layered encounters, and horde coordination. |

Deeper strata can revisit these materials in new combinations and introduce other researched regional influences. Their transitions should feel like entering another buried layer of the world.

### Difficulty and recovery

Increase complexity through attack combinations, terrain, elite behaviors, and meaningful objectives. Avoid relying entirely on larger health pools or indiscriminate area damage that deletes the horde.

Recovery opportunities should let a reduced army rebuild. Reachable common creatures remain recruitable, and the player retains enough personal combat strength to create those opportunities. Sanctuaries cannot be farmed repeatedly for unlimited resources.

## 10. Guardian and boss encounters

Major encounters test the same systems rather than abandoning them.

Example: a gate guardian attacks with a charge, a sweeping shockwave, and summoned storm creatures. The player uses anchored beasts to redirect a charge, recruits a storm creature while avoiding the guardian, and exposes the guardian's protective seals.

Once those seals break and its health is low enough, the guardian itself can become swayable. The final attempt is a sustained combat sequence: the guardian continues attacking while the player maintains the connection. Success delivers the spectacle of a large former boss joining the procession.

Use this as a later feature, not a requirement for the first playable version. Ordinary elites can establish the pattern first. Future giant recruits require rooms, doors, and follower navigation designed for their size; they should not be shrunk into generic small followers or silently removed at the next stairway.

## 11. Mobile and desktop interaction

### Mobile

Landscape is the initial layout recommendation because movement, dodging, formation placement, and horde visibility all compete for space.

- Left thumb controls movement with a virtual stick.
- The right side provides large Dodge, Sway, and Command controls.
- Basic attacks can be assisted by automatic targeting; the player can select a priority target.
- Tapping a weak enemy selects it. Tapping Sway toggles the channel on, leaving the right thumb free to dodge.
- The selected target stays locked until success, death, cancellation, or a broken attempt. Never silently switch to another creature.
- Pressing and dragging Command previews the active formation; release commits it. A compact selector changes the command, and Rally has a quick shortcut.

The Sway interaction must not require holding a third touch while moving and dodging. A hold-to-channel option may be available for players who prefer it, but the default should work with two thumbs.

Combat continues at normal speed during the Sway attempt. Any optional assistance for placing formations should be evaluated separately; it must not remove the need to dodge during recruitment.

### Desktop

Use keyboard movement, mouse targeting, a dodge key, a Sway toggle, and formation shortcuts. The underlying rules, information, and target-lock behavior remain the same across platforms.

### Essential feedback

Show target health and Sway progress together, a visible tether, an unmistakable range warning, and distinct feedback for paused or lost progress. Keep attack telegraphs visible beneath allied units. Support reduced flashes, readable contrast, and symbols in addition to color.

## 12. Art, atmosphere, and sound

Prefer an isometric world with sprite-based creatures, layered scenery, clear ground contact, shadows, and restrained lighting effects. Pixel art and an isometric camera are compatible choices; the final style should be selected with a small visual study later.

Use long shadows, moving sand, drifting cloth, dark doorways, distant silhouettes, and pools of warm light. A quiet room should still feel inhabited by something beyond view. The horde's procession becomes part of the atmosphere: claws on tile, shifting stone, feather rustles, soft thunder, and smoke flowing around pillars.

Sway can have a restrained rising tone, a visible pulse along the tether, and a brief change in the creature's markings on success. Large hordes need mixed and limited simultaneous sounds so the atmosphere does not become constant noise.

Scale is important. A small jackal, a broad armored beast, a floating cloud, and a dragon should remain visibly different. Fade scenery that obscures the player; simplify allied effects before obscuring hostile warnings.

## 13. Progression and rewards

Prioritize upgrades that change recruitment and command choices:

- Greater tether reach, without removing the target's opportunity to attack.
- Faster recovery of Sway progress after a disrupted connection.
- More flexible formation shapes or quicker formation assembly.
- Improved statue endurance in exchange for slower release or another visible tradeoff.
- Species traits that unlock new environmental interactions.
- A limited personal ability that helps create space for a capture.

Horde growth is already a major progression system. Avoid burying it beneath extensive equipment management, repeated minion leveling, or constant individual upgrades. Followers can gain simple veteran traits later, but the player should not need to open dozens of creature panels.

The initial economy needs only ordinary loot and occasional meaningful upgrade choices. New regions, uncommon creatures, lore fragments, and the next mysterious threshold provide additional reasons to descend.

## 14. Example encounter

The player enters a ruined cistern with twelve followers: several Dune Jackals, two Cinderbacks, a Basalt Horn, and drifting Stormwisps among the rest. A hostile phoenix circles above while armored creatures approach through a side arch.

The player weakens the phoenix with careful attacks. Its outline changes, but it continues swooping and leaves a burning trail across the floor.

The player selects it and taps Sway. Followers stop targeting the phoenix. A tether forms, and the player starts circling to maintain range without crossing the fire.

The side group advances. The player draws an Anchor segment across the arch, committing the Basalt Horn and nearby durable followers to a temporary wall. Other followers keep the remaining enemies occupied.

The phoenix swoops. The player dodges; progress pauses briefly but does not disappear. A pillar threatens to break line of sight, so the player changes direction instead of retreating behind it.

The wall begins to crack. The player could cancel and kill the phoenix, but completes the final seconds of the attempt. Its fire changes appearance as it joins the procession.

Rally releases the surviving statues. The enlarged horde follows the player toward the next chamber, with the newly recruited phoenix overhead. Nothing resets at the next level.

## 15. First playable scope and validation

The first playable should validate **active recruitment under pressure and the pleasure of growing a horde** before expanding the mythology or content library.

### Proposed scope

- One player character with a basic attack, dodge, and Sway.
- Three complementary creatures: Dune Jackal, Cinderback, and Stormwisp.
- No follower cap, with followers persisting between levels.
- Rally, Line, and Anchor; Rush after basic navigation works well.
- One desert dungeon region using a small set of authored room patterns.
- Repeatable numbered floors with finite encounters and a working exit.
- One environmental mechanism and one elite recruitment encounter.
- Suspend and resume for the ongoing expedition.
- Touch controls and desktop controls from the beginning.

Keep full boss recruitment, extensive regional lore, complex elemental combinations, and veteran traits for later. A short initial play session can test the loop without making short runs the final structure.

### Questions the prototype must answer

| Question | Evidence to seek |
| --- | --- |
| Is Sway enjoyable while the target still attacks? | Players intentionally attempt captures and can explain what made them succeed or fail. |
| Can the player move, dodge, and channel comfortably on mobile? | The full interaction works with two thumbs and clear target locking. |
| Does the army feel rewarding as it grows? | Larger groups visibly contribute, and additional recruits remain desirable. |
| Can players keep a capture target alive? | Capture orders behave predictably while lingering hazards remain understandable risks. |
| Are formations useful during recruitment? | Players use lines or walls to create capture opportunities without being required to use one exact solution. |
| Can followers navigate as a horde? | Crowds clear doors, reform after corners, and reach the next floor without losses caused by navigation. |
| Can the game recover from army losses? | A skilled player can rebuild with ordinary recruitable creatures. |
| Does the world retain its atmosphere? | Enemy warnings and the player remain readable as the procession grows. |

Stress scenarios should include approximately 10, 50, 100, and 200 followers on representative phones and desktop browsers. These are evaluation points, not recruitment limits or promises of a maximum supported army. Larger armies should be evaluated as the design develops.

## 16. Future implementation considerations

The intended browser implementation should keep the world simulation separate from the isometric presentation and HTML interface. Creature movement, collision, target selection, and formation assignment need a consistent underlying ground plane.

The highest-risk technical work is horde navigation and performance. Plan for shared routes, spatial queries, pooled effects, and reduced animation or decision-update detail where appropriate. Any approximation must preserve fair combat outcomes and the value of every recruit.

Save data needs the floor and generation state, player condition, followers and their conditions, upgrades, and expedition progress. Backgrounding the page should pause play safely. Neither a phone interruption nor a resumed browser tab should cause unobserved combat or a burst of catch-up damage.

Specific engines, libraries, code structure, and performance guarantees remain outside this proposal. They should follow validation of the gameplay and visual direction.

## 17. Remaining design choices

These choices can be resolved during a later design pass without changing the confirmed premise:

1. **Expedition defeat:** Keep the proposed restart at the surface, or offer a checkpoint-based adventure mode?
2. **Player identity:** A wandering hypnotist, a keeper of lost names, a displaced spirit, or another figure whose power explains Sway?
3. **Recruitment instrument:** A voice, gaze, lantern, resonant staff, or magical seal? Its animation must allow movement and readable combat.
4. **Visual treatment:** Painterly isometric sprites or isometric pixel art?
5. **Damage presentation:** How should defeated creatures disappear, collapse, or dissolve while preserving the mysterious tone?

The central design is established: weaken a dangerous creature, survive the time needed to sway it, add it to an uncapped horde, and use that growing procession to descend through an endless sequence of atmospheric dungeon levels.
