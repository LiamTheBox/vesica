// What the bladder says, by kind of line. Vesica is a dramatic, slightly neurotic organ
// that talks like a person: short lines, said in a breath, with as little anatomy jargon
// as a bladder can manage.

export const LINES = {
  // Chatter: how full it is, now and then (see CHATTER).
  sleepy: ["Zzz... so cozy...", "Mm, nap time.", "Nothing to do. I love it.", "So light... so sleepy...", "Wake me when you drink something.", "Quiet day down here."],
  nominal: ["Something's trickling in.", "Starting to fill. No big deal.", "All good down here.", "I've got room. Plenty of room.", "A little sloshy. I like it.", "Just a splash so far.", "Easy. I could hold this all day.", "Filling up nicely.", "Comfy. Carry on.", "Nothing to report. Yet."],
  distended: ["Okay, I'm noticing myself now.", "Halfway there. Just saying.", "Getting a bit heavy.", "Maybe think about a bathroom?", "Not urgent. Yet.", "Starting to stretch here.", "Don't ignore me, okay?", "Feeling round. Very round.", "A bathroom break wouldn't hurt.", "I'm being patient. For now."],
  full: ["This is getting tight!", "Bathroom. Soon. Please.", "I'm a water balloon here!", "Every step sloshes!", "No more drinks, I mean it!", "I'm stretched thin!", "Find a toilet. Any toilet.", "Hold it... hold it...", "So full it hurts!", "We need to talk. Urgently."],
  critical: ["I can't hold it much longer!", "Toilet! Now!", "It's going to come out!", "I'm shaking down here!", "Any second now!", "Squeeze! Squeeze everything!", "I'm at my limit!", "This is an emergency!", "Please, please, please!", "I'm about to burst!"],

  // Touch: by how full it is, and how much it has had.
  pokeEmpty: ["Hee! That tickles!", "Boop. Hi there.", "Poke away, I'm empty.", "Ooh, a visitor!", "Hehe, stop it!", "I'm all squishy right now."],
  poked: ["Hey! Careful!", "Poke. Rude.", "Ow! That sloshed!", "What was that for?", "Easy with the fingers.", "I felt that!", "Hands off, please.", "Watch it, I'm half full!"],
  pokeFull: ["Don't poke me, I'm full!", "Careful! I'm holding a lot!", "Not now! Not now!", "Ow! Everything sloshed!", "Hands off, I'm about to burst!", "You're not helping!"],
  slapped: ["Ow! Rude!", "Hey! What was that for?", "Slap me again, I dare you.", "Ouch! I felt that.", "Wobble wobble. Not funny."],
  slapFull: ["Don't slap a full bladder!", "Ow! Do you want a leak?", "That wave nearly broke me!", "Stop! I'm sloshing!", "Are you trying to make me leak?"],
  squeezeEmpty: ["Squish away, there's nothing in here.", "Wheee, I'm a stress ball!", "That's oddly relaxing.", "Squishy squishy.", "Go on, I'm empty."],
  squeezed: ["Stop squeezing me!", "Hey! It has to go somewhere!", "You'll make me leak!", "Too tight! Let go!", "I'm not a juice box!", "Squeezing makes it worse!", "Easy! The pressure!", "Ow! Let go!"],
  annoyed: ["Seriously. Stop. Poking.", "I'm not a stress ball!", "Okay, that's enough!", "Find a new hobby!", "Hands. Off.", "I will remember this.", "Do that again. I dare you."],
  shaken: ["Whoa! Stop shaking me!", "Everything's sloshing!", "I'm not a cocktail shaker!", "Waves! Waves everywhere!", "I'm getting seasick!", "It's all crashing at the exit!", "Wheee... no, not wheee!", "Steady! Steady!"],

  // Drinks.
  drinkWater: ["Ooh, water. Classy.", "Hydration! Fine, I'll take it.", "Water's on its way down.", "Good choice. Still my problem later.", "Fresh water incoming. Lovely.", "Water again? You know where it ends up."],
  drinkCaffeine: ["Caffeine? Oh no, the express lane.", "Coffee goes straight through you. To me.", "Caffeine! Everything's speeding up.", "A diuretic. Brace yourself.", "Wired kidneys incoming!", "That buzz comes with a bill. Me."],
  drinkAlcohol: ["Booze? You'll be visiting me a lot.", "Breaking the seal, are we?", "Cheers. I'll do the hard work.", "That's going to hit me fast.", "Party for you, overtime for me.", "Oh no. Here comes the seal-breaker."],
  drinkBig: ["All of that? Seriously?", "That's huge! Where do you think it goes?", "I'm not a reservoir!", "Whoa, slow down!", "Big gulp. Big problem. My problem.", "That's a lot of incoming."],
  drinkOther: ["Glug, glug. It all comes to me.", "Tasty for you, homework for me.", "Another one? Noted.", "I'll file that under 'later'.", "Mm. Sweet. It all ends up here.", "The kidneys say thanks. I say hmm."],
  drinkFull: ["More?! I'm already full!", "Are you serious right now?", "No more! I'm at the limit!", "You're trying to drown me!", "Not another drop, please!", "Where is that supposed to go?!"],

  // Holding on, and not.
  clench: ["Squeezing! Holding!", "Clenched! Not a drop!", "Locked tight!", "Holding the line!", "Squeeze! Good!", "Gate's shut!", "Got it! Keep squeezing!", "Tight as a drum!"],
  clenchIdle: ["Squeezing... for fun?", "Practising? Okay, I'm flexing!", "Kegel time? Fine.", "Nothing to hold, but sure.", "Look at me flex!"],
  exhausted: ["I can't squeeze any more...", "My grip's gone. Give me a second.", "Too tired to clench...", "Ugh. My muscles are jelly.", "Out of squeeze. Need a breather."],
  soothe: ["Ahh... deep breath.", "That's better. Calmer.", "Mmm, the spasm's easing.", "Breathe in... and out.", "Okay. Okay. I'm calm.", "Thanks, I needed that.", "Relaxing... relaxing...", "Phew. The tension's going."],
  cough: ["Whoa! That cough!", "Oof! Right in the bladder!", "Careful with the coughing!", "That nearly did it!", "Warn me next time!", "Bless you. Hold on!"],
  coughBraced: ["Braced! Nothing got out.", "Ha! Clenched in time!", "Sneeze blocked!", "Bless you. And well braced!", "Didn't even budge!"],
  slipping: ["I'm slipping! Clench!", "Losing it! Squeeze now!", "Help! Clench!", "It's coming out! Squeeze!", "Now! Clench now!"],
  saved: ["Caught it! Phew!", "Whoa, that was close!", "Saved it! Barely!", "Nice clench! Not a drop!", "Close one! Good reflexes!"],
  leak: ["Oops! A little got out!", "Agh! I leaked!", "No no no, it's slipping!", "A spurt got past!", "Squeeze! It's leaking!", "Oh no. Oh no no.", "Leak! Leak!", "That one slipped through!"],
  leakOver: ["Sealed. Let's never speak of this.", "That was embarrassing.", "Pretend that didn't happen.", "Ugh. A little damp now.", "Stopped it. Mostly.", "Oops. Sorry about that."],
  involuntary: ["I can't stop it!", "It's all coming out!", "I'm sorry! I can't hold it!", "Everything's going!", "The dam has burst!", "Nooo! It won't stop!", "I gave out! I'm sorry!", "It's over! It's all coming out!"],
  aftermath: ["...Well. That happened.", "I'm so sorry. I really tried.", "Empty. And mortified.", "Don't look at me.", "Let's just... start over.", "Not my finest moment."],

  // Urges.
  urgeIncoming: ["Uh-oh...", "Something's coming!", "Get ready!", "I feel one coming!", "Wait for it..."],
  sneezeIncoming: ["Ah... aah...", "Oh no, a sneeze!", "Ah... ahh... brace!", "Sneeze! Squeeze!", "Here comes a sneeze!"],
  urge: ["Oh no. Here it comes!", "Wave! Hold on!", "I need to go!", "Urge! Squeeze!", "Uh-oh. Big one!"],
  urgePassed: ["Phew. Squeezed it away.", "And... it's passing. Nice.", "Wave calmed. Good job.", "Crisis averted!", "That's how it's done."],
  urgeFaded: ["It's fading... for now.", "Phew. That wave's gone.", "Okay, it passed. Barely.", "That one rattled me.", "It'll be back, you know."],

  // Emptying.
  voiding: ["Aaahhh... relief!", "Yes! Let it all out!", "Oh, that's so much better.", "Sweet, sweet relief.", "Ahh, heaven.", "Finally!", "Let it flow...", "Best. Feeling. Ever.", "Mmm, emptying...", "I could cry. Happy tears."],
  deflated: ["Ahh. Empty. Thank you.", "Light as a feather.", "Empty and fabulous.", "That's better. So much better.", "Back to zero. Bliss.", "All clear down here.", "Fresh start. Let's keep it that way.", "Ahh, I can breathe again.", "Nothing left. Perfect.", "Ready for round two. Slowly, please."],

  // The arcade.
  proud: ["Nailed it!", "Perfect timing!", "Ooh, smooth!", "That's my pelvic floor!", "Flawless!", "Textbook!"],
  levelUp: ["Level up! It gets harder, huh?", "Next level. I'm nervous.", "Harder now? Great. Just great.", "New level! Stay with me.", "Levelling up. Hold tight!"],
}

