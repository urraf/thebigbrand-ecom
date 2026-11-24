#!/usr/bin/env python3
"""Build the g2 real-photo catalogue (himalaya, biotique, parachute, mamaearth, plum).

Every photo below was downloaded from Open Beauty Facts (CC BY-SA 3.0), looked at by eye,
cut out of its background with Apple Vision (bin/lift), squared onto a 1000x1250 white canvas
and saved as WEBP q82 to public/media/products/<brand>/<slug>.webp.

  python3 -I scripts/assets/g2/build_catalog.py           # (re)process images + write JSON
  python3 -I scripts/assets/g2/build_catalog.py --json    # JSON only (images already built)

Output: prisma/seed-data/catalog/g2.json  { products: [...], demoImages: { demoId: [Image] } }
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import process  # noqa: E402

ROOT = process.ROOT
OUT_JSON = os.path.join(ROOT, "prisma", "seed-data", "catalog", "g2.json")
BRAND_NAMES = {"himalaya": "Himalaya", "biotique": "Biotique", "parachute": "Parachute", "mamaearth": "Mamaearth", "plum": "Plum"}


def slugify(s):
    """Same rules as prisma/seed.ts slugify()."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"['’]", "", s).replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]


def image(brand, slug, code, alt):
    obf_code = code.split("_")[0]
    return {
        "url": f"/media/products/{brand}/{slug}.webp",
        "alt": alt,
        "width": 1000,
        "height": 1250,
        "source": "Open Beauty Facts",
        "sourceUrl": f"https://world.openbeautyfacts.org/product/{obf_code}",
        "license": "CC BY-SA 3.0",
        "attribution": "Open Beauty Facts contributors",
    }


# ---------------------------------------------------------------------------------------------
# Real photos for products that already exist in the demo catalogue (demo-data.cjs PRODUCTS[].id)
# file slug = the slug prisma/seed.ts gives the demo product: slugify(`${brand.name} ${p.name}`)
DEMO = [
    dict(demo="him-fw", brand="himalaya", code="8901138511784", name="Purifying Neem Face Wash for Pimples",
         alt="Himalaya Purifying Neem Face Wash tube, front of pack"),
    dict(demo="him-shamp", brand="himalaya", code="8901138002466", name="Anti-Dandruff Shampoo with Tea Tree",
         alt="Himalaya Anti-Dandruff Tea Tree Shampoo bottle, front of pack"),
    dict(demo="para-aloe", brand="parachute", code="8901088080279", name="Advansed Aloe Vera Enriched Hair Oil",
         alt="Parachute Advansed Aloe Vera Enriched Coconut Hair Oil bottle, front of pack"),
    dict(demo="mama-vitc", brand="mamaearth", code="8906087772859", name="Vitamin C Face Wash with Turmeric",
         alt="Mamaearth Vitamin C Face Wash with Vitamin C and Turmeric tube, front of pack"),
]

# ---------------------------------------------------------------------------------------------
# New products (not in the demo catalogue). `fx` = processing flags for process.run().
PRODUCTS = [
    # ── Himalaya ────────────────────────────────────────────────────────────────────────────
    dict(code="8901138002428", brand="himalaya", category="hair", name="Anti-Hair Fall Bhringaraja Shampoo", size="340 ml",
         mrp=330, price=279, rating=4.2, reviews=14260, concerns=["hairfall"], badge=None,
         tags=["shampoo", "anti hair fall shampoo", "bhringraj", "bhringaraja", "hair fall", "herbal shampoo", "himalaya shampoo"],
         description="A daily shampoo built around Bhringaraja, the herb Ayurveda has long used for hair care, with Himalaya's Natural Protein 5 complex. It cleanses the scalp gently and leaves lengths stronger and less prone to breakage from combing.",
         bullets=["Bhringaraja and chickpea extracts for stronger-feeling hair", "Natural Protein 5 complex helps reduce breakage", "Gentle enough for everyday washing", "Paraben-free, dermatologically tested"],
         howToUse="Massage into wet hair and scalp, work into a lather and rinse thoroughly. Use daily or on alternate days.",
         ingredients="Aqua, Sodium Laureth Sulfate, Dimethiconol, TEA-Dodecylbenzenesulfonate, Trideceth-10, Cocamidopropyl Betaine, Glycol Distearate, Glycerin, Fragrance, Sodium Chloride, Sodium Benzoate, Carbomer, Guar Hydroxypropyltrimonium Chloride, Salicylic Acid, Sodium Hydroxide, Disodium EDTA, Hydroxypropyltrimonium Hydrolyzed Wheat Protein, PEG-45M, Hydrolyzed Soy Protein, Cicer Arietinum Seed Extract, Eclipta Prostrata Extract, Butea Frondosa Flower Extract.",
         alt="Himalaya Anti-Hair Fall Bhringaraja Shampoo 340 ml bottle, front of pack"),
    dict(code="8901138011062", brand="himalaya", category="face", name="Hydrating Aloe Vera Face Wash", size="100 ml",
         mrp=175, price=149, rating=4.3, reviews=22840, concerns=["dry"], badge=None,
         tags=["face wash", "aloe vera face wash", "hydrating face wash", "dry skin", "cucumber", "soap free"],
         description="A soap-free gel cleanser with aloe vera and cucumber that removes dirt without leaving skin tight or squeaky. Ideal for normal to dry skin that needs a softer everyday wash.",
         bullets=["Aloe vera and cucumber for a soft, hydrated feel", "Soap-free, pH-friendly formula", "Rinses clean without tightness", "Recyclable tube"],
         howToUse="Wet your face, massage a small amount in gentle circles for 30 seconds, then rinse. Use morning and night.",
         ingredients="Aqua, Ammonium Lauryl Sulfate, Stearic Acid, Glycerin, Cocamidopropyl Betaine, Cucumis Sativus (Cucumber) Fruit Extract, Glycol Stearate, Cetyl Alcohol, Glyceryl Stearate, PEG-100 Stearate, Phenoxyethanol, Ethylhexylglycerin, Fragrance, Xanthan Gum, Sodium Lauroyl Sarcosinate, Aloe Barbadensis Leaf Extract, Sodium Benzoate, Cetearyl Alcohol, Coco-Glucoside, Glyceryl Oleate, Menthol, Tocopherol, Disodium EDTA, CI 19140, CI 42053.",
         alt="Himalaya Hydrating Aloe Vera Face Wash 100 ml tube, front of pack"),
    dict(code="8901138512811", brand="himalaya", category="face", name="Purifying Neem Foaming Face Wash", size="150 ml",
         mrp=250, price=215, rating=4.3, reviews=9870, concerns=["acne"], badge=None,
         tags=["foaming face wash", "neem face wash", "pump face wash", "oily skin", "pimples", "turmeric"],
         description="Neem and turmeric in a pump bottle that dispenses a ready-made, airy foam. The light lather lifts excess oil and grime, making it a quick wash for oily and acne-prone skin.",
         bullets=["Neem and turmeric for clearer-looking skin", "Pump dispenses instant foam, no rubbing needed", "Controls excess oil without over-drying", "Soap-free and suitable for daily use"],
         howToUse="Dispense two pumps of foam onto damp hands, massage over the face avoiding the eye area, and rinse well. Use twice daily.",
         ingredients="Aqua, Ammonium Lauryl Sulfate, Melia Azadirachta (Neem) Leaf Extract, Decyl Glucoside, Cocamidopropyl Betaine, Glycerin, Polysorbate 20, Phenoxyethanol, Curcuma Longa (Turmeric) Root Extract, Vetiveria Zizanioides Root Extract, Sodium Benzoate, Fragrance, Ethylhexylglycerin, Disodium EDTA, Citric Acid, BHT, CI 19140, CI 42090, Hexyl Cinnamal.",
         alt="Himalaya Purifying Neem Foaming Face Wash 150 ml pump bottle, front of pack"),
    dict(code="8901138819668", brand="himalaya", category="face", name="Natural Glow Kesar Face Wash", size="100 ml",
         mrp=175, price=152, rating=4.2, reviews=11430, concerns=["dull", "tan"], badge=None,
         tags=["kesar face wash", "saffron", "glow", "brightening face wash", "dull skin", "pomegranate"],
         description="A creamy face wash with kesar (saffron), cucumber and pomegranate that cleans while leaving skin looking smoother and more even. A good pick for dull, tired-looking skin after a day outdoors.",
         bullets=["Saffron and pomegranate for a natural-looking glow", "Cucumber keeps skin feeling fresh", "Soap-free, skin-friendly formula", "Gentle enough for twice-daily use"],
         howToUse="Wet face and neck, massage a coin-sized amount for 30–60 seconds and rinse. Follow with moisturiser.",
         ingredients="Aqua, Ammonium Lauryl Sulfate, Glycol Distearate, Cocamidopropyl Betaine, Glycerin, Phenoxyethanol, Ethylhexylglycerin, Fragrance, Cetyl Alcohol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Cocoyl Glutamate, Disodium Cocoyl Glutamate, Crocus Sativus Flower Extract, Cucumis Sativus (Cucumber) Fruit Extract, Sodium Hydroxide, Citric Acid, Coco-Glucoside, Glyceryl Oleate, Disodium EDTA, Tocopheryl Acetate, Menthol, Punica Granatum Fruit Extract, CI 15985.",
         alt="Himalaya Natural Glow Kesar Face Wash 100 ml tube, front of pack"),
    dict(code="8901138834777", brand="himalaya", category="skin", name="Clear Complexion Brightening Day Cream", size="50 g",
         mrp=225, price=189, rating=4.1, reviews=6720, concerns=["dull", "tan"], badge=None,
         tags=["day cream", "brightening cream", "moisturiser", "licorice", "spf", "even tone"],
         description="A light day cream with licorice and cotton tree extracts that moisturises and helps skin look brighter and more even over time. It sinks in quickly, so it sits comfortably under sunscreen or makeup.",
         bullets=["Licorice and cotton tree for a more even-looking tone", "Light, non-greasy texture", "Day-long moisture", "Works well under sunscreen and makeup"],
         howToUse="Apply a pea-sized amount to clean face and neck every morning and massage in upward strokes.",
         ingredients="Aqua, Caprylic/Capric Triglyceride, Isopropyl Myristate, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Cetearyl Ethylhexanoate, Glyceryl Stearate, Ricinus Communis Seed Oil, Hydrogenated Castor Oil, Sorbitan Stearate, Sucrose Cocoate, Titanium Dioxide, Phenoxyethanol, Sodium Cetearyl Sulfate, Parfum, Sodium Benzoate, Carbomer, Glycyrrhiza Glabra Root Extract, Hedychium Spicatum Extract, Alpinia Galanga Rhizome Extract, Ethylhexylglycerin, Methylisothiazolinone, Vateria Indica Bark Extract, Disodium EDTA, Tocopheryl Acetate, Sodium Hydroxide, Bombax Malabaricum Flower Extract, Rheum Emodi Root Extract, CI 14700.",
         alt="Himalaya Clear Complexion Day Cream 50 g jar"),
    dict(code="8901138714550", brand="himalaya", category="body", name="Neem & Turmeric Soap", size="125 g", fx=dict(nocut=True, crop=(0.004, 0.012, 0.982, 0.958)),
         mrp=60, price=54, rating=4.4, reviews=31200, concerns=["acne"], badge="Bestseller",
         tags=["soap", "neem soap", "turmeric soap", "bath soap", "body", "pimples"],
         description="A classic bathing bar with neem and turmeric that cleanses thoroughly and leaves skin feeling fresh. Its mild herbal scent and rich lather make it a family favourite for everyday baths.",
         bullets=["Neem and turmeric for clean, fresh-feeling skin", "Rich, creamy lather", "Suitable for the whole family", "Pure and natural ingredients"],
         howToUse="Work into a lather with water, massage over damp skin and rinse. Use daily.",
         ingredients="Key ingredients: Neem (Azadirachta indica) leaf extract, Turmeric (Curcuma longa) root extract, vegetable-oil soap base, glycerin, fragrance.",
         alt="Himalaya Neem & Turmeric Soap 125 g carton, front of pack"),
    dict(code="8901138821791", brand="himalaya", category="hair", name="Anti-Dandruff Hair Cream", size="140 ml",
         mrp=199, price=169, rating=4.1, reviews=5340, concerns=["dandruff", "dry"], badge=None,
         tags=["hair cream", "anti dandruff", "tea tree", "aloe vera", "styling cream", "dry scalp"],
         description="A non-sticky leave-in hair cream with tea tree and aloe vera that keeps the scalp comfortable and helps control visible flakes. Natural Protein 5 conditions the lengths so hair stays soft and manageable.",
         bullets=["Tea tree and aloe vera for a calm, flake-free look", "Non-sticky leave-in conditioning", "Natural Protein 5 for soft, manageable hair", "Light hold for everyday styling"],
         howToUse="Take a small amount on your palms and massage into the scalp and lengths of clean, towel-dried hair. Style as usual.",
         ingredients="Key ingredients: Tea Tree (Melaleuca alternifolia) oil, Aloe Vera (Aloe barbadensis) extract, Natural Protein 5 complex (hydrolysed proteins).",
         alt="Himalaya Anti-Dandruff Hair Cream 140 ml jar"),

    # ── Biotique ────────────────────────────────────────────────────────────────────────────
    dict(code="8904352002250", brand="biotique", category="skin", name="Sun Shield Aloe Vera SPF 75+ Sunscreen Lotion", size="190 ml",
         mrp=599, price=479, rating=4.2, reviews=8650, concerns=["tan", "dry"], badge=None,
         tags=["sunscreen", "spf 75", "aloe vera sunscreen", "sun protection", "pa+++", "body sunscreen"],
         description="A high-protection SPF 75+ PA+++ sun lotion blended with aloe vera, sunflower, neem and nut grass in an Ayurvedic base. It shields face and body on long, sunny days while keeping skin soft and moisturised.",
         bullets=["Broad-spectrum SPF 75+ UVB / PA+++ UVA", "Aloe vera keeps skin soothed and moisturised", "Naturally derived zinc oxide", "Generous 190 ml size for face and body"],
         howToUse="Apply generously to face and exposed skin 20 minutes before stepping out. Reapply every 2–3 hours and after swimming or sweating.",
         ingredients="Key ingredients: Aloe Vera (Aloe barbadensis), Sunflower (Helianthus annuus), Neem (Azadirachta indica), Nut Grass (Cyperus rotundus), Greater Galangal (Alpinia galanga), naturally derived Zinc Oxide.",
         alt="Biotique Sun Shield Aloe Vera SPF 75+ sunscreen lotion bottle, front of pack"),
    dict(code="8904352004100", brand="biotique", category="face", name="Honey Gel Soothe & Nourish Foaming Face Cleanser", size="120 ml",
         mrp=199, price=169, rating=4.3, reviews=12780, concerns=["dry", "dull"], badge=None,
         tags=["face wash", "honey face wash", "gel cleanser", "soap free", "dry skin", "biotique honey gel"],
         description="A 100% soap-free foaming gel made with pure honey, wild turmeric and Arjun tree bark that cleanses while it hydrates. Skin is left soft and supple rather than stripped.",
         bullets=["Pure honey for soft, hydrated skin", "Soap-free foaming gel", "Wild turmeric for a fresh, even look", "Suits all skin types"],
         howToUse="Squeeze a small amount onto wet palms, work into a lather and massage over the face. Rinse with water.",
         ingredients="Key ingredients: Pure Honey, Wild Turmeric (Curcuma aromatica), Arjun Tree (Terminalia arjuna) bark extract.",
         alt="Biotique Honey Gel Soothe & Nourish Foaming Face Cleanser 120 ml bottle, front of pack"),
    dict(code="8904352004681", brand="biotique", category="body", name="Morning Nectar Nourish & Hydrate Body Wash", size="200 ml",
         mrp=249, price=211, rating=4.2, reviews=3480, concerns=["dry"], badge=None,
         tags=["body wash", "shower gel", "soap free", "moisturising body wash", "ashwagandha", "biotique morning nectar"],
         description="A soap-free shower gel from Biotique's Morning Nectar range with wild turmeric, ashwagandha, neem leaves and ginger. It lathers gently and leaves skin feeling nourished and smooth.",
         bullets=["100% soap-free formula", "Wild turmeric, ashwagandha and neem", "Leaves skin soft and hydrated", "Convenient pump bottle"],
         howToUse="Pump onto a loofah or damp palms, lather over wet skin and rinse well.",
         ingredients="Key ingredients: Wild Turmeric, Ashwagandha (Withania somnifera), Neem leaves, Ginger.",
         alt="Biotique Morning Nectar Nourish & Hydrate Body Wash 200 ml pump bottle"),
    dict(code="8904352004650", brand="biotique", category="body", name="Apricot Refreshing Body Wash", size="200 ml",
         mrp=249, price=199, rating=4.1, reviews=2960, concerns=["dull"], badge=None,
         tags=["body wash", "apricot", "shower gel", "refreshing", "soap free", "soapberry"],
         description="A refreshing, soap-free body wash with apricot, wild turmeric and Indian soapberry. It cleanses and softens while bringing out the skin's natural brightness.",
         bullets=["Apricot for a fresh, bright look", "Indian soapberry for a gentle natural lather", "Soap-free and pH-friendly", "Fruity, uplifting fragrance"],
         howToUse="Massage over wet skin with hands or a loofah, then rinse.",
         ingredients="Key ingredients: Apricot (Prunus armeniaca), Wild Turmeric, Turmeric, Indian Soapberry (Sapindus mukorossi).",
         alt="Biotique Apricot Refreshing Body Wash 200 ml pump bottle"),
    dict(code="8904352004414", brand="biotique", category="hair", name="Green Apple Shine & Gloss Shampoo & Conditioner", size="180 ml",
         mrp=199, price=169, rating=4.2, reviews=18750, concerns=["frizz"], badge=None,
         tags=["shampoo", "2 in 1 shampoo", "green apple", "shine", "conditioner", "oily scalp"],
         description="A pH-balanced 2-in-1 shampoo and conditioner with green apple extract, sea algae and centella. It cleans the scalp gently and leaves hair glossy and refreshed after every wash.",
         bullets=["Green apple and sea algae for glossy hair", "Shampoo and conditioner in one step", "pH-balanced, gentle for daily use", "Bhringraj and hibiscus flower for nourishment"],
         howToUse="Apply liberally to wet hair, work through from scalp to ends and rinse well with water.",
         ingredients="Key ingredients: Green Apple (Pyrus malus) extract, Sea Algae, Centella (Centella asiatica), Bhringraj (Eclipta alba), Hibiscus flower.",
         alt="Biotique Green Apple Shine & Gloss Shampoo & Conditioner 180 ml bottle"),
    dict(code="8904352003905", brand="biotique", category="skin", name="Sun Shield Carrot SPF 40+ Sunscreen Lotion", size="120 ml",
         mrp=399, price=339, rating=4.1, reviews=7340, concerns=["tan"], badge=None,
         tags=["sunscreen", "spf 40", "carrot sunscreen", "pa+++", "daily sunscreen", "sun protection"],
         description="A daily SPF 40+ PA+++ sun lotion with carrot, night-jasmine leaf, lodhra bark and sprouted wheat germ. It keeps skin protected and moisturised in the sun.",
         bullets=["Broad-spectrum SPF 40+ UVB / PA+++ UVA", "Carrot root extract, rich in carotene", "Naturally derived zinc oxide", "For all skin types"],
         howToUse="Apply evenly to face and exposed areas 20 minutes before sun exposure; reapply every 2–3 hours.",
         ingredients="Key ingredients: Carrot (Daucus carota) root extract, Nyctanthes (night jasmine) leaf extract, Lodhra (Symplocos racemosa) bark, Sprouted Wheat Germ, naturally derived Zinc Oxide.",
         alt="Biotique Sun Shield Carrot SPF 40+ sunscreen lotion carton, front of pack"),
    dict(code="8904352003950", brand="biotique", category="skin", name="Sun Shield Sandalwood SPF 50+ Sunscreen Lotion", size="120 ml",
         mrp=415, price=349, rating=4.3, reviews=24910, concerns=["tan"], badge="Bestseller",
         tags=["sunscreen", "spf 50", "sandalwood sunscreen", "water resistant", "pa+++", "sun protection"],
         description="A long-time favourite SPF 50+ PA+++ sunscreen with sandalwood in a water-resistant lotion. It is a dependable everyday shield for Indian summers, from the commute to the beach.",
         bullets=["Broad-spectrum SPF 50+ UVB / PA+++ UVA", "Water-resistant formula", "Sandalwood for a cool, soothing feel", "Suits all skin types"],
         howToUse="Apply generously to face and body 20 minutes before going out. Reapply after swimming, sweating or towelling.",
         ingredients="Key ingredients: Sandalwood (Santalum album), naturally derived Zinc Oxide, botanical extracts.",
         alt="Biotique Sun Shield Sandalwood SPF 50+ sunscreen lotion bottle, front of pack"),
    dict(code="8904352004520_1", brand="biotique", category="hair", name="Ocean Kelp Anti Hair Fall Shampoo", size="650 ml", fx=dict(rot=180, deskew=True),
         mrp=599, price=449, rating=4.2, reviews=9820, concerns=["hairfall"], badge=None,
         tags=["shampoo", "anti hair fall", "ocean kelp", "family pack", "pump bottle", "hair growth therapy"],
         description="A family-size anti-hair-fall shampoo with ocean kelp, part of Biotique's Intensive Hair Growth Therapy range. The 650 ml pump bottle makes a mild, daily cleanse easy for the whole household.",
         bullets=["Ocean kelp for stronger-feeling hair", "Helps reduce hair fall from breakage", "Value 650 ml pump bottle", "Ayurvedic recipe with botanical extracts"],
         howToUse="Massage into wet hair and scalp, lather and rinse thoroughly. Repeat if needed.",
         ingredients="Key ingredients: Ocean Kelp (seaweed) extract, botanical extracts.",
         alt="Biotique Ocean Kelp Anti Hair Fall Shampoo 650 ml pump bottle"),

    # ── Parachute ───────────────────────────────────────────────────────────────────────────
    dict(code="8901088150729", brand="parachute", category="oil", name="Advansed Gold Coconut Hair Oil", size="190 ml",
         mrp=160, price=145, rating=4.4, reviews=26300, concerns=["dry", "hairfall"], badge=None,
         tags=["coconut oil", "hair oil", "parachute gold", "vitamin e", "champi", "long hair"],
         description="A light coconut hair oil from Parachute, enriched with vitamin E, for regular champi. It spreads easily, absorbs without heaviness and keeps hair soft and nourished from root to tip.",
         bullets=["Pure coconut oil base", "Enriched with vitamin E", "Light, non-sticky feel", "Ideal for regular champi"],
         howToUse="Warm a little oil between your palms and massage into the scalp and lengths. Leave on for at least an hour or overnight, then wash.",
         ingredients="Vegetable Oil including Coconut Oil (79.4% v/v), Paraffinum Liquidum (20% v/v), Vitamin E, TBHQ, Perfume.",
         alt="Parachute Advansed Gold Coconut Hair Oil 190 ml bottle"),

    # ── Mamaearth ───────────────────────────────────────────────────────────────────────────
    dict(code="8906087773924", brand="mamaearth", category="face", name="Vitamin C Daily Glow Face Wash", size="250 ml",
         mrp=499, price=399, rating=4.2, reviews=15870, concerns=["dull", "tan"], badge=None,
         tags=["vitamin c face wash", "pump face wash", "glow", "turmeric", "brightening", "value pack"],
         description="Mamaearth's Vitamin C and turmeric face wash in a 250 ml pump bottle for everyday glow. The gel lathers lightly and rinses clean, leaving skin fresh and radiant-looking.",
         bullets=["Vitamin C and turmeric for a daily glow", "Sulfate- and paraben-free", "Dermatologically tested, suits all skin types", "Big 250 ml pump for daily use"],
         howToUse="Pump a small amount onto wet palms, massage over damp face for 30 seconds and rinse. Use twice daily.",
         ingredients="Key ingredients: Vitamin C, Turmeric (Curcuma longa) extract.",
         alt="Mamaearth Vitamin C Daily Glow Face Wash 250 ml pump bottle"),
    dict(code="8904417317183", brand="mamaearth", category="body", name="Ubtan Moisturizing Body Lotion", size="400 ml",
         mrp=449, price=359, rating=4.3, reviews=7260, concerns=["dry", "dull"], badge=None,
         tags=["body lotion", "ubtan", "turmeric", "saffron", "moisturiser", "48 hour moisture"],
         description="A rich body lotion inspired by traditional ubtan, made with turmeric and saffron. It locks in moisture for up to 48 hours and leaves skin soft with a healthy glow.",
         bullets=["Turmeric and saffron for glowing skin", "Up to 48-hour moisturisation", "7-in-1 total care", "Made Safe certified, for dry skin"],
         howToUse="Apply generously all over the body after a bath, massaging until absorbed. Reapply on dry areas as needed.",
         ingredients="Key ingredients: Turmeric (Curcuma longa) extract, Saffron (Crocus sativus) extract, plant-based butters.",
         alt="Mamaearth Ubtan Moisturizing Body Lotion 400 ml bottle"),
    dict(code="8906087772484", brand="mamaearth", category="skin", name="Vitamin C Face Toner", size="200 ml",
         mrp=399, price=339, rating=4.1, reviews=6140, concerns=["dull"], badge=None,
         tags=["toner", "vitamin c toner", "cucumber", "pores", "alcohol free", "glow"],
         description="An alcohol-free toner with vitamin C and cucumber that refreshes skin and helps tighten the look of pores after cleansing. It preps the face so serums and moisturisers spread better.",
         bullets=["Vitamin C and cucumber for a fresh glow", "Helps tighten the look of pores", "Alcohol-free and gentle", "Dermatologically tested"],
         howToUse="After cleansing, apply to a cotton pad and sweep over face and neck, or pat in with fingertips. Follow with serum and moisturiser.",
         ingredients="Key ingredients: Vitamin C, Cucumber (Cucumis sativus) extract.",
         alt="Mamaearth Vitamin C Face Toner 200 ml bottle"),
    dict(code="8906087778486", brand="mamaearth", category="hair", name="Natural Henna Paste with Dark Roast Coffee", size="200 g",
         mrp=349, price=279, rating=4.0, reviews=1840, concerns=[], badge="New",
         tags=["henna", "mehendi", "hair colour", "coffee", "natural hair colour", "grey coverage"],
         description="A ready-to-use henna paste with dark roast coffee for rich, naturally coloured hair, with none of the soaking and mixing of henna powder. The resealable spout pouch keeps it fresh between applications.",
         bullets=["Ready-to-apply henna paste", "Dark roast coffee for richer tones", "Resealable spout pouch", "Dermatologically tested"],
         howToUse="Section clean, dry hair and apply the paste evenly from roots to ends with gloves. Leave on for 1–2 hours, then rinse with water.",
         ingredients="Key ingredients: Henna (Lawsonia inermis), Dark Roast Coffee.",
         alt="Mamaearth Natural Henna Paste with Dark Roast Coffee 200 g pouch"),

    # ── Plum ────────────────────────────────────────────────────────────────────────────────
    dict(code="8906118414215", brand="plum", category="skin", name="Rice Water & Niacinamide 3% Toner", size="150 ml",
         mrp=445, price=378, rating=4.4, reviews=9650, concerns=["dull", "acne"], badge="Derm pick",
         tags=["toner", "niacinamide toner", "rice water", "pores", "brightening", "vegan"],
         description="A watery toner with 3% niacinamide, rice water and oat extract that helps tighten the look of pores and brighten skin. Its light texture layers easily under serum and moisturiser.",
         bullets=["3% niacinamide for brighter-looking skin", "Rice water and oat extract to soothe", "Helps refine the look of pores", "100% vegan"],
         howToUse="Mist or pat onto clean skin morning and night, then follow with serum and moisturiser.",
         ingredients="Aqua, Niacinamide, Pentylene Glycol, Oryza Sativa (Rice) Extract, Rice Ferment Filtrate (Sake), Butylene Glycol, Rosa Damascena (Rose) Flower Water, Methyl Gluceth-20, Sorbitol, Cyclodextrin, Avena Sativa (Oat) Kernel Extract, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Xylitylglucoside, Panthenol, Sodium Gluconate, Anhydroxylitol, Xylitol, Phenoxyethanol, Ethylhexylglycerin, PEG-40 Hydrogenated Castor Oil.",
         alt="Plum Rice Water & Niacinamide 3% Toner 150 ml bottle"),
    dict(code="8906118416370", brand="plum", category="face", name="Saffron & Papaya Glow Bright Face Wash", size="100 ml",
         mrp=349, price=297, rating=4.2, reviews=4310, concerns=["dull", "tan"], badge="New",
         tags=["face wash", "saffron", "papaya", "glow", "niacinamide", "brightening"],
         description="A sulphate-free glow face wash with papaya, saffron oil and niacinamide that cleanses gently and enhances radiance. A good daily wash for dull or uneven-looking skin.",
         bullets=["Papaya and saffron oil for a radiant look", "Niacinamide for brighter-looking skin", "Gentle, sulphate-free cleansers", "Suits all skin types"],
         howToUse="Massage onto a wet face for 30 seconds and rinse. Use morning and night.",
         ingredients="Aqua, Cocamidopropyl Betaine, Acrylates Copolymer, Coco Glucoside, Sodium Cocoyl Glycinate, Glycerin, Propanediol, Olive Oil PEG-7 Esters, Triethanolamine, Capryloyl/Caproyl Methyl Glucamide, Carica Papaya Fruit Extract, Crocus Sativus (Saffron) Oil, Niacinamide, Lauroyl/Myristoyl Methyl Glucamide, Phenoxyethanol, Ethylhexylglycerin, Panthenol, Fragrance, Sodium Gluconate, CI 15510, CI 47005.",
         alt="Plum Saffron & Papaya Glow Bright Face Wash 100 ml tube"),
    dict(code="8906118412648", brand="plum", category="skin", name="Bulgarian Valley Rose Water Toner", size="100 ml", fx=dict(deskew=True),
         mrp=390, price=331, rating=4.3, reviews=5480, concerns=["dry"], badge=None,
         tags=["rose water", "toner", "hyaluronic acid", "witch hazel", "hydrating", "alcohol free"],
         description="A hydrating toner made with Bulgarian rose water, witch hazel and hyaluronic acid that tightens the look of pores and leaves skin dewy. A refreshing mist between cleanser and moisturiser.",
         bullets=["Bulgarian rose water for a refreshing lift", "Hyaluronic acid for hydration", "Witch hazel helps refine the look of pores", "100% vegan"],
         howToUse="After cleansing, spritz or pat onto face and neck. Use morning and night, or anytime skin needs a refresh.",
         ingredients="Aqua, Rosa Damascena (Rose) Flower Water, PEG-40 Hydrogenated Castor Oil, Hamamelis Virginiana (Witch Hazel) Leaf Extract, Hydrolyzed Sodium Hyaluronate, Calendula Officinalis Flower Extract, Phenoxyethanol, Ethylhexylglycerin, Sodium Gluconate.",
         alt="Plum Bulgarian Valley Rose Water Toner 100 ml bottle"),
]


def build(images=True):
    out = {"products": [], "demoImages": {}}
    for d in DEMO:
        slug = slugify(f"{BRAND_NAMES[d['brand']]} {d['name']}")
        if images:
            save(d["code"], d["brand"], slug, d.get("fx", {}))
        out["demoImages"][d["demo"]] = [image(d["brand"], slug, d["code"], d["alt"])]
    seen = set()
    for p in PRODUCTS:
        slug = slugify(f"{p['brand']} {p['name']}")
        assert slug not in seen, slug
        seen.add(slug)
        assert 0.05 <= 1 - p["price"] / p["mrp"] <= 0.30, (slug, p["mrp"], p["price"])
        if images:
            save(p["code"], p["brand"], slug, p.get("fx", {}))
        out["products"].append({
            "slug": slug, "name": p["name"], "brand": p["brand"], "category": p["category"], "size": p["size"],
            "mrp": p["mrp"], "price": p["price"], "rating": p["rating"], "reviews": p["reviews"],
            "concerns": p["concerns"], "tags": p["tags"], "badge": p["badge"], "description": p["description"],
            "bullets": p["bullets"], "howToUse": p["howToUse"], "ingredients": p["ingredients"],
            "images": [image(p["brand"], slug, p["code"], p["alt"])],
        })
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT_JSON}: {len(out['products'])} products, {len(out['demoImages'])} demo photos")


def save(code, brand, slug, fx):
    canvas = process.run(code, **fx)
    d = os.path.join(process.MEDIA, brand)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{slug}.webp")
    canvas.save(path, "WEBP", quality=82, method=6)
    print(f"  -> {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


if __name__ == "__main__":
    build(images="--json" not in sys.argv)
