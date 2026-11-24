# Faith's arcade collection

Play without an account: https://jhm-hub.github.io/scam-wheel/demos/arcade/

Twenty wheel-based scams. The production homepage and its integrations are unchanged. The shared spin, units and geometry modules are vendored unchanged from the existing Landaire-derived wheel. All new scenes are code-drawn shaded pixel art inspired by the Candy Confetti Birthday Presents game; lettering uses the bundled Nunito font and OFL.

## Playing

- Spin or Space advances one random landing. Play random round continues automatically; Pause after spin finishes the current landing.
- Two normal spins precede the scam. Jump straight to the scam skips them for review.
- Surprise me draws without replacement from all 20 scams during the current page session. The mode stays hidden until activation. A fixed selection lets Faith choose a particular game.
- Play showcase is explicitly scripted to demonstrate each game's effects. It never pretends to be a random round. Reset returns to random play.
- Reset cancels the in-flight spin, effects and queued auto-play. See final wheel reveals the completed board; Show final bill restores the result card.
- Low stakes starts at $10 cash, $2 bonus and 3 base spins. High stakes starts at $50, $10 and 3. Both are independently editable and stored in this browser. Stakes change the amounts, not the odds.
- Cash and bonus are whole dollars from 1 to 1,000; base spins from 1 to 10. Some scams add spins or use base spins to set a finish target. Their live counters show the actual limit. Multipliers cap at x64; every round has a 60-landing settlement limit.
- Three colour presets and custom wheel colours are available. Scams keep their own scene palettes. Sound has an on/off switch and volume control. Save/load a JSON settings file to move the setup to another browser.
- Open clean view creates a transparent companion tab with no controls or running cash total. Keep it in the same browser/profile. It shows the wheel, necessary game-state counters and the final bill. It does not provide cross-device, OBS-process or Twitch command synchronization.

## Games

| Scam | What changes | End condition |
| --- | --- | --- |
| Dice Boost | Die adds spins; x2 stacks on the next cash hit, which collects it once. Bonus cash replaces its spin. | Cash spins run out |
| Russian Roulette | Six chambers add cash or ending multipliers; EXIT settles the whole bill. | EXIT |
| Rent Free | Landings build or upgrade property. Every built property charges rent after every build. | Base spins + 1 |
| Gumball Ransom | Each candy costs cash. Three of one colour add an 8x/10x/12x set fee and clear that set. | Base spins + 3 |
| Heavy Baggage | Parcels add weight; all kilograms ship at the heaviest parcel's rate. | Base spins + 1 |
| Going Twice | Both of the two highest bids are charged, including ties. | Base spins + 1 |
| Photo Finish | Three ponies advance independently. Every pony's distance is charged at the finish. | A pony reaches base spins + 3 |
| Stamp Duty | Mark a 3x3 book. Completed rows and columns charge their stamps again, once per line. | Base spins + 3 |
| Bubble Trouble | Each air unit costs cash. Pop thresholds add bonuses; excess air carries into a larger bubble. | Base spins + 3 |
| Double Booked | Occupied seats shift guests clockwise. Each displaced guest adds the configured bonus fee. A full house moves all six guests. | Base spins + 3 |
| Stack Attack | Blocks drop into columns. Full rows clear and charge 5x cash per row. Height 10 adds cleanup and ends play. | Base spins + 3 or overflow |
| Charm Offensive | Every duplicate reprices all copies of that charm; only the increase in collection value is charged. | Base spins + 3 |
| Toll Troll | A car moves around 12 spaces and pays every crossed toll gate. | Base spins + 2 |
| Credit Crunch | Purchases accumulate against a limit of base spins x 3 x cash. Only the excess is charged again. | Spent exceeds the limit |
| Wrong Turn | Compass landings move on a priced 3x3 map. Wrapping off an edge adds a 2x-cash detour fee. | Base spins + 3 |
| Plinko Princess | The wheel selects a launch gate. Six random left/right bounces lead to a priced lane. | Base spins + 1 |
| Encore Please | Match C, E, G in order. Every note costs cash; each completed melody adds 8x cash. Wrong notes keep the next note pending. | Base spins + 3 |
| Royal Roll | Knock down a persistent rack of priced pins. A cleared rack adds 5x cash and resets if bowls remain. | Base spins + 1 |
| Tower Trouble | Block offsets shed overhang, shrinking the next floor. Intact blocks cost cash; offcuts cost bonus. | Base spins + 3 or zero width |
| Boss Bill | Damage costs cash. Heal landings charge a recovery fee and restore up to starting HP. Defeat adds a 5x-cash bounty. | Boss HP reaches zero |

