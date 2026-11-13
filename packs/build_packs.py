"""Builds the 3 SLP .reelrx packs from one source so starter ⊂ practice stays true."""
import json, re, sys, os

OUT = sys.argv[1]
UPDATED = "2026-11-09"

def S(write, *heard, ask=False):
    e = {"write": write}
    if heard: e["heard"] = list(heard)
    if ask: e["ask"] = True
    return e

# ---------- spelling ----------
SPELL_STARTER = [
    S("apraxia", "a praxia", "upraxia", "apraxsia"),
    S("childhood apraxia of speech", "childhood a praxia of speech"),
    S("CAS", "c.a.s.", ask=True),
    S("dysarthria", "dis arthria", "disarthria", "dysarthia"),
    S("aphasia", "a phasia", "afasia"),
    S("dysphagia", "disphagia", "dis phagia"),
    S("dysphagia", "dysphasia", ask=True),
    S("phonological", "phonologic al", "phonelogical"),
    S("articulation"),
    S("stuttering"),
    S("AAC", "a.a.c.", "a a c", "aac"),
    S("echolalia", "echo lalia", "ecolalia", "eckolalia"),
    S("gestalt language processing", "gestault language processing", "gesthalt language processing"),
    S("GLP", "g.l.p."),
    S("tongue tie", "tonguetie"),
    S("frenectomy", "frenetomy", "friendectomy", "phrenectomy"),
    S("myofunctional", "myo functional", "my functional"),
    S("orofacial", "oral facial", ask=True),
    S("bilingual"),
    S("late talker", "late talk er"),
    S("Hanen", "hannon", "hanan", "hannen", "haneen"),
    S("PROMPT", "prompt", ask=True),
    S("SLP", "s.l.p.", "s l p"),
    S("OT", "o.t."),
    S("PT", "p.t."),
    S("IEP", "i.e.p.", "i e p"),
    S("IFSP", "i.f.s.p.", "ifsp"),
    S("early intervention"),
    S("autism"), S("autistic"),
    S("ADHD", "a.d.h.d.", "adhd"),
    S("sensory"),
    S("proprioceptive", "proprio ceptive", "propreoceptive"),
    S("vestibular", "vestibuler"),
    S("torticollis", "torti collis", "tortacollis"),
    S("plagiocephaly", "plagio cephaly"),
    S("toe walking"),
    S("W-sitting", "w sitting", "double you sitting"),
    S("speech-language pathologist", "speech language pathologist"),
    S("DLD", "d.l.d."),
    S("lisp"),
    S("teletherapy", "tele therapy", "tele-therapy"),
    S("neurodiversity-affirming", "neurodiversity affirming"),
    S("ASHA", "asha", ask=True),
    S("CCC-SLP", "c.c.c. s.l.p.", "ccc slp"),
    S("dyslexia"),
    S("selective mutism"),
    S("cleft palate", "cleft pallet"),
]

