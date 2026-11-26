FAITH'S SCAM WHEEL - EIGHT NEW TWISTS

Public demo: https://jhm-hub.github.io/scam-wheel/demos/twists/
No sign-in is required. This collection is separate from the earlier 20 games.

SHOW FAITH

Choose a scam and press Spin, or use Play this demo to run its whole reveal.
Show all eight plays the eight guided reveals in order. Pause waits for the
current spin and animation to finish. Space also spins.

Guided demo is labelled SCRIPTED DEMO. Its reveal, gentle and expensive examples
use legal outcomes from the same rules as Random play. Random play does not force
the catch or a large bill. Some games can genuinely finish free.

Start at the scam skips the opening spins for a quick demonstration. Uncheck it
for two ordinary spins, followed by scam activation and the first scam landing
on the third press. Opening winnings stay in the round total.

THE EIGHT GAMES

Bargain Bin: Remove four giveaway wedges. You bought the two left on the wheel.
Sticky Fingers: Join prizes with two ribbons, then lift one free prize. Every
  connected prize follows and costs extra; the selected prize stays free.
Cutting Costs: Cutting one wedge's price copies that saving onto BOTH others.
Rent Free: Upgrade a zone. Only the landed zone is free; every other active
  zone charges rent each turn.
Double Booked: New guests sit free. A collision pushes seated guests into paid
  upgrades. Each bumped guest owes only their final seat price.
Heavy Baggage: The heaviest bag sets the rate for every kilo already packed.
Refund Pending: The refund is store credit. Two redemption spins use the credit
  first and add any shortfall to the cash bill.
Free Fall: Land on FREE and that wedge splits into two paid pointers on the same
  wheel. Both settle automatically; no extra press or repeated splitting.

The wheel stays large and central throughout. Wedges peel, stick, reprice and
push one another; the scam does not move to a separate board or arcade scene.
Each reveal holds the promising result briefly before exposing its catch.

Default guided scam additions, excluding opening spins:
Bin $50; Sticky $40; Cutting $60; Rent $35; Seats $60; Baggage $50;
Refund $40; Free Fall $90.

AMOUNTS AND SAVED ROUNDS

Amounts and appearance contains each game's prices, opening wheel amounts,
spin duration, sound volume and pink/lilac colors. Apply amounts starts a fresh
round. Save settings and Load settings transfer this collection's settings.
Partial fields fall back to defaults. Other wheel collections keep their own
settings. Nunito and its license are bundled.

The desk stores completed landings locally, per private room. Refresh restores
the last completed landing and pauses autoplay. A spin interrupted before its
landing is not charged. Browser storage must be available for recovery.

STREAM VIEW AND CHAT

Keep this control desk open and private. Expand Stream view and chat, then use
Copy OBS link. Add that complete link as a Browser Source in OBS or Streamlabs.
900 x 1040 is the native drawing ratio; it scales to fit. The clean view has a
transparent background, no desk and no running-total panel. Reveal amounts
remain part of the scene; Show final bill controls the final total card.

Use one active control desk per room. Do not capture the desk on stream. Keep
the complete private links off stream; their room keys are access credentials.
The public demo link above has no room key and gives each browser its own desk.

The desk owns the game and audio. Capture the desk's audio in your streaming
setup; the clean view is silent to prevent echo. Click a control to enable browser
sound. Closing the desk stops gameplay and chat. Reopening restores completed
landings; disconnected audience views show a waiting message and reconnect.

Optional Twitch chat listens without signing in or sending chat messages.
Enter the channel and Connect chat. Broadcaster commands are allowed by default;
the checkbox can also allow moderators. Ordinary viewers cannot control it.
Commands: !scam or !scam spin; !scam next; !scam reset.
Reset clears the current round immediately. Next waits until the wheel is idle.
Do not connect two different !scam wheel desks to the same channel at once.

Live viewing uses authenticated WebRTC with PeerJS signaling, plus a local
same-browser fallback. Internet/network restrictions can affect pairing. Test
the clean view and audio privately on Faith's streaming setup before a show.
Physical OBS/Streamlabs audio routing has not been verified on her machine.

SOURCE AND CHECKS

twists/src/model.mjs: game rules and guided routes.
twists/src/effects-a.mjs and effects-b.mjs: transformations on the actual wheel.
twists/src/scenes.mjs: per-reveal pacing.
twists/src/render.mjs: wheel, transitions and final result.
twists/src/app.mjs: private controls and one-button flow.
twists/src/checkpoint.mjs: validated replay/recovery.
twists/src/live.mjs: authenticated audience snapshots and read-only Twitch.
scripts/build-twists.mjs: self-contained HTML and bundled font license.

The wheel uses Landaire-derived landing and rotation helpers in arcade/vendor.
npm run typecheck; npm test; npm run build.
The regular build produces dist/demos/twists/index.html and Nunito-OFL.txt.
The existing main-branch GitHub Pages workflow deploys this alongside the other
games. No new dependency or account is needed for the local build.

Verification covers exhaustive discrete game outcomes, paid-pointer branches, exact
settlement, scripted/random parity, geometry, custom amounts, checkpoint replay,
the eight-game controller tour, pause/reset, duplicate input and live messaging.
Browser review covered all eight reveals, full-round opening retention, refresh,
transparent controls-free viewing and live syncing across different origins.
Twitch connection was checked read-only. No live chat commands were posted, and
no continuous listening or physical OBS audio test is claimed.
