




const cron = require("node-cron");
const mongoose = require("mongoose");
const Plan = require("../models/plain");
const User = require("../models/User");
// Note: plan expire commissions are distributed on claim (or other dedicated logic), not in this daily profit cron.
const { distributeDailyPlanCommission } = require("../utils/commissionLogic");

const startOfDay = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};

const daysBetweenDateOnly = (start, end) => {
	const s = startOfDay(start);
	const e = startOfDay(end);
	return Math.floor((e - s) / (24 * 60 * 60 * 1000));
};

const parsePercentage = (percentageStr) => {
	if (!percentageStr) return 0;
	const cleanStr = percentageStr.toString().replace(/[^\d.]/g, "");
	return parseFloat(cleanStr) || 0;
};

const calculateProfitSchedule = ({ investment, percentageStr, days }) => {
	const percentage = parsePercentage(percentageStr);
	const safeInvestment = Number(investment) || 0;
	const safeDays = Math.max(1, Number(days) || 1);

	const totalProfit = Math.round(safeInvestment * (percentage / 100));
	const baseDaily = Math.floor(totalProfit / safeDays);
	const lastDay = totalProfit - baseDaily * (safeDays - 1);

	return { totalProfit, baseDaily, lastDay };
};

// Run once every 24 hours at midnight - UPDATED: Mark as completed, not expired
cron.schedule("0 0 * * *", async () => {
	console.log("⏳ Running plan daily profit distribution...");

	try {
		if (mongoose.connection.readyState !== 1) {
			console.log("⏭️ Skipping plan cron (MongoDB not connected yet)");
			return;
		}

		const plans = await Plan.find({ status: { $in: ['running', 'completed'] } });
		const now = new Date();
		let creditedCount = 0;

		for (let plan of plans) {
			if (!plan.user_id) continue;
			if (plan.status === 'claimed') continue;

			// Normalize profit schedule to protect against legacy/stale stored values
			const schedule = calculateProfitSchedule({
				investment: plan.Investment,
				percentageStr: plan.profitPercentage,
				days: plan.days,
			});
			if (
				Number(plan.returnProfit) !== schedule.totalProfit ||
				Number(plan.dailyEarning) !== schedule.baseDaily ||
				Number(plan.lastDayEarning) !== schedule.lastDay
			) {
				plan.returnProfit = schedule.totalProfit;
				plan.dailyEarning = schedule.baseDaily;
				plan.lastDayEarning = schedule.lastDay;
				plan.totalAmount = (Number(plan.Investment) || 0) + schedule.totalProfit;
				// Don't change totalEarning/profitPaidDays here; those represent already-paid profit.
			}
			if ((plan.profitPaidDays || 0) >= (plan.days || 0)) {
				// Still ensure completion flags are consistent
				if (plan.status === 'running' && plan.endingDate && now >= plan.endingDate) {
					plan.status = 'completed';
					plan.completedAt = plan.completedAt || now;
					plan.planExpired = true;
					await plan.save();
				}
				continue;
			}

			const daysElapsed = daysBetweenDateOnly(plan.startingDate || plan.createdAt || now, now);
			// Pay starts after the first full day has elapsed (e.g. plan bought today -> first payout next midnight)
			const dueDays = Math.min(plan.days || 0, Math.max(0, daysElapsed));
			const alreadyPaid = Math.max(0, plan.profitPaidDays || 0);
			let toPay = dueDays - alreadyPaid;
			if (toPay <= 0) {
				// Mark completed if time is up
				if (plan.status === 'running' && plan.endingDate && now >= plan.endingDate) {
					plan.status = 'completed';
					plan.completedAt = plan.completedAt || now;
					plan.planExpired = true;
					await plan.save();
				}
				continue;
			}

			const user = await User.findById(plan.user_id);
			if (!user) continue;

			while (toPay > 0 && (plan.profitPaidDays || 0) < (plan.days || 0)) {
				const nextDayNumber = (plan.profitPaidDays || 0) + 1;
				const isLastDay = nextDayNumber === (plan.days || 0);
				const profitAmount = isLastDay
					? (Number(plan.lastDayEarning) || 0)
					: (Number(plan.dailyEarning) || 0);

				if (profitAmount > 0) {
					user.userbalance += profitAmount;
					user.totalEarnings = (user.totalEarnings || 0) + profitAmount;
					plan.totalEarning = (plan.totalEarning || 0) + profitAmount;

					// Distribute upline commissions DAILY based on this day's profit (graceful failure)
					try {
						await distributeDailyPlanCommission({
							user,
							plan,
							profitAmount,
							dayNumber: nextDayNumber,
						});
					} catch (commissionErr) {
						// Log error but continue (profit is still paid)
						console.error(`⚠️ Daily commission distribution failed for plan ${plan._id}:`, commissionErr.message);
					}

					creditedCount += 1;
				}

				plan.profitPaidDays = nextDayNumber;
				plan.lastProfitPaidAt = now;
				toPay -= 1;
			}

			// If all profits are paid and the plan duration is over, mark completed
			if ((plan.profitPaidDays || 0) >= (plan.days || 0) && plan.endingDate && now >= plan.endingDate) {
				plan.status = 'completed';
				plan.completedAt = plan.completedAt || now;
				plan.planExpired = true;
			}

			await user.save();
			await plan.save();
		}

		console.log(`✅ Daily profit distributed. Plans checked: ${plans.length}, profit credits: ${creditedCount}`);
	} catch (err) {
		console.error("❌ Error distributing plan profits:", err.message);
	}
});