SPELL_PRACTICE_EXTRA = [
    # speech sounds
    S("phoneme", "phonem"), S("phonemic awareness"), S("minimal pairs"), S("cycles approach"),
    S("final consonant deletion"), S("cluster reduction"), S("fronting"), S("backing"), S("gliding"),
    S("stopping"), S("deaffrication", "de-affrication", "de affrication"), S("vowelization"),
    S("interdental lisp", "inter dental lisp"), S("lateral lisp"), S("frontal lisp"),
    S("rhotic", "rotic", "rhodic"), S("vocalic R", "vocalic are", "vocalic r"),
    S("coarticulation", "co-articulation", "co articulation"),
    S("stimulability", "stimuability", "stimulatability"),
    S("intelligibility", "intelligeability", "intelligability"),
    S("DTTC", "d.t.t.c."), S("ReST", "rest", ask=True), S("Nuffield", "newfield", ask=True),
    S("Kaufman", "kaufmann", "coffman", ask=True), S("motor planning"), S("tactile cues"),
    # language
    S("morphology"), S("syntax"), S("semantics"), S("pragmatics", "pragmatic s"), S("prosody", "prosidy"),
    S("narrative skills"), S("MLU", "m.l.u."), S("word retrieval"), S("word-finding", "word finding"),
    S("language disorder"), S("language delay"), S("two-word combinations", "two word combinations"),
    S("babbling", "babbeling"), S("canonical babbling"), S("jargon"), S("joint attention"),
    S("parallel talk"), S("self-talk", "self talk"), S("expansion"), S("recasting", "re-casting", "re casting"),
    S("wait time"), S("It Takes Two to Talk", "it takes two to talk"), S("More Than Words", "more than words", ask=True),
    # gestalt / autism / neurodiversity
    S("NLA", "n.l.a."), S("Natural Language Acquisition", "natural language acquisition"),
    S("delayed echolalia"), S("immediate echolalia"), S("scripting"), S("gestalts", "gestaults"),
    S("mitigation"), S("stimming"), S("AuDHD", "audhd", "o d h d"), S("neurodivergent"), S("neurotypical"),
    S("DIRFloortime", "dir floortime", "d.i.r. floortime", "floor time"), S("JASPER", "jasper", ask=True),
    S("SCERTS", "skirts", "scerts", ask=True), S("PECS", "pecks", "pex", ask=True), S("ABA", "a.b.a."),
    S("masking"), S("interoception", "inner oception", "interception", ask=True),
    # AAC
    S("core vocabulary"), S("fringe vocabulary"), S("LAMP Words for Life", "lamp words for life"),
    S("Proloquo2Go", "proloquo to go", "prolo quo to go", "proloquo 2 go"), S("TouchChat", "touch chat"),
    S("TD Snap", "t.d. snap", "td snap"), S("speech-generating device", "speech generating device"),
    S("SGD", "s.g.d."), S("aided language modeling"), S("robust AAC", "robust aac"),
    S("partner-assisted scanning", "partner assisted scanning"), S("eye gaze"), S("low-tech AAC", "low tech aac"),
    # fluency
    S("disfluency", "dis fluency", "dysfluency"), S("cluttering"), S("Lidcombe", "lid comb", "lidcome", "lidcom"),
    S("prolongations"), S("stammering"), S("stuttering-affirming", "stuttering affirming"),
    # voice / resonance / cleft
    S("hypernasality", "hyper nasality"), S("hyponasality", "hypo nasality"), S("resonance"),
    S("vocal nodules"), S("vocal folds"), S("larynx", "larnyx", "larinks"),
    S("LSVT LOUD", "l.s.v.t. loud", "lsvt loud"), S("SPEAK OUT!", "speak out", ask=True),
    S("velopharyngeal", "velo pharyngeal"), S("VPI", "v.p.i."), S("velum"), S("cleft lip"),
    S("gender-affirming voice", "gender affirming voice"),
    # feeding / swallowing / myo
    S("ARFID", "arfid", "ar fid", "are fid"), S("food chaining"), S("picky eating"), S("oral aversion"),
    S("pocketing"), S("tongue thrust"), S("open mouth posture"), S("mouth breathing"),
    S("TOTs", "tots", ask=True), S("tethered oral tissues"), S("lingual frenulum"),
    S("ankyloglossia", "ankylo glossia", "ankyloglosia"), S("lip tie"), S("oral motor"),
    S("MBS", "m.b.s."), S("modified barium swallow"), S("VFSS", "v.f.s.s."), S("FEES", "fees", ask=True),
    S("IDDSI", "iddsi", "id see", ask=True), S("thickened liquids"), S("aspiration"), S("silent aspiration"),
    # adult neuro
    S("TBI", "t.b.i."), S("cognitive-communication", "cognitive communication"), S("Parkinson's", "parkinsons"),
    S("ALS", "a.l.s."), S("dementia"), S("primary progressive aphasia"), S("anomia", "a nomia"),
    S("Broca's aphasia", "brocas aphasia", "broca aphasia"), S("Wernicke's aphasia", "wernickes aphasia", "vernickies aphasia"),
    # hearing
    S("hearing loss"), S("cochlear implant", "coklear implant"), S("auditory processing disorder"),
    S("APD", "a.p.d."), S("audiologist"), S("ear tubes"), S("otitis media", "otitis medea"),
    # literacy
    S("phonics"), S("decoding"), S("structured literacy"), S("Orton-Gillingham", "orton gillingham"),
    S("science of reading"),
    # school / admin / practice
    S("504 plan", "five oh four plan"), S("FAPE", "fape", ask=True), S("LRE", "l.r.e."), S("RTI", "r.t.i."),
    S("MTSS", "m.t.s.s."), S("push-in", "push in", ask=True), S("pull-out", "pull out", ask=True),
    S("caseload", "case load"), S("triennial", "tri-annual", "triannual"), S("IEE", "i.e.e."),
    S("private practice"), S("superbill", "super bill"), S("out-of-network", "out of network"),
    S("private pay"), S("CPT code", "c.p.t. code"), S("telepractice", "tele practice"),
    S("SLPA", "s.l.p.a.", "slpa"), S("clinical fellow"), S("CF", "c.f.", ask=True), S("Medicaid", "medicade"),
    S("prior authorization"),
    # tests
    S("CELF-5", "self 5", "celf five", "self five"), S("PLS-5", "p.l.s. 5", "pls 5", "pls five"),
    S("GFTA-3", "g.f.t.a. 3", "gfta 3"), S("KLPA", "k.l.p.a."), S("CASL-2", "castle 2", "casl 2", ask=True),
    S("PPVT", "p.p.v.t."), S("EVT", "e.v.t."), S("REEL-4", "reel 4", "reel four", ask=True),
    S("Rossetti", "rosetti", "rozetti"), S("DAYC", "d.a.y.c.", "day c"),
    # development / conditions
    S("milestones"), S("M-CHAT", "m chat", "em chat"), S("developmental pediatrician"),
    S("NICU", "nick you", "n.i.c.u."), S("preemie"), S("adjusted age"), S("Down syndrome", "downs syndrome"),
    S("cerebral palsy"), S("Fragile X", "fragile ex"),
    # bilingual
    S("code-switching", "code switching"), S("dialect"), S("multilingual"), S("African American English"),
    S("accent modification"),
]

