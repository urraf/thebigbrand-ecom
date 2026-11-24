"""Curated g1 picks: Open Beauty Facts barcode -> catalogue product (or demo product photo).

Each image spec: code (OBF barcode), plus processing options passed to process.process():
  bg: auto|white|flood|keep, ftol, tol, crop [l,t,r,b] (px of the original), quad [ul,ll,lr,ur], max_up, scale.
Every photo listed here was inspected by eye (raw and processed) before acceptance.
"""

OBF = "Open Beauty Facts"

# ---------------------------------------------------------------- demo products (photos only)
DEMO = [
    {"demo": "cet-cl", "brand": "cetaphil", "name": "Gentle Skin Cleanser for Sensitive Skin",
     "img": [{"code": "0302993921165", "bg": "trim", "alt": "Cetaphil Gentle Skin Cleanser pump bottle for dry to normal, sensitive skin"}]},
    {"demo": "cet-moist", "brand": "cetaphil", "name": "Moisturising Cream for Dry to Very Dry Skin",
     "img": [{"code": "6009626121148", "bg": "trim", "alt": "Cetaphil Moisturising Cream tub for dry to very dry, sensitive skin"}]},
    {"demo": "dove-sh", "brand": "dove", "name": "Intense Repair Shampoo for Damaged Hair",
     "img": [{"code": "8712561488280", "bg": "trim", "alt": "Dove Intensive Repair shampoo bottle for damaged hair"}]},
    {"demo": "dove-bw", "brand": "dove", "name": "Deeply Nourishing Body Wash",
     "img": [{"code": "8717163710234", "bg": "trim", "alt": "Dove Deeply Nourishing body wash bottle"}]},
    {"demo": "nivea-cream", "brand": "nivea", "name": "Soft Light Moisturising Cream with Jojoba Oil",
     "img": [{"code": "4005808799442", "bg": "trim", "alt": "Nivea Soft moisturising cream jar with jojoba oil and Vitamin E"}]},
    {"demo": "nivea-lotion", "brand": "nivea", "name": "Nourishing Body Lotion for Very Dry Skin",
     "img": [{"code": "4005900440891", "bg": "kmeans", "kmeans": {"opening": 7},
                  "clip": [{"poly": [500, 80, 970, 80, 970, 300, 900, 300, 900, 765, 1128, 760, 1128, 1120, 1182, 1230, 1298, 1670, 1310, 1900, 1310, 3420, 1250, 3535, 300, 3535, 215, 3420, 215, 1900, 228, 1670, 350, 1230, 378, 1120, 378, 812, 580, 800, 580, 300, 500, 300]}], "alt": "Nivea Rich Nourishing body lotion pump bottle for very dry skin"}]},
    {"demo": "gar-micellar", "brand": "garnier", "name": "Micellar Cleansing Water, Makeup Remover",
     "img": [{"code": "3600541361348", "bg": "trim", "max_up": 1.85, "alt": "Garnier SkinActive Micellar Cleansing Water 400 ml with pink cap"}]},
    {"demo": "lo-shampoo", "brand": "loreal", "name": "Total Repair 5 Shampoo for Damaged Hair",
     "img": [{"code": "3600524150006", "bg": "trim", "max_up": 1.85, "alt": "L'Oréal Paris Total Repair 5 repairing shampoo bottle"}]},
    {"demo": "lo-found", "brand": "loreal", "name": "Infallible 24H Fresh Wear Foundation",
     "img": [{"code": "3600523614417", "bg": "trim", "max_up": 1.85, "alt": "L'Oréal Paris Infallible 24H Fresh Wear liquid foundation bottle"}]},
    {"demo": "lo-hyal", "brand": "loreal", "name": "Revitalift 1.5% Hyaluronic Acid Face Serum",
     "img": [{"code": "0071249377512", "bg": "keep", "crop": [45, 0, 1225, 3214], "alt": "L'Oréal Paris Revitalift Derm Intensives 1.5% Pure Hyaluronic Acid serum carton"}]},
]

# ---------------------------------------------------------------- new catalogue products
P = []


def add(**kw):
    P.append(kw)


