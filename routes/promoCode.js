const express = require("express");
const router = express.Router();

const PromoCode = require("../models/promoCode");
const PromoCodeClaim = require("../models/PromoCodeClaim");
const User = require("../models/User");

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

router.post("/promoCode", async (req, res) => {
	try {
		const { limit, amount } = req.body;
		const parsedLimit = Number(limit);
		const parsedAmount = Number(amount);

		if (!parsedLimit || parsedLimit <= 0 || !parsedAmount || parsedAmount <= 0) {
			return res.status(400).json({
				success: false,
				message: "Valid limit and amount are required",
			});
		}

		const perUserAmount = parsedAmount / parsedLimit;
		if (perUserAmount < 1) {
			return res.status(400).json({
				success: false,
				message:
					"Invalid setup: total amount is too low for this user limit. Please keep amount >= limit so each user gets at least Rs1.",
			});
		}

		const code = await createUniquePromoCode();
		const promo = await PromoCode.create({
			code,
			amount: parsedAmount,
			limit: parsedLimit,
		});

		return res.status(201).json({
			success: true,
			message: "Promo code created successfully",
			perUserAmount: Number((parsedAmount / parsedLimit).toFixed(2)),
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

		const totalAmountCents = Math.round(Number(promo.amount) * 100);
		const maxUsers = Number(promo.limit);
		const baseShareCents = Math.floor(totalAmountCents / maxUsers);
		const remainderCents = totalAmountCents % maxUsers;

		const claimIndex = promo.claimed + 1;
		const claimAmountCents =
			baseShareCents + (claimIndex <= remainderCents ? 1 : 0);
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
		const { userId } = req.body;

		if (!userId) {
			return res
				.status(400)
				.json({ success: false, message: "userId is required" });
		}

		const history = await PromoCodeClaim.find({ userId })
			.sort({ createdAt: -1 })
			.select("code creditedAmount totalAmount limit claimIndex createdAt");

		return res.status(200).json({ success: true, history });
	} catch (error) {
		console.error("Error fetching promo history:", error);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

module.exports = router;