# ---------- claims ("#" = any number) ----------
def C(kind, why, try_, *match):
    return {"kind": kind, "match": list(match), "why": why, "try": try_}

CLAIMS_STARTER = [
    C("promise", "Promises a result. Every child is different.",
      "This is one way to give your child more chances to talk.",
      "will get your child talking", "will get your toddler talking", "guaranteed", "guarantee",
      "100%", "works every time", "this will fix", "will fix"),
    C("timeline", "A timeline is a promise you can't keep for every child.",
      "Many kids make progress with practice. Every child's timeline is different.",
      "in # weeks", "in # days", "in # months", "by next week", "overnight"),
    C("cure", "'Cure' and 'fix' words promise an outcome, and can feel shaming to people who stutter.",
      "Support your child's speech.",
      "cure", "cured", "cures", "fix stuttering", "fix a lisp", "fix your child's", "get rid of the stutter", "get rid of stuttering", "get rid of the lisp"),
    C("diagnosis", "Nobody can be diagnosed from a reel.",
      "If you notice this, it's worth asking an SLP.",
      "they have apraxia", "your child has apraxia", "your child has autism", "they have autism", "means your child is",
      "is a sign of autism", "definitely has"),
    C("scope", "Medical advice is outside an SLP's lane.",
      "Talk to your pediatrician.",
      "stop the medication", "stop the meds", "you don't need a doctor", "skip the pediatrician",
      "instead of the doctor"),
    C("testimonial", "Client quotes and reviews need written permission, and can never be made up.",
      "Cut it, or describe how you work instead.",
      "best slp ever", "five stars", "5 stars", "my client said", "a parent told me", "one of my parents said"),
    C("privacy", "Talking about a specific client can identify them, even without a name.",
      "A lot of kids I see...",
      "my client", "in session today", "today in session", "one of my kids", "my little guy",
      "my little girl", "my kiddo"),
    C("absolute", "'All' and 'every' claims leave out the kids they don't fit.",
      "Many kids...",
      "every child will", "all kids will", "all late talkers", "every late talker"),
]

