"""Reference data for Western Ghats bird and frog species.

YAMNet only recognises *generic* audio classes (e.g. "Bird", "Frog"), so the
pipeline works in two stages:

1. ``CATEGORY_YAMNET_CLASSES`` maps generic YAMNet labels to an animal
   category (bird / frog).
2. Within a category, a dominant-frequency heuristic picks the most likely
   Western Ghats species from the table below (``freq_low_hz`` /
   ``freq_high_hz`` approximate each species' typical call band).

The frequency bands are practical approximations compiled for the MVP —
they are good enough to route a generic "bird" detection to a plausible
species, not an authoritative acoustic reference.
"""

SPECIES_REFERENCE = {
    "bird": [
        {
            "common_name": "Malabar Grey Hornbill",
            "scientific_name": "Ocyceros griseus",
            "habitat": "Evergreen and moist deciduous forests, low to mid elevations",
            "call_description": "Loud cackling and maniacal laughing calls",
            "freq_low_hz": 900,
            "freq_high_hz": 3000,
        },
        {
            "common_name": "Great Hornbill",
            "scientific_name": "Buceros bicornis",
            "habitat": "Tall wet evergreen forests, protected areas",
            "call_description": "Deep resonant barks and loud whooshing wingbeats",
            "freq_low_hz": 400,
            "freq_high_hz": 2000,
        },
        {
            "common_name": "Malabar Trogon",
            "scientific_name": "Harpactes fasciatus",
            "habitat": "Dense evergreen forests, shaded ravines",
            "call_description": "Soft throaty 'quack' series",
            "freq_low_hz": 700,
            "freq_high_hz": 2200,
        },
        {
            "common_name": "Malabar Whistling Thrush",
            "scientific_name": "Myophonus horsfieldii",
            "habitat": "Hill streams and rocky rivers near evergreen forest",
            "call_description": "Human-like whistling song at dawn",
            "freq_low_hz": 1400,
            "freq_high_hz": 4200,
        },
        {
            "common_name": "White-bellied Treepie",
            "scientific_name": "Dendrocitta leucogastra",
            "habitat": "Evergreen forest canopy, mixed hunting parties",
            "call_description": "Harsh chuckling and metallic notes",
            "freq_low_hz": 1400,
            "freq_high_hz": 5200,
        },
        {
            "common_name": "Yellow-browed Bulbul",
            "scientific_name": "Acritillas indica",
            "habitat": "Shrubbery and forest edge, tea estates",
            "call_description": "Mellow bubbling song",
            "freq_low_hz": 1800,
            "freq_high_hz": 4600,
        },
        {
            "common_name": "Flame-throated Bulbul",
            "scientific_name": "Rubigula gularis",
            "habitat": "Forest edges and secondary growth of southern Ghats",
            "call_description": "Cheerful repeated warbling phrases",
            "freq_low_hz": 2000,
            "freq_high_hz": 5000,
        },
        {
            "common_name": "White-bellied Blue Flycatcher",
            "scientific_name": "Cyornis pallidipes",
            "habitat": "Wet evergreen forest undergrowth",
            "call_description": "Sweet descending whistled phrases",
            "freq_low_hz": 2300,
            "freq_high_hz": 6000,
        },
        {
            "common_name": "Black-and-orange Flycatcher",
            "scientific_name": "Ficedula nigrorufa",
            "habitat": "Shola forests and edges of the Nilgiris and higher hills",
            "call_description": "Thin whistled 'tsee-tsee' phrases",
            "freq_low_hz": 2800,
            "freq_high_hz": 7000,
        },
        {
            "common_name": "Nilgiri Flycatcher",
            "scientific_name": "Eumyias albicaudatus",
            "habitat": "Upper-elevation shola forest and plantations",
            "call_description": "Repeated wheezy whistles",
            "freq_low_hz": 2600,
            "freq_high_hz": 6500,
        },
        {
            "common_name": "Wayanad Laughingthrush",
            "scientific_name": "Montecincla jerdoni",
            "habitat": "Dense undergrowth of southern Ghats evergreen forest",
            "call_description": "Noisy chattering and chuckling duets",
            "freq_low_hz": 900,
            "freq_high_hz": 3400,
        },
        {
            "common_name": "Nilgiri Laughingthrush",
            "scientific_name": "Montecincla cachinnans",
            "habitat": "Shola edges and bracken slopes of the Nilgiris",
            "call_description": "Rolling laughing calls in groups",
            "freq_low_hz": 1300,
            "freq_high_hz": 4000,
        },
        {
            "common_name": "Rufous Babbler",
            "scientific_name": "Argya subrufa",
            "habitat": "Lantana scrub and forest edges of the southern Ghats",
            "call_description": "Constant babbling and squeaky chatter",
            "freq_low_hz": 1000,
            "freq_high_hz": 3200,
        },
        {
            "common_name": "Malabar Barbet",
            "scientific_name": "Psilopogon malabaricus",
            "habitat": "Evergreen forest canopy and adjacent fruiting trees",
            "call_description": "Far-carrying 'poo-boo' duet calls",
            "freq_low_hz": 600,
            "freq_high_hz": 1900,
        },
        {
            "common_name": "Crimson-backed Sunbird",
            "scientific_name": "Leptocoma minima",
            "habitat": "Forest canopy and flower gardens, southern Ghats",
            "call_description": "High thin 'chee-chee' and rapid rattling song",
            "freq_low_hz": 2800,
            "freq_high_hz": 8000,
        },
        {
            "common_name": "Nilgiri Wood Pigeon",
            "scientific_name": "Columba elphinstonii",
            "habitat": "Mountain evergreen forest, hill stations",
            "call_description": "Low muffled hoots",
            "freq_low_hz": 350,
            "freq_high_hz": 1300,
        },
        {
            "common_name": "Malabar Parakeet",
            "scientific_name": "Psittacula columboides",
            "habitat": "Evergreen and moist deciduous forest, ghats slopes",
            "call_description": "Loud screeching in flight",
            "freq_low_hz": 1100,
            "freq_high_hz": 4200,
        },
        {
            "common_name": "Malabar Starling",
            "scientific_name": "Sturnia blythii",
            "habitat": "Open forest and cultivated areas of the western Ghats",
            "call_description": "Chattering whistles and mimicry",
            "freq_low_hz": 1400,
            "freq_high_hz": 4200,
        },
        {
            "common_name": "Grey Junglefowl",
            "scientific_name": "Gallus sonneratii",
            "habitat": "Bamboo brakes and forest undergrowth",
            "call_description": "Loud breaking 'kuk-kur-kuk' dawn calls",
            "freq_low_hz": 700,
            "freq_high_hz": 2200,
        },
        {
            "common_name": "Sri Lanka Frogmouth",
            "scientific_name": "Batrachostomus moniliger",
            "habitat": "Dense evergreen forest understorey, night",
            "call_description": "Frog-like croaking duets at dusk",
            "freq_low_hz": 900,
            "freq_high_hz": 2600,
        },
    ],
    "frog": [
        {
            "common_name": "Indian Bullfrog",
            "scientific_name": "Hoplobatrachus tigerinus",
            "habitat": "Ponds, paddy fields and marshes, monsoon",
            "call_description": "Deep booming croaks in choruses",
            "freq_low_hz": 150,
            "freq_high_hz": 700,
        },
        {
            "common_name": "Common Indian Toad",
            "scientific_name": "Duttaphrynus melanostictus",
            "habitat": "Gardens, drains and forest edges, monsoon nights",
            "call_description": "Rhythmic high trills",
            "freq_low_hz": 600,
            "freq_high_hz": 2500,
        },
        {
            "common_name": "Malabar Gliding Frog",
            "scientific_name": "Rhacophorus malabaricus",
            "habitat": "Forest canopy near streams, breeds in foam nests",
            "call_description": "Chirping 'tak-tak' calls",
            "freq_low_hz": 800,
            "freq_high_hz": 2600,
        },
        {
            "common_name": "Bombay Night Frog",
            "scientific_name": "Nyctibatrachus humayuni",
            "habitat": "Streams and boulders of evergreen forest, night",
            "call_description": "Short cricket-like pulses",
            "freq_low_hz": 700,
            "freq_high_hz": 2200,
        },
        {
            "common_name": "Resplendent Bush Frog",
            "scientific_name": "Raorchestes resplendens",
            "habitat": "High-altitude shola grasslands of the Anamalai hills",
            "call_description": "High insect-like chirps",
            "freq_low_hz": 2500,
            "freq_high_hz": 6000,
        },
        {
            "common_name": "Amboli Bush Frog",
            "scientific_name": "Pseudophilautus amboli",
            "habitat": "Lateritic plateaus and forest edges around Amboli",
            "call_description": "Rapid clicking chirps",
            "freq_low_hz": 2000,
            "freq_high_hz": 5000,
        },
        {
            "common_name": "Indian Chorus Frog",
            "scientific_name": "Microhyla ornata",
            "habitat": "Seasonal puddles, paddy fields and ditches",
            "call_description": "Cricket-like synchronous chirps",
            "freq_low_hz": 2400,
            "freq_high_hz": 5500,
        },
        {
            "common_name": "Kerala Wart Frog",
            "scientific_name": "Minervarya keralensis",
            "habitat": "Marshy pools and stream edges of the southern Ghats",
            "call_description": "Pulsed rattling calls",
            "freq_low_hz": 1200,
            "freq_high_hz": 3500,
        },
        {
            "common_name": "Brown Leaping Frog",
            "scientific_name": "Indirana semipalmata",
            "habitat": "Wet rock faces near forest streams",
            "call_description": "Sharp repetitive chirps",
            "freq_low_hz": 1500,
            "freq_high_hz": 4000,
        },
        {
            "common_name": "Purple Frog",
            "scientific_name": "Nasikabatrachus sahyadrensis",
            "habitat": "Underground near streams; surfaces only in monsoon",
            "call_description": "Unusual drawn-out 'baaa' calls from burrows",
            "freq_low_hz": 800,
            "freq_high_hz": 3000,
        },
    ],
}

