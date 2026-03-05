const express = require("express");
const router = express.Router();

const PromoCode = require("../models/PromoCode");
const PromoCodeClaim = require("../models/PromoCodeClaim");
const User = require("../models/User");

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

async function cleanupExpiredClaims() {
	const cutoff = new Date(Date.now() - CLAIM_WINDOW_MS);
	await PromoCodeClaim.deleteMany({ createdAt: { $lt: cutoff } });
}

function generateCode(length = 8) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let result = "";
	for (let index = 0; index < length; index += 1) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

async function createUniquePromoCode() {
	let code = generateCode();
	let exists = await PromoCode.exists({ code });

	while (exists) {
		code = generateCode();
		exists = await PromoCode.exists({ code });
	}

	return code;
}

function shuffleArray(values) {
	const arr = [...values];
	for (let index = arr.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[arr[index], arr[randomIndex]] = [arr[randomIndex], arr[index]];
	}
	return arr;
}

function getMinTotalForUniqueDistributionCents(users, minPerUserCents = 100) {
	return users * minPerUserCents + (users * (users - 1)) / 2;
}

function hasDifferentAmounts(values) {
	return Array.isArray(values) && new Set(values).size > 1;
}

function createRandomDistributionCents(totalCents, users, minPerUserCents = 100) {
	if (!Number.isInteger(totalCents) || !Number.isInteger(users) || users <= 0) {
		throw new Error("Invalid distribution setup");
	}

	const minimumRequired = users * minPerUserCents;
	if (totalCents < minimumRequired) {
		throw new Error("Total amount too low for user limit");
	}

	const minimumUniqueRequired = getMinTotalForUniqueDistributionCents(
		users,
		minPerUserCents
	);
	if (totalCents < minimumUniqueRequired) {
		throw new Error("Total amount too low for unique random distribution");
	}

	const shares = Array.from({ length: users }, (_, index) => minPerUserCents + index);
	let remaining = totalCents - minimumUniqueRequired;

	const deltas = Array(users).fill(0);
	for (let index = 0; index < users; index += 1) {
		const weight = users - index;
		const maxChunk = Math.floor(remaining / weight);
		const chunk = index === users - 1 ? maxChunk : Math.floor(Math.random() * (maxChunk + 1));
		deltas[index] = chunk;
		remaining -= chunk * weight;
	}

	let runningDelta = 0;
	for (let index = 0; index < users; index += 1) {
		runningDelta += deltas[index];
		shares[index] += runningDelta;
	}

	if (!hasDifferentAmounts(shares)) {
		throw new Error("Unable to generate random distribution");
	}

	return shuffleArray(shares);
}