CLAIMS_PRACTICE_EXTRA = [
    C("superlative", "Superlatives you can't prove can read as misleading advertising.",
      "Speech therapy for [who you help] in [your town].",
      "best speech therapist", "best slp in", "number one", "top rated", "top-rated"),
    C("credential", "Name only credentials you hold, written the official way.",
      "Use your exact credential, e.g. M.S., CCC-SLP.",
      "board certified", "certified in", "specialist in", "expert in"),
    C("causation", "Cause-and-effect claims about delays and autism need strong evidence, and parents can hear blame.",
      "Here's what can help...",
      "screen time causes", "causes speech delay", "causes speech delays", "causes autism", "caused his delay",
      "caused her delay", "caused their delay"),
    C("scope", "Results after a tongue tie release vary, and the decision is medical.",
      "If you're wondering about a tongue tie, ask your pediatrician or dentist. An SLP can look at how the tongue moves.",
      "frenectomy will", "the release will fix", "cutting the tongue tie", "tongue tie causes", "clipping the tongue"),
    C("comparison", "Comparing yourself to other clinicians can break ethics rules on how you represent services.",
      "Here's how I work...",
      "faster than", "better than other", "other slps don't", "unlike other therapists"),
    C("insurance", "Coverage depends on the plan. Promising it can backfire.",
      "Many families use out-of-network benefits. Check your plan.",
      "insurance covers", "insurance will pay", "covered by insurance", "will be reimbursed", "insurance will cover"),
    C("beforeafter", "Before/after of a client is client footage: that's a red light.",
      "Cut it. Show the strategy, not the client.",
      "before and after", "before after", "look at the difference", "look at them now"),
    C("stats", "Outcome numbers about your clients are claims you'd need to back up, and they point at clients.",
      "Many kids I work with...",
      "# percent of my clients", "#% of my clients", "all my clients", "every one of my clients"),
    C("promise", "Fine when you're busting the myth. Not fine as a promise.",
      "Some kids catch up and some need support. That's why it's worth checking.",
      "will catch up", "they'll catch up", "will grow out of it"),
    C("hype", "Hype words oversell and can sound like a sales pitch for a health service.",
      "A simple way to...",
      "miracle", "magic trick", "the secret to", "game changer", "rewire the brain", "rewire their brain"),
    C("promise", "Some kids do need therapy. Don't talk anyone out of help.",
      "If you're worried, it's worth asking.",
      "you don't need therapy", "you don't need speech therapy", "no therapy needed", "skip therapy"),
    C("scope", "An autism diagnosis is outside most SLPs' scope. Check your state.",
      "I can screen and help you find the right next step.",
      "i diagnose autism", "i can diagnose autism", "i diagnosed", "i can tell if your child is autistic"),
    C("scope", "Supplements, medications and alternative treatments are outside an SLP's lane.",
      "Talk to your pediatrician.",
      "supplement", "supplements", "essential oil", "essential oils", "melatonin", "stop the reflux"),
]

# ---------- stoplight extras ----------
def L(id_, text, level, fix):
    return {"id": id_, "text": text, "level": level, "fix": fix}

