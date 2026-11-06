/* ════════════════════════════════════════════════════════════════
   Ai'sHub · offline knowledge base
   Curated, self-contained topics the on-device engine can answer with
   no network at all. Plain Markdown answers so they render like any
   other model output.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  const T = (id, title, triggers, answer, tags = []) => ({ id, title, triggers, answer, tags });

  const topics = [
    /* ─────────────── about Ai'sHub ─────────────── */
    T('about', "What Ai'sHub is", ['who are you', 'what are you', 'your name', 'about aishub', "ai'shub", 'aishub', 'introduce yourself', 'what can you do', 'help me', 'capabilities'], `## I'm Ai'sHub — your own AI, free forever

**Chat mode** gives you a normal assistant: questions, writing, coding, study help, brainstorming.
**Agent mode** takes one goal, breaks it into steps, runs tools on this device and reports back.

**What's inside**
- **118+ models** from 23 providers (Gemini, Groq, OpenRouter, Claude, GPT, DeepSeek, Qwen, Llama and more) — sync adds new ones automatically.
- **On-device engine** (me, right now) — works with airplane mode on, no key, no limit.
- **Keyless free models** — the moment you install, Pollinations gives you free cloud answers with no signup.
- **Your keys, your device** — anything you add stays in local storage and goes straight to the provider.

**Good to know:** cloud models need network + (usually) a free API key. The on-device engine needs nothing at all. Switch models from the chip at the top of the screen.`, ['app']),

    T('free', 'Is it really free?', ['is it free', 'how much', 'price', 'pricing', 'cost', 'subscription', 'pay', 'unlimited', 'lifetime', 'premium'], `## Free, and it stays free

Ai'sHub has **no subscription, no ads, no trial timer**.

- The **on-device engine** is unlimited by design — it runs on your phone's own CPU.
- **Keyless cloud models** (Pollinations) are free and need no account.
- **BYO-key providers** (Gemini, Groq, OpenRouter, Cerebras, NVIDIA…) all have permanent free tiers. You create the key in their console in 30 seconds; Ai'sHub never sees your bill because there isn't one.

**Honest caveat:** each provider enforces its own rate limits on free tiers (for example ~30 requests/minute on Groq). Ai'sHub shows the error and suggests another free model instead of hiding it.`, ['app']),

    T('offline', 'How offline mode works', ['offline', 'airplane', 'no internet', 'without internet', 'no network', 'works offline', 'local engine', 'on device', 'on-device'], `## Offline = a real engine on your phone

When there is no network (or you pick a model labelled **Local**), Ai'sHub runs its own on-device engine:

1. **Understands** your message with a lightweight intent classifier (question, code, math, writing, translation, brainstorming).
2. **Retrieves** from a built-in knowledge base and skill set (calculator, converters, text tools, timers, planners).
3. **Composes** a structured answer — headings, steps, checklists, code samples — using templates tuned per topic.
4. **Never uploads** anything. It literally cannot: no network calls exist on that path.

**Best offline uses:** math, unit conversions, writing drafts, study notes, coding snippets, planning, and questions you ask often.

**Limits:** it's not a frontier model, so for deep reasoning or very specific facts, connect a cloud model. Chat history, agent tasks and settings all keep working offline — they're stored on the device.`, ['app']),

    T('apikey', 'Adding API keys', ['api key', 'add key', 'apikey', 'provider key', 'gemini key', 'groq key', 'openrouter key', 'how to connect', 'connect model'], `## Connect a provider in ~30 seconds

1. Open **Settings → API keys** in Ai'sHub.
2. Tap the provider you want (Gemini, Groq, OpenRouter, Cerebras, NVIDIA, Mistral…).
3. In the provider console, create a key and paste it.
4. Tap **Sync** on the **Models** tab — every model your key can reach appears, including ones released after this app was built.

**Free-tier picks**

| Provider | Free tier | Get a key |
| --- | --- | --- |
| Google Gemini | generous daily limits | aistudio.google.com/apikey |
| Groq | ~30 req/min, very fast | console.groq.com/keys |
| OpenRouter | models marked \`:free\` | openrouter.ai/keys |
| Cerebras | trial credit, fastest tokens/s | cloud.cerebras.ai |
| NVIDIA NIM | free developer access | build.nvidia.com |

Keys are stored only in this device's storage and sent directly to that provider's API.`, ['app']),

    T('privacy', 'Privacy and data', ['privacy', 'data', 'tracking', 'safe', 'secure', 'store my chats', 'upload', 'gdpr'], `## Your data stays yours

- **Chats, settings, keys and agent tasks** live in this app's local storage (localStorage + IndexedDB) on your device.
- **No analytics, no ads, no telemetry.** Ai'sHub has no backend of its own.
- With a **cloud model**, only the current conversation you send goes to that provider — exactly like using their website.
- With the **on-device engine**, nothing leaves the phone at all.
- Delete everything anytime: **Settings → Data → Reset**.

Practical hygiene: don't paste passwords, card numbers or private documents into any cloud model. Use a local model for sensitive text.`, ['app']),

    T('agentmode', 'Agent mode explained', ['agent mode', 'agent', 'autonomous', 'do it for me', 'automate', 'tool use', 'tools'], `## Agent mode: one goal, many steps

Switch the pill above the message box to **Agent**. Describe the outcome, not the steps — for example: *"Plan a 3-day Dhaka trip under 15,000 BDT and save it to a note."*

**What the agent does**
1. **Plan** — writes a short numbered plan you can see.
2. **Act** — calls built-in skills: calculator, unit converter, notes, file reading, web fetch/JSON, text tools, timers, memory.
3. **Check** — verifies results and retries a failed step once.
4. **Report** — final answer + full step trace, saved in the **Agent** tab.

**Safety:** by default dangerous steps (saving, overwriting, network writes) ask for a tap first. Change this in **Settings → Agent approval**. Max steps is configurable too.

**Offline?** The planner still works on-device — notes, math, conversion and text skills are all local.`, ['app']),

    T('modelsync', 'How new models appear', ['new model', 'new models', 'auto add', 'auto update', 'model list', 'sync models', 'latest models'], `## New models add themselves

Ai'sHub ships with a starting catalog, then refreshes it from every provider you've connected:

1. On launch (and every 6 hours) it calls each provider's \`/models\` endpoint.
2. New IDs are merged in, deduped by \`provider:model\`, and tagged **NEW**.
3. Capability flags (free / vision / tools / reasoning) are inferred from the ID and the provider's metadata.
4. You get a toast — no app update needed.

You can also add a **catalog feed** URL in Settings pointing at a JSON list; the repo can publish one so everyone sees a newly announced model the same day.

**Manual controls:** Models tab → **Sync** to refresh now, **Custom** to add any OpenAI-compatible endpoint or model id by hand.`, ['app']),

    T('install', 'Installing Ai\'sHub', ['install', 'download', 'apk', 'android app', 'home screen', 'add to home screen', 'ios', 'iphone', 'package name', 'com.aishub'], `## Get Ai'sHub on your phone

**Android app (native)** — the repo ships a Capacitor project (\`android/\`), package **com.aishub**. Build it with Android Studio or \`npx cap sync android && cd android && ./gradlew assembleDebug\`, then install the APK. Offline files are bundled inside the app.

**PWA (any phone)** — open the published page in Chrome/Safari → menu → **Install app** / **Add to Home Screen**. It installs with the same icon and works offline via the service worker.

**Desktop** — Chrome/Edge → install icon in the address bar.

After installing once, the shell keeps working offline; only cloud model calls need the internet.`, ['app']),

    /* ─────────────── science & study ─────────────── */
    T('photosynthesis', 'Photosynthesis', ['photosynthesis', 'chlorophyll', 'plants make food', 'how plants eat'], `## Photosynthesis in one page

**Definition:** plants, algae and some bacteria convert light energy into chemical energy stored in glucose.

**Equation**
\`\`\`
6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂
\`\`\`

**Where:** chloroplasts. Light reactions in the **thylakoid membrane**, Calvin cycle in the **stroma**.

**Two stages**
1. **Light reactions** — water is split (photolysis), releasing O₂; ATP and NADPH are made.
2. **Calvin cycle** — CO₂ is fixed by RuBisCO into a 3-carbon sugar, using ATP + NADPH, to build glucose.

**Limiting factors:** light intensity, CO₂ concentration, temperature, water, chlorophyll amount.

**Why it matters:** it produces the oxygen you breathe and the base of nearly every food chain.

*Exam tip:* if asked for the site of photosynthesis, say **chloroplast**; for the pigment, **chlorophyll**.`, ['science', 'biology']),

    T('gravity', 'Gravity', ['gravity', 'gravitation', 'why things fall', 'newton gravity', 'weightless'], `## Gravity, simply and precisely

**Newton's law:** every mass attracts every other mass:
\`\`\`
F = G · m₁ · m₂ / r²        G = 6.674×10⁻¹¹ N·m²/kg²
\`\`\`
Double the distance → quarter the force.

**At Earth's surface:** \`g ≈ 9.81 m/s²\`. Weight is a force: \`W = m·g\`, so a 60 kg person weighs ≈ 589 N.

**Einstein's upgrade:** mass doesn't "pull" — it curves spacetime, and objects follow the straightest available path (geodesics). This predicts light bending and gravitational waves, both measured.

**Free fall:** all objects accelerate equally in vacuum (a feather and hammer land together on the Moon, 1971).

**Everyday consequences:** orbits are continuous free fall, tides come from Moon/Sun gradients, GPS clocks need relativistic correction.`, ['science', 'physics']),

    T('watercycle', 'Water cycle', ['water cycle', 'hydrological', 'rain', 'evaporation', 'condensation'], `## The water cycle

1. **Evaporation** — the Sun turns surface water into vapour (plus **transpiration** from plants).
2. **Condensation** — vapour cools at altitude onto particles, forming droplets → clouds.
3. **Precipitation** — droplets merge until heavy enough: rain, snow, hail, sleet.
4. **Collection / runoff** — water enters rivers, lakes, groundwater and eventually oceans.
5. **Infiltration** recharges aquifers, which feed rivers slowly (base flow).

**Numbers worth knowing:** ~71% of Earth's surface is water; only ~2.5% is fresh; ~97% of that fresh water is locked in ice and groundwater.

**Human impact:** paving reduces infiltration → flash floods; dams and irrigation change runoff; warming increases evaporation and rainfall intensity.`, ['science', 'geography']),

    T('dna', 'DNA and genes', ['dna', 'gene', 'genes', 'rna', 'genetics', 'chromosome', 'heredity', 'mutation'], `## DNA, genes and inheritance

**DNA** is a double helix of two strands held by base pairs: **A–T** and **G–C**. The order of those letters is the instruction.

**Gene → protein:** DNA is transcribed to mRNA in the nucleus, then translated by ribosomes into a chain of amino acids (3 bases = 1 codon = 1 amino acid) that folds into a protein.

**Genes** are stretches of DNA that encode something. Humans have ~20,000 protein-coding genes across 46 chromosomes (23 pairs).

**Inheritance:** each parent passes one allele per gene. Dominant alleles show in heterozygotes; recessive ones need two copies.

**Mutations** are changes in the sequence — from copying errors, radiation or chemicals. Most are neutral, some cause disease, some create useful variation that natural selection can act on.

**Modern tools:** PCR copies DNA, CRISPR edits it, sequencing reads it.`, ['science', 'biology']),

    T('newton', "Newton's laws", ['newton', "newton's laws", 'laws of motion', 'inertia', 'force', 'f=ma', 'action reaction'], `## Newton's three laws

**1. Inertia** — an object keeps its velocity unless a net external force acts. (Seatbelts exist because of this.)

**2. F = m·a** — net force equals mass times acceleration. Units: 1 N = 1 kg·m/s².

**3. Action–reaction** — forces come in equal, opposite pairs on *different* bodies. A rocket pushes gas down, gas pushes rocket up.

**Worked example** — a 1,200 kg car accelerates 0 → 27 m/s (≈100 km/h) in 9 s:
\`\`\`
a = Δv/Δt = 27/9 = 3 m/s²
F = m·a = 1200 × 3 = 3,600 N
\`\`\`

**Common mistake:** canceling action–reaction pairs on one object. Pairs act on two objects, so they never cancel.`, ['science', 'physics']),

    T('relativity', 'Relativity (quick guide)', ['relativity', 'einstein', 'e=mc2', 'e = mc2', 'time dilation', 'speed of light'], `## Special + general relativity, in plain language

**Special relativity (1905)** — two postulates: physics is the same in all inertial frames; light speed \`c\` is constant for everyone.

Consequences:
- **Time dilation:** moving clocks run slow, \`t' = t·√(1 − v²/c²)\`
- **Length contraction** along motion.
- **Mass–energy equivalence:** \`E = mc²\` (1 g of mass ≈ 9×10¹³ J).
- **No signal beats light.**

**General relativity (1915)** — gravity is curvature of spacetime caused by energy/momentum. Predictions confirmed: Mercury's perihelion precession, light bending during eclipses, gravitational lensing, black holes (image released 2019), gravitational waves (detected 2015), GPS clock corrections.

**Intuition:** satellites' clocks tick faster by ~38 μs/day; without correction, GPS drifts ~10 km per day.`, ['science', 'physics']),

    T('climate', 'Climate change basics', ['climate change', 'global warming', 'greenhouse', 'co2 emissions', 'carbon footprint'], `## Climate change: the essentials

**Mechanism:** greenhouse gases (CO₂, CH₄, N₂O, water vapour) absorb outgoing infrared, warming the surface. Since industrialisation, atmospheric CO₂ rose from ~280 to over 420 ppm.

**Evidence:** direct temperature records, ice cores (air bubbles = past CO₂), sea-level measurements, satellite data, shifting species ranges.

**Impacts:** hotter heatwaves, heavier rainfall and droughts, ocean acidification, sea-level rise from thermal expansion + ice melt, crop stress, migration and health pressure.

**What actually moves the needle**
1. Electricity: renewables + storage, efficiency.
2. Transport: public transit, EVs, fewer short flights.
3. Buildings: insulation, heat pumps.
4. Food: less waste, less beef, seasonal produce.
5. Systems: carbon pricing, standards, disclosure.

**Personal footprint:** typically biggest in home energy, car use and flights — measure those first.`, ['science', 'environment']),

    T('periodic', 'Periodic table basics', ['periodic table', 'element', 'atoms', 'atomic number', 'mendeleev', 'periods groups'], `## Reading the periodic table

**Layout:** rows = **periods** (shells being filled), columns = **groups** (similar valence electrons).

**Key regions:** s-block (groups 1–2), p-block (13–18), d-block = transition metals, f-block = lanthanides/actinides.

**Trends**
- **Atomic radius** ↓ across a period (more protons pull harder), ↑ down a group (new shell).
- **Ionisation energy** ↑ across, ↓ down.
- **Electronegativity** ↑ across, ↓ down (F is highest).
- **Metallic character** ↓ across, ↑ down.

**Handy facts:** atomic number = protons (it defines the element); groups 1/2 react vigorously; noble gases are inert; halogens gain one electron.

**Mnemonic for period 2:** *Lina Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon* — or just remember 1s² 2s² 2p⁶.`, ['science', 'chemistry']),

    T('studyplan', 'Build a study plan', ['study plan', 'how to study', 'exam prep', 'revision', 'memorize', 'learn faster', 'focus', 'pomodoro'], `## A study method that actually works

**1. Define the target** — exam date + syllabus split into ~12 chunks. Each chunk gets one "can I explain it out loud?" test.

**2. Time-block** — 4–6 blocks of 25–50 min per day, each with a single outcome. Breaks are part of the plan, not a reward.

**3. Use active recall** — close the book and write everything you remember, then check. Re-reading feels productive but does little.

**4. Space it** — revise after 1 day, 3 days, 7 days, 21 days. Phone alarms or Ai'sHub notes both work.

**5. Interleave** — mix problem types in a session so you practise *choosing* the method, not just executing it.

**6. Explain it** — teach a friend or the local Ai'sHub engine: gaps show up in the first sentence.

**7. Sleep 7–9 h** — consolidation happens in sleep. All-nighters trade memory for anxiety.

**Weekly reset:** 20 min reviewing what worked, what slipped, and next week's three priorities.`, ['education']),

    /* ─────────────── math ─────────────── */
    T('percent', 'Percentages', ['percentage', 'percent', 'discount', 'increase percent', 'how to calculate percent'], `## Percentages — all the cases

**Core idea:** percent means "per 100". So \`x% = x/100\`.

| Question | Formula | Example |
| --- | --- | --- |
| What is 15% of 240? | \`0.15 × 240\` | 36 |
| 18 is what % of 75? | \`18/75 × 100\` | 24% |
| Price after 20% off 1,500 | \`1500 × 0.8\` | 1,200 |
| Increase from 80 to 100 | \`(100−80)/80 × 100\` | +25% |
| Reverse: price 900 after 10% off | \`900 / 0.9\` | 1,000 |

**Traps**
- A 20% drop then a 20% rise does **not** return to the start: \`1 × 0.8 × 1.2 = 0.96\` → you're 4% down.
- Percent *points* ≠ percent: going 5% → 7% is **+2 points** but **+40%** relative.

*Tip:* tap the ✦ skills chip and type the numbers — the offline calculator does the arithmetic instantly.`, ['math']),

    T('geometry', 'Area and volume formulas', ['area', 'volume', 'perimeter', 'circle area', 'triangle area', 'cylinder', 'sphere', 'geometry formulas'], `## Area & volume cheat sheet

**Area**
\`\`\`
square      a²
rectangle   l·w
triangle    ½·b·h        (or √(s(s−a)(s−b)(s−c)) Heron)
circle      πr²
trapezium   ½(a+b)·h
parallelogram b·h
sector      (θ/360)·πr²
\`\`\`

**Volume**
\`\`\`
cube        a³
cuboid      l·w·h
cylinder    πr²h
cone        ⅓πr²h
sphere      4/3 πr³
prism       base area × height
pyramid     ⅓ × base area × height
\`\`\`

**Surface area:** cylinder \`2πr(r+h)\`, cone \`πr(r+√(r²+h²))\`, sphere \`4πr²\`.

**Units:** 1 m² = 10,000 cm², 1 m³ = 1,000 L = 10⁶ cm³. Always convert before multiplying.`, ['math']),

    T('quadratic', 'Quadratic equations', ['quadratic', 'parabola', 'discriminant', 'root formula', 'ax2+bx+c'], `## Solving ax² + bx + c = 0

**Formula**
\`\`\`
x = (−b ± √(b² − 4ac)) / (2a)
\`\`\`

**Discriminant** \`D = b² − 4ac\`
- D > 0 → two real roots
- D = 0 → one repeated root (x = −b/2a)
- D < 0 → no real roots (complex pair)

**Example:** 2x² − 7x + 3 = 0
\`\`\`
a=2 b=−7 c=3
D = 49 − 24 = 25
x = (7 ± 5)/4  →  x = 3  or  x = 0.5
\`\`\`

**Other routes:** factorising when roots are integers; completing the square to find the vertex \`(−b/2a, c − b²/4a)\`; graph it to sanity-check.

**Word problems:** area, projectile height and profit-vs-price questions are nearly always quadratics.`, ['math']),

    T('stats', 'Statistics essentials', ['statistics', 'mean median mode', 'standard deviation', 'probability', 'average', 'percentile'], `## Statistics you'll actually use

**Central tendency**
- **Mean** = sum / count (sensitive to outliers)
- **Median** = middle value when sorted (robust)
- **Mode** = most frequent (good for categories)

**Spread**
\`\`\`
variance  s² = Σ(x − x̄)² / (n − 1)
std dev   s  = √s²
range     max − min
IQR       Q3 − Q1   (contains middle 50%)
\`\`\`

**Probability**: \`P(A) = favourable / total\`; \`P(A or B) = P(A)+P(B)−P(A and B)\`; independent events multiply.

**Traps**
1. A **median** income is not an **average** income.
2. Correlation ≠ causation (ice-cream sales and drowning both rise in summer).
3. Big samples shrink random error (~1/√n) but don't fix bias.
4. "Average of averages" is wrong unless group sizes match.`, ['math']),

    /* ─────────────── coding ─────────────── */
    T('html', 'HTML basics', ['html', 'tags', 'webpage', 'markup', 'html5'], `## HTML in one page

\`\`\`html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My page</title>
</head>
<body>
  <header><h1>Hello</h1></header>
  <main>
    <p>Some text with a <a href="https://example.com">link</a>.</p>
    <img src="photo.jpg" alt="Describe the image" />
    <ul><li>First</li><li>Second</li></ul>
    <button onclick="alert('hi')">Click</button>
  </main>
</body>
</html>
\`\`\`

**Core tags:** headings \`h1–h6\`, \`p\`, \`a\`, \`img\`, lists \`ul/ol/li\`, \`div\`/\`span\`, forms \`form/input/label\`, semantic \`header/nav/main/section/footer\`.

**Rules that matter:** one \`h1\` per page; always set \`alt\`; use semantic tags for accessibility and SEO; \`<button>\` for actions, \`<a>\` for navigation.`, ['code', 'web']),

    T('css', 'CSS layout basics', ['css', 'flexbox', 'grid', 'styling', 'responsive', 'media query'], `## CSS: layout that behaves

**Flexbox** — one dimension:
\`\`\`css
.row { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
.panel { flex: 1 1 0; min-width: 0; }
\`\`\`

**Grid** — two dimensions:
\`\`\`css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
\`\`\`

**Responsive** with container-ish media queries:
\`\`\`css
@media (max-width: 640px) { .sidebar { display: none; } }
\`\`\`

**Variables + theming**
\`\`\`css
:root { --brand: #7c5cff; --bg: #07070b; }
.btn  { background: var(--brand); }
\`\`\`

**Debug checklist:** missing unit on numbers, specificity conflicts, \`box-sizing\` (set \`border-box\` globally), overflowing flex children (add \`min-width: 0\`), z-index without \`position\`.`, ['code', 'web']),

    T('javascript', 'JavaScript essentials', ['javascript', 'js', 'es6', 'arrow function', 'async await', 'promise'], `## JavaScript you use daily

\`\`\`js
// variables: const by default, let when reassigning
const user = { name: 'Ada', age: 36 };
let count = 0;

// functions
const add = (a, b) => a + b;

// arrays
const nums = [3, 1, 4];
nums.map(n => n * 2);        // [6, 2, 8]
nums.filter(n => n > 2);     // [3, 4]
nums.reduce((s, n) => s + n, 0); // 8

// objects
const { name } = user;        // destructure
const next = { ...user, age: 37 }; // immutable update

// async
async function load() {
  try {
    const res = await fetch('https://api.example.com/items');
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.error('failed', err);
  }
}
\`\`\`

**Must-know concepts:** closures, \`this\` (arrow functions capture it), the event loop, promises vs callbacks, modules (\`import/export\`), optional chaining \`a?.b\`, nullish coalescing \`a ?? b\`.

**Debug:** \`console.table(arr)\`, breakpoints in DevTools, \`debugger;\`, and read the *first* error line — later ones are usually fallout.`, ['code']),

    T('python', 'Python essentials', ['python', 'py', 'pip', 'list comprehension', 'pandas', 'def function'], `## Python quick reference

\`\`\`python
# basics
name = "Ada"
age = 36
nums = [3, 1, 4]
squares = [n * n for n in nums]      # list comprehension
unique = {n for n in nums}           # set
scores = {"ada": 98, "alan": 91}     # dict

# functions
def greet(who, *, excited=False):
    msg = f"Hello, {who}"
    return msg + "!" if excited else msg

# control flow
for n in nums:
    if n % 2 == 0:
        print(f"{n} is even")

# files
with open("notes.txt", "w", encoding="utf-8") as f:
    f.write("hello\\n")

# errors
try:
    value = int("42")
except ValueError as err:
    print("bad input", err)
\`\`\`

**Project setup**
\`\`\`bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\\Scripts\\activate
pip install requests pandas
\`\`\`

**Idioms:** \`if __name__ == "__main__":\`, f-strings, \`enumerate\`, \`zip\`, \`pathlib.Path\`, type hints (\`def f(x: int) -> int\`).`, ['code']),

    T('git', 'Git commands', ['git', 'commit', 'branch', 'merge', 'rebase', 'pull request', 'version control'], `## Git survival kit

\`\`\`bash
git init
git clone <url>
git status                     # what changed
git add -A                     # stage everything
git commit -m "feat: add login"
git pull --rebase origin main
git push origin HEAD
\`\`\`

**Branches**
\`\`\`bash
git switch -c feature/login    # create + switch
git switch main
git merge feature/login
git branch -d feature/login
\`\`\`

**Fix-ups**
\`\`\`bash
git restore --staged file      # unstage
git restore file               # discard local edits
git commit --amend             # edit last commit (not yet pushed)
git revert <sha>               # undo safely on shared branches
git stash / git stash pop      # park work
git log --oneline --graph --all
\`\`\`

**Rules of thumb:** commit small and often; never rebase a branch others use; \`.gitignore\` before the first commit; a PR should answer *what* and *why*.`, ['code']),

    T('api', 'APIs and REST', ['api', 'rest', 'http', 'endpoint', 'json api', 'post get', 'fetch'], `## APIs without the fog

**REST basics:** resources at URLs, verbs as actions.

| Verb | Meaning | Example |
| --- | --- | --- |
| GET | read | \`GET /users/42\` |
| POST | create | \`POST /users\` |
| PATCH | partial update | \`PATCH /users/42\` |
| PUT | replace | \`PUT /users/42\` |
| DELETE | remove | \`DELETE /users/42\` |

**Status codes:** 2xx success, 3xx redirect, 400 bad request, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 429 rate limited, 5xx server error.

**Calling one**
\`\`\`js
const res = await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ name: 'Ada' }),
});
if (!res.ok) throw new Error('HTTP ' + res.status);
const data = await res.json();
\`\`\`

**Good practice:** timeouts, retry only idempotent calls, never ship secrets in a web client, version your API, paginate lists, log correlation ids.`, ['code']),

    T('debug', 'Debugging method', ['debug', 'bug', 'error', 'not working', 'fix code', 'troubleshoot'], `## Debug like a scientist

**1. Reproduce** — find the smallest input that fails, every time.

**2. Read the actual error** — top line of the stack, first file *in your code*. 80% of bugs are answered there.

**3. Bisect** — comment out half, test, repeat. Six steps narrows 64 possibilities to 1.

**4. Check assumptions** — log real values, not what you think they are: \`console.log({ input, ids: ids.length })\`.

**5. Simplify** — rewrite the failing 10 lines from scratch; the bug is usually a shape mismatch (string vs number, null, empty array).

**6. Verify the fix** — rerun the failing case, then a case that should *not* be affected.

**Common culprits:** off-by-one loops, async not awaited, mutation of shared state, stale cache, wrong environment variable, trailing whitespace in keys.

**Log template**
\`\`\`
TRACE  start        input=…
TRACE  after step 1 value=…
ERROR  at step 2    reason=…
\`\`\``, ['code']),

    T('sql', 'SQL basics', ['sql', 'database', 'select', 'join', 'query', 'sqlite', 'postgres'], `## SQL in one page

\`\`\`sql
SELECT u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 2
ORDER BY orders DESC
LIMIT 20;
\`\`\`

**Clause order matters:** \`SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT\`.

**Joins:** INNER (both sides), LEFT (keep left), RIGHT, FULL (both). \`WHERE\` filters rows; \`HAVING\` filters groups.

**Write safely**
\`\`\`sql
INSERT INTO notes (title, body) VALUES (?, ?);   -- parameters, never string-concat
UPDATE notes SET body = ? WHERE id = ?;
DELETE FROM notes WHERE id = ?;
\`\`\`

**Indexes** speed reads on the columns you filter/join by; they cost write time and disk. \`EXPLAIN\` shows the plan.`, ['code']),

    T('regex', 'Regex cheat sheet', ['regex', 'regexp', 'regular expression', 'pattern match'], `## Regex patterns that cover most needs

**Characters:** \`.\` any, \`\\d\` digit, \`\\w\` word char, \`\\s\` whitespace, \`[abc]\` set, \`[^abc]\` negation.

**Quantifiers:** \`*\` 0+, \`+\` 1+, \`?\` optional, \`{2,5}\` range (greedy; add \`?\` to make lazy).

**Anchors:** \`^\` start, \`$\` end, \`\\b\` word boundary.

**Groups:** \`(…)\` capture, \`(?:…)\` non-capturing, \`(?<name>…)\` named, \`\\1\` backreference.

**Handy patterns**
\`\`\`
email        ^[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}$
URL          ^https?://[^\\s]+$
number       ^-?\\d+(\\.\\d+)?$
phone (intl) ^\\+?[1-9]\\d{7,14}$
date YYYY-MM-DD  ^\\d{4}-\\d{2}-\\d{2}$
whitespace   \\s+
\`\`\`

**In code**
\`\`\`js
const m = 'Order #4711'.match(/#(\\d+)/);
if (m) console.log(m[1]); // "4711"
'one, two'.split(/,\\s*/); // ["one","two"]
\`\`\`

**Advice:** keep regex out of places where a parser is safer (HTML, JSON); test with real data and add comments for anything past one line.`, ['code']),

    T('algorithm', 'Algorithms & Big-O', ['algorithm', 'big o', 'complexity', 'sorting', 'binary search', 'data structure'], `## Complexity at a glance

| Pattern | Time | Example |
| --- | --- | --- |
| constant | O(1) | hash lookup, array index |
| logarithmic | O(log n) | binary search, balanced tree |
| linear | O(n) | one pass, map/filter |
| linearithmic | O(n log n) | good sorts, heap |
| quadratic | O(n²) | nested loops |
| exponential | O(2ⁿ) | naive subsets, some recursion |

**Binary search**
\`\`\`js
function bsearch(arr, target) {       // arr sorted
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}
\`\`\`

**Choosing a structure:** array for order/indexing, set for membership, map for lookups, stack for undo/parsing, queue for scheduling, heap for top-k, graph for relationships.

**Interview habit:** state the brute force, its complexity, then optimise — interviewers score the reasoning as much as the code.`, ['code']),

    /* ─────────────── writing ─────────────── */
    T('email', 'Write a professional email', ['email', 'write an email', 'professional email', 'follow up email', 'cover email'], `## Email that gets answered

**Structure:** subject = action + topic → one-line purpose → context → specific ask → deadline → sign-off.

\`\`\`
Subject: Confirm Thursday 3pm demo — 2 questions

Hi Sara,

Quick one: are we still on for Thursday 15:00? I want to make sure
the staging build is the one you'll see.

Two things I need before then:
1. The test account email you'll use.
2. Whether your team needs read-only or admin access.

If I don't hear back by Wednesday noon I'll assume the slot works
and send the link.

Thanks,
Rafiq
\`\`\`

**Rules**
- One email, one ask. Two asks = two threads.
- Put the deadline in the body, not only in your head.
- Numbered lists beat paragraphs for anything actionable.
- Reply within 24 h even if it's "got it, answer by Friday".

**Tone dial:** formal (*I would appreciate…*), neutral (*Could you…*), friendly (*Quick favour —*). Mirror the other side.`, ['writing']),

    T('coverletter', 'Cover letters & resumes', ['cover letter', 'resume', 'cv', 'job application', 'interview', 'hiring'], `## Get to the interview

**Resume rules**
1. One page under 5 years' experience, two max after.
2. Lead bullets with an outcome: *"Cut checkout failures 32% by adding retry + idempotency"*.
3. Numbers everywhere: users, %, time, money, scale.
4. Mirror the job ad's vocabulary — that's what the ATS scans.
5. No photo, no "references on request", no objective paragraph.

**Cover letter skeleton (200–250 words)**

\`\`\`
Para 1 — Hook: the role + one proof you fit ("I shipped the kind of
         onboarding flow you describe at ShopX, cutting drop-off 18%").
Para 2 — Evidence: two achievements with numbers, mapped to their needs.
Para 3 — Fit: why this company specifically (product, market, mission).
Para 4 — Close: availability + one clear ask (a conversation).
\`\`\`

**Interview prep:** write 6 STAR stories (Situation, Task, Action, Result) covering conflict, failure, leadership, ambiguity, deadline, technical depth. Rehearse out loud once.`, ['writing', 'career']),

    T('story', 'Story & creative writing', ['story', 'creative writing', 'novel', 'character', 'poem', 'fiction', 'plot'], `## Make a scene work

**Scene spine:** goal → obstacle → decision → consequence. If a scene has no decision, it's description.

**Character in three strokes**
1. What they want (external goal).
2. What they need (internal truth they resist).
3. The lie they believe — and the moment it cracks.

**Show, don't report**
- Telling: *She was nervous.*
- Showing: *She checked the door twice before the coffee arrived, then turned the cup handle to face exactly north.*

**Openers that hook:** a decision already in motion, a contradiction, or a line of dialogue with subtext.

**Micro-poem form**
\`\`\`
Three lines: an image, a turn, a silence.
The lamp decides it has done enough —
the room agrees —
outside, a bus keeps everyone honest.
\`\`\`

**Revision pass:** cut 10% of words, replace adverbs with stronger verbs, read aloud to catch rhythm.`, ['writing', 'creative']),

    T('summarize', 'Summarise anything', ['summarize', 'summary', 'tldr', 'shorten', 'key points', 'main idea'], `## Summaries that keep the meaning

**The 4-step method**
1. **Question** — what decision or understanding is this summary for?
2. **Thesis** — write the single sentence the text exists to prove.
3. **Evidence** — 3–5 points that support it, each ≤ 12 words.
4. **Caveat** — what the text doesn't settle or assumes.

**Formats by length**
- *Tweet:* thesis + sharpest number.
- *Paragraph:* thesis, two supports, implication.
- *Brief:* headings for Context / Findings / Implications / Next step.

**Faithfulness checks:** no claim stronger than the source; keep numbers exact; mark inference with "suggests" or "likely"; keep names and dates.

**Example**
> **Thesis:** Remote teams ship slower when decisions lack written owners.
> **Evidence:** 3 studies, handoff latency, meeting density.
> **Caveat:** mostly software teams; no data on hardware.

Paste a long article here and I'll produce this skeleton for it.`, ['writing', 'productivity']),

    /* ─────────────── everyday life ─────────────── */
    T('productivity', 'Productivity system', ['productivity', 'get things done', 'procrastination', 'todo', 'time management', 'gtd', 'prioritize'], `## A productivity system that survives Monday

**1. One capture inbox** — every task goes to one place (Ai'sHub notes, a widget, a paper card). Capture costs < 5 s.

**2. Daily three** — each morning pick 3 outcomes. Not 10. Three. Everything else is bonus.

**3. Timebox, don't wish** — put the three on the calendar as blocks. Work expands to fill the space you give it.

**4. Eat the frog** — hardest item first, before messages.

**5. Shut the doors** — notifications off for the first block; one browser window.

**6. Weekly review (25 min)** — what shipped, what slipped, what's next week's three.

**Priority trick — ICE:** Impact (1–5) × Confidence (1–5) × Ease (1–5). Do the top score; delete anything under your threshold instead of postponing it.

**Beating procrastination:** shrink the first step to 2 minutes (\`open the doc and write the title\`), and pre-commit with a timer.`, ['life', 'productivity']),

    T('money', 'Budget & saving basics', ['budget', 'save money', 'savings', '50/30/20', 'expenses', 'emergency fund', 'loan', 'interest'], `## Money basics that compound

**50/30/20 starter rule** (adjust to reality): 50% needs, 30% wants, 20% savings + debt payoff.

**Order of operations**
1. **Emergency fund** — 3–6 months of essentials in a separate account.
2. **Kill high-interest debt** — anything above ~10% APR beats investing.
3. **Matched pension/retirement** — free money first.
4. **Invest the rest** broadly and boringly, monthly, automatically.

**Compound interest**
\`\`\`
A = P(1 + r/n)^(n·t)
P=10,000, r=8%, n=12, t=10  →  A ≈ 22,196
\`\`\`
Starting 5 years earlier is worth more than almost any hot pick.

**Loan check** — compare APR, not monthly payment. Total cost = payment × months − principal.

**Everyday levers:** subscription audit, cook 4 more meals/week, buy used for depreciating items, automatic transfer on payday.`, ['life', 'finance']),

    T('health', 'Health & fitness basics', ['health', 'exercise', 'workout', 'sleep', 'diet', 'nutrition', 'lose weight', 'fitness', 'fever'], `## Health habits with the best evidence

**Movement:** 150 min moderate cardio per week + 2 strength sessions. Walking counts. Start with 20-min walks 5×/week.

**Strength starter (2–3×/week):** squat, hinge (deadlift/hip thrust), push-up, row, carry. 3 sets of 5–12 reps, add a little weight or a rep weekly.

**Sleep:** 7–9 h, same wake time daily, dim light 1 h before bed, caffeine cut-off 8 h before.

**Food:** protein at every meal (~1.2–1.6 g/kg if training), fibre 25–35 g, mostly whole foods, water through the day. No single food is magic; consistency is.

**Fat loss:** a deficit of ~300–500 kcal/day gives 0.3–0.5 kg/week. Slower is more sustainable and protects muscle.

**⚠️ Medical disclaimer:** this is general information, not diagnosis. For fever above 39 °C, chest pain, breathing trouble, sudden weakness, severe dehydration or symptoms lasting more than a few days — contact a clinician or emergency services now.`, ['life', 'health']),

    T('cooking', 'Cooking basics & conversions', ['cook', 'recipe', 'bake', 'measurement', 'grams', 'cups', 'how long to boil', 'tea', 'rice'], `## Kitchen basics

**Conversions**
\`\`\`
1 cup flour ≈ 125 g    1 cup sugar ≈ 200 g    1 cup rice ≈ 185 g
1 tbsp ≈ 15 ml         1 tsp ≈ 5 ml           1 cup ≈ 240 ml
1 oz ≈ 28.3 g          1 lb ≈ 454 g           °F = °C×9/5 + 32
\`\`\`

**Ratios to remember**
- **Rice:** 1 part rice : 1.75–2 parts water, bring to boil, lid on low 12–15 min, rest 10 min.
- **Pasta:** 1 L water + 10 g salt per 100 g; cook 1 min less than the pack, finish in sauce.
- **Tea:** black 95–100 °C / 3–4 min; green 75–80 °C / 2–3 min (boiling water makes it bitter).
- **Eggs:** soft-boiled 6 min, jammy 7, hard 9–10 (from boiling).
- **Vinaigrette:** 3 oil : 1 acid + salt.
- **Bread dough:** 100 flour : 60–65 water : 1 salt : 1 yeast (%).

**Flavour formula:** salt + fat + acid + heat. If a dish tastes flat, it's usually missing acid (lemon, vinegar) or salt.

**Food safety:** poultry to 74 °C internal, leftovers cooled within 2 h and eaten within 3 days.`, ['life', 'cooking']),

    T('travel', 'Plan a trip', ['travel', 'trip plan', 'itinerary', 'vacation', 'flight', 'hotel', 'visa', 'packing'], `## Trip planning checklist

**8+ weeks out**
1. Dates + budget ceiling per day.
2. Passport validity (6 months) and visa rules for your nationality.
3. Book flights when the fare is within your target band; set an alert.
4. Accommodation: location beats luxury — near transit.

**2 weeks out:** itinerary skeleton (1 anchor per day, not 6), travel insurance, eSIM or roaming, copies of documents offline.

**3 days out:** download offline maps + this app (works offline), currency, notify bank, pack list.

**Packing rule:** lay everything out, then remove 30%. Clothes: 4 tops, 2 bottoms, 1 warm layer, 1 rain layer, shoes you can walk 15 km in.

**Daily budget formula**
\`\`\`
total = transport + stay + food(3×) + local transit + tickets + buffer 15%
\`\`\`

**On the ground:** keep a photo of your passport on the phone (encrypted), use hotel cards for directions, learn "hello / thank you / how much" in the local language.`, ['life', 'travel']),

    T('language', 'Language learning & phrases', ['language', 'translate', 'learn english', 'learn bangla', 'arabic', 'spanish', 'french', 'hindi', 'grammar', 'vocabulary'], `## Language learning that sticks

**Method (30 min/day)**
1. **10 min input** — listen to content just above your level with subtitles on, then off.
2. **10 min output** — speak or write 5 sentences using new words.
3. **10 min review** — spaced repetition of ~20 cards.

**Survival phrases** (learn these first in any language)
- Hello / Thank you / Please
- Excuse me — where is …?
- How much is this?
- I don't understand. Can you say it slower?
- Water, food, toilet, help, police, hospital

**Quick glossary**

| English | Bengali | Hindi | Arabic | Spanish |
| --- | --- | --- | --- | --- |
| hello | নমস্কার (nomoskar) | नमस्ते | السلام عليكم | hola |
| thank you | ধন্যবাদ (dhonnobad) | धन्यवाद | شكراً | gracias |
| how much? | কত? (koto?) | कितना? | كم؟ | ¿cuánto? |
| water | পানি | पानी | ماء | agua |
| help | সাহায্য | मदद | مساعدة | ayuda |

**Grammar habits:** verb-second in German, gendered nouns in Romance languages, subject–verb–object in English, verb-final in Bengali/Hindi. Learn the pattern before the vocabulary list.`, ['language']),

    T('firstaid', 'First aid basics', ['first aid', 'emergency', 'cpr', 'burn', 'choking', 'bleeding', 'cuts'], `## First aid — the first five minutes

**⚠️ Call emergency services for: chest pain, breathing trouble, heavy bleeding, unconsciousness, seizure, severe allergic reaction, stroke signs (face droop / arm weakness / speech trouble).**

**Choking (adult, conscious):** 5 firm back blows between shoulder blades → 5 abdominal thrusts (Heimlich) → repeat. If they collapse, start CPR.

**CPR (adult):** 30 chest compressions (5–6 cm deep, 100–120/min) : 2 rescue breaths, or hands-only compressions if untrained. Continue until help or movement.

**Severe bleeding:** press hard directly on the wound with cloth, add layers without removing, elevate if possible, keep pressure until medics arrive.

**Burns:** cool with running water 20 min, remove rings/clothing that isn't stuck, cover loosely. No ice, butter or toothpaste.

**Fainting:** lay flat, raise legs ~30 cm, loosen tight clothing, turn to the side if vomiting.

**Allergic reaction:** help the person use their adrenaline auto-injector, call emergency services, lie flat with legs raised.

**This is general education, not a substitute for certified training.** Take a local first-aid course — it's a few hours and worth it for life.`, ['health', 'safety']),

    /* ─────────────── ideas & decisions ─────────────── */
    T('brainstorm', 'Brainstorm ideas', ['brainstorm', 'ideas', 'suggest', 'name ideas', 'creative prompts', 'content ideas'], `## Brainstorming that produces usable ideas

**Run four lenses** — quantity first, judgement later.

1. **Remove** — what if the hardest constraint vanished? What if it cost nothing? What if it had to take 1 minute?
2. **Combine** — merge two categories (coffee × library, fitness × subscription, notes × agent).
3. **Invert** — what would make this fail? Build the opposite.
4. **Audience-shift** — same product for kids / seniors / commuters / night shift workers.

**SCAMPER prompt list:** Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse.

**Scoring:** after 20 ideas, score Impact (1–5) × Ease (1–5). Anything ≥ 16 gets a 1-page test plan: hypothesis, smallest build, success metric, deadline.

**Example (study app ideas)**
- Flashcard app that only shows cards you fail.
- "Explain it to me at 5 levels" toggle.
- Exam countdown that auto-builds the 21-day plan.
- Study rooms with silent video co-working.
- AI that quizzes you from your own notes.

Tell me the domain and constraints and I'll generate 20 more, scored.`, ['ideas', 'productivity']),

    T('decision', 'Make a decision', ['decide', 'decision', 'pros and cons', 'should i', 'choose between', 'swot'], `## Decide without spiralling

**1. Frame it** — what exactly is being chosen, and by when? A decision past its date becomes a decision by default.

**2. Criteria first** — list 3–5 things that truly matter (money, time, risk, learning, people). Weight them 1–5.

**3. Score options** — 1–5 per criterion, multiply by weight, sum. The score is a thinking tool; disagreements are the useful output.

**4. Reversibility test** — easily reversible? Decide fast, learn. Irreversible? Slow down, gather one more piece of evidence.

**5. Pre-mortem** — imagine it failed in 12 months; write the two most likely causes; add a mitigation for each.

**6. 10/10/10** — how will you feel in 10 minutes, 10 months, 10 years?

**Template**
\`\`\`
Decision: …
Deadline: …
Options: A / B / C
Criteria (weight): cost 4 · time 3 · risk 5 · growth 4
Scores:  A 62 · B 71 · C 55
Key unknown: …
Cheapest test before committing: …
\`\`\`

Tell me the actual choice and I'll fill this in with you.`, ['life', 'productivity']),

    T('business', 'Start a business / side project', ['business', 'startup', 'side project', 'business plan', 'marketing', 'customer', 'pitch', 'product'], `## From idea to first paying customer

**Week 1 — Problem interviews (10 people)**
Ask about the last time they hit the problem: what they did, what it cost. Never pitch. Look for repetition, not politeness.

**Week 2 — One-page spec**
\`\`\`
Who: …            (one sentence, one segment)
Problem: …        (in their words)
Promise: …        (outcome, measurable)
Smallest version: …   (1 core flow only)
Price: …          (charge from day one)
Success metric: …  (e.g. 10 paying users)
\`\`\`

**Week 3–4 — Build the thinnest thing** that delivers the promise. Manual steps are fine; a form and a spreadsheet are fine.

**Launch channels that work for zero budget**
1. Communities where the problem is discussed (answer, don't spam).
2. A build-in-public log on X/LinkedIn — 1 post/day, real numbers.
3. Direct outreach: 20 personal messages/day, personalised first line.
4. Product Hunt / relevant subreddits / local groups, once the flow is solid.

**Pricing:** start higher than feels comfortable; you can discount, but raising is harder. Charge per outcome where possible.

**Watch:** CAC vs LTV, week-4 retention, and whether referrals happen without prompting. Those three decide if you keep going.`, ['business', 'career']),

    /* ─────────────── fun ─────────────── */
    T('joke', 'Jokes & light stuff', ['joke', 'funny', 'make me laugh', 'pun', 'riddle'], `## A few, then a challenge

**Developer joke**
Why do programmers prefer dark mode? Because light attracts bugs.

**AI joke**
I asked the neural network for a joke about overfitting. It told me the same one 400 times.

**Riddle**
> The more you take, the more you leave behind. What am I?
> **Footsteps.**

**One-liner**
I told my computer I needed a break — now it won't stop sending me KitKat ads.

**Dad joke**
Why did the scarecrow win an award? He was outstanding in his field.

Want another round? Ask for a *theme* — programmer, science, wordplay, or "roast my code" and I'll aim properly.`, ['fun']),

    T('quote', 'Quotes for a moment', ['quote', 'motivation', 'inspire', 'encourage', 'confidence'], `## Words that hold up

> "The best way out is always through." — Robert Frost

> "Simplicity is the soul of efficiency." — Austin Freeman

> "You do not rise to the level of your goals. You fall to the level of your systems." — James Clear

> "It always seems impossible until it's done." — Nelson Mandela

> "Amateurs sit and wait for inspiration, the rest of us just get up and go to work." — Stephen King

**If you're stuck right now:** pick the smallest next action you can finish in 10 minutes, do it, then decide again. Momentum is a decision, not a mood.`, ['fun', 'motivation']),

    T('translation', 'Translate text', ['translate', 'translation', 'in bengali', 'in hindi', 'in arabic', 'in spanish', 'in french'], `## Translation — how I handle it here

**Offline:** the on-device engine has a phrase glossary (Bengali, Hindi, Arabic, Spanish, French, German) for common words plus a simple sentence-pattern helper. It's reliable for *short, everyday* phrases; it is **not** a neural translator.

**Best quality:** connect a cloud model — Gemini, Groq/Llama and GPT all translate excellently. Pick one from the model chip, then ask: *"Translate to Bengali, keep it formal: …"*

**Tips for good results**
- Say the target language, tone and audience.
- Give names as proper nouns ("keep 'Nadia' as-is").
- For documents, ask for a table: original | translation | notes.
- Idioms: ask for the *meaning*, then the closest idiom in the target language.

Paste your text and tell me the language, and I'll do what this engine can — or switch me to a cloud model for full-quality translation.`, ['language']),
  ];

  /* --------------- retrieval --------------- */
  const STOP = new Set('a an the is are was were be been being do does did have has had will would can could should may might must i you he she it we they me my your our their this that these those to of in on for with about from at by as and or but if then than so not no yes how what why when where who which'.split(' '));

  const tokens = (text = '') =>
    text
      .toLowerCase()
      .replace(A.util.notWordRe(), ' ')
      .split(/\s+/)
      .filter((w) => w && w.length > 1 && !STOP.has(w));

  /** crude but effective stemmer: plurals, -ing, -ed, -tion */
  function stem(word = '') {
    let w = word.toLowerCase();
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }

  // pre-compute a stemmed token index once
  const index = topics.map((t) => {
    const triggerTokens = new Set(t.triggers.flatMap((tr) => tokens(tr).map(stem)));
    const titleTokens = new Set(tokens(t.title).map(stem));
    const bodyTokens = new Set(tokens(t.answer).map(stem));
    return { topic: t, triggerTokens, titleTokens, bodyTokens };
  });

  /* Generic verbs and filler carry no subject. Without this filter the trigger
     "works offline" matched the verb in "how does wifi WORK" and answered a question
     about Wi-Fi with a page about offline mode: right words, wrong topic. */
  const GENERIC = new Set([
    'work', 'works', 'working', 'use', 'uses', 'using', 'make', 'makes', 'making',
    'do', 'does', 'did', 'done', 'doing', 'get', 'gets', 'got', 'give', 'want',
    'need', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'this', 'that',
    'app', 'thing', 'things', 'way', 'ways', 'best', 'good', 'right', 'help',
    'can', 'could', 'should', 'would', 'will', 'really', 'actually', 'please',
  ]);

  /** Score every topic against the query, best first. */
  function search(query, limit = 3) {
    const q = tokens(query).map(stem);
    if (!q.length) return [];
    const lowerQuery = ' ' + query.toLowerCase() + ' ';
    const scored = index.map(({ topic, triggerTokens, titleTokens, bodyTokens }) => {
      let score = 0;
      let triggerHits = 0;
      for (const word of q) {
        const meaningful = !GENERIC.has(word) && word.length > 2;
        if (meaningful && triggerTokens.has(word)) { score += 5; triggerHits += 1; }
        else if (meaningful && [...triggerTokens].some((tr) => tr.startsWith(word) && word.length > 3)) { score += 3; triggerHits += 1; }
        if (meaningful && titleTokens.has(word)) score += 3;
        if (bodyTokens.has(word)) score += 0.6;
      }
      for (const trig of topic.triggers) {
        if (trig.includes(' ') && lowerQuery.includes(trig)) { score += 7; triggerHits += 2; }
      }
      // normalise a touch so huge topics don't dominate
      return { topic, score: score / Math.sqrt(1 + topic.answer.length / 3000), triggerHits };
    });
    return scored
      .filter((s) => s.score >= 3.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** All topics in a category or matching a keyword (used by the prompts tab). */
  function byTag(tag) {
    return topics.filter((t) => t.tags.includes(tag));
  }

  A.knowledge = { topics, search, byTag, tokens, stem };
})();
