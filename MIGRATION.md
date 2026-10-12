# Migrating the existing spreadsheet — `import/source/Vertigo_Gearliste___Status.xlsx`

This is our current inventory, kept in a Google Sheet since ~2019. It is messy, partly Danish, has conflicting counts between sheets, and mixes inventory with pricing rules, notes and reference material. Everything in it must either land in the new system or be deliberately parked. Build the importer against this exact file, with a preview that shows what will be created and a list of rows that need a human decision. Do not silently guess.

Danish terms you will meet: *Antal* = quantity, *ialt* = total, *Udlån* = lent out, *Til Rep* = in repair, *Missing* = missing, *Under construction / manufacturing process* = being built, *Pris* = price, *Vægt* = weight, *Str.* = size, *stk* = pieces, *Note*, *Ønsker* = wish list, *solgt* = sold, *ikke til udleje* = not for rental, *excl. moms* = excl. VAT, *Dagspris* = day price, *Lejefaktor* = rental factor, *Nøglebrikker* = key fobs, *Stativer* = stands, *Kabler* = cables, *Lamper* = lamps, *Bokse* = boxes/controllers.

## Sheet-by-sheet mapping

### `LED - SCROLLER - BOX` — main inventory list
Columns: Hvad (category) | Type (model/system) | Str. (size/length) | Pris | Vægt | Antal (ialt) | Antal minus rep & missing | Udlån (name + qty) | Til Rep | Missing | Under construction | Note.
Structure is hierarchical by blank cells: column A gives the category (Kabler, Bokse, LED, Lamper, NETWORK, LASER), column B the system/model, column C the variant (usually length). Each row with a quantity is a **bulk item** whose model is `B` and whose variant is `C`.

- **Cables** (rows 5–61): Scroller, LP12 "QLED", Wieland + LP12, True1, CEE (red/blue by length), SDI, Ethercon, Scroller til Split-Wieland, SplitLED Wieland kabler, lp12 5-pin NEMA. Create category tree `Cables → <system>` and one bulk model per system+length. Some quantities are text (`'19(old)+ 9 (new)'`, `'mindst 8'`) — import as the sum (28, 8) and flag for review. Weights like `'~0.8 kg'` go to model weight.
- **Bokse** (rows 68–71): BlackLED controller 4-out (200 W) and 6-out (450 W) in Scroller and Wieland variants. These are **serialized** in practice (see `LEDController Optælling` below) — create the models here, units from the other sheet.
- **LED** (rows 74–97): LightLED, BlackLED, QLED, SpotLED, SplitLED, PentaLED — these are **Vertigo's own custom-built LED fixtures**, by length. Bulk items. The `Under construction` column is a real status: those units exist but are not usable yet. Notes like `'Fordelt til 6 stk flightcase'` and `'7 SplitLED flightcases i alt'` describe cases → create kits/cases as locations. `[5 A pr. fixtur]` in column B is a power spec → model power draw.
- **Lamper**: 16 × EclGalleryProfile FC 60 W RGBW, 2 kg, price 220 — create model with spec; note on new gobo price.
- **NETWORK**: Grå Switch, ~1.7 kg.
- **LASER spejle**: laser mirrors by size (76×76, 400×300, 150×150, 80×100 "de gamle") — bulk.
- `Udlån` cells like `'ukirke'`/`2` and `'? !! kan ikke findes'` → create a loan/external location or a `missing` status accordingly, flagged.

### `QLED` — QLED recount, 21 July 2025
Rows 3–7 duplicate the old QLED counts from the main sheet; rows 10–28 are a **newer count** (`Ny optælling (21.07.25)`): QLED set 2 m ×46, 5 m ×40; LP12 leftover; accessories (Ethercon-LP12 adapters, True1-Wieland adapters, VatterTool ×4). **Prefer this sheet's counts over the main sheet for QLED**, and show both in the preview. Row 33–37 ("Grupper 5, 45/9, 200 W") is a power-grouping calculation, not inventory — ignore.

