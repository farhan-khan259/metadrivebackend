




const Plan = require("../models/plain");
const User = require("../models/User");
const { distributeDailyPlanCommission } = require("../utils/commissionLogic");

const parsePercentage = (percentageStr) => {
	if (!percentageStr) return 0;
	const cleanStr = percentageStr.toString().replace(/[^\d.]/g, "");
	return parseFloat(cleanStr) || 0;
};

const calculateProfitSchedule = ({ investment, percentageStr, days }) => {
	const percentage = parsePercentage(percentageStr);
	const safeInvestment = Number(investment) || 0;
	const safeDays = Math.max(1, Number(days) || 1);

	const baseDaily = Math.round(safeInvestment * (percentage / 100));
	const totalProfit = baseDaily * safeDays;
	const lastDay = baseDaily;

	return {
		percentage,
		totalProfit,
		baseDaily,
		lastDay,
	};
};

const startOfDay = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};

// ✅ Create a new plan - UPDATED with referral commission
exports.createPlan = async (req, res) => {
	try {
		const { user_id, PlanName, Investment, profitPercentage, returnProfit } = req.body;

		if (!user_id || !PlanName || !Investment) {
			return res
				.status(400)
				.json({ success: false, message: "user_id, PlanName and Investment are required" });
		}

		const user = await User.findById(user_id);
		if (!user) return res.status(404).json({ success: false, message: "User not found" });

		if (user.userbalance < Investment) {
			return res.status(400).json({
				success: false,
				message: "Insufficient balance. Please deposit funds to subscribe to a plan.",
			});
		}

		// Plans are fixed to 180 days
		const planDays = 180;

		// Calculate dates
		const startingDate = new Date();
		const endingDate = new Date(startingDate);
		endingDate.setDate(endingDate.getDate() + planDays);

		const percentageStr = profitPercentage || "5.5%";
		let calculatedReturnProfit = 0;
		let calculatedDailyEarning = 0;
		let calculatedLastDayEarning = 0;

		// Preferred: compute from percentage as DAILY profit % over full duration
		if (percentageStr) {
			const schedule = calculateProfitSchedule({
				investment: Investment,
				percentageStr,
				days: planDays,
			});
			calculatedReturnProfit = schedule.totalProfit;
			calculatedDailyEarning = schedule.baseDaily;
			calculatedLastDayEarning = schedule.lastDay;
		} else if (typeof returnProfit === 'number') {
			// Backwards support: accept total profit directly
			calculatedReturnProfit = Math.round(returnProfit);
			calculatedDailyEarning = Math.floor(calculatedReturnProfit / planDays);
			calculatedLastDayEarning = calculatedReturnProfit - calculatedDailyEarning * (planDays - 1);
		} else {
			return res.status(400).json({
				success: false,
				message: "profitPercentage (daily %) or returnProfit is required",
			});
		}

		const plan = new Plan({
			user_id,
			PlanName,
			Investment,
			dailyEarning: calculatedDailyEarning,
			lastDayEarning: calculatedLastDayEarning,
			days: planDays,
			startingDate,
			endingDate,
			returnProfit: calculatedReturnProfit,
			profitPercentage: percentageStr,
			totalEarning: 0,
			totalAmount: Investment + calculatedReturnProfit,
			planExpireText: `180 days`,
			expiryDate: endingDate,
			planExpired: false,
			status: 'running'
		});

		// ✅ DEDUCT INVESTMENT FROM USER BALANCE
		user.UserInvestment = (user.UserInvestment || 0) + Investment;
		user.userbalance -= Investment;

		await user.save();
		await plan.save();

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

// ✅ Claim plan endpoint - ENHANCED with rebate commission
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

		// Normalize schedule (protect against legacy stored dailyEarning/returnProfit values)
		const schedule = calculateProfitSchedule({
			investment: plan.Investment,
			percentageStr: plan.profitPercentage,
			days: plan.days,
		});
		plan.returnProfit = schedule.totalProfit;
		plan.dailyEarning = schedule.baseDaily;
		plan.lastDayEarning = schedule.lastDay;
		plan.totalAmount = (Number(plan.Investment) || 0) + schedule.totalProfit;

		const returnProfit = schedule.totalProfit;
		const alreadyPaidProfit = Number(plan.totalEarning) || 0;
		const remainingProfit = Math.max(0, returnProfit - alreadyPaidProfit);

		// Update user balance:
		// - Profit is paid daily by cron; credit any remaining profit here (catch-up)
		// - Principal (Investment) is returned ONLY when claimed
		const user = await User.findById(user_id);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		if (remainingProfit > 0) {
			// If cron missed payouts, credit profit now and also pay the upline commissions for each missed day
			const alreadyPaidDays = Math.max(0, plan.profitPaidDays || 0);
			for (let dayNum = alreadyPaidDays + 1; dayNum <= (plan.days || 0); dayNum++) {
				const isLast = dayNum === (plan.days || 0);
				const profitAmount = isLast
					? (Number(plan.lastDayEarning) || 0)
					: (Number(plan.dailyEarning) || 0);
				if (profitAmount > 0) {
					try {
						await distributeDailyPlanCommission({
							user,
							plan,
							profitAmount,
							dayNumber: dayNum,
						});
					} catch (commissionErr) {
						// Log error but continue (profit is still paid)
						console.error(`⚠️ Catch-up commission distribution failed for day ${dayNum}:`, commissionErr.message);
					}
				}
			}

			user.userbalance += remainingProfit;
			user.totalEarnings = (user.totalEarnings || 0) + remainingProfit;
			plan.totalEarning = alreadyPaidProfit + remainingProfit;
			plan.profitPaidDays = Math.max(plan.profitPaidDays || 0, plan.days || 0);
			plan.lastProfitPaidAt = new Date();
		}

		// Return principal
		user.userbalance += (Number(plan.Investment) || 0);
		user.UserInvestment = Math.max(0, (user.UserInvestment || 0) - (Number(plan.Investment) || 0));

		await user.save();

		// Update plan status
		plan.status = 'claimed';
		plan.claimedAt = new Date();
		plan.principalClaimed = true;
		await plan.save();

		console.log(`✅ Plan claimed successfully. Principal returned: ${Number(plan.Investment) || 0} PKR`);

		res.json({
			success: true,
			message: 'Plan claimed successfully',
			amount: Number(plan.Investment) || 0,
			newBalance: user.userbalance,
			plan: {
				investment: plan.Investment,
				profit: returnProfit,
				totalProfitPaid: plan.totalEarning
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