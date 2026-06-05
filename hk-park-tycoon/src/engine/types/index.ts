// =============================================================================
// HK Theme Park Tycoon - Core Type System
// =============================================================================

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export enum TileType {
  EMPTY = 'EMPTY',
  PATH = 'PATH',
  RIDE_FOOTPRINT = 'RIDE_FOOTPRINT',
  SHOP_FOOTPRINT = 'SHOP_FOOTPRINT',
  DECORATION = 'DECORATION',
  WATER = 'WATER',
  TERRAIN_HILL = 'TERRAIN_HILL',
  ENTRANCE = 'ENTRANCE',
}

export enum GuestState {
  ENTERING = 'ENTERING',
  WALKING = 'WALKING',
  QUEUING = 'QUEUING',
  RIDING = 'RIDING',
  SHOPPING = 'SHOPPING',
  EATING = 'EATING',
  SITTING = 'SITTING',
  LEAVING = 'LEAVING',
  LOST = 'LOST',
}

export enum RideCategory {
  THRILL = 'THRILL',
  FAMILY = 'FAMILY',
  GENTLE = 'GENTLE',
  WATER = 'WATER',
  TRANSPORT = 'TRANSPORT',
}

export enum ShopCategory {
  FOOD = 'FOOD',
  DRINK = 'DRINK',
  SOUVENIR = 'SOUVENIR',
  FACILITY = 'FACILITY',
}

export enum StaffType {
  JANITOR = 'JANITOR',
  MECHANIC = 'MECHANIC',
  SECURITY = 'SECURITY',
  ENTERTAINER = 'ENTERTAINER',
}

export enum Weather {
  CLEAR = 'CLEAR',
  CLOUDY = 'CLOUDY',
  RAIN = 'RAIN',
  TYPHOON_WARNING = 'TYPHOON_WARNING',
  TYPHOON = 'TYPHOON',
}

export enum GameSpeed {
  PAUSED = 0,
  NORMAL = 1,
  FAST = 2,
  ULTRA = 3,
}

export enum Season {
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  AUTUMN = 'AUTUMN',
  WINTER = 'WINTER',
}

export enum ToolType {
  SELECT = 'SELECT',
  BUILD_PATH = 'BUILD_PATH',
  PLACE_RIDE = 'PLACE_RIDE',
  PLACE_SHOP = 'PLACE_SHOP',
  PLACE_DECORATION = 'PLACE_DECORATION',
  DEMOLISH = 'DEMOLISH',
  TERRAFORM = 'TERRAFORM',
}

// -----------------------------------------------------------------------------
// Core Interfaces
// -----------------------------------------------------------------------------

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  elevation: number;
  buildable: boolean;
  entityId: string | null;
  sceneryScore: number;
}

export interface GameDate {
  day: number;
  month: number;
  year: number;
}

// -----------------------------------------------------------------------------
// Rides
// -----------------------------------------------------------------------------

export interface Ride {
  id: string;
  definitionId: string;
  name: string;
  tiles: Position[];
  entranceTile: Position;
  exitTile: Position;
  rotation: 0 | 1 | 2 | 3;
  excitement: number;
  intensity: number;
  nausea: number;
  maxQueue: number;
  currentQueue: string[];
  ridersOnBoard: string[];
  status: 'building' | 'open' | 'closed' | 'broken';
  monthlyMaintenanceCost: number;
  monthsOld: number;
  totalCustomers: number;
  totalRevenue: number;
  ticketPrice: number;
  lastBreakdown: GameDate | null;
  rideTimer: number;
}

export interface RideDefinition {
  id: string;
  name: string;
  category: RideCategory;
  baseCost: number;
  monthlyMaintenance: number;
  capacity: number;
  rideDurationTicks: number;
  baseExcitement: number;
  baseIntensity: number;
  baseNausea: number;
  footprint: { w: number; h: number };
  minAge: number;
  maxAge: number;
  suggestedPrice: number;
  breakdownChance: number;
  sponsor: SponsorConfig | null;
}

// -----------------------------------------------------------------------------
// Shops
// -----------------------------------------------------------------------------

export interface Shop {
  id: string;
  definitionId: string;
  name: string;
  tile: Position;
  revenue: number;
  monthlyMaintenance: number;
  stock: number;
  maxStock: number;
}

export interface ShopDefinition {
  id: string;
  name: string;
  category: ShopCategory;
  cost: number;
  monthlyMaintenance: number;
  revenuePerCustomer: number;
  restockCost: number;
  maxStock: number;
  sponsor: SponsorConfig | null;
}

// -----------------------------------------------------------------------------
// Guests
// -----------------------------------------------------------------------------

export interface Guest {
  id: string;
  name: string;
  x: number;
  y: number;
  state: GuestState;
  happiness: number;
  happinessTarget: number;
  hunger: number;
  thirst: number;
  nausea: number;
  energy: number;
  intensityTolerance: number;
  nauseaTolerance: number;
  cash: number;
  currentPath: Position[];
  targetTile: Position | null;
  currentRideId: string | null;
  ridesRidden: string[];
  thoughtBubble: string | null;
  timeInPark: number;
  pathfindFailures: number;
}

// -----------------------------------------------------------------------------
// Staff
// -----------------------------------------------------------------------------

export interface Staff {
  id: string;
  name: string;
  type: StaffType;
  tile: Position;
  patrolArea: Position[] | null;
  salary: number;
}

// -----------------------------------------------------------------------------
// Districts
// -----------------------------------------------------------------------------

export interface District {
  id: string;
  name: string;
  description: string;
  unlockCost: number;
  tiles: { x: number; y: number; w: number; h: number };
  unlocked: boolean;
  terrain: 'flat' | 'hilly' | 'coastal';
  guestMultiplier: number;
  sponsor: SponsorConfig | null;
}