# ============ CETAPHIL ============
add(brand="cetaphil", name="Moisturising Lotion for Dry, Sensitive Skin", category="body", size="250 ml",
    mrp=1099, price=949, rating=4.6, reviews=21480, concerns=["dry"], badge="Derm pick",
    tags=["body lotion", "moisturiser", "sensitive skin", "fragrance free", "non comedogenic", "dry skin", "cetaphil lotion"],
    description="A lightweight, fast-absorbing body lotion made for dry and sensitive skin that leaves no greasy film. Fragrance-free and non-comedogenic, so it suits everyday use on face and body.",
    bullets=["Hydrates dry, sensitive skin for up to 48 hours", "Light, non-greasy texture that absorbs quickly", "Fragrance-free and non-comedogenic", "Dermatologist-recommended formula"],
    howToUse="Apply liberally to clean skin as often as needed, or as directed. Massage gently until absorbed.",
    ingredients="Key ingredients: Glycerin, Sweet Almond Oil, Niacinamide (Vitamin B3), Panthenol (Pro-Vitamin B5), Vitamin E.",
    img=[{"code": "8906005273000", "bg": "trim", "alt": "Cetaphil Moisturising Lotion 250 ml bottle for dry, sensitive skin"}])

add(brand="cetaphil", name="Daily Facial Cleanser for Combination to Oily Skin", category="face", size="236 ml",
    mrp=1299, price=1099, rating=4.5, reviews=8640, concerns=["acne"], badge=None,
    tags=["face wash", "cleanser", "oily skin", "combination skin", "niacinamide", "foaming cleanser", "sensitive skin"],
    description="A gentle gel cleanser that lifts away dirt, oil and make-up without stripping combination to oily skin. Niacinamide and panthenol help keep skin feeling soft and balanced after every wash.",
    bullets=["Removes excess oil and make-up gently", "With niacinamide and panthenol", "Soap-free and fragrance-free", "Suitable for sensitive skin"],
    howToUse="Massage a small amount onto damp face in circular motions, then rinse with lukewarm water. Use morning and night.",
    ingredients="Key ingredients: Niacinamide, Panthenol (Pro-Vitamin B5), Glycerin.",
    img=[{"code": "3499320014519", "bg": "trim", "alt": "Cetaphil Daily Facial Cleanser pump bottle for combination to oily skin"}])

add(brand="cetaphil", name="Body Cream for Dry, Sensitive Skin", category="body", size="450 g",
    mrp=1899, price=1599, rating=4.6, reviews=3120, concerns=["dry"], badge="New",
    tags=["body cream", "dry skin", "sensitive skin", "moisturiser", "fragrance free", "intensive moisture"],
    description="A rich, cushiony body cream that comforts dry and sensitive skin and keeps it soft for 24 hours. The large tub makes it easy to use generously after every bath.",
    bullets=["Intensively moisturises for 24 hours", "Rich yet non-greasy cream texture", "Gentle on dry, sensitive skin", "Value-size 450 g tub"],
    howToUse="Apply generously to the body after bathing, focusing on dry areas. Reapply as needed.",
    ingredients="Key ingredients: Glycerin, Shea Butter, Panthenol (Pro-Vitamin B5), Niacinamide.",
    img=[{"code": "5020465201687", "bg": "trim", "alt": "Cetaphil Body Cream 450 g tub for dry, sensitive skin"}])

# ============ DOVE ============
add(brand="dove", name="Intense Repair Conditioner for Damaged Hair", category="hair", size="750 ml",
    mrp=1050, price=849, rating=4.4, reviews=14210, concerns=["frizz"], badge=None,
    tags=["conditioner", "damaged hair", "repair", "keratin", "dove conditioner", "frizz"],
    description="A creamy conditioner that smooths damaged lengths and helps reduce breakage and split-end look. Pair it with Dove Intense Repair Shampoo for softer, more manageable hair.",
    bullets=["Smooths and softens damaged hair", "Helps reduce breakage from combing", "Detangles for easy styling", "Large 750 ml pump pack"],
    howToUse="After shampooing, apply to lengths and ends. Leave for 1-2 minutes, then rinse thoroughly.",
    ingredients=None,
    img=[{"code": "0079400053121", "bg": "trim", "alt": "Dove Intense Repair conditioner 750 ml pump bottle"}])

add(brand="dove", name="Original Beauty Cream Bar (Pack of 2)", category="body", size="2 x 90 g",
    mrp=150, price=135, rating=4.6, reviews=58200, concerns=["dry"], badge="Bestseller",
    tags=["soap", "beauty bar", "bathing bar", "moisturising cream", "dry skin", "dove soap"],
    description="The classic Dove beauty bar with a quarter moisturising cream that cleanses without the tight, dry feel of ordinary soap. A gentle everyday choice for face and body.",
    bullets=["1/4 moisturising cream for soft skin", "Mild cleansers, gentler than ordinary soap", "Rich, creamy lather", "Plastic-free paper pack of two"],
    howToUse="Work the bar into a creamy lather with water, massage over face and body, then rinse.",
    ingredients="Key ingredients: Mild cleansers (Sodium Lauroyl Isethionate), Stearic Acid, 1/4 Moisturising Cream.",
    img=[{"code": "8720181481239", "bg": "trim", "alt": "Dove Original beauty cream bar, paper pack of two bars"}])

