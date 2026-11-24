# The 214 Kangxi radicals, indexed by number (1-based), as (character, English name).
KANGXI = [
    None,
    ("一", "one"), ("丨", "line"), ("丶", "dot"), ("丿", "slash"), ("乙", "second"),
    ("亅", "hook"), ("二", "two"), ("亠", "lid"), ("人", "person"), ("儿", "legs"),
    ("入", "enter"), ("八", "eight"), ("冂", "upside-down box"), ("冖", "cover"), ("冫", "ice"),
    ("几", "table"), ("凵", "open box"), ("刀", "knife"), ("力", "power"), ("勹", "wrap"),
    ("匕", "spoon"), ("匚", "box"), ("匸", "hiding enclosure"), ("十", "ten"), ("卜", "divination"),
    ("卩", "seal"), ("厂", "cliff"), ("厶", "private"), ("又", "right hand"), ("口", "mouth"),
    ("囗", "enclosure"), ("土", "earth"), ("士", "samurai"), ("夂", "go"), ("夊", "go slowly"),
    ("夕", "evening"), ("大", "big"), ("女", "woman"), ("子", "child"), ("宀", "roof"),
    ("寸", "inch"), ("小", "small"), ("尢", "lame"), ("尸", "corpse"), ("屮", "sprout"),
    ("山", "mountain"), ("巛", "river"), ("工", "work"), ("己", "oneself"), ("巾", "cloth"),
    ("干", "dry"), ("幺", "short thread"), ("广", "house on cliff"), ("廴", "long stride"), ("廾", "two hands"),
    ("弋", "shoot"), ("弓", "bow"), ("彐", "snout"), ("彡", "hair"), ("彳", "step"),
    ("心", "heart"), ("戈", "halberd"), ("戸", "door"), ("手", "hand"), ("支", "branch"),
    ("攴", "strike"), ("文", "writing"), ("斗", "dipper"), ("斤", "axe"), ("方", "direction"),
    ("无", "not"), ("日", "sun"), ("曰", "say"), ("月", "moon"), ("木", "tree"),
    ("欠", "yawn"), ("止", "stop"), ("歹", "death"), ("殳", "weapon"), ("毋", "do not"),
    ("比", "compare"), ("毛", "fur"), ("氏", "clan"), ("气", "steam"), ("水", "water"),
    ("火", "fire"), ("爪", "claw"), ("父", "father"), ("爻", "trigrams"), ("爿", "split wood"),
    ("片", "slice"), ("牙", "fang"), ("牛", "cow"), ("犬", "dog"), ("玄", "dark"),
    ("玉", "jade"), ("瓜", "melon"), ("瓦", "tile"), ("甘", "sweet"), ("生", "life"),
    ("用", "use"), ("田", "rice field"), ("疋", "bolt of cloth"), ("疒", "sickness"), ("癶", "footsteps"),
    ("白", "white"), ("皮", "skin"), ("皿", "dish"), ("目", "eye"), ("矛", "spear"),
    ("矢", "arrow"), ("石", "stone"), ("示", "altar"), ("禸", "track"), ("禾", "grain"),
    ("穴", "hole"), ("立", "stand"), ("竹", "bamboo"), ("米", "rice"), ("糸", "thread"),
    ("缶", "jar"), ("网", "net"), ("羊", "sheep"), ("羽", "feather"), ("老", "old"),
    ("而", "and"), ("耒", "plow"), ("耳", "ear"), ("聿", "brush"), ("肉", "meat"),
    ("臣", "retainer"), ("自", "self"), ("至", "arrive"), ("臼", "mortar"), ("舌", "tongue"),
    ("舛", "oppose"), ("舟", "boat"), ("艮", "stopping"), ("色", "color"), ("艸", "grass"),
    ("虍", "tiger"), ("虫", "insect"), ("血", "blood"), ("行", "go"), ("衣", "clothes"),
    ("襾", "cover"), ("見", "see"), ("角", "horn"), ("言", "speech"), ("谷", "valley"),
    ("豆", "bean"), ("豕", "pig"), ("豸", "badger"), ("貝", "shell"), ("赤", "red"),
    ("走", "run"), ("足", "foot"), ("身", "body"), ("車", "cart"), ("辛", "bitter"),
    ("辰", "morning"), ("辵", "walk"), ("邑", "town"), ("酉", "sake jar"), ("釆", "distinguish"),
    ("里", "village"), ("金", "metal"), ("長", "long"), ("門", "gate"), ("阜", "hill"),
    ("隶", "capture"), ("隹", "small bird"), ("雨", "rain"), ("青", "blue"), ("非", "wrong"),
    ("面", "face"), ("革", "leather"), ("韋", "tanned leather"), ("韭", "leek"), ("音", "sound"),
    ("頁", "head"), ("風", "wind"), ("飛", "fly"), ("食", "eat"), ("首", "neck"),
    ("香", "fragrance"), ("馬", "horse"), ("骨", "bone"), ("高", "tall"), ("髟", "long hair"),
    ("鬥", "fight"), ("鬯", "herbs"), ("鬲", "cauldron"), ("鬼", "ghost"), ("魚", "fish"),
    ("鳥", "bird"), ("鹵", "salt"), ("鹿", "deer"), ("麦", "wheat"), ("麻", "hemp"),
    ("黄", "yellow"), ("黍", "millet"), ("黒", "black"), ("黹", "embroidery"), ("黽", "frog"),
    ("鼎", "tripod"), ("鼓", "drum"), ("鼠", "rat"), ("鼻", "nose"), ("斉", "even"),
    ("歯", "tooth"), ("竜", "dragon"), ("亀", "turtle"), ("龠", "flute"),
]