STOP_STARTER = [
    L("materials", "Therapy materials with a name, photo or handwriting are showing (artwork, name tags, picture schedules)",
      "yellow", "Crop past them, cover them, or film before materials go out."),
    L("aac", "An AAC device or picture board that belongs to a client is in frame (their photos, name or custom buttons)",
      "yellow", "Use a demo device or a blank board, or keep it out of the shot."),
]
STOP_PRACTICE_EXTRA = [
    L("telehealth", "A video call screen is visible, even a thumbnail or frozen frame",
      "yellow", "Close the call window before filming. If a client's face shows, it's red."),
    L("audio", "A child's voice can be heard in the background (waiting room, next room)",
      "yellow", "Cut that part, or re-film when it's quiet."),
    L("docs", "Eval forms, test protocols, reports or session notes are on screen or on the table",
      "yellow", "Clear the table and close the laptop. Blank protocols are fine; filled ones aren't."),
    L("school", "School-based: a district logo, classroom labels or student work is in frame",
      "yellow", "Film somewhere neutral, and check your district's social media policy."),
]

# ---------- reel types ----------
REELS_STARTER = [
    {"id": "tip", "name": "Talking-head tip", "length": "20-45s", "bestFor": "parents",
     "beats": ["Hook: the problem or the surprising part", "The tip, with one real-life example",
               "Why it works, in one sentence", "Close: what to do next"]},
    {"id": "bts", "name": "Behind the scenes", "length": "8-20s", "bestFor": "trust",
     "beats": ["Hook text sets up the story", "3-6 quick clips, 1-3 seconds each", "Close text: a feeling or a line"],
     "note": "No clients, ever. Check every clip's background."},
    {"id": "question", "name": "Parent question / myth vs. fact", "length": "30-60s", "bestFor": "parents searching for answers",
     "beats": ["Hook: the question in the parent's words", "Short answer first", "2-3 points, a text card for each",
               "Close: when to get help"]},
]
REELS_PRACTICE_EXTRA = [
    {"id": "dothis", "name": "Do this, not that", "length": "15-30s", "bestFor": "saves and shares",
     "beats": ["Hook: the thing most people do", "Not that: say or show it", "Do this: the swap",
               "Why, in one line", "Close: try it today"]},
    {"id": "demo", "name": "Hands-only demo", "length": "20-40s", "bestFor": "showing a strategy",
     "beats": ["Hook: what you're about to show", "The toy or book", "Model it twice, slowly",
               "What to watch for", "Close: try it at home"],
     "note": "Your hands and voice only. No child, ever. A stuffed animal can play the child."},
    {"id": "referral", "name": "For teachers & pediatricians", "length": "30-45s", "bestFor": "referral partners",
     "beats": ["Hook: who this is for", "2-3 signs worth a referral", "What happens after they refer",
               "Close: how to refer to you"]},
]

# ---------- hooks (free=True goes in the email add-on) ----------
def H(reel, audience, text, free=False):
    h = {"reelType": reel, "audience": audience, "text": text}
    if free: h["free"] = True
    return h

