export interface ModeInfo {
    id: number;
    name: string;
    original: string;
    hook: string;
    rule: string;
    colors: [
        string,
        string,
        string
    ];
    motif: string;
    cue: string;
    experimental?: boolean;
}
export const MODES: readonly ModeInfo[] = [
    { id: 0, name: "Money Orchard", original: "Dollar Tree", hook: "GROW FIVE. THEN GET OUT.", rule: "Grow five different $11 trees. After that, find a $1 exit.", colors: ["#66bfaa", "#baebbd", "#fff4c9"], motif: "orchard", cue: "GROW" },
    { id: 1, name: "Tip Jar Takeover", original: "Cash Boost", hook: "EVERY CASH SPACE GETS A RAISE", rule: "Add the cash boost to every cash prize. Bonus spins stay.", colors: ["#e18caf", "#f5c9a7", "#fff2ce"], motif: "coins", cue: "KA-CHING" },
    { id: 2, name: "Seeing Double", original: "Double Ticker", hook: "TWO POINTERS. ONE SPIN.", rule: "Both pointers pay. Extra spins use the larger award. Each special can hit twice.", colors: ["#9e8edb", "#eca5cf", "#e8e7ff"], motif: "double", cue: "DOUBLE VISION" },
    { id: 3, name: "Price Tag Party", original: "Cash Set", hook: "ONE PRICE. EVERY CASH SPACE.", rule: "Every cash prize becomes the configured flat amount.", colors: ["#db98c1", "#b5a1e9", "#ffefd0"], motif: "tags", cue: "SOLD" },
    { id: 4, name: "Main Character Energy", original: "Increased 2X Probability", hook: "THE MULTIPLIER TAKES THE STAGE", rule: "The multiplier grows to 35% of the wheel.", colors: ["#a68bd9", "#ebbee4", "#fff0b9"], motif: "spotlight", cue: "MAKE ROOM" },
    { id: 5, name: "Spin Me Baby", original: "Increased 2 Spins Probability", hook: "THE ENCORE GETS BIGGER", rule: "The +2 spins space grows to 30% of the wheel.", colors: ["#da8fc3", "#accaf0", "#fff5d6"], motif: "loops", cue: "AGAIN AGAIN" },
    { id: 6, name: "Clingy Wheel", original: "Increased Bonus Spins", hook: "IT DOES NOT WANT YOU TO LEAVE", rule: "Four more cash spaces gain a bonus spin.", colors: ["#d687b4", "#e8b3dc", "#fff0e0"], motif: "hearts", cue: "STAY A LITTLE" },
    { id: 8, name: "High Roller Hotline", original: "Russian Roulette", hook: "TWO HOT SPOTS. BIG MONEY.", rule: "Two $100 spaces cover 40% of the wheel. All other spaces pay $20.", colors: ["#d58fa8", "#a795d2", "#ffedaa"], motif: "hotline", cue: "JACKPOT CALLING" },
    { id: 9, name: "Just One More", original: "Mega Spin Bonus", hook: "OKAY. TWO MORE.", rule: "Add two spins to the current balance.", colors: ["#93b2df", "#d4b9eb", "#fff0d3"], motif: "tickets", cue: "+2 SPINS" },
    { id: 10, name: "Extra Extra", original: "Expanding Bonus Spins", hook: "BONUS SPACES TAKE OVER", rule: "The two cash-plus-spin spaces each grow to 40%.", colors: ["#d78cc5", "#9cbee4", "#fff3b7"], motif: "expand", cue: "ROOM FOR MORE" },
    { id: 11, name: "Multiplier Muse", original: "Mega Multiplier", hook: "ALL MULTIPLIERS. ONE SHOT.", rule: "One spin on a multiplier-only wheel. Factors add to the bank.", colors: ["#9e8be0", "#cfb4ef", "#fff2ba"], motif: "stars", cue: "STAR POWER" },
    { id: 12, name: "Fatal Attraction", original: "The 2X Magnet", hook: "IT IS PULLING YOU IN", rule: "The tiny multiplier is guaranteed on the first spin. Then the base wheel returns.", colors: ["#d186b0", "#91cbd9", "#ffedc2"], motif: "magnet", cue: "CANNOT RESIST" },
    { id: 13, name: "Third Wheel", original: "Right in the Middle", hook: "YOUR NEIGHBORS ARE COMING TOO", rule: "Collect three spaces. Neighbor bonus spins only count on the first spin; multiplier windows can hit twice.", colors: ["#9b9cdc", "#e0a8d1", "#e7f5f1"], motif: "triple", cue: "THREE IS A PARTY" },
    { id: 14, name: "Sweet Little Lie", original: "Mega Death / Angel Numbers", hook: "THIS LOOKS EXPENSIVE", rule: "The scary jackpot board is a fake-out. The real wheel pays angel numbers.", colors: ["#b794df", "#f0c0dc", "#fff5da"], motif: "angels", cue: "JEBAITED" },
    { id: 15, name: "Split Personality", original: "Cell Division", hook: "SHE HAS TWO SIDES", rule: "Two independent wheels pay together. Multiplier spaces do not return a spin.", colors: ["#d495c3", "#94bfdb", "#fff0da"], motif: "split", cue: "MAKE IT TWO" },
    { id: 16, name: "Lights Out, Babe", original: "Power Outage", hook: "ONLY FOUR SURVIVE", rule: "Eight spaces burn out. The four lit spaces have equal chances.", colors: ["#6d86be", "#98d5e0", "#fbf0bb"], motif: "outage", cue: "POWER FAILURE" },
    { id: 17, name: "Grabby Hands", original: "The Mean Ticker", hook: "THOSE HANDS ARE NOT FREE", rule: "Two extra hands collect prizes. The hands can take only one special per round.", colors: ["#cb91c9", "#f0b7a5", "#fff3d8"], motif: "hands", cue: "GIMME GIMME" },
    { id: 18, name: "Color Me Expensive", original: "Rainbow Ride", hook: "THE COLOR DOES THE MATH", rule: "A1Z26 letter values in each color name become the cash prize.", colors: ["#d191cd", "#98ccdb", "#fff2ca"], motif: "rainbow", cue: "TASTE THE TOTAL" },
    { id: 19, name: "Double Dare, Darling", original: "Double Trouble", hook: "DOUBLE THE MONEY. DOUBLE THE DRAMA.", rule: "Cash doubles, multiplier becomes x4, and +4 spins can hit once.", colors: ["#d28ec9", "#aa94df", "#ffeaba"], motif: "mirror", cue: "DARE YOU" },
    { id: 20, name: "Vault After Dark", original: "Bank Heist", hook: "WATCH THE LASERS", rule: "Six laser spaces pay $15 and return a spin. The other six keep their prizes.", colors: ["#648ea5", "#87dfc4", "#ffe5ce"], motif: "lasers", cue: "ACCESS GRANTED" },
    { id: 21, name: "Lucky-ish", original: "All or Nothing", hook: "THAT SEVEN HAS COMPANY", rule: "Scripted gag: the $777 space is decorative. A $7 landing turns into a $77 award.", colors: ["#af90da", "#f0ba99", "#fff1b9"], motif: "parachute", cue: "SPECIAL DELIVERY" },
    { id: 22, name: "Rush Hour Crush", original: "15 Second Dash", hook: "15 SECONDS. KEEP SPINNING.", rule: "Spin manually against the clock. The + and - controls queue seconds.", colors: ["#e394b4", "#a6bbea", "#fff0b1"], motif: "speed", cue: "READY SET GO" },
    { id: 23, name: "Bubble Trouble", original: "Force Fields", hook: "CASH BOUNCES BACK", rule: "Three shields pay cash-only hits and bounce into a free replacement spin.", colors: ["#8bcad9", "#c0abeb", "#efffe9"], motif: "bubbles", cue: "SHIELDS UP" },
    { id: 24, name: "Pick Your Poison", original: "Mystery Picks", hook: "SIX SECRETS. PICK YOUR FATE.", rule: "Choose six shuffled prizes, reveal them, then spin the same revealed board once.", colors: ["#b08bce", "#eda6c8", "#fff0c8"], motif: "mystery", cue: "PICK SIX" },
    { id: 25, name: "Heartbreak Escape", original: "Key Escape", hook: "THREE KEYS TO FREEDOM", rule: "Keep going until three keys unlock the wheel. Every key pays $5.", colors: ["#b68bdd", "#eeafc8", "#fff0c4"], motif: "locks", cue: "LET ME OUT" },
    { id: 26, name: "Prize Pinball", original: "New concept", hook: "ONE BALL. THREE CASH BUMPERS.", rule: "A spin picks three different cash bumpers. Collect all three, then finish.", colors: ["#8abdd7", "#da9dcf", "#fff3ae"], motif: "pinball", cue: "LAUNCH BALL", experimental: true },
    { id: 27, name: "Combo Queen", original: "New concept", hook: "THREE SPINS. BUILD A COMBO.", rule: "Three cash-only spins pay x1, x2, then x3. Every spin builds the combo; repeat hits never reset it.", colors: ["#cb90cc", "#95cbbb", "#fff0b0"], motif: "combo", cue: "COMBO START", experimental: true },
    { id: 28, name: "Encore or Exit", original: "New concept", hook: "CASH OUT OR TAKE AN ENCORE", rule: "One spin pays cash. Choose to bank it or take up to two more spins; each encore also adds a 50% bonus to that spin.", colors: ["#e0a0b9", "#a899da", "#fff2c6"], motif: "encore", cue: "YOUR CALL", experimental: true },
];
export const modeById = (id: number): ModeInfo => MODES.find(m => m.id === id) ?? MODES[0]!;