// -----------------------------------------------------------------------------
// Financial
// -----------------------------------------------------------------------------

export interface FinancialReport {
  month: number;
  year: number;
  rideRevenue: number;
  shopRevenue: number;
  entranceFeeRevenue: number;
  totalRevenue: number;
  staffWages: number;
  rideMaintenance: number;
  loanInterest: number;
  landPurchases: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
}

export interface Transaction {
  category: string;
  amount: number;
  description: string;
}

// -----------------------------------------------------------------------------
// Decorations
// -----------------------------------------------------------------------------

export interface DecorationDefinition {
  id: string;
  name: string;
  cost: number;
  sceneryValue: number;
  sponsor: SponsorConfig | null;
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: GameDate;
  entityId?: string;
  read: boolean;
}

// -----------------------------------------------------------------------------
// Sponsorship (Layer 3: Sponsorable Digital Real Estate)
// -----------------------------------------------------------------------------

export type SponsorTier = 'shop' | 'ride' | 'billboard' | 'district' | 'event' | 'vip';
export type ImpressionEventType = 'view' | 'click' | 'hover' | 'vip_mention';

export interface SponsorConfig {
  sponsorId: string;
  brandName: string;
  displayName: string;
  logoUrl: string;
  colorScheme: string;
  description: string;
  clickUrl: string | null;
  impressionTrackingId: string;
  tier: SponsorTier;
  startDate: string;
  endDate: string;
}

export interface ImpressionEvent {
  timestamp: number;
  surfaceType: SponsorTier;
  surfaceId: string;
  sponsorId: string | null;
  eventType: ImpressionEventType;
  sessionId: string;
  duration?: number;
}

export interface SponsorableEntity {
  defaultName: string;
  defaultIcon: string;
  defaultDescription: string;
  defaultColorScheme: string;
  sponsor: SponsorConfig | null;
}

export interface DisplayConfig {
  name: string;
  icon: string;
  color: string;
  description: string;
}

// VIP AI Guest system
export interface VIPPersona {
  id: string;
  name: string;
  title: string;
  personality: string;
  loves: string[];
  dislikes: string[];
  catchphrases: string[];
  avatarEmoji: string;
  brandAffinity: VIPBrandAffinity | null;
}

export interface VIPBrandAffinity {
  brand: string;
  product: string;
  relationship: string;
  mentionFrequency: number;
}

// -----------------------------------------------------------------------------
// Game State
// -----------------------------------------------------------------------------

export interface GameState {
  grid: Tile[][];
  money: number;
  date: GameDate;
  speed: GameSpeed;
  guests: Map<string, Guest>;
  rides: Map<string, Ride>;
  shops: Map<string, Shop>;
  staff: Map<string, Staff>;
  districts: District[];
  parkRating: number;
  parkName: string;
  selectedTool: ToolType;
  loanAmount: number;
  loanInterestRate: number;
  monthlyReports: FinancialReport[];
  totalGuestsAllTime: number;
  maxGuestsAtOnce: number;
  weather: Weather;
  season: Season;
  currentTick: number;
  notifications: Notification[];
}

// -----------------------------------------------------------------------------
// Event Bus
// -----------------------------------------------------------------------------

export type GameEvent =
  | { type: 'GUEST_ENTERED'; guestId: string }
  | { type: 'GUEST_LEFT'; guestId: string; happiness: number }
  | { type: 'GUEST_LOST'; guestId: string; position: Position }
  | { type: 'RIDE_BUILT'; rideId: string; definitionId: string }
  | { type: 'RIDE_OPENED'; rideId: string }
  | { type: 'RIDE_CLOSED'; rideId: string }
  | { type: 'RIDE_BROKEN'; rideId: string }
  | { type: 'RIDE_REPAIRED'; rideId: string }
  | { type: 'RIDE_DEMOLISHED'; rideId: string }
  | { type: 'RIDE_CYCLE_COMPLETE'; rideId: string; riders: string[] }
  | { type: 'SHOP_BUILT'; shopId: string; definitionId: string }
  | { type: 'SHOP_DEMOLISHED'; shopId: string }
  | { type: 'SHOP_OUT_OF_STOCK'; shopId: string }
  | { type: 'SHOP_RESTOCKED'; shopId: string }
  | { type: 'STAFF_HIRED'; staffId: string; staffType: StaffType }
  | { type: 'STAFF_FIRED'; staffId: string }
  | { type: 'DISTRICT_UNLOCKED'; districtId: string }
  | { type: 'WEATHER_CHANGED'; from: Weather; to: Weather }
  | { type: 'SEASON_CHANGED'; from: Season; to: Season }
  | { type: 'MONTH_ENDED'; report: FinancialReport }
  | { type: 'LOAN_TAKEN'; amount: number }
  | { type: 'LOAN_REPAID'; amount: number }
  | { type: 'PARK_RATING_CHANGED'; oldRating: number; newRating: number }
  | { type: 'MONEY_CHANGED'; amount: number; transaction: Transaction }
  | { type: 'PATH_BUILT'; position: Position }
  | { type: 'PATH_DEMOLISHED'; position: Position }
  | { type: 'DECORATION_PLACED'; position: Position; definitionId: string }
  | { type: 'DECORATION_REMOVED'; position: Position }
  | { type: 'SPEED_CHANGED'; speed: GameSpeed }
  | { type: 'TOOL_SELECTED'; tool: ToolType }
  | { type: 'NOTIFICATION_ADDED'; notification: Notification }
  | { type: 'TICK'; tick: number };
