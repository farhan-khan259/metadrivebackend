
// backend/routes/Teamdetails.js
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Paymnet = require("../models/payment");
const Plan = require("../models/plain");
const { REFERRAL_COMMISSION_RATES, MAX_COMMISSION_LEVEL } = require("../utils/commissionLogic");

const TEAM_DEPOSIT_REWARD_THRESHOLD = 100000;
const TEAM_DEPOSIT_REWARD_AMOUNT = 3000;
const TEAM_REWARD_MILESTONES = [100000, 200000, 300000];
const LEVEL1_TEAM_REWARD_CONFIGS = [
	{ target: 10, rewardAmount: 1000, title: "Starter Bonus" },
	{ target: 25, rewardAmount: 2500, title: "Rising Leader Bonus" },
	{ target: 50, rewardAmount: 6000, title: "Team Builder Bonus" },
	{ target: 100, rewardAmount: 15000, title: "Leader Bonus" },
	{ target: 200, rewardAmount: 30000, title: "Mega Leader Bonus" },
];

const VALID_LEVEL1_PLAN_STATUSES = ["running", "completed", "claimed", "expired"];

async function buildLevelMembers(user) {
	const userSelectFields =
		"_id fullName email randomCode whatsappNumber team createdAt userTotalDeposits userTotalWithdrawals UserInvestment referredBy";

	const dedupeById = (members) => {
		const seen = new Set();
		const unique = [];
		for (const member of members) {
			const id = member?._id?.toString();
			if (!id || seen.has(id)) continue;
			seen.add(id);
			unique.push(member);
		}
		return unique;
	};

	const fetchUsersByCodes = async (codes) => {
		if (!codes || codes.length === 0) return [];
		return User.find({ randomCode: { $in: codes } }).select(userSelectFields);
	};

	const levelMembers = {};
	const seenUserIds = new Set();

	levelMembers[1] = dedupeById(await fetchUsersByCodes(user.team || []));
	levelMembers[1].forEach((m) => seenUserIds.add(m._id.toString()));

	for (let lvl = 2; lvl <= MAX_COMMISSION_LEVEL; lvl++) {
		const prev = levelMembers[lvl - 1] || [];
		const nextCodes = prev.flatMap((m) => (m.team && m.team.length ? m.team : []));
		if (!nextCodes.length) {
			levelMembers[lvl] = [];
			continue;
		}

		let fetched = await fetchUsersByCodes(nextCodes);
		fetched = dedupeById(fetched).filter((m) => !seenUserIds.has(m._id.toString()));
		fetched.forEach((m) => seenUserIds.add(m._id.toString()));
		levelMembers[lvl] = fetched;
	}

	return levelMembers;
}

function calculateTotalTeamDeposit(levelMembers) {
	let total = 0;
	for (let lvl = 1; lvl <= MAX_COMMISSION_LEVEL; lvl++) {
		const members = levelMembers[lvl] || [];
		for (const member of members) {
			total += Number(member.userTotalDeposits || 0);
		}
	}
	return total;
}

async function getLevel1ValidMemberData(level1Members) {
	if (!Array.isArray(level1Members) || level1Members.length === 0) {
		return {
			validMemberIds: [],
			validMembers: [],
		};
	}

	const level1Ids = level1Members.map((member) => member._id);
	const activePlanUserIds = await Plan.distinct("user_id", {
		user_id: { $in: level1Ids },
		Investment: { $gt: 0 },
		status: { $in: VALID_LEVEL1_PLAN_STATUSES },
	});

	const activeSet = new Set(activePlanUserIds.map((id) => id.toString()));
	const validMembers = level1Members.filter((member) =>
		activeSet.has(member._id.toString())
	);

	return {
		validMemberIds: [...activeSet],
		validMembers,
	};
}

function buildLevel1RewardProgress(validCount, claimedTargets = []) {
	const claimedSet = new Set(claimedTargets.map((value) => Number(value)));

	return LEVEL1_TEAM_REWARD_CONFIGS.map((reward) => {
		const target = Number(reward.target);
		const progressCount = Math.min(validCount, target);
		const progressPercent = target > 0 ? Math.min(100, Math.round((progressCount / target) * 100)) : 0;
		const claimed = claimedSet.has(target);
		const canClaim = !claimed && validCount >= target;

		return {
			target,
			rewardAmount: Number(reward.rewardAmount || 0),
			title: reward.title,
			progressCount,
			progressPercent,
			claimed,
			canClaim,
		};
	});
}

/**
 * Helper: calculate deposit statistics for a set of members
 */