add(brand="dove", name="Care & Protect Beauty Bar", category="body", size="90 g",
    mrp=85, price=79, rating=4.5, reviews=12950, concerns=["dry"], badge=None,
    tags=["soap", "beauty bar", "antibacterial", "bathing bar", "moisturising", "care and protect"],
    description="A sulfate-free beauty bar with an antibacterial ingredient that washes away bacteria while caring for skin. Moisturising cream helps protect against the dryness of everyday washing.",
    bullets=["With an antibacterial ingredient", "Sulfate-free gentle cleansers", "Moisturising cream protects from dryness", "Mild enough for daily use"],
    howToUse="Lather between wet hands, massage onto skin and rinse well.",
    ingredients="Key ingredients: Sulfate-free mild cleansers, Moisturising Cream, Antibacterial ingredient.",
    img=[{"code": "8710522914090", "bg": "trim", "alt": "Dove Care & Protect beauty cream bar box"}])

add(brand="dove", name="Body Love Rich Nourishment Cream", category="body", size="150 ml",
    mrp=499, price=425, rating=4.5, reviews=6870, concerns=["dry"], badge="New",
    tags=["body cream", "face cream", "ceramide", "moisturiser", "dry skin", "body love"],
    description="A thick, nourishing cream for face and body enriched with a ceramide restoring serum for long-lasting softness. Ideal for dry patches on elbows, knees and hands.",
    bullets=["Up to 72 hours of moisture", "With ceramide restoring serum", "For face and body", "Rich, comforting texture"],
    howToUse="Massage onto clean face and body as often as needed, especially on dry areas.",
    ingredients="OBF",
    img=[{"code": "8717163476789", "bg": "trim", "alt": "Dove Body Love Rich Nourishment Cream tin, top view"}])

add(brand="dove", name="Original Anti-Perspirant Roll-On", category="body", size="50 ml",
    mrp=229, price=199, rating=4.4, reviews=21300, concerns=[], badge=None,
    tags=["deodorant", "roll on", "antiperspirant", "underarm", "women", "dove original"],
    description="A gentle roll-on with Dove's signature moisturising cream that gives 48-hour sweat and odour protection. Alcohol-free formula that is kind to underarm skin.",
    bullets=["48-hour anti-perspirant protection", "1/4 moisturising cream for underarm care", "0% alcohol formula", "Fresh, clean scent"],
    howToUse="Apply to clean, dry underarms. Allow to dry before dressing.",
    ingredients="Key ingredients: Aluminium Chlorohydrate, Sunflower Seed Oil, 1/4 Moisturising Cream.",
    img=[{"code": "59096771", "bg": "white", "max_up": 2.0, "alt": "Dove Original anti-perspirant roll-on"}])

add(brand="dove", name="Men+Care Extra Fresh Anti-Perspirant Spray", category="men", size="150 ml",
    mrp=299, price=255, rating=4.3, reviews=9840, concerns=[], badge=None,
    tags=["deodorant", "men deodorant", "body spray", "antiperspirant", "extra fresh", "men care"],
    description="A cooling anti-perspirant spray for men that keeps you feeling fresh and dry for 48 hours. Dove's moisturiser technology helps care for underarm skin.",
    bullets=["48-hour sweat and odour protection", "Cool, extra-fresh fragrance", "With skin-care moisturiser technology", "Quick-drying spray"],
    howToUse="Shake well and spray onto underarms from 15 cm. Avoid spraying on broken skin.",
    ingredients="Key ingredients: Aluminium Chlorohydrate, Sunflower Seed Oil, Fragrance.",
    img=[{"code": "8718114216478", "bg": "trim", "alt": "Dove Men+Care Extra Fresh anti-perspirant spray can"}])

add(brand="dove", name="Men+Care Fresh Clean 2-in-1 Shampoo + Conditioner", category="men", size="750 ml",
    mrp=999, price=829, rating=4.4, reviews=5320, concerns=["dandruff"], badge=None,
    tags=["men shampoo", "2 in 1", "conditioner", "fresh clean", "men care", "hair wash"],
    description="A two-in-one shampoo and conditioner for men that cleans and conditions in a single step. Leaves hair fresh, soft and easy to manage every day.",
    bullets=["Shampoo and conditioner in one", "Fresh, clean scent", "Strengthens hair against breakage", "Big 750 ml family pack"],
    howToUse="Massage into wet hair and scalp, lather, then rinse thoroughly.",
    ingredients=None,
    img=[{"code": "0079400189455", "bg": "trim", "alt": "Dove Men+Care Fresh Clean 2-in-1 shampoo and conditioner bottle"}])

