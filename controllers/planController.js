// const Plan = require("../models/plain");
// const User = require("../models/User");
// const { distributeReferralCommission, distributePlanExpireCommission } = require("../utils/commissionLogic");

// // ✅ Create a new plan - UPDATED with referral commission
// exports.createPlan = async (req, res) => {
// 	try {
// 		const {
// 			user_id,
// 			PlanName,
// 			Investment,
// 			dailyEarning,
// 			durationDays,
// 			days,
// 			profitPercentage,
// 			returnProfit
// 		} = req.body;

// 		if (!user_id || !PlanName || !Investment || !dailyEarning) {
// 			return res.status(400).json({ success: false, message: "All fields are required" });
// 		}

// 		const user = await User.findById(user_id);
// 		if (!user) return res.status(404).json({ success: false, message: "User not found" });

// 		if (user.userbalance < Investment) {
// 			return res.status(400).json({
// 				success: false,
// 				message: "Insufficient balance. Please deposit funds to subscribe to a plan.",
// 			});
// 		}

// 		// Use days from frontend or default to durationDays or 30
// 		const planDays = days || durationDays || 30;

// 		// Calculate dates
// 		const startingDate = new Date();
// 		const endingDate = new Date();
// 		endingDate.setDate(endingDate.getDate() + planDays);

// 		// Calculate return profit if not provided
// 		const calculatedReturnProfit = returnProfit || (dailyEarning * planDays);

// 		const plan = new Plan({
// 			user_id,
// 			PlanName,
// 			Investment,
// 			dailyEarning,
// 			days: planDays,
// 			startingDate,
// 			endingDate,
// 			returnProfit: calculatedReturnProfit,
// 			profitPercentage: profitPercentage || "5.6%",
// 			totalEarning: 0,
// 			totalAmount: Investment + calculatedReturnProfit,
// 			planExpireText: `${planDays} days`,
// 			expiryDate: endingDate,
// 			planExpired: false,
// 			status: 'running'
// 		});

// 		// ✅ DEDUCT INVESTMENT FROM USER BALANCE
// 		user.UserInvestment = (user.UserInvestment || 0) + Investment;
// 		user.userbalance -= Investment;

// 		await user.save();
// 		await plan.save();

// 		// ✅ DISTRIBUTE REFERRAL COMMISSIONS ON PLAN PURCHASE
// 		await distributeReferralCommission(user, Investment);

// 		res.status(201).json({
// 			success: true,
// 			plan,
// 			newBalance: user.userbalance
// 		});
// 	} catch (err) {
// 		console.error("Create plan error:", err);
// 		res.status(500).json({ success: false, message: err.message });
// 	}
// };

// // ✅ Get all active plans of the logged-in user
// exports.getPlans = async (req, res) => {
// 	try {
// 		const userId = req.query.id;
// 		if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });

// 		const plans = await Plan.find({ user_id: userId, status: 'running' }).populate(
// 			"user_id",
// 			"fullName email"
// 		);

// 		res.status(200).json({ success: true, plans });
// 	} catch (err) {
// 		res.status(500).json({ success: false, message: err.message });
// 	}
// };

// // ✅ Get all plans for a specific user
// exports.getPlanById = async (req, res) => {
// 	try {
// 		const plans = await Plan.find({ user_id: req.params.id }).populate(
// 			"user_id",
// 			"fullName email"
// 		);

// 		if (!plans || plans.length === 0) {
// 			return res.status(404).json({ success: false, message: "No plans found for this user" });
// 		}

// 		const responsePlans = plans.map(plan => ({
// 			id: plan._id,
// 			name: plan.PlanName,
// 			amount: plan.Investment,
// 			daily: plan.dailyEarning,
// 			total: plan.totalEarning,
// 			totalAmount: plan.totalAmount,
// 			expireText: plan.planExpireText,
// 			expiryDate: plan.expiryDate,
// 			planExpired: plan.planExpired,
// 			startDate: plan.createdAt,
// 			days: plan.days,
// 			startingDate: plan.startingDate,
// 			endingDate: plan.endingDate,
// 			returnProfit: plan.returnProfit,
// 			profitPercentage: plan.profitPercentage,
// 			status: plan.status,
// 			claimedAt: plan.claimedAt,
// 			user: plan.user_id,
// 		}));

// 		res.status(200).json({ success: true, plans: responsePlans });
// 	} catch (err) {
// 		res.status(500).json({ success: false, message: err.message });
// 	}
// };

// // ✅ Claim plan endpoint - ENHANCED with plan expire commission
// exports.claimPlan = async (req, res) => {
// 	try {
// 		const { planId, user_id } = req.body;

