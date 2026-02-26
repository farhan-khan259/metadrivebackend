const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const REBATE_TYPES = ['rebate_commission', 'daily_plan_commission', 'plan_expire_commission'];

const getRebateSummary = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('🔍 Fetching rebate commissions for user:', userId);

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Get rebate commissions for the user (including legacy transaction types)
        const transactions = await Transaction.find({
            userId: new mongoose.Types.ObjectId(userId),
            type: { $in: REBATE_TYPES },
            status: 'completed'
        }).sort({ createdAt: -1 });

        console.log(`📊 Found ${transactions.length} rebate commissions`);

        // Calculate level-wise totals
        const levelTotals = {
            level1: 0,
            level2: 0,
            level3: 0,
            level4: 0,
            level5: 0,
        };

        // Process real transactions
        const enhancedTransactions = transactions.map(transaction => ({
            _id: transaction._id,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            status: transaction.status,
            createdAt: transaction.createdAt,
            metadata: transaction.metadata || {
                level: 1,
                fromUserName: 'Team Member',
                planName: 'Investment Plan',
                investment: 0,
                returnProfit: 0,
                commissionRate: 0.04
            }
        }));

        // Calculate level totals from real data
        enhancedTransactions.forEach(transaction => {
            const level = transaction.metadata?.level;
            if (level === 1) levelTotals.level1 += transaction.amount;
            else if (level === 2) levelTotals.level2 += transaction.amount;
            else if (level === 3) levelTotals.level3 += transaction.amount;
            else if (level === 4) levelTotals.level4 += transaction.amount;
            else if (level === 5) levelTotals.level5 += transaction.amount;
        });

        // If no transactions found, return empty but successful response
        if (transactions.length === 0) {
            return res.json({
                success: true,
                message: 'No rebate commissions found',
                data: {
                    summary: {
                        totalCommission: 0,
                        levelTotals: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
                        totalTransactions: 0
                    },
                    transactions: []
                }
            });
        }

        res.json({
            success: true,
            message: 'Rebate commission data retrieved successfully',
            data: {
                summary: {
                    totalCommission: transactions.reduce((sum, t) => sum + t.amount, 0),
                    levelTotals,
                    totalTransactions: transactions.length
                },
                transactions: enhancedTransactions
            }
        });

    } catch (error) {
        console.error('❌ Error fetching rebate commission summary:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

router.get('/rebate-summary/:userId', getRebateSummary);
router.get('/plan-expire-summary/:userId', getRebateSummary);

// ✅ Get ALL commissions for user (referral + rebate commissions)
router.get('/all-commissions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('🔍 Fetching ALL commissions for user:', userId);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Get all commission transactions (referral + rebate)
        const transactions = await Transaction.find({
            userId: new mongoose.Types.ObjectId(userId),
            type: { $in: ['referral_commission', ...REBATE_TYPES] },
            status: 'completed'
        }).sort({ createdAt: -1 });

        console.log(`📊 Found ${transactions.length} total commission transactions`);

        // Calculate level-wise totals and type-wise totals
        const levelTotals = {
            level1: 0,
            level2: 0,
            level3: 0,
            level4: 0,
            level5: 0,
        };

        const typeTotals = {
            referral_commission: 0,
            rebate_commission: 0,
        };

        // Process transactions
        const enhancedTransactions = transactions.map(transaction => ({
            _id: transaction._id,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            status: transaction.status,
            createdAt: transaction.createdAt,
            metadata: transaction.metadata || {
                level: 1,
                fromUserName: 'Team Member',
            }
        }));

        // Calculate totals
        enhancedTransactions.forEach(transaction => {
            const level = transaction.metadata?.level;
            if (level === 1) levelTotals.level1 += transaction.amount;
            else if (level === 2) levelTotals.level2 += transaction.amount;
            else if (level === 3) levelTotals.level3 += transaction.amount;
            else if (level === 4) levelTotals.level4 += transaction.amount;
            else if (level === 5) levelTotals.level5 += transaction.amount;

            if (transaction.type === 'referral_commission') {
                typeTotals.referral_commission += transaction.amount;
            } else if (REBATE_TYPES.includes(transaction.type)) {
                typeTotals.rebate_commission += transaction.amount;
            }
        });

        if (transactions.length === 0) {
            return res.json({
                success: true,
                message: 'No commissions found',
                data: {
                    summary: {
                        totalCommission: 0,
                        levelTotals: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
                        typeTotals: { referral_commission: 0, rebate_commission: 0 },
                        totalTransactions: 0
                    },
                    transactions: []
                }
            });
        }

        res.json({
            success: true,
            message: 'All commissions retrieved successfully',
            data: {
                summary: {
                    totalCommission: transactions.reduce((sum, t) => sum + t.amount, 0),
                    levelTotals,
                    typeTotals,
                    totalTransactions: transactions.length
                },
                transactions: enhancedTransactions
            }
        });

    } catch (error) {
        console.error('❌ Error fetching all commissions:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;