add(brand="dove", name="Men+Care Extra Fresh Body + Face Wash", category="men", size="532 ml",
    mrp=699, price=599, rating=4.4, reviews=4110, concerns=["dry"], badge=None,
    tags=["men body wash", "face wash", "shower gel", "extra fresh", "men care", "cooling"],
    description="A cooling body and face wash for men with Micro Moisture technology that rinses clean without drying skin. One bottle for a quick, refreshing shower.",
    bullets=["For body and face", "Cooling extra-fresh feel", "Micro Moisture helps fight skin dryness", "Rich lather, rinses clean"],
    howToUse="Squeeze onto hands or a loofah, lather over wet body and face, then rinse.",
    ingredients="Key ingredients: Micro Moisture technology, Glycerin, Menthol (cooling agent).",
    img=[{"code": "0011111062184", "bg": "trim", "max_up": 2.1, "alt": "Dove Men+Care Extra Fresh body and face wash bottle"}])

add(brand="dove", name="Hydrating Care Body Wash with Aloe", category="body", size="450 ml",
    mrp=499, price=429, rating=4.5, reviews=7260, concerns=["dry"], badge=None,
    tags=["body wash", "shower gel", "aloe", "hydrating", "sulfate free", "dove body wash"],
    description="A refreshing body wash with aloe and birch water that leaves skin soft, hydrated and lightly fragranced. The sulfate-free formula is gentle enough for daily showers.",
    bullets=["With aloe and birch water", "Sulfate-free gentle cleansers", "Leaves skin soft and hydrated", "Fresh, light fragrance"],
    howToUse="Apply to wet skin with hands or a loofah, work into a lather and rinse well.",
    ingredients="Key ingredients: Aloe Vera, Birch Water, Glycerin.",
    img=[{"code": "8710847929052", "bg": "trim", "alt": "Dove Hydrating Care body wash with aloe"}])

# ============ GARNIER ============
add(brand="garnier", name="Micellar Vitamin C Cleansing Water", category="face", size="400 ml",
    mrp=549, price=469, rating=4.4, reviews=11870, concerns=["dull"], badge="New",
    tags=["micellar water", "makeup remover", "vitamin c", "cleanser", "brightening", "dull skin"],
    description="A no-rinse micellar water with vitamin C that lifts away make-up, dirt and oil in one swipe. Leaves skin feeling fresh and looking brighter.",
    bullets=["Removes make-up, cleanses and brightens", "With vitamin C", "No rinsing or harsh rubbing needed", "Suitable for face, eyes and lips"],
    howToUse="Soak a cotton pad and gently wipe over face, eyes and lips. No need to rinse.",
    ingredients="Key ingredients: Micelles, Vitamin C (Ascorbyl Glucoside), Glycerin.",
    img=[{"code": "3600542444019", "bg": "trim", "alt": "Garnier SkinActive Micellar Vitamin C cleansing water bottle"}])

add(brand="garnier", name="SkinActive Micellar Foaming Face Wash", category="face", size="200 ml",
    mrp=599, price=499, rating=4.3, reviews=4380, concerns=[], badge=None,
    tags=["face wash", "micellar", "foaming cleanser", "makeup remover", "sensitive skin"],
    description="A gentle foaming cleanser powered by micelles that removes make-up and impurities in one rinse. Leaves skin clean and refreshed without harsh rubbing.",
    bullets=["All-in-1: cleanses and removes make-up", "Light foam rinses off easily", "Suitable for all skin types", "Fragrance-free formula"],
    howToUse="Pump 2-3 times onto damp hands, massage onto face, then rinse with water.",
    ingredients=None,
    img=[{"code": "0603084512843", "bg": "trim", "alt": "Garnier SkinActive Micellar Foaming Cleanser pump bottle"}])

add(brand="garnier", name="Ultimate Blends Hair Food Aloe Vera 3-in-1 Hair Mask", category="hair", size="390 ml",
    mrp=799, price=649, rating=4.4, reviews=9610, concerns=["dry"], badge="Bestseller",
    tags=["hair mask", "hair food", "aloe vera", "conditioner", "leave in", "normal hair"],
    description="A 3-in-1 hair mask with aloe vera that can be used as a conditioner, a mask or a leave-in for light, bouncy hair. The vegan formula has 98% ingredients of natural origin.",
    bullets=["Use as conditioner, mask or leave-in", "Moisturises without weighing hair down", "98% natural-origin ingredients", "Vegan formula, no silicones"],
    howToUse="Apply to washed, towel-dried hair. Rinse after 1 minute as a conditioner, 3 minutes as a mask, or leave in on dry ends.",
    ingredients="Key ingredients: Aloe Vera, Coconut.",
    img=[{"code": "3600542231558", "bg": "trim", "alt": "Garnier Ultimate Blends Hair Food Aloe Vera 3-in-1 hair mask jar"}])