// 		if (!planId || !user_id) {
// 			return res.status(400).json({
// 				success: false,
// 				message: 'Plan ID and User ID are required'
// 			});
// 		}

// 		const plan = await Plan.findById(planId);
// 		if (!plan) {
// 			return res.status(404).json({
// 				success: false,
// 				message: 'Plan not found'
// 			});
// 		}

// 		if (plan.user_id.toString() !== user_id) {
// 			return res.status(403).json({
// 				success: false,
// 				message: 'Not authorized to claim this plan'
// 			});
// 		}

// 		if (plan.status === 'claimed') {
// 			return res.status(400).json({
// 				success: false,
// 				message: 'Plan already claimed'
// 			});
// 		}

// 		const endDate = new Date(plan.endingDate);
// 		const today = new Date();

// 		// Allow claiming only after plan end date
// 		if (today < endDate) {
// 			return res.status(400).json({
// 				success: false,
// 				message: 'Plan is not yet completed'
// 			});
// 		}

// 		// Calculate total amount to claim (Investment + Profit)
// 		const returnProfit = plan.returnProfit || (plan.dailyEarning * plan.days);
// 		const totalAmount = plan.Investment + returnProfit;

// 		// Update user balance
// 		const user = await User.findById(user_id);
// 		user.userbalance += totalAmount;
// 		user.totalEarnings = (user.totalEarnings || 0) + returnProfit;

// 		await user.save();

// 		// Update plan status
// 		plan.status = 'claimed';
// 		plan.claimedAt = new Date();
// 		plan.totalEarning = returnProfit;
// 		await plan.save();

// 		// ✅ DISTRIBUTE PLAN EXPIRE COMMISSIONS
// 		await distributePlanExpireCommission(plan._id);

// 		console.log(`✅ Plan claimed successfully. Amount: ${totalAmount} PKR`);

// 		res.json({
// 			success: true,
// 			message: 'Plan claimed successfully',
// 			amount: totalAmount,
// 			newBalance: user.userbalance,
// 			plan: {
// 				investment: plan.Investment,
// 				profit: returnProfit,
// 				total: totalAmount
// 			}
// 		});
// 	} catch (error) {
// 		console.error('❌ Error claiming plan:', error);
// 		res.status(500).json({
// 			success: false,
// 			message: 'Server error while claiming plan'
// 		});
// 	}
// };

// // Rest of the functions
// exports.updatePlan = async (req, res) => {
// 	try {
// 		const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
// 		if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

// 		res.status(200).json({ success: true, plan });
// 	} catch (err) {
// 		res.status(500).json({ success: false, message: err.message });
// 	}
// };

// exports.deletePlan = async (req, res) => {
// 	try {
// 		const plan = await Plan.findByIdAndDelete(req.params.id);
// 		if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

// 		res.status(200).json({ success: true, message: "Plan deleted" });
// 	} catch (err) {
// 		res.status(500).json({ success: false, message: err.message });
// 	}
// };





const Plan = require("../models/plain");
const User = require("../models/User");
const { distributeReferralCommission, distributePlanExpireCommission } = require("../utils/commissionLogic");

// ✅ Create a new plan - UPDATED with referral commission
exports.createPlan = async (req, res) => {
	try {
		const {
			user_id,
			PlanName,
			Investment,
			dailyEarning,
			durationDays,
			days,
			profitPercentage,
			returnProfit
		} = req.body;

		if (!user_id || !PlanName || !Investment || !dailyEarning) {
			return res.status(400).json({ success: false, message: "All fields are required" });
		}

		const user = await User.findById(user_id);
		if (!user) return res.status(404).json({ success: false, message: "User not found" });

		if (user.userbalance < Investment) {
			return res.status(400).json({
				success: false,
				message: "Insufficient balance. Please deposit funds to subscribe to a plan.",
			});
		}

		// Use days from frontend or default to durationDays or 30
		const planDays = days || durationDays || 30;

		// Calculate dates
		const startingDate = new Date();
		const endingDate = new Date();
		endingDate.setDate(endingDate.getDate() + planDays);

		// Calculate return profit if not provided
		const calculatedReturnProfit = returnProfit || (dailyEarning * planDays);

		const plan = new Plan({
			user_id,
			PlanName,
			Investment,
			dailyEarning,
			days: planDays,
			startingDate,
			endingDate,
			returnProfit: calculatedReturnProfit,
			profitPercentage: profitPercentage || "5.6%",
			totalEarning: 0,
			totalAmount: Investment + calculatedReturnProfit,
			planExpireText: `${planDays} days`,
			expiryDate: endingDate,
			planExpired: false,
			status: 'running'
		});

		// ✅ DEDUCT INVESTMENT FROM USER BALANCE
		user.UserInvestment = (user.UserInvestment || 0) + Investment;
		user.userbalance -= Investment;

		await user.save();
		await plan.save();

		// ✅ DISTRIBUTE REFERRAL COMMISSIONS ON PLAN PURCHASE
		await distributeReferralCommission(user, Investment);

		res.status(201).json({
			success: true,
			plan,
			newBalance: user.userbalance
		});
	} catch (err) {
		console.error("Create plan error:", err);
		res.status(500).json({ success: false, message: err.message });
	}
};

