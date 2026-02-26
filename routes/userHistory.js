const User = require("../models/User");
const express = require("express");
const router = express.Router();

// Helper: calculate stats + commission from user fields only (no Payment collection)
async function calculateStats(members, commissionRate = 0) {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date();
	endOfDay.setHours(23, 59, 59, 999);

	const todayNewUsers = members.filter(
		(u) => u.createdAt >= startOfDay && u.createdAt <= endOfDay
	).length;

	const totalUsers = members.length;
	const totalActiveUsers = members.length; // Optional: filter active users only

	let totalTeamDeposit = 0;
	let totalTeamWithdrawal = 0;
	let todayTeamDeposit = 0;
	let todayTeamWithdrawal = 0;

	const membersWithPayments = members.map((member) => {
		const totalDeposit = member.userTotalDeposits || 0;
		const totalWithdrawal = member.userTotalWithdrawals || 0;

		const todayDeposit =
			member.createdAt >= startOfDay && member.createdAt <= endOfDay
				? totalDeposit
				: 0;

		const todayWithdrawal =
			member.createdAt >= startOfDay && member.createdAt <= endOfDay
				? totalWithdrawal
				: 0;

		totalTeamDeposit += totalDeposit;
		totalTeamWithdrawal += totalWithdrawal;
		todayTeamDeposit += todayDeposit;
		todayTeamWithdrawal += todayWithdrawal;

		return {
			_id: member._id,
			fullName: member.fullName,
			email: member.email,
			randomCode: member.randomCode,
			whatsappNumber: member.whatsappNumber,
			createdAt: member.createdAt,
			payments: {
				totalDeposit,
				totalWithdrawal,
				todayDeposit,
				todayWithdrawal,
			},
		};
	});

	const todayCommission = todayTeamDeposit * commissionRate;
	const totalCommission = totalTeamDeposit * commissionRate;

	return {
		todayNewUsers,
		totalActiveUsers,
		totalUsers,
		todayTeamDeposit,
		totalTeamDeposit,
		todayTeamWithdrawal,
		totalTeamWithdrawal,
		todayCommission,
		totalCommission,
		membersWithPayments,
	};
}

// ✅ Get user by ID with referrals + stats + commission
router.post("/usertransaction", async (req, res) => {
	const { userId } = req.body;

	try {
		const user = await User.findById(userId);
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found" });
		}

		// ✅ Direct referrals
		const directReferrals = await User.find({
			randomCode: { $in: user.team },
		}).select(
			"_id fullName email randomCode whatsappNumber team createdAt userTotalDeposits userTotalWithdrawals"
		);

		// ✅ Indirect referrals
		let indirectReferrals = [];
		for (const d of directReferrals) {
			const deeper = await User.find({
				randomCode: { $in: d.team },
			}).select(
				"_id fullName email randomCode whatsappNumber team createdAt userTotalDeposits userTotalWithdrawals"
			);
			indirectReferrals = indirectReferrals.concat(deeper);
		}

		// ✅ Extended referrals
		let extendedReferrals = [];
		for (const i of indirectReferrals) {
			const deeper = await User.find({
				randomCode: { $in: i.team },
			}).select(
				"_id fullName email randomCode whatsappNumber team createdAt userTotalDeposits userTotalWithdrawals"
			);
			extendedReferrals = extendedReferrals.concat(deeper);
		}

		// ✅ Calculate stats
		const directStats = await calculateStats(directReferrals, 0.065);
		const indirectStats = await calculateStats(indirectReferrals, 0.033);
		const extendedStats = await calculateStats(extendedReferrals, 0.025);

		// ✅ Commission totals
		const directTotalCommission = directStats.totalCommission;
		const indirectTotalCommission = indirectStats.totalCommission;
		const extendedTotalCommission = extendedStats.totalCommission;

		const grandTotalCommission =
			directTotalCommission + indirectTotalCommission + extendedTotalCommission;

		// ✅ Final response
		res.status(200).json({
			success: true,
			user: {
				_id: user._id,
				fullName: user.fullName,
				email: user.email,
				randomCode: user.randomCode,
				whatsappNumber: user.whatsappNumber,
				teamIds: user.team,
				UserInvestment: user.UserInvestment || 0,
				userbalance: user.userbalance || 0,
				userTotalDeposits: user.userTotalDeposits || 0,
				userCreateDate: user.createdAt || 0,
				userTotalWithdrawals: user.userTotalWithdrawals || 0,
			},
			directReferrals: {
				members: directStats.membersWithPayments,
				stats: {
					todayNewUsers: directStats.todayNewUsers,
					totalActiveUsers: directStats.totalActiveUsers,
					totalUsers: directStats.totalUsers,
					todayTeamDeposit: directStats.todayTeamDeposit,
					totalTeamDeposit: directStats.totalTeamDeposit,
					todayTeamWithdrawal: directStats.todayTeamWithdrawal,
					totalTeamWithdrawal: directStats.totalTeamWithdrawal,
					todayCommission: directStats.todayCommission,
					totalCommission: directStats.totalCommission,
				},
				totalCommission: directTotalCommission,
			},
			indirectReferrals: {
				members: indirectStats.membersWithPayments,
				stats: {
					todayNewUsers: indirectStats.todayNewUsers,
					totalActiveUsers: indirectStats.totalActiveUsers,
					totalUsers: indirectStats.totalUsers,
					todayTeamDeposit: indirectStats.todayTeamDeposit,
					totalTeamDeposit: indirectStats.totalTeamDeposit,
					todayTeamWithdrawal: indirectStats.todayTeamWithdrawal,
					totalTeamWithdrawal: indirectStats.totalTeamWithdrawal,
					todayCommission: indirectStats.todayCommission,
					totalCommission: indirectStats.totalCommission,
				},
				totalCommission: indirectTotalCommission,
			},
			extendedReferrals: {
				members: extendedStats.membersWithPayments,
				stats: {
					todayNewUsers: extendedStats.todayNewUsers,
					totalActiveUsers: extendedStats.totalActiveUsers,
					totalUsers: extendedStats.totalUsers,
					todayTeamDeposit: extendedStats.todayTeamDeposit,
					totalTeamDeposit: extendedStats.totalTeamDeposit,
					todayTeamWithdrawal: extendedStats.todayTeamWithdrawal,
					totalTeamWithdrawal: extendedStats.totalTeamWithdrawal,
					todayCommission: extendedStats.todayCommission,
					totalCommission: extendedStats.totalCommission,
				},
				totalCommission: extendedTotalCommission,
			},
			commissionSummary: {
				directTotalCommission,
				indirectTotalCommission,
				extendedTotalCommission,
				grandTotalCommission,
			},
		});
	} catch (e) {
		console.error(e);
		res.status(400).json({ success: false, message: e.message });
	}
});

module.exports = router;