async function calculateStats(members, commissionRate = 0) {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date();
	endOfDay.setHours(23, 59, 59, 999);

	const todayNewUsers = members.filter(
		(u) => u.createdAt >= startOfDay && u.createdAt <= endOfDay
	).length;

	const totalUsers = members.length;
	const totalActiveUsers = members.length;

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
			UserInvestment: member.UserInvestment || 0,
			createdAt: member.createdAt,
			referredBy: member.referredBy, // Include referredBy
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

/**
 * Helper: Get upliner name by referral code
 */
async function getUplinerName(referralCode) {
	if (!referralCode) return null;
	const upliner = await User.findOne({ randomCode: referralCode }).select("fullName");
	return upliner ? upliner.fullName : null;
}

/**
 * POST /team
 */
router.post("/", async (req, res) => {
	const { userId } = req.body;

	try {
		if (!userId) {
			return res.status(400).json({ success: false, message: "userId is required" });
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		// Get referrals with referredBy field
		const userSelectFields =
			"_id fullName email randomCode whatsappNumber team createdAt userTotalDeposits userTotalWithdrawals UserInvestment referredBy";

		const dedupeById = (members) => {
			const seen = new Set();
			const unique = [];
			for (const member of members) {
				const id = member?._id?.toString();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				unique.push(member);
			}
			return unique;
		};

		const fetchUsersByCodes = async (codes) => {
			if (!codes || codes.length === 0) return [];
			return User.find({ randomCode: { $in: codes } }).select(userSelectFields);
		};

		const levelMembers = {};
		const seenUserIds = new Set();

		// Level 1
		levelMembers[1] = dedupeById(await fetchUsersByCodes(user.team || []));
		levelMembers[1].forEach((m) => seenUserIds.add(m._id.toString()));

		// Levels 2..MAX_COMMISSION_LEVEL
		for (let lvl = 2; lvl <= MAX_COMMISSION_LEVEL; lvl++) {
			const prev = levelMembers[lvl - 1] || [];
			const nextCodes = prev.flatMap((m) => (m.team && m.team.length ? m.team : []));
			if (!nextCodes.length) {
				levelMembers[lvl] = [];
				continue;
			}

			let fetched = await fetchUsersByCodes(nextCodes);
			fetched = dedupeById(fetched).filter((m) => !seenUserIds.has(m._id.toString()));
			fetched.forEach((m) => seenUserIds.add(m._id.toString()));
			levelMembers[lvl] = fetched;
		}

		const directReferrals = levelMembers[1] || [];
		const indirectReferrals = levelMembers[2] || [];
		const extendedReferrals = levelMembers[3] || [];
		const level4Referrals = levelMembers[4] || [];
		const level5Referrals = levelMembers[5] || [];

		// Get upliner names for all levels
		const getUplinersForMembers = async (members) => {
			if (!members || members.length === 0) return [];
			const enriched = await Promise.all(
				members.map(async (member) => {
					const uplinerName = await getUplinerName(member.referredBy);
					return {
						...(member.toObject ? member.toObject() : member),
						uplinerName: uplinerName || "Unknown",
					};
				})
			);
			return enriched;
		};

		// Process all levels with upliner names
		const [directWithUpliners, indirectWithUpliners, extendedWithUpliners, level4WithUpliners, level5WithUpliners] =
			await Promise.all([
				getUplinersForMembers(directReferrals),
				getUplinersForMembers(indirectReferrals),
				getUplinersForMembers(extendedReferrals),
				getUplinersForMembers(level4Referrals),
				getUplinersForMembers(level5Referrals),
			]);

		// Calculate stats
		const [directStats, indirectStats, extendedStats, level4Stats, level5Stats] = await Promise.all([
			calculateStats(directWithUpliners, REFERRAL_COMMISSION_RATES[1] || 0),
			calculateStats(indirectWithUpliners, REFERRAL_COMMISSION_RATES[2] || 0),
			calculateStats(extendedWithUpliners, REFERRAL_COMMISSION_RATES[3] || 0),
			calculateStats(level4WithUpliners, REFERRAL_COMMISSION_RATES[4] || 0),
			calculateStats(level5WithUpliners, REFERRAL_COMMISSION_RATES[5] || 0),
		]);

		// Update membersWithPayments to include uplinerName
		directStats.membersWithPayments = directStats.membersWithPayments.map(member => ({
			...member,
			uplinerName: directWithUpliners.find(m => m._id.toString() === member._id.toString())?.uplinerName || user.fullName
		}));

		indirectStats.membersWithPayments = indirectStats.membersWithPayments.map(member => ({
			...member,
			uplinerName: indirectWithUpliners.find(m => m._id.toString() === member._id.toString())?.uplinerName || user.fullName
		}));

		extendedStats.membersWithPayments = extendedStats.membersWithPayments.map(member => ({
			...member,
			uplinerName: extendedWithUpliners.find(m => m._id.toString() === member._id.toString())?.uplinerName || user.fullName
		}));

		level4Stats.membersWithPayments = level4Stats.membersWithPayments.map(member => ({
			...member,
			uplinerName: level4WithUpliners.find(m => m._id.toString() === member._id.toString())?.uplinerName || user.fullName
		}));

		level5Stats.membersWithPayments = level5Stats.membersWithPayments.map(member => ({
			...member,
			uplinerName: level5WithUpliners.find(m => m._id.toString() === member._id.toString())?.uplinerName || user.fullName
		}));

		// Rest of your existing code for payments, investments, etc.
		const payment = await Paymnet.find({ user_id: userId });

		// Team plan investment calculation
		const aggregateInvestment = async (userIds) => {
			if (!userIds || userIds.length === 0) return 0;
			const agg = await Plan.aggregate([
				{ $match: { user_id: { $in: userIds }, planExpired: false } },
				{ $group: { _id: null, total: { $sum: "$Investment" } } },
			]);
			return (agg[0] && agg[0].total) || 0;
		};

		const level1UserIds = directReferrals.map((u) => u._id);
		const level2UserIds = indirectReferrals.map((u) => u._id);
		const level3UserIds = extendedReferrals.map((u) => u._id);
		const level4UserIds = level4Referrals.map((u) => u._id);
		const level5UserIds = level5Referrals.map((u) => u._id);

		const [level1Investment, level2Investment, level3Investment, level4Investment, level5Investment] =
			await Promise.all([
				aggregateInvestment(level1UserIds),
				aggregateInvestment(level2UserIds),
				aggregateInvestment(level3UserIds),
				aggregateInvestment(level4UserIds),
				aggregateInvestment(level5UserIds),
			]);

		const teamPlanInvestment =
			Number(level1Investment + level2Investment + level3Investment + level4Investment + level5Investment) || 0;

		// Commission totals
		const directTotalCommission = directStats.totalCommission || 0;
		const indirectTotalCommission = indirectStats.totalCommission || 0;
		const extendedTotalCommission = extendedStats.totalCommission || 0;
		const level4TotalCommission = level4Stats.totalCommission || 0;
		const level5TotalCommission = level5Stats.totalCommission || 0;
		const grandTotalCommission =
			directTotalCommission +
			indirectTotalCommission +
			extendedTotalCommission +
			level4TotalCommission +
			level5TotalCommission;

		// Final response
		const claimedMilestones = Array.isArray(user.teamDepositRewardMilestones)
			? user.teamDepositRewardMilestones
			: [];
		const normalizedClaimedMilestones = [
			...new Set([
				...claimedMilestones,
				...(user.teamDepositRewardClaimed ? [TEAM_DEPOSIT_REWARD_THRESHOLD] : []),
			]),
		].sort((a, b) => a - b);

		return res.status(200).json({
			success: true,
			user: {
				_id: user._id,
				fullName: user.fullName,
				email: user.email,
				randomCode: user.randomCode,
				whatsappNumber: user.whatsappNumber,
				teamIds: user.team || [],
				UserInvestment: user.UserInvestment || 0,
				userbalance: user.userbalance || 0,
				userTotalDeposits: user.userTotalDeposits || 0,
				userCreateDate: user.createdAt || null,
				userTotalWithdrawals: user.userTotalWithdrawals || 0,
				teamDepositRewardClaimed: user.teamDepositRewardClaimed || false,
				teamDepositRewardClaimedAt: user.teamDepositRewardClaimedAt || null,
				teamDepositRewardMilestones: normalizedClaimedMilestones,
				level1TeamRewardClaimedTargets: user.level1TeamRewardClaimedTargets || [],
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
			level4Referrals: {
				members: level4Stats.membersWithPayments,
				stats: {
					todayNewUsers: level4Stats.todayNewUsers,
					totalActiveUsers: level4Stats.totalActiveUsers,
					totalUsers: level4Stats.totalUsers,
					todayTeamDeposit: level4Stats.todayTeamDeposit,
					totalTeamDeposit: level4Stats.totalTeamDeposit,
					todayTeamWithdrawal: level4Stats.todayTeamWithdrawal,
					totalTeamWithdrawal: level4Stats.totalTeamWithdrawal,
					todayCommission: level4Stats.todayCommission,
					totalCommission: level4Stats.totalCommission,
				},
				totalCommission: level4TotalCommission,
			},
			level5Referrals: {
				members: level5Stats.membersWithPayments,
				stats: {
					todayNewUsers: level5Stats.todayNewUsers,
					totalActiveUsers: level5Stats.totalActiveUsers,
					totalUsers: level5Stats.totalUsers,
					todayTeamDeposit: level5Stats.todayTeamDeposit,
					totalTeamDeposit: level5Stats.totalTeamDeposit,
					todayTeamWithdrawal: level5Stats.todayTeamWithdrawal,
					totalTeamWithdrawal: level5Stats.totalTeamWithdrawal,
					todayCommission: level5Stats.todayCommission,
					totalCommission: level5Stats.totalCommission,
				},
				totalCommission: level5TotalCommission,
			},
			commissionSummary: {
				level1Commission: directTotalCommission,
				level2Commission: indirectTotalCommission,
				level3Commission: extendedTotalCommission,
				level4Commission: level4TotalCommission,
				level5Commission: level5TotalCommission,
				grandTotalCommission,
			},
			payment: payment || [],
			teamPlanInvestment,
			teamDepositRewardMilestones: TEAM_REWARD_MILESTONES,
			teamPlanInvestmentBreakdown: {
				level1: level1Investment,
				level2: level2Investment,
				level3: level3Investment,
				level4: level4Investment,
				level5: level5Investment,
			},
		});
	} catch (err) {
		console.error("❌ Error in /team route:", err);
		return res.status(500).json({ success: false, message: err.message || "Server error" });
	}
});

/**
 * POST /team/level1-rewards
 * Level-1 valid member rewards based on direct referrals with activated plans only.
 */
router.post("/level1-rewards", async (req, res) => {
	const { userId } = req.body;

	try {
		if (!userId) {
			return res.status(400).json({ success: false, message: "userId is required" });
		}

		const user = await User.findById(userId).select("_id team fullName level1TeamRewardClaimedTargets userbalance");
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const levelMembers = await buildLevelMembers(user);
		const level1Members = levelMembers[1] || [];
		const { validMembers } = await getLevel1ValidMemberData(level1Members);

		const claimedTargets = Array.isArray(user.level1TeamRewardClaimedTargets)
			? user.level1TeamRewardClaimedTargets
			: [];

		return res.status(200).json({
			success: true,
			user: {
				_id: user._id,
				fullName: user.fullName,
				userbalance: Number(user.userbalance || 0),
				level1TeamRewardClaimedTargets: claimedTargets,
			},
			level1Stats: {
				totalDirectMembers: level1Members.length,
				validMembersCount: validMembers.length,
				invalidMembersCount: Math.max(level1Members.length - validMembers.length, 0),
			},
			rewards: buildLevel1RewardProgress(validMembers.length, claimedTargets),
		});
	} catch (err) {
		console.error("❌ Error in /team/level1-rewards:", err);
		return res.status(500).json({ success: false, message: err.message || "Server error" });
	}
});

/**
 * POST /team/claim-level1-reward
 * Claim level-1 direct referral reward once target is completed.
 */
router.post("/claim-level1-reward", async (req, res) => {
	const { userId, target } = req.body;

	try {
		if (!userId) {
			return res.status(400).json({ success: false, message: "userId is required" });
		}

		const normalizedTarget = Number(target);
		const rewardConfig = LEVEL1_TEAM_REWARD_CONFIGS.find(
			(item) => Number(item.target) === normalizedTarget
		);

		if (!rewardConfig) {
			return res.status(400).json({
				success: false,
				message: "Invalid target",
				allowedTargets: LEVEL1_TEAM_REWARD_CONFIGS.map((item) => item.target),
			});
		}

		const user = await User.findById(userId).select("_id team userbalance level1TeamRewardClaimedTargets fullName");
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const claimedTargets = Array.isArray(user.level1TeamRewardClaimedTargets)
			? user.level1TeamRewardClaimedTargets.map((value) => Number(value))
			: [];
		if (claimedTargets.includes(normalizedTarget)) {
			return res.status(400).json({
				success: false,
				message: "Reward already claimed",
				claimed: true,
				target: normalizedTarget,
			});
		}

		const levelMembers = await buildLevelMembers(user);
		const level1Members = levelMembers[1] || [];
		const { validMembers } = await getLevel1ValidMemberData(level1Members);
		const validMembersCount = validMembers.length;

		if (validMembersCount < normalizedTarget) {
			return res.status(400).json({
				success: false,
				message: "Target not completed yet",
				claimed: false,
				target: normalizedTarget,
				validMembersCount,
			});
		}

		const updated = await User.findOneAndUpdate(
			{
				_id: userId,
				level1TeamRewardClaimedTargets: { $ne: normalizedTarget },
			},
			{
				$inc: { userbalance: Number(rewardConfig.rewardAmount || 0) },
				$addToSet: { level1TeamRewardClaimedTargets: normalizedTarget },
			},
			{ new: true }
		).select("_id userbalance fullName level1TeamRewardClaimedTargets");

		if (!updated) {
			return res.status(400).json({
				success: false,
				message: "Reward already claimed",
				claimed: true,
				target: normalizedTarget,
			});
		}

		return res.status(200).json({
			success: true,
			message: "Reward claimed successfully",
			target: normalizedTarget,
			rewardAmount: Number(rewardConfig.rewardAmount || 0),
			newBalance: Number(updated.userbalance || 0),
			claimedTargets: updated.level1TeamRewardClaimedTargets || [],
			validMembersCount,
		});
	} catch (err) {
		console.error("❌ Error in /team/claim-level1-reward:", err);
		return res.status(500).json({ success: false, message: err.message || "Server error" });
	}
});

/**
 * POST /team/claim-reward
 * Milestone rewards: +3000 to userbalance when total team deposit reaches each configured threshold
 */
router.post("/claim-reward", async (req, res) => {
	const { userId, threshold } = req.body;

	try {
		if (!userId) {
			return res.status(400).json({ success: false, message: "userId is required" });
		}

		const requestedThreshold = Number(threshold) || TEAM_DEPOSIT_REWARD_THRESHOLD;
		if (!TEAM_REWARD_MILESTONES.includes(requestedThreshold)) {
			return res.status(400).json({
				success: false,
				message: "Invalid reward threshold",
				allowedThresholds: TEAM_REWARD_MILESTONES,
			});
		}

		const user = await User.findById(userId).select("_id team userbalance teamDepositRewardClaimed teamDepositRewardClaimedAt teamDepositRewardMilestones");
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const claimedMilestones = Array.isArray(user.teamDepositRewardMilestones)
			? user.teamDepositRewardMilestones
			: [];
		const milestoneAlreadyClaimed =
			claimedMilestones.includes(requestedThreshold) ||
			(requestedThreshold === TEAM_DEPOSIT_REWARD_THRESHOLD && user.teamDepositRewardClaimed);

		if (milestoneAlreadyClaimed) {
			return res
				.status(400)
				.json({ success: false, message: "Reward already claimed", claimed: true, threshold: requestedThreshold });
		}

		const levelMembers = await buildLevelMembers(user);
		const totalTeamDeposit = calculateTotalTeamDeposit(levelMembers);
		if (totalTeamDeposit < requestedThreshold) {
			return res.status(400).json({
				success: false,
				message: "Not eligible yet",
				totalTeamDeposit,
				threshold: requestedThreshold,
				claimed: false,
			});
		}

		const updateQuery = {
			_id: userId,
			teamDepositRewardMilestones: { $ne: requestedThreshold },
		};
		if (requestedThreshold === TEAM_DEPOSIT_REWARD_THRESHOLD) {
			updateQuery.teamDepositRewardClaimed = { $ne: true };
		}

		const updatePayload = {
			$inc: { userbalance: TEAM_DEPOSIT_REWARD_AMOUNT },
			$addToSet: { teamDepositRewardMilestones: requestedThreshold },
		};
		if (requestedThreshold === TEAM_DEPOSIT_REWARD_THRESHOLD) {
			updatePayload.$set = {
				teamDepositRewardClaimed: true,
				teamDepositRewardClaimedAt: new Date(),
			};
		}

		const updated = await User.findOneAndUpdate(
			updateQuery,
			updatePayload,
			{ new: true }
		).select("_id userbalance teamDepositRewardClaimed teamDepositRewardClaimedAt teamDepositRewardMilestones");

		if (!updated) {
			return res
				.status(400)
				.json({ success: false, message: "Reward already claimed", claimed: true, threshold: requestedThreshold });
		}

		return res.status(200).json({
			success: true,
			message: "Reward claimed successfully",
			rewardAmount: TEAM_DEPOSIT_REWARD_AMOUNT,
			newBalance: updated.userbalance,
			claimed: true,
			totalTeamDeposit,
			threshold: requestedThreshold,
			claimedMilestones: updated.teamDepositRewardMilestones || [],
			claimedAt: updated.teamDepositRewardClaimedAt,
		});
	} catch (err) {
		console.error("❌ Error in /team/claim-reward:", err);
		return res.status(500).json({ success: false, message: err.message || "Server error" });
	}
});

module.exports = router;