### `LEDController Optælling` — LED controller fleet
One row per **serialized unit**: ID (`W6-01`…`W6-12`, `N6-01`…`N6-30`, `N4-01`…`N4-10`), IP address, board type (Teensy 3.2 / Teensy 4 / 4.0), Status (`OK`, `ERROR`, `ERROR board has no power`), Firmware (`Updated`). Column M holds a corrected ID for a few rows (`'ID: N6-01'`) — use column M's ID when present and flag.
Mapping: the ID prefix is the model (W6 = Wieland 6-out, N6 = 6-out, N4 = 4-out; confirm with us). Create **custom fields** on the LED controller category: `IP address`, `Board type`, `Firmware`. Status `ERROR*` → item status `in repair` with the text as the note. `N6-23`–`N6-30` have an ID but no data → create as `in house`, flag "unverified".

### `PROJEKTORE` — projectors (header says "ano ca. 2019")
Columns: ID | Model | Lumen | Throw Ratio | Tilt/lens shift | Resolution | Pris excl. moms (= **list day price**) | notes | notes | serial number.
- Each row with an ID (B1, B2, B7…, DW1, E1–E4, F1–F3, G1–G5, H1–H3, I1–I4, K1–K5, J1–J6) is a **serialized unit**; the letter is the model group. Keep the ID as the asset tag. Rows without ID (NEC P554U ×6, BenQ TH682st, TH671st ×6, Optoma HD29HST ×3) are also units — generate IDs in the same scheme (e.g. `L1…`) and flag.
- Create **custom fields** on the Projector category: `Lumen`, `Throw ratio`, `Lens shift`, `Resolution`. Day price → model rental day price.
- Notes to translate into state: `'solgt'`, `'solgt til Jan Sermuelsen aug 2020'`, `'solgt til Michael Gaardsøe dec 2019'` → status `retired` with reason *sold* and the note; `'LÅNT TIL KATHARINA'` → external loan, flagged; `'ikke til udleje'` (J-series, located "Bremen") → item flag **not for rental**; `'mangler pære'`, `'Pære gevind udu'`, `'ny pære'`, `'Har en lys pixel prik!'` → condition notes.
- J-series have real serial numbers in column J (`PD84G00243031`…) → serial field.
- Rows 97–114 `GearGuys projektore`: Panasonic PT-RZ21K and ET-D… lenses that **GearGuys** (a partner company) owns. Not our gear → import into a separate **"Partner / sub-hire catalog"** (see new features) with owner = GearGuys, with throw ratios and links.
- Rows 131–153 `Ønsker` (wish list) and the price-research rows → import into a **wish list** table (model, price, link, note), not inventory.
- Row 84 `'Lasse har købe 9 stk … fra 2014'` → note on the relevant model, flagged.

### `COMPUTERE` — media servers and video hardware
- Two media server PCs **Pink FREDDY** and **Green HARRY** (serialized, name = asset tag) with component specs (CPU, storage, RAM, PSU), purchase date Dec 2018, and a `baseprice` row per component. Day price formula = sum of component base prices / 10 (=2140.7); cell H2 `-0.3` is a **30% discount** applied. Store the component list as a text spec and the computed day price as the rental day price.
- GPUs (Quadro RTX 5000, GTX 1080 Ti, RTX A5000 ×2, RTX 4090, RTX 5090 FE), PCIe cards (DeckLink Duo 2, 4K Extreme 12G, SDI 4K ×2, 8K), outboard (AJA HA5-4K ×4, Lenovo P27u-10 monitors ×4 "(3 stk)" — flag, Blackmagic Video Assist 4K, Canon batteries + charger), BlackBox 6-port 450 W ×38 and Qbox 6-port 200 W ×15. Column E = purchase price, column G = day price (10% of purchase). Import as items with purchase price and day price.
- `Skærme: Dell P2418HT 6,4 kg -kasse` → monitor model with weight.

