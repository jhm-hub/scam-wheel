FAITH SCAM WHEEL - NATIVE ARCADE PROTOTYPE

This is a working extension of the supplied StreamElements wheel source.
The supplied drive folder is unchanged. The editable implementation is here.
Ordinary wheel configurations retain their original behavior by default;
Scam Wheel is an optional game type.

OPEN IT
- dist/index.html: Faith's wheel homepage and host desk.
- dist/scam.html: the same desk at its established address.
- dist/scam-stream.html: standalone transparent overlay, independent game.
- dist/browser.html: private buttons and live totals for the browser option.
- dist/browser-wheel.html: paired transparent viewer (use its private link).
- dist/wheel.html: the original general wheel configuration playground.
- dist/demo.html: redirects to wheel.html, preserving a shared config code.

PLAY
Enter a player name if wanted, then New round. The wheel makes two ordinary
spins. The next accepted press reveals the scam, regardless of bonus spins.
Press Spin again to play that scam. Finish round applies the multiplier bank
and shows the final total. Space spins; H shows or hides the controls.
New round cancels pending animations and starts fresh.

SHOW FAITH
Showcase contains all 25 renamed original modes, with an Original name
reference. It also contains three playable proposals: Prize Pinball,
Combo Queen and Encore or Exit. These ideas are OFF in the normal random
pool. Enable them only after Faith approves. Every name is editable.

SETTINGS
Edit the ten ordinary cash amounts, starting spins, demo cash, sound level,
boost, flat cash value,
angel values, multiplier values and spin length. Edit all mode names, pool
checkboxes and relative weights under Scam names & random pool.
Other original special-mode values and rules remain fixed.
Save starts a new round. Settings are saved per browser/file location;
Export settings makes a portable backup. Import settings restores that file
or a settings file from the previous 25-mode HTML version.
The wheel-look importer accepts the supplied wheel's saved configuration
code, preserving this game's prizes, arcade font and simple round center.
Export again after changing settings so the exported overlay contains them.

OBS
Use the exported stream HTML as a Local File Browser Source, approximately
1000 x 1000. Its background is transparent. The checkered desk background
is preview-only. Use OBS Interact and Space to spin; H opens the controls.
The desk and separately opened stream file each own their own round; they
are not synchronized remote controllers. To operate the shown round,
interact with that Browser Source or use the StreamElements commands below.
Permanent player/ready/regular-spin headings and the bottom tagline are
removed. The stream shows the wheel and temporary game effects. Running cash,
multiplier and remaining spins are only in the host Play controls; H hides
those controls. The timed mode shows its countdown in the same host panel.

STREAMELEMENTS
Hosted installation: open the published homepage, save your settings, and
choose Stream setup. Copy or download its installer. The page detects its
published HTTPS address, including the repository subfolder or custom domain.
An exported local desk remembers that address. Before publishing, you can
enter the published site address yourself; do not enter the github.com repo
link or a localhost preview address.

Create a NEW Custom Widget. Clear its HTML, CSS, JS, Fields and Data tabs.
Paste the installer into HTML and save. The installer contains your saved
configuration and loads wheel.js from YOUR site. It never uses Landaire's
hosted wheel. Code updates load on a widget refresh (hosting/browser caches
may briefly delay them). A running round is not updated in place. Changed
settings require saving and pasting a fresh viewer installer. Stream setup
also supplies the PRIVATE LIVE TOTALS installer. Install it in a second
overlay on the same account and open that overlay in a private browser or
OBS Custom Browser Dock. Never add the private panel as a scene source.
It reads the actual viewer totals through SE_API.store, and marks old totals
offline if updates stop. The homepage desk remains a local preview.

Offline alternative: Settings > Offline StreamElements HTML or the default
dist/StreamElements-HTML.txt embeds the complete wheel. This copy works without
a hosted wheel.js and does not receive updates from GitHub. Test either
installation in a private StreamElements preview before using it on stream.

Commands use the original permission setting (broadcaster by default):
!scam or !scam spin - spin / reveal the scam
!scam new [player] - cancel and start a round
!scam finish - finish and reveal the total
!scam bonus 1 / !scam bonus -1 - adjust spins; queue seconds during Dash
!scam demo ID - reveal a specific mode
!scam yes / !scam no - resolve a boundary prompt
!scam pick 1 ... !scam pick 12 - toggle a mystery choice
!scam reveal - reveal six mystery picks
!scam continue - dismiss the rainbow equation
!scam encore / !scam bank - choose in Encore or Exit
!scam pause / !scam resume - pause/resume new actions
Ordinary add/remove/reset entry commands retain their meaning in ordinary
wheel mode; they do not modify an active Scam Wheel round.

GAME RULES
Cash adds to a running total. Multiplier factors add to a bank: x2 plus x5
means x7 at the end. Final totals at 30 or less triple; 31 through 50 double.
These finale twists and the original hit caps are preserved.
Fatal Attraction guarantees its first multiplier. Sweet Little Lie first
shows an unplayable fake jackpot wheel. Lucky-ish's $777 wedge is decorative;
it always lands on $7 and then awards $77 once. Each mode's showcase card
explains its behavior. This prototype does not collect or transfer payments.

BUILD / SOURCE
Install dependencies with pnpm install --frozen-lockfile.
npm run typecheck
npm test
npm run build
Build outputs are in dist/. New game modules are in src/scam/.
The root Showcase/ folder belongs to the previous HTML implementation;
do not run its legacy builder over this native version.
Bungee font license is in assets/Bungee-OFL.txt. Font and synthesized arcade
sounds are bundled, so the delivered game has no remote asset dependency.