// ✅ Get all active plans of the logged-in user
exports.getPlans = async (req, res) => {
	try {
		const userId = req.query.id;
		if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });

		const plans = await Plan.find({ user_id: userId, status: 'running' }).populate(
			"user_id",
			"fullName email"
		);

		res.status(200).json({ success: true, plans });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ✅ Get all plans for a specific user
exports.getPlanById = async (req, res) => {
	try {
		const plans = await Plan.find({ user_id: req.params.id }).populate(
			"user_id",
			"fullName email"
		);

		if (!plans || plans.length === 0) {
			return res.status(404).json({ success: false, message: "No plans found for this user" });
		}

		const responsePlans = plans.map(plan => ({
			id: plan._id,
			name: plan.PlanName,
			amount: plan.Investment,
			daily: plan.dailyEarning,
			total: plan.totalEarning,
			totalAmount: plan.totalAmount,
			expireText: plan.planExpireText,
			expiryDate: plan.expiryDate,
			planExpired: plan.planExpired,
			startDate: plan.createdAt,
			days: plan.days,
			startingDate: plan.startingDate,
			endingDate: plan.endingDate,
			returnProfit: plan.returnProfit,
			profitPercentage: plan.profitPercentage,
			status: plan.status,
			claimedAt: plan.claimedAt,
			user: plan.user_id,
		}));

		res.status(200).json({ success: true, plans: responsePlans });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ✅ Claim plan endpoint - ENHANCED with plan expire commission
exports.claimPlan = async (req, res) => {
	try {
		const { planId, user_id } = req.body;

		if (!planId || !user_id) {
			return res.status(400).json({
				success: false,
				message: 'Plan ID and User ID are required'
			});
		}

		const plan = await Plan.findById(planId);
		if (!plan) {
			return res.status(404).json({
				success: false,
				message: 'Plan not found'
			});
		}

		if (plan.user_id.toString() !== user_id) {
			return res.status(403).json({
				success: false,
				message: 'Not authorized to claim this plan'
			});
		}

		if (plan.status === 'claimed') {
			return res.status(400).json({
				success: false,
				message: 'Plan already claimed'
			});
		}

		const endDate = new Date(plan.endingDate);
		const today = new Date();

		// Allow claiming only after plan end date or if completed
		if (today < endDate && plan.status !== 'completed') {
			return res.status(400).json({
				success: false,
				message: 'Plan is not yet completed'
			});
		}

		// Calculate total amount to claim (Investment + Profit)
		const returnProfit = plan.returnProfit || (plan.dailyEarning * plan.days);
		const totalAmount = plan.Investment + returnProfit;

		// Update user balance
		const user = await User.findById(user_id);
		user.userbalance += totalAmount;
		user.totalEarnings = (user.totalEarnings || 0) + returnProfit;

		await user.save();

		// Update plan status
		plan.status = 'claimed';
		plan.claimedAt = new Date();
		plan.totalEarning = returnProfit;
		await plan.save();

		// ✅ DISTRIBUTE PLAN EXPIRE COMMISSIONS
		await distributePlanExpireCommission(plan._id);

		console.log(`✅ Plan claimed successfully. Amount: ${totalAmount} PKR`);

		res.json({
			success: true,
			message: 'Plan claimed successfully',
			amount: totalAmount,
			newBalance: user.userbalance,
			plan: {
				investment: plan.Investment,
				profit: returnProfit,
				total: totalAmount
			}
		});
	} catch (error) {
		console.error('❌ Error claiming plan:', error);
		res.status(500).json({
			success: false,
			message: 'Server error while claiming plan'
		});
	}
};

// Rest of the functions
exports.updatePlan = async (req, res) => {
	try {
		const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
		if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

		res.status(200).json({ success: true, plan });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};

exports.deletePlan = async (req, res) => {
	try {
		const plan = await Plan.findByIdAndDelete(req.params.id);
		if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

		res.status(200).json({ success: true, message: "Plan deleted" });
	} catch (err) {
		res.status(500).json({ success: false, message: err.message });
	}
};