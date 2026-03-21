// Question bank – mix of quiz (4-option) and true_false types
// correct: index into the answers array

const ALL_QUESTIONS = [
  // ── SCIENCE ──
  {
    type: 'quiz', category: 'Science', emoji: '🔬',
    question: 'What is the chemical symbol for Gold?',
    answers: ['Au', 'Ag', 'Fe', 'Gd'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Science', emoji: '🔬',
    question: 'How many bones are in the adult human body?',
    answers: ['206', '186', '248', '212'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Science', emoji: '⚛️',
    question: 'What is the speed of light (approx.) in km/s?',
    answers: ['300,000', '150,000', '500,000', '1,000,000'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Biology', emoji: '🧬',
    question: 'The human heart has four chambers.',
    answers: ['True', 'False'], correct: 0, time: 15
  },
  {
    type: 'true_false', category: 'Science', emoji: '🌡️',
    question: 'Water boils at 90 °C at standard atmospheric pressure.',
    answers: ['True', 'False'], correct: 1, time: 15
  },
  {
    type: 'quiz', category: 'Chemistry', emoji: '🧪',
    question: 'What element does "O" represent on the periodic table?',
    answers: ['Oxygen', 'Osmium', 'Oganesson', 'Oxide'], correct: 0, time: 20
  },

  // ── SPACE ──
  {
    type: 'quiz', category: 'Space', emoji: '🚀',
    question: 'Which planet is known as the Red Planet?',
    answers: ['Mars', 'Venus', 'Jupiter', 'Saturn'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Space', emoji: '🪐',
    question: 'Which is the largest planet in our Solar System?',
    answers: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Space', emoji: '🌙',
    question: 'The Moon has its own source of light.',
    answers: ['True', 'False'], correct: 1, time: 15
  },
  {
    type: 'quiz', category: 'Space', emoji: '⭐',
    question: 'What is the name of our galaxy?',
    answers: ['Milky Way', 'Andromeda', 'Triangulum', 'Whirlpool'], correct: 0, time: 20
  },

  // ── HISTORY ──
  {
    type: 'quiz', category: 'History', emoji: '📜',
    question: 'In what year did World War II end?',
    answers: ['1945', '1942', '1948', '1944'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'History', emoji: '🏛️',
    question: 'Who was the first President of the United States?',
    answers: ['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'History', emoji: '🗿',
    question: 'The Great Wall of China is visible from space with the naked eye.',
    answers: ['True', 'False'], correct: 1, time: 15
  },
  {
    type: 'quiz', category: 'History', emoji: '🔱',
    question: 'Which ancient wonder was located in Alexandria, Egypt?',
    answers: ['The Lighthouse', 'The Colossus', 'The Hanging Gardens', 'The Mausoleum'], correct: 0, time: 25
  },

  // ── GEOGRAPHY ──
  {
    type: 'quiz', category: 'Geography', emoji: '🌍',
    question: 'What is the capital city of Australia?',
    answers: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Geography', emoji: '🌊',
    question: 'What is the largest ocean on Earth?',
    answers: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Geography', emoji: '⛰️',
    question: 'Which is the tallest mountain in the world?',
    answers: ['Mount Everest', 'K2', 'Kangchenjunga', 'Makalu'], correct: 0, time: 15
  },
  {
    type: 'quiz', category: 'Geography', emoji: '🗺️',
    question: 'How many continents are there on Earth?',
    answers: ['7', '5', '6', '8'], correct: 0, time: 15
  },
  {
    type: 'true_false', category: 'Geography', emoji: '🌏',
    question: 'Russia is the largest country in the world by area.',
    answers: ['True', 'False'], correct: 0, time: 15
  },

  // ── ART & CULTURE ──
  {
    type: 'quiz', category: 'Art', emoji: '🎨',
    question: 'Who painted the Mona Lisa?',
    answers: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Vincent van Gogh'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Literature', emoji: '📚',
    question: 'Who wrote "Romeo and Juliet"?',
    answers: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Leo Tolstoy'], correct: 0, time: 20
  },

  // ── MUSIC ──
  {
    type: 'quiz', category: 'Music', emoji: '🎵',
    question: 'How many strings does a standard acoustic guitar have?',
    answers: ['6', '4', '8', '12'], correct: 0, time: 15
  },
  {
    type: 'quiz', category: 'Music', emoji: '🎹',
    question: 'How many keys does a standard piano have?',
    answers: ['88', '76', '92', '80'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Music', emoji: '🎸',
    question: 'Ludwig van Beethoven composed his Ninth Symphony after losing his hearing.',
    answers: ['True', 'False'], correct: 0, time: 20
  },

  // ── SPORTS ──
  {
    type: 'quiz', category: 'Sports', emoji: '🏀',
    question: 'In which sport would you perform a "slam dunk"?',
    answers: ['Basketball', 'Volleyball', 'Tennis', 'Baseball'], correct: 0, time: 15
  },
  {
    type: 'quiz', category: 'Sports', emoji: '⚽',
    question: 'How many players are on a standard soccer (football) team?',
    answers: ['11', '9', '13', '10'], correct: 0, time: 15
  },
  {
    type: 'quiz', category: 'Sports', emoji: '🏆',
    question: 'How often are the Summer Olympic Games held?',
    answers: ['Every 4 years', 'Every 2 years', 'Every year', 'Every 5 years'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Sports', emoji: '🎾',
    question: 'A tennis match is played best of 5 sets in all Grand Slam tournaments.',
    answers: ['True', 'False'], correct: 1, time: 20
  },

  // ── NATURE ──
  {
    type: 'true_false', category: 'Nature', emoji: '🦩',
    question: 'A group of flamingos is called a "flamboyance".',
    answers: ['True', 'False'], correct: 0, time: 15
  },
  {
    type: 'true_false', category: 'Nature', emoji: '🦇',
    question: 'All bats are completely blind.',
    answers: ['True', 'False'], correct: 1, time: 15
  },
  {
    type: 'quiz', category: 'Nature', emoji: '🐘',
    question: 'Which is the largest land animal on Earth?',
    answers: ['African Elephant', 'White Rhinoceros', 'Giraffe', 'Hippopotamus'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Nature', emoji: '🐟',
    question: 'What is the largest fish in the ocean?',
    answers: ['Whale Shark', 'Great White Shark', 'Blue Whale', 'Manta Ray'], correct: 0, time: 20
  },

  // ── FOOD ──
  {
    type: 'quiz', category: 'Food', emoji: '🍕',
    question: 'Which country did pizza originate from?',
    answers: ['Italy', 'Greece', 'Spain', 'France'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Food', emoji: '🍣',
    question: 'What type of fish is traditionally used in a classic Caesar salad?',
    answers: ['Anchovy', 'Salmon', 'Tuna', 'Sardine'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Food', emoji: '🍅',
    question: 'Tomatoes are botanically classified as a fruit.',
    answers: ['True', 'False'], correct: 0, time: 15
  },

  // ── MATH ──
  {
    type: 'quiz', category: 'Math', emoji: '🔢',
    question: 'What is 7 × 8?',
    answers: ['56', '54', '63', '48'], correct: 0, time: 15
  },
  {
    type: 'quiz', category: 'Math', emoji: '📐',
    question: 'What is the value of π (pi) to 2 decimal places?',
    answers: ['3.14', '3.16', '3.12', '3.18'], correct: 0, time: 15
  },
  {
    type: 'true_false', category: 'Math', emoji: '♾️',
    question: 'A square is a special type of rectangle.',
    answers: ['True', 'False'], correct: 0, time: 15
  },

  // ── LANGUAGE ──
  {
    type: 'quiz', category: 'Language', emoji: '🗣️',
    question: 'What is the most spoken language by native speakers?',
    answers: ['Mandarin Chinese', 'English', 'Spanish', 'Hindi'], correct: 0, time: 20
  },
  {
    type: 'quiz', category: 'Language', emoji: '🔤',
    question: 'How many letters are in the English alphabet?',
    answers: ['26', '24', '28', '25'], correct: 0, time: 15
  },

  // ── TECH ──
  {
    type: 'quiz', category: 'Technology', emoji: '💻',
    question: 'What does "CPU" stand for?',
    answers: ['Central Processing Unit', 'Core Power Unit', 'Compute Program Unit', 'Central Protocol Unit'], correct: 0, time: 20
  },
  {
    type: 'true_false', category: 'Technology', emoji: '🤖',
    question: 'The first commercially available computer mouse was invented by Apple.',
    answers: ['True', 'False'], correct: 1, time: 20
  }
];