add(brand="garnier", name="Ultimate Blends Hair Food Papaya & Amla 3-in-1 Hair Mask", category="hair", size="390 ml",
    mrp=799, price=649, rating=4.4, reviews=7420, concerns=["frizz"], badge=None,
    tags=["hair mask", "hair food", "papaya", "amla", "damaged hair", "repair"],
    description="A repairing 3-in-1 mask with papaya and amla for damaged hair that needs extra softness. Works as a conditioner, an intense mask or a leave-in treatment.",
    bullets=["Repairs the look of damaged hair", "With papaya and amla", "Conditioner, mask or leave-in", "98% natural-origin, vegan formula"],
    howToUse="Apply to washed, towel-dried hair. Rinse after 1-3 minutes, or leave a small amount on dry ends.",
    ingredients="Key ingredients: Papaya, Amla.",
    img=[{"code": "3600542231565", "bg": "trim", "alt": "Garnier Ultimate Blends Hair Food Papaya & Amla hair mask jar"}])

add(brand="garnier", name="Ultimate Blends Hair Food Banana & Shea 3-in-1 Hair Mask", category="hair", size="390 ml",
    mrp=799, price=649, rating=4.5, reviews=10380, concerns=["dry"], badge=None,
    tags=["hair mask", "hair food", "banana", "shea", "dry hair", "nourishing"],
    description="A nourishing 3-in-1 mask with banana and shea for dry hair that feels rough. Melts in to leave lengths soft, supple and easy to detangle.",
    bullets=["Nourishes dry hair", "With banana and shea", "Conditioner, mask or leave-in", "No silicones, vegan formula"],
    howToUse="Apply to washed, towel-dried hair. Rinse after 1-3 minutes, or leave a small amount on dry ends.",
    ingredients="Key ingredients: Banana, Shea.",
    img=[{"code": "3600542231572", "bg": "trim", "alt": "Garnier Ultimate Blends Hair Food Banana & Shea hair mask jar"}])

add(brand="garnier", name="Ultimate Blends Hair Food Coconut & Macadamia 3-in-1 Hair Mask", category="hair", size="390 ml",
    mrp=799, price=649, rating=4.4, reviews=6120, concerns=["frizz"], badge=None,
    tags=["hair mask", "hair food", "coconut", "macadamia", "frizzy hair", "smoothing"],
    description="A smoothing 3-in-1 mask with coconut and macadamia for frizzy, unruly hair. Helps tame flyaways and leaves hair touchably soft.",
    bullets=["Smooths frizzy, unruly hair", "With coconut and macadamia", "Conditioner, mask or leave-in", "98% natural-origin, vegan formula"],
    howToUse="Apply to washed, towel-dried hair. Rinse after 1-3 minutes, or leave a small amount on dry ends.",
    ingredients="Key ingredients: Coconut, Macadamia.",
    img=[{"code": "3600542231589", "bg": "trim", "alt": "Garnier Ultimate Blends Hair Food Coconut & Macadamia hair mask jar"}])

add(brand="garnier", name="Ultimate Blends Hair Food Papaya Repairing Conditioner", category="hair", size="350 ml",
    mrp=499, price=425, rating=4.3, reviews=3270, concerns=["frizz"], badge=None,
    tags=["conditioner", "hair food", "papaya", "coconut", "damaged hair", "silicone free"],
    description="A repairing conditioner with papaya and coconut that detangles damaged hair and adds softness. Comes in a 100% recycled bottle.",
    bullets=["Detangles and softens damaged hair", "With papaya and coconut", "No silicones", "Vegan formula"],
    howToUse="After shampooing, apply to lengths and ends, leave for a minute and rinse.",
    ingredients="Key ingredients: Papaya, Coconut.",
    img=[{"code": "3600542342650", "bg": "trim", "alt": "Garnier Ultimate Blends Repairing Hair Food Papaya conditioner bottle"}])