HOOKS = [
    H("tip", "parents", "Quizzing your toddler isn't the same as teaching words.", True),
    H("tip", "parents", "Try this the next time they point and grunt.", True),
    H("tip", "parents", "Bath time is secretly great for talking. Here's why."),
    H("tip", "parents", "The car might be the best place to practice talking.", True),
    H("tip", "parents", "Say less, so your toddler can catch more."),
    H("tip", "parents", "Your child says one word. Add one more.", True),
    H("tip", "parents", "Wait five seconds. Then watch what happens."),
    H("tip", "parents", "Reading the whole book isn't the point."),
    H("tip", "parents", "If your child says 'tat' for 'cat,' watch this."),
    H("tip", "parents", "A snack-time trick for more chances to talk."),
    H("tip", "clinicians", "SLPs: your parent handouts are too long."),
    H("tip", "clinicians", "What I tell parents at the very first visit."),
    H("bts", "parents", "Setting up my therapy room before anyone gets here.", True),
    H("bts", "parents", "What I do after every session that nobody sees.", True),
    H("bts", "parents", "Everything in my therapy bag, and why."),
    H("bts", "parents", "What my family thinks I do all day vs. reality."),
    H("bts", "clinicians", "Prepping one toy five different ways."),
    H("bts", "clinicians", "The unglamorous side of running a private practice."),
    H("bts", "parents", "My favorite therapy toy costs under $10."),
    H("question", "parents", "'Should my 2-year-old be saying more words?'", True),
    H("question", "parents", "Does screen time cause speech delays? What I tell parents."),
    H("question", "parents", "'He's a boy, he'll talk later.' Let's talk about that.", True),
    H("question", "parents", "3 signs it's worth getting a speech evaluation.", True),
    H("question", "parents", "Will two languages confuse my child?"),
    H("question", "parents", "Is it a lisp, or just a phase?"),
    H("question", "parents", "What actually happens at a speech evaluation?", True),
    H("question", "parents", "Does a pacifier hurt speech? It depends."),
    H("question", "parents", "'Is my child's stuttering my fault?'"),
    H("question", "parents", "When should strangers understand what my child says?"),
    H("dothis", "parents", "Don't say 'say ___.' Try this instead."),
    H("dothis", "parents", "Not 'use your words.' Try this."),
    H("dothis", "parents", "Correcting their speech? Do this instead."),
    H("dothis", "parents", "Skip the yes/no question. Offer two choices."),
    H("dothis", "parents", "Don't finish their sentence. Do this instead."),
    H("dothis", "parents", "Skip the flashcards. Grab this instead."),
    H("dothis", "parents", "Instead of 'what color is it?' try this."),
    H("dothis", "clinicians", "SLPs: don't end sessions with 'any questions?'"),
    H("demo", "parents", "One toy car, ten words. Watch."),
    H("demo", "parents", "How I'd read this book with a late talker."),
    H("demo", "parents", "Bubbles, but make it speech practice."),
    H("demo", "parents", "Modeling AAC in 30 seconds. Watch my hands."),
    H("demo", "parents", "How to play 'ready, set... go' for speech."),
    H("demo", "parents", "One puzzle, three ways to build language."),
    H("demo", "parents", "What 'modeling' actually looks like at home."),
    H("referral", "referral", "Teachers: when a speech referral makes sense."),
    H("referral", "referral", "Pediatricians: speech signs worth a referral."),
    H("referral", "referral", "What happens after you refer a family to me."),
    H("referral", "referral", "Daycare teachers: what I wish you knew about late talkers."),
    H("referral", "referral", "'Wait and see' or 'let's check'? When to refer."),
    H("referral", "clinicians", "OTs and PTs: when to loop in an SLP."),
]