router.post("/promoCode", async (req, res) => {
	try {
		const { limit, amount } = req.body;
		const parsedLimit = Number(limit);
		const parsedAmount = Number(amount);

		if (
			!Number.isFinite(parsedLimit) ||
			!Number.isFinite(parsedAmount) ||
			parsedLimit <= 0 ||
			parsedAmount <= 0
		) {
			return res.status(400).json({
				success: false,
				message: "Valid limit and amount are required",
			});
		}

		if (!Number.isInteger(parsedLimit)) {
			return res.status(400).json({
				success: false,
				message: "Limit must be a whole number",
			});
		}

		const totalAmountCents = Math.round(parsedAmount * 100);
		if (totalAmountCents < parsedLimit * 100) {
			return res.status(400).json({
				success: false,
				message:
					"Invalid setup: total amount is too low for this user limit. Please keep amount >= limit so each user gets at least Rs1.",
			});
		}

		const minimumUniqueRequired = getMinTotalForUniqueDistributionCents(
			parsedLimit,
			100
		);
		if (totalAmountCents < minimumUniqueRequired) {
			return res.status(400).json({
				success: false,
				message: `For random different amounts per user, total amount must be at least Rs${(
					minimumUniqueRequired / 100
				).toFixed(2)} for limit ${parsedLimit}.`,
			});
		}

		const claimAmountsCents = createRandomDistributionCents(
			totalAmountCents,
			parsedLimit,
			100
		);

		const code = await createUniquePromoCode();
		const promo = await PromoCode.create({
			code,
			amount: parsedAmount,
			limit: parsedLimit,
			claimAmountsCents,
		});

		const minShare = Math.min(...claimAmountsCents) / 100;
		const maxShare = Math.max(...claimAmountsCents) / 100;

		return res.status(201).json({
			success: true,
			message: "Promo code created successfully",
			distribution: {
				type: "random",
				minAmount: Number(minShare.toFixed(2)),
				maxAmount: Number(maxShare.toFixed(2)),
			},
			promo,
		});
	} catch (error) {
		console.error("Error creating promo code:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

router.post("/promoCodeGetAll", async (_req, res) => {
	try {
		const data = await PromoCode.find().sort({ createdAt: -1 });
		return res.status(200).json({ success: true, data });
	} catch (error) {
		console.error("Error fetching promo codes:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

router.post("/promoCodeDelete1", async (req, res) => {
	try {
		const { id } = req.body;

		if (!id) {
			return res.status(400).json({
				success: false,
				message: "Promo code id is required",
			});
		}

		const deleted = await PromoCode.findByIdAndDelete(id);

		if (!deleted) {
			return res
				.status(404)
				.json({ success: false, message: "Promo code not found" });
		}

		return res
			.status(200)
			.json({ success: true, message: "Promo code deleted successfully" });
	} catch (error) {
		console.error("Error deleting promo code:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

router.post("/promoCode/apply", async (req, res) => {
	try {
		await cleanupExpiredClaims();

		const { code, userId } = req.body;

		if (!code || !userId) {
			return res.status(400).json({
				success: false,
				message: "Promo code and userId are required",
			});
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const normalizedCode = String(code).trim().toUpperCase();
		const promo = await PromoCode.findOne({ code: normalizedCode, isActive: true });

		if (!promo) {
			return res
				.status(404)
				.json({ success: false, message: "Invalid promo code" });
		}

		const alreadyClaimed = promo.claimedBy.some(
			(claimedUserId) => claimedUserId.toString() === userId
		);

		if (alreadyClaimed) {
			return res.status(400).json({
				success: false,
				message: "You have already claimed this promo code",
			});
		}

		if (promo.claimed >= promo.limit) {
			return res.status(400).json({
				success: false,
				message: "Promo code usage limit reached",
			});
		}

		if (
			promo.claimed === 0 &&
			(!Array.isArray(promo.claimAmountsCents) ||
				promo.claimAmountsCents.length !== promo.limit ||
				!hasDifferentAmounts(promo.claimAmountsCents))
		) {
			const totalAmountCents = Math.round(Number(promo.amount) * 100);
			const minimumUniqueRequired = getMinTotalForUniqueDistributionCents(
				Number(promo.limit),
				100
			);

			if (totalAmountCents >= minimumUniqueRequired) {
				promo.claimAmountsCents = createRandomDistributionCents(
					totalAmountCents,
					Number(promo.limit),
					100
				);
				await promo.save();
			}
		}

		const claimIndex = promo.claimed + 1;
		let claimAmountCents;

		if (
			Array.isArray(promo.claimAmountsCents) &&
			promo.claimAmountsCents.length === promo.limit
		) {
			claimAmountCents = promo.claimAmountsCents[claimIndex - 1];
		} else {
			const totalAmountCents = Math.round(Number(promo.amount) * 100);
			const maxUsers = Number(promo.limit);
			const baseShareCents = Math.floor(totalAmountCents / maxUsers);
			const remainderCents = totalAmountCents % maxUsers;
			claimAmountCents = baseShareCents + (claimIndex <= remainderCents ? 1 : 0);
		}

		if (!Number.isFinite(claimAmountCents) || claimAmountCents <= 0) {
			return res.status(400).json({
				success: false,
				message: "Promo code payout setup is invalid",
			});
		}

		const claimAmount = claimAmountCents / 100;

		user.userbalance += claimAmount;
		await user.save();

		promo.claimed += 1;
		promo.claimedBy.push(user._id);
		await promo.save();

		const claimRecord = await PromoCodeClaim.create({
			userId: user._id,
			promoCodeId: promo._id,
			code: promo.code,
			creditedAmount: claimAmount,
			totalAmount: promo.amount,
			limit: promo.limit,
			claimIndex,
		});

		return res.status(200).json({
			success: true,
			message: "Promo code applied successfully",
			amount: claimAmount,
			totalAmount: promo.amount,
			balance: user.userbalance,
			claim: {
				_id: claimRecord._id,
				code: claimRecord.code,
				userName: user.fullName,
				creditedAmount: claimRecord.creditedAmount,
				totalAmount: claimRecord.totalAmount,
				limit: claimRecord.limit,
				claimIndex: claimRecord.claimIndex,
				createdAt: claimRecord.createdAt,
			},
		});
	} catch (error) {
		console.error("Error applying promo code:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

router.post("/promoCode/history", async (req, res) => {
	try {
		await cleanupExpiredClaims();

		const { userId } = req.body;

		if (!userId) {
			return res
				.status(400)
				.json({ success: false, message: "userId is required" });
		}

		const cutoff = new Date(Date.now() - CLAIM_WINDOW_MS);
		const history = await PromoCodeClaim.find({ userId, createdAt: { $gte: cutoff } })
			.sort({ createdAt: -1 })
			.select("code creditedAmount totalAmount limit claimIndex createdAt");

		return res.status(200).json({ success: true, history });
	} catch (error) {
		console.error("Error fetching promo history:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

router.post("/promoCode/liveClaims", async (_req, res) => {
	try {
		await cleanupExpiredClaims();

		const cutoff = new Date(Date.now() - CLAIM_WINDOW_MS);
		const history = await PromoCodeClaim.find({ createdAt: { $gte: cutoff } })
			.sort({ createdAt: -1 })
			.limit(200)
			.populate("userId", "fullName")
			.select("code creditedAmount createdAt userId");

		const liveClaims = history.map((item) => ({
			_id: item._id,
			code: item.code,
			creditedAmount: item.creditedAmount,
			createdAt: item.createdAt,
			userName: item.userId?.fullName || "User",
		}));

		return res.status(200).json({ success: true, history: liveClaims });
	} catch (error) {
		console.error("Error fetching live promo claims:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

module.exports = router;
