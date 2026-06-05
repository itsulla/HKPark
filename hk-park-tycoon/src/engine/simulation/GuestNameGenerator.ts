// =============================================================================
// HK Theme Park Tycoon - Guest Name Generator
// =============================================================================

// -----------------------------------------------------------------------------
// Name pools
// -----------------------------------------------------------------------------

const CANTONESE_NAMES: string[] = [
  'Wing', 'Mei', 'Siu', 'Ho', 'Ka', 'Yan', 'Chi', 'Wai', 'Ling', 'Fai',
  'Kit', 'Lok', 'Hei', 'Yat', 'Tin', 'Ming', 'Kwok', 'Tsz', 'Pui', 'Sum',
  'Tak', 'Man', 'Lai', 'Yee', 'Chun', 'Fung', 'Sze', 'Kwan', 'Hin', 'Pak',
  'Cheuk', 'Yiu', 'Shing', 'Wah', 'Lam', 'Kai', 'Tsang', 'Po', 'On', 'Chung',
  'Hang', 'Nga', 'Bik', 'Sin', 'Shun', 'Sau', 'Ngan', 'Yuen', 'Tung', 'Long',
];

const INTERNATIONAL_NAMES: string[] = [
  'James', 'Sarah', 'Mike', 'Lisa', 'Tom', 'Emma', 'Alex', 'Sophie', 'Ben', 'Lucy',
  'David', 'Anna', 'Chris', 'Rachel', 'Nick', 'Olivia', 'Jack', 'Emily', 'Sam', 'Chloe',
  'Oliver', 'Grace', 'Harry', 'Mia', 'Charlie', 'Ella', 'Leo', 'Lily', 'Oscar', 'Zoe',
  'Kenji', 'Yuki', 'Min-jun', 'Sora', 'Carlos', 'Maria', 'Pierre', 'Amelie', 'Hans', 'Ingrid',
  'Raj', 'Priya', 'Amir', 'Fatima', 'Diego', 'Isabella', 'Luca', 'Elena', 'Mateo', 'Sofia',
];

const THEME_PARK_NAMES: string[] = [
  'Happy Harry', 'Thrillseeker Tina', 'Dizzy Dave', 'Queue Queen', 'Coaster Carl',
  'Loop-de-Lou', 'Funnel Cake Frank', 'Screaming Sally', 'Brave Bobby', 'Cotton Candy Cathy',
  'Rollercoaster Rick', 'Souvenir Steve', 'Photo-op Pam', 'FastPass Freddie', 'Pretzel Pete',
  'Whiplash Wendy', 'Bumper Car Barry', 'Teacup Teresa', 'G-Force Greg', 'Splash Zone Sandra',
  'Adrenaline Andy', 'Balloon Betty', 'Churro Charlie', 'Drop Tower Daisy', 'Ferris Fred',
  'Height-Check Helen', 'Inversion Ivan', 'Joyride Jenny', 'Kettle Corn Ken', 'Lazy River Liz',
];

const ALL_NAMES: string[] = [
  ...CANTONESE_NAMES,
  ...INTERNATIONAL_NAMES,
  ...THEME_PARK_NAMES,
];

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Returns a random guest name from a pool of 130+ names mixing
 * Cantonese, international, and fun theme-park-themed names.
 */
export function getRandomGuestName(): string {
  return ALL_NAMES[Math.floor(Math.random() * ALL_NAMES.length)];
}