# ---------- plain-language swaps ----------
def W(term, parent): return {"term": term, "parent": parent}
SWAPS_STARTER = [
    W("expressive language", "how your child puts words together"),
    W("receptive language", "how your child understands what you say"),
    W("articulation", "how clearly your child says sounds"),
    W("phonological processes", "sound patterns kids use while they're learning (like 'tat' for 'cat')"),
    W("disfluency", "stuttering, getting stuck on words"),
    W("pragmatics", "using words with other people: taking turns, asking, joining in"),
    W("AAC", "other ways to talk: pictures, a talker device, signs"),
    W("modeling", "showing the words yourself"),
    W("joint attention", "looking at the same thing together"),
    W("intervention", "therapy, support"),
]
SWAPS_PRACTICE_EXTRA = [
    W("social language", "using words with other people"),
    W("feeding therapy", "help with eating and trying new foods"),
    W("oral motor", "how the mouth, lips and tongue move"),
    W("expansion", "adding a word to what they said ('car' → 'red car')"),
    W("sensory processing", "how your child handles sounds, touch and movement"),
    W("fine motor", "hand skills: holding a crayon, buttons, snacks"),
    W("gross motor", "big movements: crawling, walking, climbing"),
    W("milestones", "what most kids are doing around this age"),
    W("evaluation", "a visit where we find out what's going on"),
    W("prognosis", "what we expect going forward"),
    W("phoneme", "a speech sound"),
    W("intelligibility", "how easy your child is to understand"),
    W("stimulability", "whether your child can say the sound with help"),
    W("motor planning", "how the brain tells the mouth what to do"),
    W("apraxia", "trouble planning the mouth movements for speech"),
    W("dysarthria", "weak or slow speech muscles"),
    W("dysphagia", "trouble swallowing"),
    W("aphasia", "trouble with language after a stroke or brain injury"),
    W("echolalia", "repeating words or phrases they've heard"),
    W("gestalt language processing", "learning language in chunks or phrases first"),
    W("MLU", "how many words they put together"),
    W("resonance", "how the voice sounds through the nose and mouth"),
    W("hypernasality", "sounding like they're talking through their nose"),
    W("IEP", "the school plan for your child's support"),
    W("IFSP", "the early intervention plan for your family"),
    W("early intervention", "your state's support for kids under 3"),
    W("DLD", "a lasting difficulty learning and using language"),
    W("phonemic awareness", "hearing the sounds inside words"),
    W("decoding", "sounding out words"),
    W("generalization", "using a new skill everywhere, not just in therapy"),
]

CARE_STARTER = ["General info, not medical advice. Talk to your child's provider about your child."]
CARE_PRACTICE = CARE_STARTER + [
    "Every child is different. If you're worried, it's worth asking an SLP.",
    "This isn't a diagnosis. An evaluation is how we find out what's going on.",
    "Not a substitute for therapy. Just one thing to try at home.",
]

HASHTAGS_STARTER = [{"name": "Speech basics", "tags": ["#speechtherapy", "#speechdevelopment", "#toddlertalk", "#parentingtips"]}]
HASHTAGS_PRACTICE = [
    {"name": "Toddler talk", "tags": ["#toddlertalk", "#latetalker", "#speechdevelopment", "#toddlerlearning", "#speechtherapy"]},
    {"name": "Speech sounds", "tags": ["#articulation", "#speechsounds", "#lisp", "#kidsspeech", "#speechtherapy"]},
    {"name": "AAC & neurodiversity", "tags": ["#AAC", "#AACawareness", "#gestaltlanguageprocessing", "#neurodiversityaffirming", "#autismacceptance"]},
    {"name": "Feeding", "tags": ["#feedingtherapy", "#pickyeating", "#toddlermeals", "#mealtimetips", "#speechtherapy"]},
    {"name": "Local", "tags": ["#{town}speechtherapy", "#{town}parents", "#{town}kids", "#speechtherapy", "#slp"]},
    {"name": "SLP community", "tags": ["#slp", "#slpeeps", "#privatepracticeslp", "#speechpathology", "#slp2b"]},
]

PRESETS = [
    {"id": "calm", "name": "Calm clinic", "style": "clean", "case": "sentence", "linesMax": 2},
    {"id": "bold", "name": "Bold tip", "style": "box", "case": "sentence", "linesMax": 2},
    {"id": "play", "name": "Playful", "style": "pop", "case": "upper", "linesMax": 1},
]

NOTICE = ("A practical safety net, not legal advice. Your license rules, state laws and any employer or "
          "school social media policy come first.")

def meta(id_, name, tier, kind, **extra):
    m = {"packVersion": 1, "id": id_, "name": name, "profession": "slp", "tier": tier, "kind": kind,
         "version": "1.0.0", "updated": UPDATED, "author": "Systems with Jwo", "notice": NOTICE}
    m.update(extra); return m