VALIDATION
All 25 original modes and all 3 new demos completed browser reveal, spin
and finale checks. State tests cover boundary awards, special hit caps,
third-turn triggering with bonus spins, reset cancellation and timed Dash.
Physical OBS/StreamElements deployment and audio routing still need a
private test on Faith's setup. Names and new ideas await Faith's feedback.

OCTOBER 13 POLISH
A custom pink-and-lilac arcade sign announces SCAM ACTIVATED at each scam
reveal, with cream lettering, chasing bulbs, pixel hearts, starbursts and
a short arcade chime. The sprite and speech bubble have been removed.
The sign shows the current game name, appears once per scam, and clears
before the game begins. Existing mute and volume controls apply.
Combo Queen pays x1, x2, then x3; repeat hits never reset the combo. Added
spins stay at x3. The meter marks earned levels and the next spin bonus.
Reveals have mode-specific motion, prizes fly into the central result card, pinball
travels between its three prizes, Rainbow deals its letter-value tiles,
keys unlock and used shields fade. Reward cards do not overlap.
Reduced-motion preferences simplify the effects. All artwork and sound
are bundled in the HTML; no internet connection or separate image needed.

GITHUB PAGES
See GITHUB-SETUP.txt. Place this source folder's CONTENTS at the repository
root, including .github/. Enable Pages with GitHub Actions as the source.
The existing main-branch deployment workflow installs locked dependencies,
runs typecheck and tests, then builds and publishes dist/. It gets the site
address from GitHub Pages automatically through FAITH_SITE_URL.
A configured build also writes dist/StreamElements-Hosted-HTML.txt using
default settings. Prefer Stream setup for Faith's customized settings.
The published site is https://jhm-hub.github.io/scam-wheel/.
The configured build uses its actual Pages address.

VIEWER LAYOUT
The permanent cash, multiplier and spins row below the wheel is hidden in
every mode. Play shows the local preview totals only. The separate private totals
panel follows the actual StreamElements/OBS round.
Use the transparent stream overlay or hide controls for the viewer layout.
Prize reveals, mode-specific animations and the final result still appear.

LIVE MONITOR IMPLEMENTATION
src/scam/live-publisher.ts sends projected round snapshots from the SE
controller. src/scam/monitor-entry.ts builds a separate read-only bundle
without the game engine. The alphanumeric store key is account-scoped.
One active viewer owns the feed; editor previews do not publish and extra
viewers remain inactive while a fresh owner exists. The 12-second freshness
window also marks disconnected totals offline. This is a best-effort lease
on a non-transactional store, not multi-host or multi-game support.
Refreshing the viewer starts a new round. Do not refresh mid-game.
Store documentation: https://docs.streamelements.com/overlays/custom-widget
Commands are fixed to !scam in scam configs, including legacy imports;
ordinary configs retain their configured commands. No chat messages are
sent by the private monitor. Full operator instructions: GITHUB-SETUP.txt.

BROWSER LIVE SETUP
Open https://jhm-hub.github.io/scam-wheel/browser.html in a normal browser
on the streaming computer. It creates a private control room. Expand
Put the wheel on stream and copy the wheel link. Add that link as an
800 x 800 Browser Source in Streamlabs or OBS. No StreamElements account
is needed for this option. Only the viewer link belongs in the scene.
Keep the controls page in a separate private window or private browser dock.

The badge should say LIVE WHEEL CONNECTED. The viewer owns the game;
buttons here operate that game and totals come back from it. For a browser
demo, use Open wheel to test instead. Close the test viewer before opening
the same link in Streamlabs. Use one viewer and reuse its source across
scenes, with automatic source shutdown and scene refresh turned off.

Enter Faith's Twitch channel in the private controls and Connect Twitch
chat. The viewer listens without sending messages, passwords or tokens.
Only the channel owner may use !scam commands by default. The checkbox
can also allow channel moderators. Ordinary viewers, stale messages and
shared-chat messages from other channels are ignored. Buttons remain
available when chat is disconnected. Chat stays active when the private
controls are closed, as long as the viewer is running and online.

To change amounts, open Settings & demos in the SAME browser as the
private controls, save the changes, then Apply saved settings & start fresh
between rounds. Names, all 25 original demos, all three proposals, mystery
picks and the special mode choices are supported. New round interrupts a
round; Apply and Demo wait until the current animation is finished.

Save the private controls link. Both links include a secret room key; keep
them off stream and do not share them with viewers. Anyone with either
complete link can control the room. Reopening controls preserves the live
round. Refreshing or closing the VIEWER loses its current round; saved
settings and Twitch channel are restored, but gameplay is not recovered.
Disconnected buttons do not queue actions. Old totals are marked offline.

The paired browser option needs internet, HTTPS (localhost for development),
WebRTC, PeerJS Cloud signaling/relay availability and Twitch public IRC.
The room key stays in the URL fragment; it is not sent to the static host
or signaling service. Mutual HMAC challenges authenticate the encrypted
data connection. Private controls contain no game engine. Duplicate viewer
protection is best-effort, not a substitute for using one active source.
Restrictive networks or unavailable services can prevent connection.
The existing StreamElements installation is a separate alternative.

Check audio in Streamlabs before going live. Browser autoplay policies can
block sounds in a normal browser until the wheel is clicked. The Sound
button mutes/unmutes the game, but cannot override browser sound policy.
The game artwork and sounds remain bundled; live pairing and chat require
network services. Physical Streamlabs/OBS and Faith's account permissions
need a private test on her machine.

Browser implementation: src/browser/. Tests cover authenticated pairing,
wrong-key rejection, disconnected actions, command parsing, owner/moderator
permissions, chat deduplication and reconnects. No chat messages are sent.
