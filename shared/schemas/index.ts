import { z } from 'zod';

// =============================================================================
// Categories
// =============================================================================

export const CategoryEnum = z.enum([
    '3top',
    '3tod',
    '3down',
    '3back',
    '2top',
    '2tod',
    '2down',
    '2back',
]);

export type Category = z.infer<typeof CategoryEnum>;

export const CATEGORY_LABELS: Record<Category, string> = {
    '3top': '3 ตัวบน',
    '3down': '3 ตัวล่าง',
    '3tod': '3 ตัวโต๊ด',
    '3back': '3 ตัวกลับ',
    '2top': '2 ตัวบน',
    '2tod': '2 ตัวโต๊ด',
    '2down': '2 ตัวล่าง',
    '2back': '2 ตัวกลับ',
};

export const CATEGORY_DIGIT_LENGTH: Record<Category, number> = {
    '3top': 3,
    '3tod': 3,
    '3down': 3,
    '3back': 3,
    '2top': 2,
    '2tod': 2,
    '2down': 2,
    '2back': 2,
};

// =============================================================================
// Agent
// =============================================================================

export const AgentSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    createdAt: z.string().datetime().optional(),
    modifiedAt: z.string().datetime().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const CreateAgentSchema = AgentSchema.omit({ id: true, createdAt: true, modifiedAt: true });
export type CreateAgent = z.infer<typeof CreateAgentSchema>;

// =============================================================================
// Per-Combo Total
// =============================================================================

export const PerComboTotalSchema = z.object({
    combo: z.string(),
    unitPrice: z.number().min(0),
    quantity: z.number().int().min(1),
    soldAmount: z.number().min(0),
    payoutRate: z.number().min(0),
});

export type PerComboTotal = z.infer<typeof PerComboTotalSchema>;

// =============================================================================
// Entry
// =============================================================================

export const EntrySchema = z.object({
    id: z.string().uuid(),
    category: CategoryEnum,
    raw: z.string().regex(/^\d+$/, 'Must be numeric'),
    expanded: z.array(z.string()).optional(),
    unitPrice: z.number().min(1),
    quantity: z.number().int().min(1).default(1),
    perComboTotals: z.array(PerComboTotalSchema).optional(),
    total: z.number().min(0).optional(),
});

export type Entry = z.infer<typeof EntrySchema>;

export const CreateEntrySchema = EntrySchema.omit({
    id: true,
    expanded: true,
    perComboTotals: true,
    total: true,
});
export type CreateEntry = z.infer<typeof CreateEntrySchema>;

// =============================================================================
// Ticket
// =============================================================================

export const TicketSchema = z.object({
    id: z.string().uuid(),
    agentId: z.string().uuid(),
    round: z.string().min(1), // e.g., "morning", "afternoon", "evening"
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    drawPeriod: z.string().optional(), // งวดหวย เช่น "1", "16", "หุ้น"
    createdAt: z.string().datetime(),
    createdBy: z.string(),
    modifiedAt: z.string().datetime(),
    entries: z.array(EntrySchema),
    billTotal: z.number().min(0),
    synced: z.boolean().default(false),
    deleted: z.boolean().default(false),
});

export type Ticket = z.infer<typeof TicketSchema>;

export const CreateTicketSchema = TicketSchema.omit({
    id: true,
    createdAt: true,
    modifiedAt: true,
    synced: true,
    deleted: true,
});
export type CreateTicket = z.infer<typeof CreateTicketSchema>;

// =============================================================================
// Blocked Number
// =============================================================================

export const BlockedNumberSchema = z.object({
    id: z.string().uuid(),
    number: z.string().regex(/^\d+$/, 'Must be numeric'),
    category: CategoryEnum,
    payoutOverride: z.number().min(0),
    enabled: z.boolean().default(true),
});

export type BlockedNumber = z.infer<typeof BlockedNumberSchema>;

export const CreateBlockedNumberSchema = BlockedNumberSchema.omit({ id: true });
export type CreateBlockedNumber = z.infer<typeof CreateBlockedNumberSchema>;

// =============================================================================
// Lottery Result (ประวัติผลหวย)
// =============================================================================

export const LotteryResultSchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    drawPeriod: z.string().optional(), // งวด: 1, 16, หุ้น
    firstPrize: z.string().regex(/^\d{6}$/).optional(), // รางวัลที่ 1 (6 หลัก)
    threeTop: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวบน
    threeDown: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวล่าง
    twoDown: z.string().regex(/^\d{2}$/).optional(), // 2 ตัวล่าง
    threeTod1: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวโต๊ด 1 (เลขหน้า 3 ตัว ชุด 1)
    threeTod2: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวโต๊ด 2 (เลขหน้า 3 ตัว ชุด 2)
    threeTod3: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวโต๊ด 3 (เลขท้าย 3 ตัว ชุด 1)
    threeTod4: z.string().regex(/^\d{3}$/).optional(), // 3 ตัวโต๊ด 4 (เลขท้าย 3 ตัว ชุด 2)
    createdAt: z.string().datetime(),
    modifiedAt: z.string().datetime(),
});