add(brand="garnier", name="Color Naturals Crème Riche Hair Colour, 1 Natural Black", category="hair", size="1 application",
    mrp=299, price=249, rating=4.3, reviews=18740, concerns=[], badge=None,
    tags=["hair colour", "hair dye", "natural black", "no ammonia", "grey coverage", "color naturals"],
    description="A nourishing permanent crème hair colour in Natural Black with up to 100% grey coverage and no ammonia. Enriched with natural oils for rich, long-lasting colour.",
    bullets=["Natural Black shade, up to 100% grey coverage", "No ammonia", "Enriched with nourishing oils", "Long-lasting, glossy colour"],
    howToUse="Do an allergy test 48 hours before use. Mix the colour cream and developer, apply to dry hair, leave for 30 minutes and rinse; follow with the conditioner.",
    ingredients="Key ingredients: Avocado Oil, Olive Oil, Shea Oil.",
    img=[{"code": "8901526204731", "bg": "keep", "quad": [130, 186, 232, 3606, 1970, 3497, 1898, 188], "alt": "Garnier Color Naturals Crème Riche 1 Natural Black hair colour box"}])

# ============ L'ORÉAL PARIS ============
add(brand="loreal", name="Lash Paradise Volume Mascara, Black", category="makeup", size="6.4 ml",
    mrp=999, price=849, rating=4.4, reviews=16420, concerns=[], badge="Bestseller",
    tags=["mascara", "volume", "lashes", "black", "eye makeup", "lash paradise"],
    description="A volumising mascara with a soft, full brush that coats every lash for a feathery, fuller look. Builds easily without clumping.",
    bullets=["Instant volume and length", "Soft, wavy bristle brush", "Buildable, clump-free formula", "Intense black colour"],
    howToUse="Sweep from the root of the lashes to the tips with a zig-zag motion. Add coats for more volume.",
    ingredients="Key ingredients: Castor Oil, Beeswax, Black Iron Oxide (CI 77499).",
    img=[{"code": "30161443", "bg": "trim", "max_up": 1.85, "alt": "L'Oréal Paris Lash Paradise mascara in black"}])

add(brand="loreal", name="Color Riche Satin Lipstick, La Prune", category="makeup", size="4.5 g",
    mrp=849, price=699, rating=4.3, reviews=5840, concerns=[], badge=None,
    tags=["lipstick", "satin", "lip colour", "plum", "color riche", "makeup"],
    description="A creamy satin lipstick with rich colour payoff and a comfortable, moisturising feel. The plum-pink La Prune shade flatters Indian skin tones.",
    bullets=["Rich, creamy satin finish", "Comfortable, moisturising wear", "High colour payoff in one swipe", "Iconic gold case"],
    howToUse="Apply directly from the bullet starting at the centre of the lips and working outwards.",
    ingredients="Key ingredients: Argan Oil, Vitamin E, Jojoba Oil.",
    img=[{"code": "3600524187644", "bg": "trim", "max_up": 1.85, "alt": "L'Oréal Paris Color Riche satin lipstick in La Prune"}])

add(brand="loreal", name="True Match Super-Blendable Foundation", category="makeup", size="30 ml",
    mrp=1199, price=999, rating=4.3, reviews=7360, concerns=[], badge=None,
    tags=["foundation", "liquid foundation", "true match", "natural finish", "hyaluronic acid", "makeup base"],
    description="A lightweight liquid foundation that matches skin tone and texture for a natural, second-skin finish. Infused with hyaluronic acid for a comfortable, hydrated feel.",
    bullets=["Natural, skin-like finish", "Medium, buildable coverage", "With hyaluronic acid", "Wide range of shades"],
    howToUse="Shake well. Apply from the centre of the face outwards with fingers, a brush or a sponge.",
    ingredients="Key ingredients: Hyaluronic Acid, Glycerin.",
    img=[{"code": "3600524188467", "bg": "trim", "max_up": 1.85, "alt": "L'Oréal Paris True Match Super-Blendable foundation bottle"}])

add(brand="loreal", name="Infallible 24H Matte Cover Foundation", category="makeup", size="30 ml",
    mrp=1099, price=899, rating=4.3, reviews=9280, concerns=[], badge=None,
    tags=["foundation", "matte foundation", "full coverage", "oil control", "infallible", "long wear"],
    description="A long-wear matte foundation with full coverage that stays put through heat and humidity for up to 24 hours. Controls shine while feeling light on skin.",
    bullets=["Up to 24H wear", "Full coverage, matte finish", "Transfer- and sweat-resistant", "Lightweight feel"],
    howToUse="Squeeze a small amount and blend from the centre of the face outwards. Build in thin layers.",
    ingredients=None,
    img=[{"code": "3600523783809", "bg": "trim", "max_up": 1.8, "alt": "L'Oréal Paris Infallible 24H Matte Cover foundation tube"}])