starter = meta("slp-starter", "SLP Starter", "free", "base", endCard=True) | {
    "spelling": SPELL_STARTER, "claims": CLAIMS_STARTER, "stoplightExtras": STOP_STARTER,
    "reelTypes": REELS_STARTER, "hooks": [], "swaps": SWAPS_STARTER, "careLines": CARE_STARTER,
    "captionPresets": [PRESETS[2]], "hashtagSets": HASHTAGS_STARTER,
}
free_hooks = meta("slp-hooks-free", "10 Free SLP Hooks", "free", "addon") | {
    "hooks": [{k: v for k, v in h.items() if k != "free"} for h in HOOKS if h.get("free")],
}
practice = meta("slp-practice", "SLP Practice Pack", "paid", "base", endCard=False,
                license="For one clinician's own use. Please don't share the file.") | {
    "spelling": SPELL_STARTER + SPELL_PRACTICE_EXTRA, "claims": CLAIMS_STARTER + CLAIMS_PRACTICE_EXTRA,
    "stoplightExtras": STOP_STARTER + STOP_PRACTICE_EXTRA, "reelTypes": REELS_STARTER + REELS_PRACTICE_EXTRA,
    "hooks": [{k: v for k, v in h.items() if k != "free"} for h in HOOKS],
    "swaps": SWAPS_STARTER + SWAPS_PRACTICE_EXTRA, "careLines": CARE_PRACTICE,
    "captionPresets": PRESETS, "hashtagSets": HASHTAGS_PRACTICE,
}

# ---------- checks ----------
errs = []
for p in (starter, free_hooks, practice):
    reel_ids = {r["id"] for r in p.get("reelTypes", [])} or {r["id"] for r in REELS_STARTER}
    for h in p.get("hooks", []):
        n = len(re.findall(r"[\w$][\w'$]*", h["text"]))
        if n > 10: errs.append(f"{p['id']}: hook over 10 words: {h['text']}")
        if h["reelType"] not in reel_ids: errs.append(f"{p['id']}: hook reelType missing: {h}")
    for hs in p.get("hashtagSets", []):
        if len(hs["tags"]) > 5: errs.append(f"{p['id']}: >5 hashtags in {hs['name']}")
    seen = set()
    for s in p.get("spelling", []):
        key = (s["write"].lower(), tuple(s.get("heard", [])))
        if key in seen: errs.append(f"{p['id']}: duplicate spelling {s}")
        seen.add(key)
    ids = [x["id"] for x in p.get("stoplightExtras", [])] + [x["id"] for x in p.get("reelTypes", [])]
    if len(ids) != len(set(ids)): errs.append(f"{p['id']}: duplicate ids")
# any hook that trips the pack's own claims check?
allmatch = [m for c in CLAIMS_STARTER + CLAIMS_PRACTICE_EXTRA for m in c["match"]]
for h in HOOKS:
    t = h["text"].lower()
    for m in allmatch:
        pat = r"\b" + re.escape(m).replace(r"\#", r"\w+") + r"\b"
        if re.search(pat, t): errs.append(f"hook trips claims '{m}': {h['text']}")
if errs:
    print("\n".join(errs)); sys.exit(1)

os.makedirs(OUT, exist_ok=True)
for p in (starter, free_hooks, practice):
    with open(os.path.join(OUT, p["id"] + ".reelrx"), "w") as f:
        json.dump(p, f, indent=2, ensure_ascii=False); f.write("\n")
    print(f"{p['id']}: spelling {len(p.get('spelling', []))}, claims groups {len(p.get('claims', []))} "
          f"({sum(len(c['match']) for c in p.get('claims', []))} phrases), stoplight+ {len(p.get('stoplightExtras', []))}, "
          f"reel types {len(p.get('reelTypes', []))}, hooks {len(p.get('hooks', []))}, swaps {len(p.get('swaps', []))}, "
          f"care {len(p.get('careLines', []))}, presets {len(p.get('captionPresets', []))}, hashtag sets {len(p.get('hashtagSets', []))}")