export type LotteryResult = z.infer<typeof LotteryResultSchema>;

export const CreateLotteryResultSchema = LotteryResultSchema.omit({
    id: true,
    createdAt: true,
    modifiedAt: true,
});
export type CreateLotteryResult = z.infer<typeof CreateLotteryResultSchema>;

// =============================================================================
// Payouts
// =============================================================================

export const PayoutsSchema = z.object({
    '3top': z.number().min(0).default(800),
    '3tod': z.number().min(0).default(130),
    '3down': z.number().min(0).default(400),
    '3back': z.number().min(0).default(130),
    '2top': z.number().min(0).default(70),
    '2tod': z.number().min(0).default(35),
    '2down': z.number().min(0).default(70),
    '2back': z.number().min(0).default(35),
});

export type Payouts = z.infer<typeof PayoutsSchema>;

export const DEFAULT_PAYOUTS: Payouts = {
    '3top': 800,
    '3tod': 130,
    '3down': 400,
    '3back': 130,
    '2top': 70,
    '2tod': 35,
    '2down': 70,
    '2back': 35,
};

// =============================================================================
// Ceilings
// =============================================================================

export const CeilingsSchema = z.object({
    perComboMax: z.number().min(0).default(10000),
    perNumberMax: z.number().min(0).default(50000), // เพดานต่อเลข (รวมทุกบิล)
});

export type Ceilings = z.infer<typeof CeilingsSchema>;

// =============================================================================
// Storage Mode
// =============================================================================

export const StorageModeEnum = z.enum(['Off', 'PushOnly', 'TwoWay']);
export type StorageMode = z.infer<typeof StorageModeEnum>;

// =============================================================================
// Firebase Config
// =============================================================================

export const FirebaseConfigSchema = z.object({
    apiKey: z.string().optional(),
    authDomain: z.string().optional(),
    projectId: z.string().optional(),
    storageBucket: z.string().optional(),
    messagingSenderId: z.string().optional(),
    appId: z.string().optional(),
});

export type FirebaseConfig = z.infer<typeof FirebaseConfigSchema>;

// =============================================================================
// Settings
// =============================================================================

export const SettingsSchema = z.object({
    payouts: PayoutsSchema,
    ceilings: CeilingsSchema,
    riskyThreshold: z.number().min(0).default(5000),
    storageMode: StorageModeEnum.default('Off'),
    firebaseConfig: FirebaseConfigSchema.optional(),
    mergeDuplicates: z.boolean().default(true),
    conflictResolution: z.enum(['remote', 'local']).default('remote'),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
    payouts: DEFAULT_PAYOUTS,
    ceilings: { perComboMax: 10000, perNumberMax: 50000 },
    riskyThreshold: 5000,
    storageMode: 'Off',
    mergeDuplicates: true,
    conflictResolution: 'remote',
};

// =============================================================================
// User
// =============================================================================

export const UserRoleEnum = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserSchema = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(50),
    passwordHash: z.string(),
    role: UserRoleEnum,
    mustChangePassword: z.boolean().default(false),
    createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const LoginSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = LoginSchema.extend({
    role: UserRoleEnum.default('user'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// =============================================================================
// Summary
// =============================================================================

export const AgentSummarySchema = z.object({
    agentId: z.string().uuid(),
    agentName: z.string(),
    gross: z.number(),
    expectedPayout: z.number(),
    profit: z.number(),
    ticketCount: z.number().int(),
});

export type AgentSummary = z.infer<typeof AgentSummarySchema>;

export const RiskyNumberSchema = z.object({
    combo: z.string(),
    category: CategoryEnum,
    soldAmount: z.number(),
    threshold: z.number(),
});

export type RiskyNumber = z.infer<typeof RiskyNumberSchema>;

export const SummarySchema = z.object({
    date: z.string(),
    round: z.string().optional(),
    gross: z.number(),
    expectedPayout: z.number(),
    profit: z.number(),
    ticketCount: z.number().int(),
    perAgent: z.array(AgentSummarySchema),
    riskyNumbers: z.array(RiskyNumberSchema),
});

export type Summary = z.infer<typeof SummarySchema>;

// =============================================================================
// API Response
// =============================================================================

export const ApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
});

export type ApiResponse<T = unknown> = {
    success: boolean;
    data?: T;
    error?: string;
};
