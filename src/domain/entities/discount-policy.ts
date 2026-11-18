// Versioned: a policy is never edited in place. Changing the discount inserts
// a new version, so every sale keeps pointing at the exact rule it was
// charged under and the audit trail shows who changed what and when.
//
// The discount itself is a percentage the cashier picks at the till
// (promo_discounts); the policy holds the limits around it.
export interface DiscountPolicy {
  id: number;
  // Units per DAY that get the chosen percentage: the worker's first N units
  // of the day, across all their purchases ("2 this morning, 1 more in the
  // afternoon"); the rest are charged at full price.
  maxDiscountedUnitsPerDay: number;
  pointsPerSol: number;
  // Points that are worth S/ 1 off when the worker redeems them (0 = the
  // worker can't redeem points).
  redeemPointsPerSol: number;
  // Fewest points a worker must hold to redeem.
  minRedeemPoints: number;
  // Highest price a birthday gift may have (0 = no birthday gift).
  birthdayGiftMaxAmount: number;
  isActive: boolean;
  createdById: number | null;
  createdByName?: string | null;
  createdAt: Date;
}

export interface DiscountPolicyData {
  maxDiscountedUnitsPerDay: number;
  pointsPerSol: number;
  redeemPointsPerSol: number;
  minRedeemPoints: number;
  birthdayGiftMaxAmount: number;
}