# Shapes a radical or common part takes inside a kanji: form -> (full form, name).
VARIANTS = {
    "亻": ("人", "person"), "𠆢": ("人", "person"), "儿": ("儿", "legs"),
    "冫": ("氷", "ice"), "刂": ("刀", "knife"), "⺈": ("刀", "knife"),
    "氵": ("水", "water"), "氺": ("水", "water"), "扌": ("手", "hand"),
    "忄": ("心", "heart"), "⺗": ("心", "heart"), "艹": ("艸", "grass"),
    "辶": ("辵", "walk"), "⻌": ("辵", "walk"), "礻": ("示", "altar"),
    "衤": ("衣", "clothes"), "犭": ("犬", "dog"), "灬": ("火", "fire"),
    "攵": ("攴", "strike"), "王": ("玉", "king / jade"), "罒": ("网", "net"),
    "⺮": ("竹", "bamboo"), "耂": ("老", "old"), "爫": ("爪", "claw"),
    "牜": ("牛", "cow"), "⻊": ("足", "foot"), "𧾷": ("足", "foot"),
    "糹": ("糸", "thread"), "訁": ("言", "speech"), "飠": ("食", "eat"),
    "釒": ("金", "metal"), "⺌": ("小", "small"), "丷": ("八", "eight"),
    "⺕": ("彐", "snout"), "覀": ("襾", "cover"), "西": ("襾", "west"),
    "乚": ("乙", "second"), "㔾": ("卩", "seal"), "⺧": ("牛", "cow"),
    "⺶": ("羊", "sheep"), "𦍌": ("羊", "sheep"), "⺼": ("肉", "meat"),
    "旡": ("无", "not"), "母": ("毋", "mother"), "⺪": ("疋", "bolt of cloth"),
    "爿": ("爿", "split wood"), "廾": ("廾", "two hands"), "龷": ("廾", "two hands"),
    "彑": ("彐", "snout"), "⺍": ("小", "small"), "川": ("巛", "river"),
}

# 阝 means "hill" on the left and "town" on the right; KanjiVG gives the full form.
SPLIT_FORMS = {("阝", "阜"): "hill", ("阝", "邑"): "town"}


def radical_by_number(number):
    if not number or number < 1 or number >= len(KANGXI):
        return None
    return KANGXI[number]


def part_name(char, original=None):
    if (char, original) in SPLIT_FORMS:
        return SPLIT_FORMS[(char, original)]
    if char in VARIANTS:
        return VARIANTS[char][1]
    for entry in KANGXI[1:]:
        if entry[0] == char:
            return entry[1]
    return None