### `Stativer & Support` — stands, rods, rigging, alu
Same column layout as the main sheet, but shifted one column left (no Pris column).
- Manfrotto stands/poles/bases (rows 5–16) → models with the Manfrotto part number from column C. Notes: `'(1 broken) + mikkel har 2 stk'` → 1 unit in repair, 2 units at location *Mikkel* (person as location), flag. `'i 3 stk Manfrotto LBAG110 Polstret taske'` → create 3 bag kits as containers. `'1 ny fra LP d. 19 nov 2024 er incl.'` → note.
- 16 mm stainless rods (rows 19–27) and 28 mm rods (rows 36–49) by length, Space 10 bases ×32, misc extenders, adapters, magic arms, L-brackets, straight brackets, 45° brackets, Kito chain hoists (WLL 250 kg), Mitari chains (WLL 1.4 t). Columns L–V on these rows are a hand tally (`11111`) and wish notes — ignore the tallies, keep the text in N23 (`'Rør vi gerne vil have lavet i 28 / 1,5 mm'`) as a wish-list note.
- 35×35 mm alu profiles (rows 88–117) by length with finish/usage notes (`'rå alu'`, `'sort malet'`, `'kube!'`, `'DR rammen m. velco'`, `'WKB 2026'`) → one bulk model per length; custom field `Finish`; the project names in notes are history, keep as notes. Alu corners 90°/60°/30°, cube corners, T-pieces, extenders.
- `MELO III trapper` / podium legs (rows 132–199): 40×40 legs by height for stairs and podiums (`20 cm ben ×52`, `40 cm ×8`…). Import the leg counts as bulk items; the material/labour costing (rows 149–158) and Biltema links are reference notes on the model.

### `16mm rods` — older rods count
Duplicates part of `Stativer & Support` with **different numbers** (150 cm: 31 vs 30; 200 cm: 9 vs 8; 300 cm: 7 vs 8; 28 mm 200 cm: 16 vs 15…). Treat `Stativer & Support` as newer, show the conflict in the preview for us to confirm.

### `Truss` — truss inventory, pricing and supplier quotes
Rows 4–39 = inventory **and** pricing in one: item code (HD24-200, HD24-100, HD24-150, HD24-50, BLK-24 box corner, BLK-SCON-ST, CS1-CON, CS1-TP-SHORT, CS1-RS2, CS1-TPS-SHORT, CS1-BOB105, NEO Clamp ET set black/alu, Strong Boy dolly, 6-kant alu baseplate) | length m | Stk (qty) | Sæt | proposed **rent price per piece incl. accessories** (col F) | list price (H) | discount % (I: 40, 30, or none) | net price (K) | total (L) | "Tårn" (tower) set quantities (N/O).
Import: bulk models with quantity, purchase list price, discount, net price (= purchase price), **rental day price = column F**. The description rows beneath codes (`'Conical Connector HD/FD'`) are the model name. Notes rows 51–52 (`'32 stk truss = 32 x 4 sæt = 128 stk'`) → model notes.
Rows 57–99: two **supplier quotes from Urs** (order confirmation 303053885, 23 July 2025; NEO quote 302026792, 24 July 2025), incl. powder coating 18 744 and invoice discounts. Import as **purchase records / attachments on the truss models** (supplier, date, quote number, amounts). Note the quote quantities differ from inventory rows (e.g. BLK-SCON-ST 160 vs 8, CS1-CON 128 vs 20) — these are what was ordered; the inventory rows may be stale. Flag.

### `lejefaktor` — rental factor tables (pricing rules, not inventory)
Three tables of *days → factor* that multiply a model's day price. Import all three as **named rate tables** in the pricing engine:
1. **Standard** (A5–A16): 1 d = 1.0, 2 d = 1.5, 3 d = 2.0, 4 d = 2.4, 5–7 d = 2.7, 10 d = 3.6, 14 d = 4.2, 21 d = 5.5, 30 d = 6.5, each further day +10% of day-1 price.
2. **Theatre** (E5–E15): base 1 d = 0.5 ("not to be used alone"), applies from 14 days: 14 d = 2.1, 21 d = 2.8, 30 d = 3.3, 6 months = 10.8; +10 days = +0.5.
3. **Revised** (A37–A46 and J/K columns): 1 = 1.0, 2 = 1.5, 3 = 1.7, 5 = 1.9, 7 = 2.1, 10 = 2.3, 14 = 2.6, 21 = 3.0, 30 = 3.3–3.4, then +0.5 per 10 days up to 230 days. The two copies differ slightly at 30 days (3.3 vs 3.4) — flag.
Interpolate for days not listed (step function: use the nearest lower tier) and make tables editable in the UI. Footer: **all prices excl. VAT, freight and insurance** → default terms text on quotes.

