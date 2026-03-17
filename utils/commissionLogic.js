
const User = require('../models/User');
const Plan = require('../models/plain');
const Transaction = require('../models/Transaction');

const MAX_COMMISSION_LEVEL = 5;

// Referral commission rates (on plan purchase)
const REFERRAL_COMMISSION_RATES = {
    1: 0.065, // 6.5% - Direct
    2: 0.033, // 3.3% - Indirect
    3: 0.025, // 2.5% - Extended
    4: 0.02,  // 2% - Level 4
    5: 0.015  // 1.5% - Level 5
};

// Rebate commission rates (paid when a downline receives daily plan profit)
// Uses the same percentages that were previously used for the legacy plan-expire commission.
const REBATE_COMMISSION_RATES = {
    1: 0.04,  // 4%
    2: 0.022, // 2.2%
    3: 0.015, // 1.5%
    4: 0.012, // 1.2% - Level 4
    5: 0.01   // 1% - Level 5
};

// ✅ DISTRIBUTE REFERRAL COMMISSION WHEN PLAN IS PURCHASED
const distributeReferralCommission = async (user, investmentAmount) => {
    try {
        const commissionTransactions = [];
        let currentUser = user;

        for (let level = 1; level <= MAX_COMMISSION_LEVEL; level++) {
            if (!currentUser.referredBy) break;

            const upliner = await User.findOne({ randomCode: currentUser.referredBy });
            if (!upliner) break;

            const commissionRate = REFERRAL_COMMISSION_RATES[level] || 0;
            const commissionAmount = investmentAmount * commissionRate;

            if (commissionAmount > 0) {
                // Add commission to upliner's balance
                upliner.userbalance += commissionAmount;
                upliner.totalCommissionEarned = (upliner.totalCommissionEarned || 0) + commissionAmount;

                // Track level-wise commission
                if (level === 1) {
                    upliner.directCommission = (upliner.directCommission || 0) + commissionAmount;
                } else if (level === 2) {
                    upliner.indirectCommission = (upliner.indirectCommission || 0) + commissionAmount;
                } else if (level === 3) {
                    upliner.extendedCommission = (upliner.extendedCommission || 0) + commissionAmount;
                }

                await upliner.save();

                // Create transaction record
                const commissionTransaction = new Transaction({
                    userId: upliner._id,
                    amount: commissionAmount,
                    type: 'referral_commission',
                    description: `Level ${level} referral commission from ${user.fullName}`,
                    status: 'completed',
                    metadata: {
                        fromUserId: user._id,
                        fromUserName: user.fullName,
                        level: level,
                        investmentAmount: investmentAmount,
                        commissionRate: commissionRate
                    }
                });

                await commissionTransaction.save();
                commissionTransactions.push(commissionTransaction);

                console.log(`💰 Level ${level} referral commission: ${commissionAmount} PKR to ${upliner.fullName}`);
            }

            currentUser = upliner;
        }

        return commissionTransactions;
    } catch (error) {
        console.error('Error distributing referral commission:', error);
        throw error;
    }
};

// ✅ DISTRIBUTE REBATE COMMISSION WHEN USER RECEIVES DAILY PROFIT
// `profitAmount` is the amount of profit credited to the user for a specific plan day.
const distributeDailyPlanCommission = async ({
	user,
	plan,
	profitAmount,
	dayNumber,
}) => {
    try {
        if (!user || !user._id) throw new Error('User is required for rebate commission');
        if (!plan || !plan._id) throw new Error('Plan is required for daily commission');

        const safeProfitAmount = Number(profitAmount) || 0;
        if (safeProfitAmount <= 0) return [];

        console.log(`🎯 Distributing rebate commissions for plan ${plan._id} day ${dayNumber || 'N/A'}:`);
        console.log(`- Daily Profit Amount: ${safeProfitAmount}`);

        const commissionTransactions = [];
        let currentUser = user;

        for (let level = 1; level <= MAX_COMMISSION_LEVEL; level++) {
            if (!currentUser.referredBy) break;

            const upliner = await User.findOne({ randomCode: currentUser.referredBy });
            if (!upliner) break;

            const commissionRate = REBATE_COMMISSION_RATES[level] || 0;
            const commissionAmount = safeProfitAmount * commissionRate;

            if (commissionAmount > 0) {
                // Add commission to upliner's balance
                upliner.userbalance += commissionAmount;
                upliner.totalCommissionEarned = (upliner.totalCommissionEarned || 0) + commissionAmount;
                // Keep legacy field in sync for backward compatibility.
                upliner.planExpireCommission = (upliner.planExpireCommission || 0) + commissionAmount;
                upliner.rebateCommission = (upliner.rebateCommission || 0) + commissionAmount;

                await upliner.save();

                // Create transaction record
                const commissionTransaction = new Transaction({
                    userId: upliner._id,
                    amount: commissionAmount,
                    type: 'rebate_commission',
                    description: `Level ${level} rebate commission from ${user.fullName}`,
                    status: 'completed',
                    metadata: {
                        fromUserId: user._id,
                        fromUserName: user.fullName,
                        level: level,
                        planId: plan._id,
                        planName: plan.PlanName,
                        dayNumber: dayNumber,
                        profitAmount: safeProfitAmount,
                        commissionRate: commissionRate
                    }
                });

                await commissionTransaction.save();
                commissionTransactions.push(commissionTransaction);

                console.log(`🎁 Level ${level} rebate commission: ${commissionAmount} PKR to ${upliner.fullName}`);
            }

            currentUser = upliner;
        }

        return commissionTransactions;
    } catch (error) {
        console.error('Error distributing rebate commission:', error);
        throw error;
    }
};

module.exports = {
    distributeReferralCommission,
    distributeDailyPlanCommission,
    REFERRAL_COMMISSION_RATES,
    REBATE_COMMISSION_RATES,
    MAX_COMMISSION_LEVEL
};