// Who gets to speak (see AudioManager.speak): urgent lines cut in over anything, the
// bladder's own chatter about how full it is waits its turn, and everything else is a
// reaction to what just happened. Starting to empty counts as urgent, so it cuts off
// whatever was being said and drops any line waiting.
export const URGENT = new Set(['leak', 'involuntary', 'slipping', 'saved', 'urgeIncoming', 'sneezeIncoming', 'voiding'])
export const CHATTER = new Set(['sleepy', 'nominal', 'distended', 'full', 'critical'])

// How each kind of line is said.
const FRANTIC = { pitch: 1.45, rate: 1.25 }
const EXCITED = { pitch: 1.35, rate: 1.2 }
const RELAXED = { pitch: 1.15, rate: 0.95 }
const TIRED = { pitch: 1.05, rate: 0.85 }
const PLAYFUL = { pitch: 1.35, rate: 1.1 }
const GRUMPY = { pitch: 1.1, rate: 1.1 }
export const NORMAL_VOICE = { pitch: 1.2, rate: 1.05 }
export const VOICE_STYLE = {
  critical: FRANTIC, involuntary: FRANTIC, leak: FRANTIC, slipping: FRANTIC, urgeIncoming: FRANTIC, sneezeIncoming: FRANTIC,
  shaken: EXCITED, squeezed: EXCITED, clench: EXCITED, cough: EXCITED, urge: EXCITED, saved: EXCITED, proud: EXCITED, levelUp: EXCITED,
  soothe: { pitch: 1.15, rate: 0.9 },
  voiding: RELAXED, deflated: RELAXED, urgePassed: RELAXED, urgeFaded: RELAXED, leakOver: RELAXED,
  exhausted: TIRED, aftermath: TIRED,
  pokeEmpty: PLAYFUL, squeezeEmpty: PLAYFUL, clenchIdle: PLAYFUL,
  pokeFull: EXCITED, slapped: EXCITED, slapFull: FRANTIC, drinkFull: FRANTIC, coughBraced: EXCITED,
  annoyed: GRUMPY,
  sleepy: { pitch: 1.0, rate: 0.8 },
}
