const bcrypt = require("bcryptjs");
const User = require("../models/User");

function generateRandomCode(length = 8) {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

async function generateUniqueRandomCode(maxAttempts = 20) {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const code = generateRandomCode();
		// eslint-disable-next-line no-await-in-loop
		const exists = await User.exists({ randomCode: code });
		if (!exists) return code;
	}
	throw new Error("Failed to generate unique randomCode for admin user");
}

async function ensureAdminUser() {
	const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
	const adminPassword = process.env.ADMIN_PASSWORD;
	const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

	if (!adminEmail) {
		console.warn("⚠️ ADMIN_EMAIL not set; skipping admin seed");
		return null;
	}

	if (!adminPassword && !adminPasswordHash) {
		console.warn("⚠️ ADMIN_PASSWORD / ADMIN_PASSWORD_HASH not set; skipping admin seed");
		return null;
	}

	let adminUser = await User.findOne({ email: adminEmail });

	// If email changed, try to find an existing admin account to update
	if (!adminUser) {
		adminUser = await User.findOne({ role: "admin" });
	}

	const nextPasswordHash = adminPassword
		? await bcrypt.hash(adminPassword, 10)
		: adminPasswordHash;

	if (!adminUser) {
		const randomCode = await generateUniqueRandomCode();
		adminUser = new User({
			fullName: "Admin",
			email: adminEmail,
			password: nextPasswordHash,
			role: "admin",
			randomCode,
			team: [],
			whatsappNumber: "",
			userbalance: 0,
			UserInvestment: 0,
			userTotalDeposits: 0,
			userTotalWithdrawals: 0,
			totalEarnings: 0,
			totalCommissionEarned: 0,
		});
		await adminUser.save();
		console.log(`✅ Admin user created in DB: ${adminEmail}`);
		return adminUser;
	}

	// Update existing admin user
	let didChange = false;
	if (adminUser.email !== adminEmail) {
		adminUser.email = adminEmail;
		didChange = true;
	}
	if (adminUser.role !== "admin") {
		adminUser.role = "admin";
		didChange = true;
	}
	if (adminUser.password !== nextPasswordHash) {
		adminUser.password = nextPasswordHash;
		didChange = true;
	}
	if (!adminUser.randomCode) {
		adminUser.randomCode = await generateUniqueRandomCode();
		didChange = true;
	}

	if (didChange) {
		await adminUser.save();
		console.log(`✅ Admin user updated in DB: ${adminEmail}`);
	} else {
		console.log(`ℹ️ Admin user already up-to-date: ${adminEmail}`);
	}

	return adminUser;
}

module.exports = ensureAdminUser;