# Generic YAMNet (AudioSet) labels that indicate each category. The names must
# match yamnet_class_map.csv exactly.
CATEGORY_YAMNET_CLASSES = {
    "bird": [
        "Bird",
        "Bird vocalization, bird call, bird song",
        "Bird flight, flapping wings",
        "Chirp, tweet",
        "Squawk",
        "Coo",
        "Cluck",
        "Owl",
        "Hoot",
        "Chicken, rooster",
        "Crowing, cock-a-doodle-doo",
    ],
    "frog": [
        "Frog",
        "Croak",
    ],
}

# Confidence multipliers for the frequency-based species heuristic.
IN_BAND_PRIOR = 0.95      # dominant frequency falls inside the species' band
NEAREST_BAND_PRIOR = 0.80  # no band matched; nearest band centre chosen


def species_rows():
    """Flatten the reference table into rows for the SpeciesReference table."""
    rows = []
    for category, species_list in SPECIES_REFERENCE.items():
        for item in species_list:
            rows.append(
                {
                    "species_name": item["scientific_name"].lower().replace(" ", "_"),
                    "common_name": item["common_name"],
                    "scientific_name": item["scientific_name"],
                    "category": category,
                    "habitat": item["habitat"],
                    "freq_low_hz": item["freq_low_hz"],
                    "freq_high_hz": item["freq_high_hz"],
                }
            )
    return rows


def candidates_for_category(category):
    """Return the species list for one category (used by the ML heuristic)."""
    return SPECIES_REFERENCE.get(category, [])