### `IGANGVÆRENDE UDLEJE` — ongoing loans
Two free-text loans: (1) Michael Gaardsøe / Thormod, kulturhuset, 12 Oct 2021 — 4 EclGalleryProfile FC with SuperClamps, 2 grey cases, True1 cables, 3 BenQ Perstrop projectors in a Peli, 1 NEC projector, Manfrotto 410 ×3 and 405 ×1 gear heads, SuperClamps, adapters; price 5 500 kr + VAT. (2) Alex, June 2023 — 2 × Manfrotto 410, 1 × 100 kg clamp. Import as **external rentals** with status `out`/`overdue`, lines matched to models where possible, and ask us whether they are still open.

### `Nøglebrikker` — key fobs
Fob IDs U00825–U00844 with holder names (Frede, Mikkel Meyer, Casper Øbro, Carl Emil, Jeppe, Amis, Maja, Vibeke, Bil (the car), Alex Rasmussen, Stefan, Andreas – Kunstnerhjælp, CJ, Maria, Pan, Alexander Levison, Mona), split into `Hovedbrikker` (main) and `Gæstebrikker` (guest); U00831 = MANGLER (missing), U00838 unassigned; notes "Mona rykket 16-09-2025", "Bo har ikke", "Xavier har ikke". Import as serialized items in category `Keys & access → Key fobs`, location = person (holder), status `missing` for U00831. Persons who are not users become **contacts**.

### `Dirverse` — TENTE castor reference
Two castor specs (Alpha 3477UFR100P62 100 mm, 3477UFR125P62 125 mm) with load, price, height, plate size, usage notes → **reference/wish-list** entries, not inventory.

### `El-løbehjul` — empty. Skip.

## New requirements this file reveals (add to the main spec)

1. **Rental pricing engine**: every model has a *rental day price*; projects/rentals pick a *rate table* (Standard / Theatre / Revised, editable) and the system computes line price = day price × factor(days), with per-line and per-document discount %, insurance/freight lines, and totals excl. and incl. 25% VAT. Quotes export to PDF.
2. **Statuses**: add `under construction` (exists, not yet usable) and a `not for rental` flag (owned, usable on own projects only). `retired` needs a reason (sold / scrapped / lost) and a free-text note (e.g. who bought it).
3. **Locations**: a location can be a warehouse place, a **case/kit**, a **person** (staff or contact), a project, an external renter, or a repair shop.
4. **Category-level custom fields** seeded from the data: Projector (lumen, throw ratio, lens shift, resolution), LED controller (IP, board type, firmware), Alu profile (finish), Computer (CPU, GPU, RAM, storage, PSU), Truss (length m).
5. **Partner / sub-hire catalog**: gear other companies own that we regularly rent in (GearGuys' Panasonic lenses). Sub-hire lines can be added to a project's packing list and marked as "rent in from X".
6. **Wish list**: models we want to buy, with price, link, note; convertible to a real model when purchased.
7. **Purchase records** on models: supplier, date, quote/order number, list price, discount, net price, attachment (the Urs quotes).
8. **Contacts** (people who are not users): fob holders, borrowers, suppliers (Urs, LP), partners (GearGuys).
9. **Importer behaviour**: preview with three buckets — *will import*, *imported with assumption* (shows the assumption), *needs decision* (conflicting counts, unparseable quantities, unknown person names). Nothing is written until we confirm. Keep the original cell reference on every imported record (`source: sheet!cell`) so we can trace back.
10. **Seed the real data, not demo data**, once the import works — the seed script should be able to load this file so a fresh install starts with our actual inventory.