All equal-size wheel slots are equally likely on random spins. Plinko's subsequent bounces are also random. Scripted showcases select fixed outcomes and are visibly labelled. Money is a game total; this page does not take or process payments.

## Source and checks

`src/model.mjs` holds the original four demos and the common round ledger. `src/extended.mjs` holds the additional 16 state machines. `scenes.mjs` draws their persistent state and animations; `pixel-art.mjs` draws the shaded sprite library. `config.mjs` validates saved settings and keeps low/high profiles separate.

From the repository root, the normal install, test and build commands include this collection. `node scripts/build-arcade.mjs` rebuilds only the playable page. The generated page embeds its JS, CSS and font and requires no runtime downloads. `node scripts/build-arcade.mjs --engine && node --test arcade/checks/game.mjs` runs the collection's tests.

Checks cover all showcase totals, 3,000 random rounds across all 20 games at ordinary/extreme settings, 2,000 additional rounds for the first four, exact ledger accounting, configuration validation, individual rule boundaries, mystery-deck coverage and every 4/6/8/9/12-slot pointer geometry. The collection has 35 model and motion checks. Browser review separately completed all 20 showcases and checked profile/theme persistence, reset cancellation, pause and transparent-view synchronization. Synthesized audio is included; direct listening has not been verified.

## Inspiration and originality comparison

Dice Boost and Russian Roulette intentionally follow the mechanics observed in the user-provided Lexiful recording: https://kick.com/lexiful/videos/01a1faf6-cde8-7df0-ae7a-db1f4e94a0d1. The user reported permission to borrow those games and style. No footage, logos or character sprites are included.

The other 18 game designs were compared against the supplied 25-mode Kay wheel catalog. That catalog contains price replacements, enlarged slices, extra spins, multiple pointers/wheels, forced magnets, fixed digit bait, neighbouring awards, timed spins, shields, mystery picks and key escape. These new designs use different persistent state, triggers and settlement rules, beyond renamed or recoloured versions. Kay's game also named Russian Roulette is a different high/low cash wheel. This comparison is not a claim of worldwide originality.


## Motion review

The wheel uses a continuous wind-up/launch curve and the original landing math. Scene actions finish before the bill card arrives, with eased entrances and exits. The 16 scene games stage their individual movements; die settling, candy delivery and intermediate roulette/rent cards also use smooth handoffs. A monotonic clock with a shared epoch keeps the companion view aligned.

`node scripts/review-arcade.mjs <output-folder>` generates a local visual-review page using the production renderer and model. It can replay or inspect individual moments, switch to maximum settings or reduced motion, and compare the last animated scene against its resting scene. It is not included in the published site. Frame timing reports measure the current browser; they are not a guarantee for every device.

The November 24 motion pass reviewed all 20 games, checked 389 scene-to-rest joins across default/maximum/reduced settings, and inspected large amounts and a 390px layout. Full browser rounds covered Dice Boost, Russian Roulette, Rent Free, Gumball Ransom and Plinko Princess. On the review Mac these rounds ran around 60 fps with no recorded frames over 50ms. One initial review-page transformation stalled while another browser tab was opening; its repeat is recorded separately. Audio timing follows the visual reveal; no direct listening approval is claimed.

The detail animation pass adds staggered activation lettering, coordinated decoration/pointer transitions, progressive rent receipts, and a candy delivery handoff timed to its charge sound. Repeat stamp hits retain the prior stamp until contact, parcel rows repack smoothly, and Plinko settles into its lane before the bill. The review page also checks full overlay exits, inherited scene opacity and both transformation boundaries. Small isolated antialiasing differences in raster comparisons are recorded rather than hidden; they are visually inspected separately.
