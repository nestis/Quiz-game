/**
 * Seed script – creates 6 themed quiz games with a total of ~110 questions.
 * Safe to re-run: each game is identified by name; existing games are skipped.
 */
const { v4: uuid } = require('uuid');
const { db, T, PutCommand, ScanCommand } = require('./db');

// ── Question banks ────────────────────────────────────────────────────────────

const GAMES = [
  {
    name: 'General Knowledge',
    description: 'A crowd-pleasing mix of 20 questions covering Science, History, Geography, Art, Sports, and more.',
    questions: [
      { type:'quiz',       category:'Science',    emoji:'🔬', question:'What is the chemical symbol for Gold?',                              answers:['Au','Ag','Fe','Gd'],                                         correct:0, time:20 },
      { type:'quiz',       category:'Science',    emoji:'⚛️', question:'How many bones are in the adult human body?',                        answers:['206','186','248','212'],                                      correct:0, time:20 },
      { type:'true_false', category:'Biology',    emoji:'🧬', question:'The human heart has four chambers.',                                 answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Space',      emoji:'🚀', question:'Which planet is known as the Red Planet?',                          answers:['Mars','Venus','Jupiter','Saturn'],                            correct:0, time:20 },
      { type:'quiz',       category:'Space',      emoji:'⭐', question:'What is the name of our galaxy?',                                   answers:['Milky Way','Andromeda','Triangulum','Whirlpool'],             correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'📜', question:'In what year did World War II end?',                                answers:['1945','1942','1948','1944'],                                  correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'🏛️', question:'Who was the first President of the United States?',                 answers:['George Washington','Thomas Jefferson','Abraham Lincoln','John Adams'], correct:0, time:20 },
      { type:'true_false', category:'History',    emoji:'🗿', question:'The Great Wall of China is visible from space with the naked eye.',  answers:['True','False'],                                              correct:1, time:15 },
      { type:'quiz',       category:'Geography',  emoji:'🌍', question:'What is the capital city of Australia?',                           answers:['Canberra','Sydney','Melbourne','Brisbane'],                   correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'⛰️', question:'Which is the tallest mountain in the world?',                      answers:['Mount Everest','K2','Kangchenjunga','Makalu'],                correct:0, time:15 },
      { type:'quiz',       category:'Art',        emoji:'🎨', question:'Who painted the Mona Lisa?',                                       answers:['Leonardo da Vinci','Michelangelo','Raphael','Van Gogh'],      correct:0, time:20 },
      { type:'quiz',       category:'Literature', emoji:'📚', question:'Who wrote "Romeo and Juliet"?',                                    answers:['William Shakespeare','Charles Dickens','Jane Austen','Leo Tolstoy'], correct:0, time:20 },
      { type:'quiz',       category:'Music',      emoji:'🎹', question:'How many keys does a standard piano have?',                        answers:['88','76','92','80'],                                          correct:0, time:20 },
      { type:'quiz',       category:'Sports',     emoji:'⚽', question:'How many players are on a standard soccer team?',                 answers:['11','9','13','10'],                                           correct:0, time:15 },
      { type:'quiz',       category:'Sports',     emoji:'🏆', question:'How often are the Summer Olympic Games held?',                    answers:['Every 4 years','Every 2 years','Every year','Every 5 years'], correct:0, time:20 },
      { type:'true_false', category:'Nature',     emoji:'🦩', question:'A group of flamingos is called a "flamboyance".',                  answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Food',       emoji:'🍕', question:'Which country did pizza originate from?',                         answers:['Italy','Greece','Spain','France'],                            correct:0, time:20 },
      { type:'true_false', category:'Food',       emoji:'🍅', question:'Tomatoes are botanically classified as a fruit.',                  answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Math',       emoji:'🔢', question:'What is 7 × 8?',                                                  answers:['56','54','63','48'],                                          correct:0, time:15 },
      { type:'quiz',       category:'Language',   emoji:'🗣️', question:'What is the most spoken language by native speakers?',            answers:['Mandarin Chinese','English','Spanish','Hindi'],               correct:0, time:20 },
    ],
  },

  {
    name: 'Science & Technology',
    description: '20 questions on physics, biology, chemistry, space, computers, and the people behind great discoveries.',
    questions: [
      { type:'quiz',       category:'Physics',    emoji:'⚡', question:'What is the SI unit of electrical resistance?',                    answers:['Ohm','Volt','Ampere','Watt'],                                 correct:0, time:20 },
      { type:'quiz',       category:'Biology',    emoji:'🧬', question:'What is the powerhouse of the cell?',                             answers:['Mitochondria','Nucleus','Ribosome','Golgi body'],             correct:0, time:20 },
      { type:'quiz',       category:'Chemistry',  emoji:'🧪', question:'What is the most abundant gas in Earth\'s atmosphere?',           answers:['Nitrogen','Oxygen','Carbon Dioxide','Argon'],                correct:0, time:20 },
      { type:'quiz',       category:'Chemistry',  emoji:'⚗️', question:'What is the chemical formula for table salt?',                    answers:['NaCl','KCl','NaOH','HCl'],                                   correct:0, time:20 },
      { type:'quiz',       category:'Physics',    emoji:'🌡️', question:'At what temperature (°C) does water boil at sea level?',          answers:['100','90','110','80'],                                        correct:0, time:15 },
      { type:'quiz',       category:'Space',      emoji:'🪐', question:'Which planet has the most moons?',                               answers:['Saturn','Jupiter','Uranus','Neptune'],                        correct:0, time:20 },
      { type:'quiz',       category:'Space',      emoji:'☀️', question:'Approximately how long does light from the Sun take to reach Earth?', answers:['8 minutes','1 hour','30 seconds','3 hours'],             correct:0, time:25 },
      { type:'quiz',       category:'Physics',    emoji:'🔭', question:'Who developed the theory of General Relativity?',                 answers:['Albert Einstein','Isaac Newton','Nikola Tesla','Max Planck'], correct:0, time:20 },
      { type:'quiz',       category:'Biology',    emoji:'🦠', question:'How many chromosomes do humans normally have?',                   answers:['46','23','48','44'],                                          correct:0, time:20 },
      { type:'true_false', category:'Biology',    emoji:'🩸', question:'Red blood cells have a nucleus.',                                 answers:['True','False'],                                              correct:1, time:15 },
      { type:'quiz',       category:'Technology', emoji:'💻', question:'What does "CPU" stand for?',                                     answers:['Central Processing Unit','Core Power Unit','Compute Protocol Unit','Control Processing Unit'], correct:0, time:20 },
      { type:'quiz',       category:'Technology', emoji:'🖥️', question:'How many bits are in a byte?',                                   answers:['8','4','16','32'],                                            correct:0, time:15 },
      { type:'quiz',       category:'Technology', emoji:'📱', question:'In what year was the first iPhone released?',                    answers:['2007','2005','2009','2003'],                                  correct:0, time:20 },
      { type:'quiz',       category:'Technology', emoji:'🌐', question:'What does "HTTP" stand for?',                                    answers:['HyperText Transfer Protocol','High Transfer Text Protocol','HyperText Technical Process','Hybrid Text Transfer Protocol'], correct:0, time:25 },
      { type:'true_false', category:'Technology', emoji:'🤖', question:'The Python programming language is named after the Monty Python comedy group.', answers:['True','False'],                              correct:0, time:20 },
      { type:'quiz',       category:'Physics',    emoji:'💎', question:'What is the hardest natural substance on Earth?',                answers:['Diamond','Titanium','Graphene','Quartz'],                     correct:0, time:20 },
      { type:'quiz',       category:'Biology',    emoji:'🧠', question:'What is the largest organ in the human body?',                   answers:['Skin','Liver','Brain','Lungs'],                               correct:0, time:20 },
      { type:'true_false', category:'Physics',    emoji:'🌊', question:'Sound travels faster in water than in air.',                     answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Chemistry',  emoji:'🪙', question:'What is the atomic number of Carbon?',                          answers:['6','8','12','4'],                                             correct:0, time:20 },
      { type:'quiz',       category:'Space',      emoji:'🌌', question:'What is the name of the closest star to our Solar System (other than the Sun)?', answers:['Proxima Centauri','Sirius','Betelgeuse','Vega'], correct:0, time:25 },
    ],
  },

  {
    name: 'History & Geography',
    description: '20 questions spanning ancient civilisations, world wars, famous landmarks, capitals, and world records.',
    questions: [
      { type:'quiz',       category:'History',    emoji:'🏺', question:'Which ancient civilisation built the Great Pyramids?',           answers:['Ancient Egyptians','Ancient Greeks','Romans','Babylonians'],  correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'⚔️', question:'In which year did World War I begin?',                           answers:['1914','1918','1910','1916'],                                  correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'🗽', question:'Which country gifted the Statue of Liberty to the USA?',         answers:['France','England','Spain','Italy'],                           correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'🌕', question:'Who was the first person to walk on the Moon?',                  answers:['Neil Armstrong','Buzz Aldrin','Yuri Gagarin','Alan Shepard'], correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'🧱', question:'In which year did the Berlin Wall fall?',                        answers:['1989','1991','1985','1993'],                                  correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'⛵', question:'In which year did Christopher Columbus first reach the Americas?', answers:['1492','1482','1502','1472'],                                correct:0, time:20 },
      { type:'true_false', category:'History',    emoji:'👑', question:'Queen Victoria reigned for over 60 years.',                      answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'History',    emoji:'🎨', question:'Who painted the ceiling of the Sistine Chapel?',                answers:['Michelangelo','Leonardo da Vinci','Raphael','Botticelli'],    correct:0, time:20 },
      { type:'quiz',       category:'History',    emoji:'🏛️', question:'Which empire was ruled by Julius Caesar?',                      answers:['Roman Empire','Greek Empire','Ottoman Empire','Persian Empire'], correct:0, time:20 },
      { type:'true_false', category:'History',    emoji:'🐉', question:'The Mongol Empire was the largest contiguous empire in history.', answers:['True','False'],                                              correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🌍', question:'What is the capital of Brazil?',                                answers:['Brasília','São Paulo','Rio de Janeiro','Salvador'],           correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🌊', question:'Which is the longest river in the world?',                      answers:['Nile','Amazon','Yangtze','Mississippi'],                      correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🏔️', question:'Which mountain range contains Mount Everest?',                  answers:['Himalayas','Andes','Alps','Rockies'],                         correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🗺️', question:'What is the smallest country in the world by area?',            answers:['Vatican City','Monaco','San Marino','Liechtenstein'],        correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🌏', question:'Which country has the most natural lakes?',                     answers:['Canada','Russia','USA','Finland'],                            correct:0, time:20 },
      { type:'true_false', category:'Geography',  emoji:'🦘', question:'Australia is both a country and a continent.',                   answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Geography',  emoji:'💧', question:'What is the world\'s largest ocean?',                           answers:['Pacific','Atlantic','Indian','Arctic'],                       correct:0, time:15 },
      { type:'quiz',       category:'Geography',  emoji:'🌋', question:'Which country has the highest number of active volcanoes?',     answers:['Indonesia','Japan','USA','Iceland'],                          correct:0, time:25 },
      { type:'true_false', category:'Geography',  emoji:'🌿', question:'The Amazon Rainforest produces about 20% of the world\'s oxygen.', answers:['True','False'],                                            correct:0, time:20 },
      { type:'quiz',       category:'Geography',  emoji:'🏙️', question:'What is the most populous city in the world?',                  answers:['Tokyo','Delhi','Shanghai','São Paulo'],                       correct:0, time:20 },
    ],
  },

  {
    name: 'Sports & Games',
    description: '20 questions covering football, basketball, tennis, the Olympics, and a few classic board games.',
    questions: [
      { type:'quiz',       category:'Football',   emoji:'⚽', question:'Which country has won the most FIFA World Cup titles?',           answers:['Brazil','Germany','Italy','Argentina'],                       correct:0, time:20 },
      { type:'quiz',       category:'Basketball', emoji:'🏀', question:'How many players are on the court per team in basketball?',      answers:['5','6','4','7'],                                             correct:0, time:15 },
      { type:'quiz',       category:'Tennis',     emoji:'🎾', question:'Which Grand Slam tournament is played on clay courts?',         answers:['French Open','Wimbledon','US Open','Australian Open'],        correct:0, time:20 },
      { type:'quiz',       category:'Olympics',   emoji:'🏅', question:'In what year were the first modern Olympic Games held?',         answers:['1896','1900','1892','1904'],                                  correct:0, time:20 },
      { type:'quiz',       category:'Olympics',   emoji:'🥇', question:'Which city hosted the 2012 Summer Olympics?',                   answers:['London','Paris','Beijing','Rio de Janeiro'],                  correct:0, time:20 },
      { type:'quiz',       category:'Golf',       emoji:'⛳', question:'How many holes are on a standard golf course?',                 answers:['18','9','27','36'],                                           correct:0, time:15 },
      { type:'quiz',       category:'American Football', emoji:'🏈', question:'How many points is a touchdown worth in American football?', answers:['6','7','5','4'],                                         correct:0, time:15 },
      { type:'quiz',       category:'Cricket',    emoji:'🏏', question:'Which country invented the sport of cricket?',                  answers:['England','Australia','India','South Africa'],                 correct:0, time:20 },
      { type:'quiz',       category:'Athletics',  emoji:'🏃', question:'What is the official distance of a marathon?',                  answers:['42.195 km','40 km','45 km','50 km'],                          correct:0, time:20 },
      { type:'quiz',       category:'Swimming',   emoji:'🏊', question:'How many swimming strokes are contested in the Olympic medley?', answers:['4','3','5','6'],                                             correct:0, time:20 },
      { type:'true_false', category:'Football',   emoji:'⚽', question:'A standard football match has two 45-minute halves.',           answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Boxing',     emoji:'🥊', question:'How many rounds are in a standard professional boxing title fight?', answers:['12','15','10','8'],                                      correct:0, time:20 },
      { type:'quiz',       category:'Volleyball', emoji:'🏐', question:'Which sport has a player position called the "libero"?',        answers:['Volleyball','Basketball','Handball','Water Polo'],            correct:0, time:20 },
      { type:'quiz',       category:'Archery',    emoji:'🎯', question:'What colour is the bullseye (innermost ring) of an archery target?', answers:['Yellow','Red','Black','Blue'],                          correct:0, time:20 },
      { type:'true_false', category:'Olympics',   emoji:'🤸', question:'Gymnastics has been part of every modern Olympic Games.',        answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Chess',      emoji:'♟️', question:'How many squares are on a standard chess board?',              answers:['64','32','48','128'],                                         correct:0, time:15 },
      { type:'quiz',       category:'Board Games',emoji:'🎲', question:'In Monopoly, what is the most expensive property on the standard UK board?', answers:['Mayfair','Park Lane','Bond Street','Oxford Street'], correct:0, time:25 },
      { type:'quiz',       category:'Badminton',  emoji:'🏸', question:'What is the name of the projectile used in badminton?',         answers:['Shuttlecock','Birdie','Puck','Pellet'],                       correct:0, time:15 },
      { type:'true_false', category:'Cycling',    emoji:'🚴', question:'The Tour de France is held every year.',                        answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Motorsport', emoji:'🏎️', question:'Which country hosts the Monaco Grand Prix?',                   answers:['Monaco','France','Italy','Luxembourg'],                       correct:0, time:20 },
    ],
  },

  {
    name: 'Entertainment & Pop Culture',
    description: '20 questions on movies, music, TV shows, video games, and celebrity trivia from the past few decades.',
    questions: [
      { type:'quiz',       category:'Movies',     emoji:'🎬', question:'Who played Iron Man in the Marvel Cinematic Universe?',          answers:['Robert Downey Jr.','Chris Evans','Chris Hemsworth','Mark Ruffalo'], correct:0, time:20 },
      { type:'quiz',       category:'Movies',     emoji:'🚀', question:'In what year was the original Star Wars film released?',         answers:['1977','1975','1980','1983'],                                  correct:0, time:20 },
      { type:'quiz',       category:'Movies',     emoji:'🦖', question:'Who directed Jurassic Park (1993)?',                            answers:['Steven Spielberg','George Lucas','James Cameron','Peter Jackson'], correct:0, time:20 },
      { type:'quiz',       category:'Movies',     emoji:'🧙', question:'Who played Hermione Granger in the Harry Potter films?',        answers:['Emma Watson','Emma Stone','Keira Knightley','Natalie Portman'], correct:0, time:20 },
      { type:'true_false', category:'Movies',     emoji:'🎥', question:'The Titanic (1997) won 11 Academy Awards.',                    answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Music',      emoji:'🎸', question:'"Bohemian Rhapsody" was recorded by which band?',              answers:['Queen','The Beatles','Led Zeppelin','Pink Floyd'],            correct:0, time:20 },
      { type:'true_false', category:'Music',      emoji:'🎵', question:'The Beatles were originally from Liverpool, England.',          answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Music',      emoji:'🎤', question:'What is the real name of the rapper Eminem?',                  answers:['Marshall Mathers','Eric Matthews','Mark Avery','Michael Evans'], correct:0, time:20 },
      { type:'quiz',       category:'Music',      emoji:'🕺', question:'Which country does the K-pop group BTS come from?',            answers:['South Korea','Japan','China','Thailand'],                     correct:0, time:20 },
      { type:'quiz',       category:'TV',         emoji:'👑', question:'Which TV series features the Iron Throne?',                    answers:['Game of Thrones','The Witcher','Vikings','The Last Kingdom'],  correct:0, time:20 },
      { type:'true_false', category:'TV',         emoji:'📺', question:'The Simpsons first aired in 1989.',                            answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'TV',         emoji:'🌀', question:'Which streaming service produced the show Stranger Things?',   answers:['Netflix','Amazon Prime','Disney+','HBO Max'],                 correct:0, time:20 },
      { type:'quiz',       category:'TV',         emoji:'🍕', question:'What is the name of the coffee shop in the TV show Friends?',  answers:['Central Perk','The Brew','Java Hut','Daily Grind'],           correct:0, time:20 },
      { type:'quiz',       category:'Video Games',emoji:'🎮', question:'What is the best-selling video game of all time?',             answers:['Minecraft','Tetris','GTA V','Wii Sports'],                    correct:0, time:20 },
      { type:'quiz',       category:'Video Games',emoji:'🍄', question:'Which video game character is Nintendo\'s mascot?',            answers:['Mario','Link','Pikachu','Donkey Kong'],                       correct:0, time:15 },
      { type:'true_false', category:'Video Games',emoji:'👾', question:'Pac-Man was originally released in 1980.',                     answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Books',      emoji:'📖', question:'Who wrote the Harry Potter series?',                           answers:['J.K. Rowling','Stephenie Meyer','Suzanne Collins','Philip Pullman'], correct:0, time:15 },
      { type:'quiz',       category:'Books',      emoji:'🧝', question:'Who wrote The Lord of the Rings?',                            answers:['J.R.R. Tolkien','C.S. Lewis','George R.R. Martin','Terry Pratchett'], correct:0, time:20 },
      { type:'quiz',       category:'Movies',     emoji:'🦁', question:'In The Lion King, what is the name of Simba\'s father?',       answers:['Mufasa','Simba','Scar','Pumba'],                              correct:0, time:15 },
      { type:'quiz',       category:'Music',      emoji:'🏆', question:'Which artist has won the most Grammy Awards?',                 answers:['Beyoncé','Jay-Z','Taylor Swift','Adele'],                     correct:0, time:25 },
    ],
  },

  {
    name: 'Brain Teasers & Tricky Trivia',
    description: '15 lateral thinking puzzles, clever wordplay, and deceptive trivia questions. Think before you click!',
    questions: [
      { type:'quiz',       category:'Riddle',     emoji:'🧩', question:'How many months of the year have 28 days?',                     answers:['All 12','Only February','Only February in a leap year','1'], correct:0, time:20 },
      { type:'quiz',       category:'Riddle',     emoji:'🥚', question:'If a rooster lays an egg on a pointed rooftop, which way does the egg roll?', answers:['Roosters don\'t lay eggs','Left','Right','Straight down'], correct:0, time:25 },
      { type:'quiz',       category:'Math',       emoji:'🔢', question:'What is 2 to the power of 10?',                                answers:['1,024','512','2,048','256'],                                  correct:0, time:20 },
      { type:'quiz',       category:'Riddle',     emoji:'💧', question:'What gets wetter the more it dries?',                          answers:['A towel','A sponge','Rain','A river'],                        correct:0, time:20 },
      { type:'quiz',       category:'Math',       emoji:'📐', question:'How many sides does a hexagon have?',                          answers:['6','5','7','8'],                                             correct:0, time:10 },
      { type:'quiz',       category:'Riddle',     emoji:'🗝️', question:'What has keys but no locks, space but no room, and you can enter but can\'t go inside?', answers:['A keyboard','A map','A piano','A dictionary'], correct:0, time:25 },
      { type:'quiz',       category:'Math',       emoji:'🧮', question:'What is 15% of 200?',                                          answers:['30','25','35','20'],                                          correct:0, time:20 },
      { type:'true_false', category:'Nature',     emoji:'🐦', question:'A group of crows is called a "murder".',                       answers:['True','False'],                                              correct:0, time:15 },
      { type:'quiz',       category:'Riddle',     emoji:'🌅', question:'If you overtake the person in second place in a race, what place are you in?', answers:['Second','First','Third','Last'],              correct:0, time:20 },
      { type:'quiz',       category:'Science',    emoji:'🌀', question:'A day on Venus (one full rotation) is longer than a year on Venus (one orbit of the Sun).',  answers:['True','False'],              correct:0, time:25 },
      { type:'quiz',       category:'Math',       emoji:'🔳', question:'How many faces does a cube have?',                            answers:['6','8','4','12'],                                             correct:0, time:15 },
      { type:'quiz',       category:'Math',       emoji:'√',  question:'What is the square root of 144?',                             answers:['12','14','11','13'],                                          correct:0, time:15 },
      { type:'quiz',       category:'Geography',  emoji:'🌐', question:'What is the only country in the world that is also its own continent?', answers:['Australia','Greenland','Iceland','Antarctica'],     correct:0, time:20 },
      { type:'quiz',       category:'Riddle',     emoji:'🕯️', question:'You have one match. You enter a cold dark room with a candle, an oil lamp, and a fire. Which do you light first?', answers:['The match','The candle','The oil lamp','The fire'], correct:0, time:25 },
      { type:'quiz',       category:'Science',    emoji:'🌍', question:'If you dug a hole straight through the Earth from the UK, you would come out in…', answers:['The Pacific Ocean','New Zealand','Australia','Antarctica'], correct:0, time:25 },
    ],
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

async function seedIfEmpty() {
  // Get all existing game names
  const { Items } = await db.send(new ScanCommand({
    TableName: T.GAMES,
    ProjectionExpression: '#n',
    ExpressionAttributeNames: { '#n': 'name' },
  }));
  const existingNames = new Set((Items || []).map(g => g.name));

  let created = 0;
  for (const gameData of GAMES) {
    if (existingNames.has(gameData.name)) {
      console.log(`  Skipping "${gameData.name}" (already exists)`);
      continue;
    }

    const gameId = uuid();
    await db.send(new PutCommand({
      TableName: T.GAMES,
      Item: {
        id: gameId,
        name: gameData.name,
        description: gameData.description,
        questionCount: gameData.questions.length,
        timesPlayed: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    for (const q of gameData.questions) {
      await db.send(new PutCommand({
        TableName: T.QUESTIONS,
        Item: { id: uuid(), gameId, ...q },
      }));
    }

    console.log(`  Created "${gameData.name}" (${gameData.questions.length} questions)`);
    created++;
  }

  if (created === 0) console.log('  All games already exist – nothing to seed.');
  else console.log(`  Seeded ${created} new game(s).`);
}

module.exports = { seedIfEmpty };

// Allow running directly: node server/seed.js
if (require.main === module) {
  const { initDB } = require('./db');
  (async () => {
    await initDB();
    await seedIfEmpty();
    console.log('Done.');
    process.exit(0);
  })();
}
