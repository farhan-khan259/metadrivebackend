
const User = require('../models/User');
const Plan = require('../models/plain');
const Transaction = require('../models/Transaction');

const MAX_COMMISSION_LEVEL = 5;

// Referral commission rates (on plan purchase)
const REFERRAL_COMMISSION_RATES = {
    1: 0.06,  // 6% - Direct
    2: 0.031, // 3.1% - Indirect
    3: 0.015, // 1.5% - Extended
    4: 0.01,  // 1% - Level 4
    5: 0.005  // 0.5% - Level 5
};

// Plan expire commission rates (when plan completes)
const PLAN_EXPIRE_COMMISSION_RATES = {
    1: 0.04,  // 4%
    2: 0.025, // 2.5%
    3: 0.015, // 1.5%
    4: 0.01,  // 1% - Level 4
    5: 0.005  // 0.5% - Level 5
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

// ✅ DISTRIBUTE PLAN EXPIRE COMMISSION WHEN PLAN IS CLAIMED/COMPLETED
const distributePlanExpireCommission = async (planId) => {
    try {
        const plan = await Plan.findById(planId).populate('user_id');
        if (!plan) throw new Error('Plan not found');

        const user = plan.user_id;
        const returnProfitAmount = plan.returnProfit;

        console.log(`🎯 Distributing plan expire commissions for plan ${plan._id}:`);
        console.log(`- Investment: ${plan.Investment}`);
        console.log(`- Return Profit: ${returnProfitAmount}`);

        const commissionTransactions = [];
        let currentUser = user;

        for (let level = 1; level <= MAX_COMMISSION_LEVEL; level++) {
            if (!currentUser.referredBy) break;

            const upliner = await User.findOne({ randomCode: currentUser.referredBy });
            if (!upliner) break;

            const commissionRate = PLAN_EXPIRE_COMMISSION_RATES[level] || 0;
            const commissionAmount = returnProfitAmount * commissionRate;

            if (commissionAmount > 0) {
                // Add commission to upliner's balance
                upliner.userbalance += commissionAmount;
                upliner.totalCommissionEarned = (upliner.totalCommissionEarned || 0) + commissionAmount;
                upliner.planExpireCommission = (upliner.planExpireCommission || 0) + commissionAmount;

                await upliner.save();

                // Record commission in plan
                await plan.addUplineCommission(level, upliner._id, commissionAmount, commissionRate);

                // Create transaction record
                const commissionTransaction = new Transaction({
                    userId: upliner._id,
                    amount: commissionAmount,
                    type: 'plan_expire_commission',
                    description: `Level ${level} plan expire commission from ${user.fullName}`,
                    status: 'completed',
                    metadata: {
                        fromUserId: user._id,
                        fromUserName: user.fullName,
                        level: level,
                        planId: plan._id,
                        planName: plan.PlanName,
                        returnProfitAmount: returnProfitAmount,
                        commissionRate: commissionRate
                    }
                });

                await commissionTransaction.save();
                commissionTransactions.push(commissionTransaction);

                console.log(`🎁 Level ${level} plan expire commission: ${commissionAmount} PKR to ${upliner.fullName}`);
            }

            currentUser = upliner;
        }

        // Mark plan as having distributed commissions
        plan.commissionAmount = commissionTransactions.reduce((sum, t) => sum + t.amount, 0);
        await plan.markCommissionsDistributed();

        return commissionTransactions;
    } catch (error) {
        console.error('Error distributing plan expire commission:', error);
        throw error;
    }
};

module.exports = {
    distributeReferralCommission,
    distributePlanExpireCommission,
    REFERRAL_COMMISSION_RATES,
    PLAN_EXPIRE_COMMISSION_RATES,
    MAX_COMMISSION_LEVEL
};