add(brand="loreal", name="Infallible More Than Concealer", category="makeup", size="11 ml",
    mrp=999, price=849, rating=4.4, reviews=4970, concerns=["darkcircles"], badge=None,
    tags=["concealer", "full coverage", "dark circles", "infallible", "makeup", "long wear"],
    description="A full-coverage, long-wear concealer with an oversized applicator that covers dark circles and spots in one stroke. Stays crease-free all day.",
    bullets=["Full coverage in one stroke", "Long-wear, crease-free finish", "Oversized doe-foot applicator", "Covers dark circles and blemishes"],
    howToUse="Dot under the eyes and on any spots, then blend with a fingertip or sponge.",
    ingredients="Key ingredients: Titanium Dioxide and Iron Oxide pigments, Glycerin.",
    img=[{"code": "30173620", "bg": "trim", "max_up": 1.8, "alt": "L'Oréal Paris Infallible More Than Concealer"}])

add(brand="loreal", name="Extraordinary Oil Serum for All Hair Types", category="oil", size="100 ml",
    mrp=699, price=579, rating=4.5, reviews=24860, concerns=["frizz", "dry"], badge="Bestseller",
    tags=["hair serum", "hair oil", "extraordinary oil", "frizz", "shine", "dry hair"],
    description="A lightweight hair serum blended with six precious flower oils that tames frizz and adds glossy shine. Use it before styling or as a finishing touch.",
    bullets=["Tames frizz and flyaways", "Adds instant shine", "Light, non-greasy feel", "Blend of six flower oils"],
    howToUse="Warm 1-2 pumps between palms and smooth over damp or dry lengths and ends. Do not rinse.",
    ingredients="Key ingredients: Chamomile, Linseed, Lotus, Rose, Tiare and Camellia flower extracts, Coconut Oil, Sunflower Seed Oil.",
    img=[{"code": "3600522263685", "bg": "trim", "alt": "L'Oréal Paris Extraordinary Oil hair serum pump bottle"}])

add(brand="loreal", name="Dream Lengths Detangling Conditioner", category="hair", size="180 ml",
    mrp=299, price=254, rating=4.3, reviews=6710, concerns=["frizz"], badge=None,
    tags=["conditioner", "long hair", "detangling", "split ends", "dream lengths"],
    description="A detangling conditioner for long hair that helps smooth lengths and reduce the look of split ends. Leaves hair soft and easier to comb.",
    bullets=["Detangles long hair", "Helps reduce the look of split ends", "Smooth, soft finish", "For long, damaged hair"],
    howToUse="After shampooing, apply to lengths and ends, leave for 1-2 minutes and rinse.",
    ingredients="Key ingredients: Castor Oil, Vitamins, Plant Proteins.",
    img=[{"code": "8901526592432", "bg": "trim", "max_up": 1.6, "alt": "L'Oréal Paris Dream Lengths detangling conditioner bottle"}])

add(brand="loreal", name="Fall Resist 3X Anti-Hairfall Shampoo", category="hair", size="650 ml",
    mrp=769, price=629, rating=4.3, reviews=11930, concerns=["hairfall"], badge=None,
    tags=["shampoo", "anti hairfall", "hair fall", "arginine", "strengthening", "fall resist"],
    description="An anti-hairfall shampoo with arginine essence that strengthens hair from root to tip to reduce breakage. The family-size pump pack lasts for weeks.",
    bullets=["Reduces hair fall due to breakage", "With arginine essence", "Strengthens fragile hair", "Value 650 ml pump pack"],
    howToUse="Apply to wet hair, massage into a lather, then rinse. Follow with the matching conditioner.",
    ingredients="Key ingredients: Arginine.",
    img=[{"code": "8901526102655", "bg": "kmeans", "kmeans": {"opening": 7}, "erase": [[0, 4800, 375, 6317], [2200, 4800, 2415, 6317]], "alt": "L'Oréal Paris Fall Resist 3X anti-hairfall shampoo pump bottle"}])

# ============ NIVEA ============
add(brand="nivea", name="Creme All-Season Multi-Purpose Cream", category="skin", size="150 ml",
    mrp=299, price=265, rating=4.6, reviews=48720, concerns=["dry"], badge="Bestseller",
    tags=["nivea creme", "moisturiser", "body cream", "face cream", "multi purpose", "dry skin"],
    description="The iconic blue-tin crème that intensively moisturises face, hands and body in every season. Its rich formula with Eucerit protects skin from dryness.",
    bullets=["Intensive moisture for face, hands and body", "Rich, protective formula with Eucerit", "Suitable for the whole family", "Classic 150 ml tin"],
    howToUse="Apply evenly to face and body as often as needed. Massage gently until absorbed.",
    ingredients="Key ingredients: Glycerin, Eucerit, Panthenol.",
    img=[{"code": "4005900946164", "bg": "trim", "alt": "Nivea Creme 150 ml blue tin, top view"},
         {"code": "8412300801072", "bg": "trim", "alt": "Nivea Creme blue tin, angled view"}])

