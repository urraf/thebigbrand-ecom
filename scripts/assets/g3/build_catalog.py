"""Write prisma/seed-data/catalog/g3.json (Lakmé, Minimalist, The Derma Co, Beardo) from the curated list below.

Images are the packshots built by process.py from Open Beauty Facts photos (CC BY-SA 3.0).
Usage: python3 -I build_catalog.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "prisma", "seed-data", "catalog", "g3.json")
DEMO_IDS = {"lakme-ss", "lakme-lip", "lakme-kajal", "min-niacin", "min-spf", "derma-vitc", "derma-sal",
            "beardo-oil", "beardo-fw", "bella-oud", "bella-ceo"}
CATS = {"skin", "face", "hair", "oil", "makeup", "body", "men", "fragrance"}
CONCERNS = {"hairfall", "acne", "dandruff", "dull", "tan", "dry", "frizz", "darkcircles", "beard"}
BRAND_LABEL = {"lakme": "Lakmé", "dermaco": "The Derma Co", "minimalist": "Minimalist", "beardo": "Beardo"}


def img(brand, slug, code, alt):
    return {
        "url": "/media/products/%s/%s.webp" % (brand, slug),
        "alt": alt,
        "width": 1000,
        "height": 1250,
        "source": "Open Beauty Facts",
        "sourceUrl": "https://world.openbeautyfacts.org/product/%s" % code,
        "license": "CC BY-SA 3.0",
        "attribution": "Open Beauty Facts contributors",
    }


P = []


def add(slug, name, brand, category, size, mrp, price, rating, reviews, concerns, tags, badge,
        description, bullets, how, ingredients, code, alt):
    P.append({
        "slug": slug, "name": name, "brand": brand, "category": category, "size": size,
        "mrp": mrp, "price": price, "rating": rating, "reviews": reviews, "concerns": concerns,
        "tags": tags, "badge": badge, "description": description, "bullets": bullets,
        "howToUse": how, "ingredients": ingredients, "images": [img(brand, slug, code, alt)],
    })


# ───────────────────────────── Lakmé ─────────────────────────────
add("lakme-peach-milk-soft-creme-moisturiser", "Peach Milk Soft Crème Moisturiser", "lakme", "skin", "65 g",
    165, 139, 4.4, 41820, ["dry", "dull"],
    ["moisturiser", "face cream", "peach milk", "lakme peach milk", "daily moisturiser", "soft creme", "dry skin cream"],
    "Bestseller",
    "Lakmé's everyday face crème blends peach extract with milk proteins in a light, non-greasy texture that sinks in quickly. It keeps skin soft and supple for up to 24 hours and sits well under makeup.",
    ["24-hour moisture lock", "Peach extract and milk proteins", "Light, non-sticky finish", "Works as a smooth base for makeup"],
    "Take a small amount and dot on the forehead, cheeks and chin. Spread in gentle upward strokes until absorbed. Use morning and night.",
    "Key ingredients: Demineralised Water, Cyclopentasiloxane, Sorbitol, Sunflower Seed Oil, Isohexadecane, Glycol Stearate, Titanium Dioxide, Dimethiconol, Polysorbate 80, Peach Extract (Prunus Persica), Non-fat Dry Milk, Alpha-Isomethyl Ionone, Citronellol, CI 14700.",
    "07102442", "Lakmé Peach Milk Soft Crème jar, lid view")

add("lakme-absolute-argan-oil-serum-foundation-spf-45", "Absolute Argan Oil Serum Foundation SPF 45", "lakme", "makeup", "15 ml",
    950, 799, 4.2, 6340, [],
    ["foundation", "serum foundation", "lakme absolute", "argan oil", "spf foundation", "liquid foundation", "dewy foundation"],
    None,
    "A lightweight serum foundation from the Lakmé Absolute range, infused with argan oil for a fresh, skin-like glow. Buildable coverage evens out the look of skin tone, with SPF 45 for daytime wear.",
    ["Serum-light texture with argan oil", "Buildable, natural-looking coverage", "SPF 45 for everyday wear", "Dewy, hydrated finish"],
    "Shake well. Dot a few drops over the face and blend outward with fingertips, a brush or a damp sponge. Build a second layer where needed.",
    "Key ingredients: Argania Spinosa (Argan) Kernel Oil, broad-spectrum UV filters (SPF 45), Iron Oxides for colour.",
    "8901030640575", "Lakmé Absolute Argan Oil Serum Foundation SPF 45 carton")

add("lakme-peach-milk-ultra-light-gel-moisturiser", "Peach Milk Ultra Light Gel Moisturiser", "lakme", "skin", "100 g",
    275, 233, 4.3, 9870, ["dry"],
    ["gel moisturiser", "oil free moisturiser", "peach milk gel", "lakme gel", "oily skin moisturiser", "summer moisturiser"],
    None,
    "An oil-free gel version of the Peach Milk moisturiser, made for humid days and oily or combination skin. The water-light texture absorbs fast and keeps skin hydrated for up to 24 hours without shine.",
    ["Oil-free, water-light gel", "24-hour moisture lock", "No greasy after-feel", "Peach extract for a fresh finish"],
    "Apply a small amount to clean face and neck and massage in until absorbed. Use morning and night, or as often as skin feels tight.",
    "Key ingredients: Peach Extract (Prunus Persica), Milk Protein, Glycerin.",
    "8901030865275", "Lakmé Peach Milk Ultra Light-Weight Gel jar, lid view")

add("lakme-peach-milk-vit-e-spf-24-moisture-riser-lotion", "Peach Milk Vit E + SPF 24 Moisture-Riser Lotion", "lakme", "skin", "60 ml",
    149, 134, 4.3, 18240, ["dry", "tan"],
    ["moisturiser with spf", "spf 24 lotion", "peach milk lotion", "vitamin e moisturiser", "day cream", "lakme moisture riser"],
    None,
    "A two-in-one day lotion that pairs Vitamin E with SPF 24 sun protection, so moisturising and sun care happen in one step. It leaves skin soft and smooth with a light, non-sticky feel.",
    ["Vitamin E serum for soft, smooth skin", "SPF 24 for everyday sun protection", "Light, quick-absorbing lotion", "Handy 60 ml bottle"],
    "Apply on cleansed face and neck every morning, smoothing it in evenly. Reapply after long hours outdoors.",
    "Key ingredients: Water, Octyl Salicylate, Butyl Methoxydibenzoylmethane, Glycerine, Palmitic Acid, Stearic Acid, Phenylbenzimidazole Sulphonic Acid; with Vitamin E and peach extract.",
    "8901030974380", "Lakmé Peach Milk Vit E + SPF 24 Moisture-Riser bottle, front of pack")

add("lakme-peach-milk-vit-e-creme-moisture-riser", "Peach Milk Vit E Crème Moisture-Riser", "lakme", "skin", "300 g",
    499, 424, 4.4, 7250, ["dry"],
    ["face cream", "body cream", "vitamin e cream", "peach milk creme", "family pack moisturiser", "winter cream"],
    None,
    "A rich crème with Vitamin E and peach milk in a value-size jar that works for face and body. It locks in moisture for up to 24 hours while staying non-sticky.",
    ["Vitamin E for soft, nourished skin", "24-hour moisture lock", "Non-sticky crème texture", "Big 300 g jar for face and body"],
    "Scoop a little crème with clean fingers and massage over face, neck, hands or body until absorbed. Use daily, especially after a bath.",
    "Key ingredients: Tocopheryl Acetate (Vitamin E), Peach Extract, Milk Protein, Glycerin.",
    "8901030977657", "Lakmé Peach Milk Vit E Crème Moisture-Riser jar, lid view")

add("lakme-9to5-cc-cream-spf-30", "9to5 CC Cream SPF 30, Almond", "lakme", "makeup", "30 g",
    349, 296, 4.3, 25110, ["dull", "tan"],
    ["cc cream", "complexion care cream", "lakme cc cream", "light coverage", "tinted moisturiser", "spf 30", "9to5"],
    None,
    "Lakmé's complexion care cream gives sheer, natural coverage that evens out the look of skin tone while it moisturises. SPF 30 PA++ makes it an easy one-step base for office days.",
    ["Sheer coverage that blends into skin", "SPF 30 PA++ sun protection", "Moisturises as it covers", "Shade: Almond, for medium skin tones"],
    "Dot on the forehead, cheeks, nose and chin and blend outward with fingertips. Layer lightly for more coverage.",
    "Key ingredients: UV filters (SPF 30 PA++), Glycerin, Titanium Dioxide and Iron Oxides for tinted coverage.",
    "8901030978036", "Lakmé 9to5 CC Cream tube with carton, shade Almond")

add("lakme-9to5-sun-expert-tint-hint-sunscreen-spf-50", "9to5 Sun Expert Tint Hint Sunscreen SPF 50 PA+++", "lakme", "skin", "50 g",
    375, 319, 4.2, 5480, ["tan"],
    ["sunscreen", "tinted sunscreen", "spf 50", "lakme sun expert", "no white cast", "tint hint", "daily sunscreen"],
    "New",
    "A lightly tinted sunscreen from the Sun Expert range that blurs and evens the look of skin while offering broad-spectrum SPF 50 PA+++. The hint of tint helps avoid a white cast on Indian skin tones.",
    ["SPF 50 PA+++ broad-spectrum protection", "Sheer tint, no white cast", "Lightweight, non-greasy texture", "Wear alone or under makeup"],
    "Apply generously to face and neck 15 minutes before stepping out. Reapply every 2-3 hours when outdoors or after sweating.",
    "Key ingredients: Broad-spectrum UV filters (SPF 50 PA+++), Glycerine, Iron Oxides for the sheer tint.",
    "8901030978630", "Lakmé 9to5 Sun Expert Tint Hint SPF 50 tube, front of pack")

add("lakme-9to5-powerplay-priming-powder-foundation", "9to5 Powerplay Priming Powder Foundation", "lakme", "makeup", "9 g",
    599, 509, 4.1, 3920, [],
    ["compact", "powder foundation", "priming powder", "lakme compact", "matte compact", "9to5 powerplay", "oil control"],
    None,
    "A three-in-one pressed powder that primes, covers and sets in one swipe, from the Lakmé 9to5 Fashionista collection. It gives a soft-matte finish that keeps shine in check through the workday.",
    ["Primer, foundation and powder in one", "Soft-matte, shine-controlling finish", "Buildable coverage", "Slim compact with mirror for touch-ups"],
    "Swipe the sponge over the powder and press onto the face, starting at the centre and blending outward. Touch up through the day as needed.",
    "Key ingredients: Talc, Mica, Silica, Titanium Dioxide and Iron Oxides (pressed powder pigments).",
    "8901030995262", "Lakmé 9to5 Powerplay Priming Powder Foundation carton")

add("lakme-peach-milk-creme-moisturiser-pro-ceramide-peptide", "Peach Milk Crème Moisturiser with 2% Pro Ceramide & Peptide", "lakme", "skin", "100 g",
    328, 279, 4.4, 2860, ["dry"],
    ["ceramide moisturiser", "peptide cream", "peach milk", "barrier repair cream", "lakme moisturiser", "face cream"],
    "New",
    "The new Peach Milk crème adds a 2% pro-ceramide blend and peptides to support the skin barrier, alongside peach juice and sweet almond oil. It leaves skin cushiony-soft without feeling heavy.",
    ["2% pro-ceramide complex with Ceramide NP, AP and EOP", "Palmitoyl peptides in a light crème", "Peach juice and sweet almond oil", "24-hour moisturisation"],
    "Massage a small amount onto clean face and neck morning and night until fully absorbed.",
    "Water, Cyclopentasiloxane, Sorbitol, Caprylic/Capric Triglyceride, Stearic Acid, Helianthus Annuus (Sunflower) Seed Oil, Isohexadecane, Glycol Stearate, Dimethicone, Propylene Glycol, Glycerin, Butylene Glycol, Glyceryl Stearate, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Cetyl Alcohol, Carbomer, Stearamide AMP, Prunus Persica (Peach) Juice, Prunus Amygdalus Dulcis (Sweet Almond) Fruit Extract, Sodium Lauroyl Lactylate, Prunus Amygdalus Dulcis (Sweet Almond) Oil, Gluconolactone, Ceramide NP, Tocopherol, Phytosphingosine, Ceramide AP, Cholesterol, Sodium Sulfate, Sodium Chloride, Calcium Gluconate, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Ceramide EOP, Ethylhexylglycerin, Triethanolamine, Phenoxyethanol, Methylparaben, Titanium Dioxide, Dimethiconol, Polysorbate 80, Fragrance, Tocopheryl Acetate, Propylparaben, Xanthan Gum, Disodium EDTA, BHT, Sorbitan Oleate, Zea Mays (Corn) Starch, Citric Acid, Sodium Benzoate, Sodium Lactate, Polyglyceryl-4 Caprate, Potassium Sorbate, Polysorbate 20, Alpha-Isomethyl Ionone, Citronellol, Linalool, CI 14700.",
    "8909106037861", "Lakmé Peach Milk Crème Moisturiser with 2% Pro Ceramide & Peptide jar, lid view")

# ───────────────────────────── The Derma Co ─────────────────────────────
add("the-derma-co-sali-cinamide-anti-acne-serum", "Sali-Cinamide Anti-Acne Serum", "dermaco", "skin", "30 ml",
    599, 509, 4.2, 21340, ["acne"],
    ["salicylic acid serum", "niacinamide serum", "acne serum", "sali-cinamide", "derma co serum", "oily skin serum", "pimple serum"],
    "Derm pick",
    "Pairs 2% salicylic acid with 5% niacinamide to unclog pores and calm the look of breakouts and marks on oily, acne-prone skin. Willow bark, centella and alpha arbutin round out the lightweight, fragrance-free formula.",
    ["2% salicylic acid + 5% niacinamide", "Helps keep pores clear and oil in check", "Fades the look of post-acne marks over time", "Fragrance-free, dye-free, mineral-oil-free"],
    "Apply 3-4 drops to clean, dry skin at night and let it absorb before moisturising. Start on alternate nights, and use sunscreen in the daytime.",
    "Purified Water, Propanediol, Niacinamide, Ethoxydiglycol, Butylene Glycol & Rosa Canina Fruit Extract, PEG-8, Salicylic Acid, Isostearamidopropyl Ethyldimonium Ethosulfate, Sodium Hydroxide, Propylene Glycol, Olea Europaea (Olive) Fruit Oil, Carthamus Tinctorius (Safflower) Seed Oil, Glycerine, Isoamyl Laurate, Alpha Arbutin, Willow Bark Extract, Centella Asiatica Extract, Allantoin, Hydroxyethyl Cellulose, Sodium Hyaluronate, Xylitylglucoside (and) Anhydroxylitol (and) Xylitol, Triethanolamine, Phenoxyethanol (and) Ethylhexylglycerin.",
    "8904417306521", "The Derma Co Sali-Cinamide Anti-Acne Serum carton, front")

add("the-derma-co-2-salicylic-acid-face-serum", "2% Salicylic Acid Face Serum", "dermaco", "skin", "10 ml",
    299, 254, 4.1, 33610, ["acne"],
    ["salicylic acid serum", "bha serum", "acne serum", "derma co salicylic", "pore serum", "travel size serum"],
    None,
    "A 2% salicylic acid serum with witch hazel and willow bark that exfoliates inside the pore to help keep blackheads and breakouts in check. The trial-size 10 ml bottle is an easy way to start a BHA routine.",
    ["2% salicylic acid (BHA)", "Witch hazel and willow bark extracts", "Deep-penetration formula, day or night", "Fragrance-free, dermatologically tested"],
    "After cleansing, apply 2-3 drops to the face, avoiding the eye area, and follow with moisturiser. Use sunscreen during the day.",
    "Aqua, 1,3-Propanediol, Ethoxydiglycol, Salicylic Acid, Glycerin, Methylpropanediol, Pentylene Glycol, Hamamelis Virginiana (Witch Hazel) Extract, Salix Alba (Willow) Bark Extract, Sodium Hyaluronate, Dimethyl Isosorbide, Sclerotium Gum, Phenoxyethanol, Tris(Tetramethylhydroxypiperidinol) Citrate, Ethylhexylglycerin, Trisodium Ethylenediamine Disuccinate, Sodium Hydroxide, PEG-40 Hydrogenated Castor Oil, Sodium Benzoate, Potassium Sorbate.",
    "8904417307146", "The Derma Co 2% Salicylic Acid Face Serum carton, front")

add("the-derma-co-1-kojic-acid-daily-face-wash", "1% Kojic Acid Daily Face Wash", "dermaco", "face", "150 ml",
    449, 382, 4.2, 12780, ["dull", "tan"],
    ["kojic acid face wash", "face wash for dark spots", "pigmentation face wash", "alpha arbutin", "niacinamide face wash", "derma co face wash"],
    None,
    "A gentle daily cleanser with 1% kojic acid, 1% niacinamide and alpha arbutin for skin that looks uneven or dull. It washes off clean without leaving skin tight.",
    ["1% kojic acid with 1% niacinamide", "Alpha arbutin for a more even-looking tone", "Gentle enough for twice-daily use", "Sulfate-free and paraben-free"],
    "Wet the face, massage a small amount in circular motions for 30-60 seconds and rinse. Use morning and night.",
    "Key ingredients: Kojic Acid (1%), Niacinamide (1%), Alpha Arbutin.",
    "8904417314755", "The Derma Co 1% Kojic Acid Daily Face Wash tube, front")

add("the-derma-co-triple-actives-anti-dandruff-shampoo", "Triple Actives Anti-Dandruff Shampoo", "dermaco", "hair", "200 ml",
    499, 424, 4.2, 8940, ["dandruff"],
    ["anti dandruff shampoo", "salicylic acid shampoo", "climbazole", "piroctone olamine", "itchy scalp", "derma co shampoo"],
    None,
    "Combines 2% salicylic acid, 1% climbazole and 1% piroctone olamine to lift visible flakes and keep the scalp feeling fresh and comfortable. The sulphate-free base also has rosemary, sage and aloe.",
    ["Three actives: salicylic acid, climbazole, piroctone olamine", "Helps reduce visible flakes and itchiness", "Sulphate-free, gentle on hair", "Cooling menthol and peppermint finish"],
    "Massage into a wet scalp, leave for 2-3 minutes so the actives can work, then rinse. Use 2-3 times a week.",
    "Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Dimethiconol, Sodium Lauroyl Methyl Isethionate, TEA-Dodecylbenzenesulfonate, Salicylic Acid, Glycerin, Piroctone Olamine, Climbazole, 1,3-Propanediol, Panthenol, Polyquaternium-10, Polyquaternium-7, Polyquaternium-73, Amodimethicone, Cetrimonium Chloride, Rosmarinus Officinalis (Rosemary) Extract, Salvia Officinalis (Sage) Extract, Aloe Barbadensis Leaf Extract, Sodium PCA, Sodium Stearate, Stearamidopropyl Dimethylamine, Sodium Benzoate, Mica, Acrylates Copolymer, Trisodium Ethylenediamine Disuccinate, Titanium Dioxide, Phenoxyethanol, Menthol, Mentha Piperita Oil, Sodium Hydroxide, Sodium Chloride, PEG-45M, Citric Acid.",
    "8904417322989", "The Derma Co Triple Actives Anti-Dandruff Shampoo bottle, front")

add("the-derma-co-1-salicylic-acid-gel-daily-face-wash", "1% Salicylic Acid Gel Daily Face Wash", "dermaco", "face", "100 ml",
    349, 299, 4.2, 29470, ["acne"],
    ["salicylic acid face wash", "acne face wash", "gel face wash", "oily skin face wash", "witch hazel", "derma co face wash"],
    None,
    "A clear gel cleanser with 1% salicylic acid, witch hazel and willow bark that clears away excess oil and helps keep pores unclogged. Mild enough for daily use on oily and acne-prone skin.",
    ["1% salicylic acid gel", "Witch hazel and willow bark", "Removes excess oil without stripping", "Sulfate-free and paraben-free, day and night"],
    "Massage a small amount onto damp skin for about a minute, then rinse well. Use twice a day.",
    "Aqua, Sodium Alpha Olefin Sulfonate, Cocamidopropyl Betaine, Glycerin, Cocamide MEA, Sodium Lactate, Salicylic Acid, Salix Alba (Willow) Bark Extract, Hamamelis Virginiana (Witch Hazel) Extract, Coco-Glucoside, Glyceryl Oleate, PEG-120 Methyl Glucose Dioleate, Sodium Chloride, Phenoxyethanol, Triethylene Glycol, Disodium EDTA.",
    "8906087775645", "The Derma Co 1% Salicylic Acid Gel Daily Face Wash tube, front")

# ───────────────────────────── Minimalist ─────────────────────────────
add("minimalist-vitamin-b5-10-oil-free-moisturizer", "Vitamin B5 10% Oil-Free Moisturizer", "minimalist", "skin", "50 g",
    349, 331, 4.3, 27690, ["dry", "acne"],
    ["oil free moisturizer", "vitamin b5", "panthenol", "moisturizer for oily skin", "minimalist moisturizer", "lightweight moisturizer"],
    "Bestseller",
    "A lightweight, oil-free gel-cream with 10% vitamin B5 (panthenol), copper, zinc and magnesium plus hyaluronic acid and betaine. It hydrates and soothes oily and combination skin without clogging or leaving shine.",
    ["10% vitamin B5 (panthenol)", "Copper, zinc and magnesium gluconates", "Hyaluronic acid and betaine for hydration", "Oil-free, non-comedogenic feel"],
    "Apply a pea-sized amount to clean face and neck morning and night. Follow with sunscreen in the daytime.",
    "Water/Aqua, Panthenol, Cyclopentasiloxane, Dimethicone Crosspolymer, Glycerin, Xylitylglucoside, Anhydroxylitol, Xylitol, PEG/PPG-18/18 Dimethicone, Hydrogenated Polyisobutene, Magnesium Aspartate, Zinc Gluconate, Copper Gluconate, Sodium Hyaluronate, Betaine, Phenoxyethanol, Pentylene Glycol, Allantoin, Ethylhexylglycerin, Carbomer, Magnesium Sulfate Heptahydrate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer.",
    "8906128100443", "Minimalist Vitamin B5 10% Moisturizer carton, front")

add("minimalist-salicylic-acid-lha-2-body-wash", "Salicylic Acid + LHA 2% Body Wash", "minimalist", "body", "200 ml",
    399, 379, 4.2, 9310, ["acne"],
    ["body wash", "salicylic acid body wash", "body acne", "lha", "exfoliating body wash", "minimalist body wash"],
    None,
    "A gently exfoliating body wash with salicylic acid and LHA (capryloyl salicylic acid) for bumpy, congested skin on the back, chest and arms. Niacinamide, betaine and glycerin help it rinse off without dryness.",
    ["2% salicylic acid + LHA blend", "Helps smooth rough, bumpy skin", "Niacinamide, betaine and glycerin", "Mild, sulphate-free cleansers"],
    "Lather onto wet skin, leave for a minute on problem areas, then rinse. Use daily or on alternate days.",
    "Water/Aqua, Sodium Lauroyl Sarcosinate, Coco-Glucoside, Cocamidopropyl Betaine, Acrylates Copolymer, Acrylates Crosspolymer-4, Glycerin, Sodium Lauroamphoacetate, Salicylic Acid, Capryloyl Salicylic Acid, Sodium PCA, Betaine, Niacinamide, Phenoxyethanol, Ethylhexylglycerin, Sodium Hydroxide, Trisodium Ethylenediamine Disuccinate.",
    "8906128100818", "Minimalist Salicylic Acid + LHA 2% Body Wash carton, front")

add("minimalist-maleic-bond-repair-complex-5-hair-serum", "Maleic Bond Repair Complex 5% Hair Serum", "minimalist", "hair", "50 ml",
    699, 664, 4.1, 4120, ["frizz"],
    ["hair serum", "bond repair", "damaged hair", "frizz control", "argan oil serum", "minimalist hair serum"],
    "New",
    "A leave-in hair serum with a 5% maleic acid bond-repair complex, amino acids, argan oil and squalane for hair stressed by colour, heat or straightening. It smooths frizz and leaves lengths softer and shinier.",
    ["5% maleic bond repair complex", "Amino acids, argan oil and squalane", "Smooths frizz and adds shine", "Suits all hair types"],
    "Work 2-3 pumps through damp or dry lengths and ends, avoiding the scalp. Style as usual; no need to rinse.",
    "Key ingredients: Maleic Bond Repair Complex (5%), Amino Acids, Argania Spinosa (Argan) Kernel Oil, Squalane.",
    "8906128100788", "Minimalist Maleic Bond Repair Complex 5% Hair Serum carton, front")

# ───────────────────────────── Beardo ─────────────────────────────
add("beardo-whisky-smoke-perfume-body-spray", "Whisky Smoke Perfume Body Spray", "beardo", "fragrance", "120 ml",
    349, 279, 4.1, 16480, [],
    ["perfume for men", "body spray", "deodorant", "whisky smoke", "no gas perfume", "beardo perfume", "long lasting"],
    None,
    "A no-gas perfume body spray with a warm, smoky whisky-and-wood character built for evenings out. The concentrated formula gives more sprays per can and a longer-lasting trail than regular deodorants.",
    ["Smoky, woody whisky accord", "No-gas formula: pure perfume in every spray", "Long-lasting fragrance", "120 ml for daily use"],
    "Hold 15 cm away and spray on the neck, chest and wrists. Avoid spraying on broken skin or close to the eyes.",
    "Ethyl Alcohol Denat, Water, Fragrance, Diethyl Phthalate, Propylene Glycol, Triclosan.",
    "8906084795653", "Beardo Whisky Smoke Perfume Body Spray carton, front")

add("beardo-de-tan-coffee-detox-face-wash-200ml", "De-Tan Coffee Detox Face Wash for Men", "beardo", "men", "200 ml",
    449, 359, 4.2, 11920, ["tan", "dull"],
    ["face wash for men", "de tan face wash", "coffee face wash", "beardo face wash", "men's skincare", "tan removal", "value pack"],
    None,
    "Beardo's coffee face wash in a 200 ml value bottle, powered by a 4% complex of glycolic acid, lactic acid and niacinamide. It lifts away sweat, grime and the dull look that comes with sun exposure, leaving skin fresher after every wash.",
    ["4% complex: glycolic acid, lactic acid, niacinamide", "Coffee bean extract for an energising wash", "Ceramides and hyaluronate to avoid dryness", "Bigger 200 ml bottle"],
    "Wet your face, work a coin-sized amount into a lather and massage for 30 seconds before rinsing. Use twice a day.",
    "Aqua (and) Sodium Laureth Sulfate (and) Cocamide MEA (and) Cocamidopropyl Betaine (and) Glycol Distearate (and) Sodium Chloride, Acrylates Copolymer, Salicylic Acid, Niacinamide (Vitamin B3), Ceramide 1, Ceramide 3, Ceramide 6-II, Butylene Glycol, Hydrogenated Lecithin, Caprylic/Capric Triglyceride, Polyglyceryl-10 Esters, Pentylene Glycol, Coffea Arabica (Coffee) Bean Extract, Aloe Barbadensis (Aloe Vera) Extract, Glycolic Acid, Lactic Acid, Lotus Corniculatus Seed Extract, Sodium Hyaluronate, Perfume, DMDM Hydantoin, Sodium Chloride, Tocopheryl Acetate (Vitamin E), Alpha Arbutin, Sodium Benzoate, Methylisothiazolinone, CI 14720, CI 42090.",
    "8906084796360", "Beardo De-Tan Face Wash Coffee Detox 200 ml bottle, front")

# Real photos for products already in the demo catalogue (demo-data.cjs PRODUCTS[].id)
DEMO_IMAGES = {
    "lakme-ss": [img("lakme", "lakme-sun-expert-spf-50-pa-ultra-matte-gel", "8901030978784",
                     "Lakmé 9to5 Sun Expert Super Matte SPF 50 sunscreen tube, front of pack")],
    "derma-sal": [img("dermaco", "the-derma-co-2-salicylic-acid-foaming-face-wash", "8904417306576",
                      "The Derma Co Sali-Cinamide Anti-Acne Face Wash with 2% salicylic acid, 80 ml tube, front")],
}


def validate():
    errs, slugs = [], set()
    for p in P:
        s = p["slug"]
        if s in slugs:
            errs.append("duplicate slug " + s)
        slugs.add(s)
        if p["category"] not in CATS:
            errs.append(s + ": bad category")
        if not set(p["concerns"]) <= CONCERNS:
            errs.append(s + ": bad concern")
        if not (0.70 <= p["price"] / p["mrp"] <= 0.95):
            errs.append(s + ": price %d vs mrp %d outside 5-30%% off" % (p["price"], p["mrp"]))
        if not (3.9 <= p["rating"] <= 4.7) or not (200 <= p["reviews"] <= 60000):
            errs.append(s + ": rating/reviews out of range")
        if p["badge"] not in (None, "Bestseller", "New", "Derm pick"):
            errs.append(s + ": bad badge")
        if len(p["bullets"]) != 4:
            errs.append(s + ": needs 4 bullets")
        if len(re.findall(r"[.!?](\s|$)", p["description"])) != 2:
            errs.append(s + ": description should be 2 sentences")
        if re.search(r"\b(cure|cures|treat|treats|heal|heals|prevent|prevents|eliminat)", p["description"], re.I):
            errs.append(s + ": medical claim wording")
    all_images = [im for p in P for im in p["images"]] + [im for v in DEMO_IMAGES.values() for im in v]
    for k in DEMO_IMAGES:
        if k not in DEMO_IDS:
            errs.append("unknown demo id " + k)
    for im in all_images:
        f = os.path.join(ROOT, "public", im["url"].lstrip("/"))
        if not os.path.exists(f):
            errs.append("missing image " + im["url"])
    return errs


def main():
    errs = validate()
    if errs:
        print("\n".join(errs)); sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"products": P, "demoImages": DEMO_IMAGES}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    by = {}
    for p in P:
        by[p["brand"]] = by.get(p["brand"], 0) + 1
    print("wrote", os.path.relpath(OUT, ROOT), "products:", len(P), by, "demoImages:", list(DEMO_IMAGES))


if __name__ == "__main__":
    main()