add(brand="nivea", name="Original Care Lip Balm", category="skin", size="4.8 g",
    mrp=225, price=199, rating=4.5, reviews=21960, concerns=["dry"], badge=None,
    tags=["lip balm", "lip care", "chapped lips", "jojoba oil", "shea butter", "moisture"],
    description="A caring lip balm with shea butter and organic jojoba oil that keeps lips soft and moisturised all day. A pocket essential for dry weather.",
    bullets=["Long-lasting moisture", "With shea butter and jojoba oil", "Smooth, non-sticky feel", "Everyday lip care"],
    howToUse="Apply to lips as often as needed throughout the day.",
    ingredients="OBF",
    img=[{"code": "4005900567932", "bg": "trim", "alt": "Nivea Original Care lip balm in blister pack"}])

add(brand="nivea", name="Men Sensitive Shower Gel for Body, Face & Hair", category="men", size="250 ml",
    mrp=299, price=259, rating=4.4, reviews=6930, concerns=[], badge=None,
    tags=["men shower gel", "body wash", "sensitive skin", "3 in 1", "bamboo", "men"],
    description="A soothing 3-in-1 shower gel for men's body, face and hair with bamboo extract. Cleans gently without irritating sensitive skin.",
    bullets=["3-in-1 for body, face and hair", "With bamboo extract", "Gentle on sensitive skin", "Fresh, light fragrance"],
    howToUse="Lather over wet body, face and hair, then rinse thoroughly.",
    ingredients="Key ingredients: Bamboo Extract.",
    img=[{"code": "4005808702169", "bg": "trim", "alt": "Nivea Men Sensitive shower gel bottle"}])

add(brand="nivea", name="Naturally Good Aloe Vera Body Lotion", category="body", size="200 ml",
    mrp=399, price=339, rating=4.4, reviews=4210, concerns=["dry"], badge=None,
    tags=["body lotion", "aloe vera", "natural", "moisturiser", "normal skin", "naturally good"],
    description="A light body lotion with organic aloe vera and 98% ingredients of natural origin that hydrates normal to dry skin. Packed in a bottle made with recycled plastic.",
    bullets=["98% natural-origin ingredients", "With organic aloe vera", "Light, quick-absorbing texture", "Bottle with recycled plastic"],
    howToUse="Apply evenly to the body after bathing and massage until absorbed.",
    ingredients="OBF",
    img=[{"code": "4005900784322", "bg": "trim", "alt": "Nivea Naturally Good aloe vera body lotion bottle"}])

add(brand="nivea", name="Men Creme for Face, Body & Hands", category="men", size="150 ml",
    mrp=299, price=265, rating=4.5, reviews=19870, concerns=["dry"], badge=None,
    tags=["men cream", "moisturiser", "face cream", "nivea men", "non greasy", "all purpose cream"],
    description="An all-purpose moisturising creme for men that absorbs quickly into face, body and hands without a greasy feel. Vitamin E helps keep skin soft and comfortable through shaving and sun.",
    bullets=["For face, body and hands", "Absorbs quickly, non-greasy", "With Vitamin E", "Handy 150 ml tin"],
    howToUse="Apply to face, body and hands daily, especially after shaving or washing. Massage until absorbed.",
    ingredients="OBF",
    img=[{"code": "4005900107305", "bg": "shape", "shapes": [{"ellipse": [100, 290, 2905, 3005]}], "alt": "Nivea Men Creme tin, top view"}])

add(brand="nivea", name="Shea Smooth Body Lotion for Dry Skin", category="body", size="625 ml",
    mrp=899, price=749, rating=4.5, reviews=5480, concerns=["dry"], badge=None,
    tags=["body lotion", "shea butter", "dry skin", "48h moisture", "pump bottle"],
    description="A smoothing body lotion with shea butter that gives dry skin 48 hours of moisture. The big pump bottle makes daily use easy for the whole family.",
    bullets=["48-hour moisture for dry skin", "With shea butter", "Smooth, non-greasy feel", "Large 625 ml pump bottle"],
    howToUse="Apply evenly to the body after bathing and massage until absorbed.",
    ingredients="Key ingredients: Shea Butter, Glycerin.",
    img=[{"code": "4005808713059", "bg": "trim", "alt": "Nivea Shea Smooth body lotion 625 ml pump bottle"}])
