
require("dotenv").config(); // ✅ Load environment variables first

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// ✅ Import routes
const authRoutes = require("./routes/user");
const paymentRoutes = require("./routes/payment");

const bindRoutes = require("./routes/bindAccountRoutes");
const teamDetailsRoutes = require("./routes/Teamdetails");
const planRoutes = require("./routes/plain");
const commissionRoutes = require('./routes/commissionRoutes');
const adminRoutes = require("./routes/adminRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const userHistory = require("./routes/userHistory");


const ensureAdminUser = require("./utils/ensureAdminUser");



const app = express();


// ✅ CORS Configuration (Only allow frontend)
app.use(
	cors({
		origin: [
			"http://localhost:3000",
			"https://sparkx1.pro",
			"https://www.sparkx1.pro",
		],
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
		credentials: true,
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const connectToMongo = async () => {
	const mongoUris = [process.env.MONGO_URI, process.env.MONGO_URI_DIRECT].filter(Boolean);

	if (mongoUris.length === 0) {
		throw new Error("MONGO_URI is missing in .env");
	}

	let lastError;
	for (let index = 0; index < mongoUris.length; index += 1) {
		const uri = mongoUris[index];

		try {
			await mongoose.connect(uri, {
				serverSelectionTimeoutMS: 15000,
			});

			if (index === 1) {
				console.warn("⚠️ MongoDB connected using MONGO_URI_DIRECT fallback");
			}

			return;
		} catch (err) {
			lastError = err;

			const canTryNext = index < mongoUris.length - 1;
			if (canTryNext) {
				console.warn("⚠️ Primary MongoDB URI failed, trying fallback URI...");
				continue;
			}
		}
	}

	throw lastError;
};

// ✅ MongoDB Connection + Server Startup
const startServer = async () => {
	if (!process.env.MONGO_URI && !process.env.MONGO_URI_DIRECT) {
		console.error("❌ MONGO_URI is missing in .env");
		process.exit(1);
	}

	try {
		await connectToMongo();
		console.log("✅ MongoDB Connected");

		try {
			await ensureAdminUser();
		} catch (seedErr) {
			console.error("❌ ensureAdminUser failed:", seedErr);
		}

		const PORT = process.env.PORT || 3005;
		app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
	} catch (err) {
		console.error("❌ MongoDB Connection Error:", err);
		process.exit(1);
	}
};

// ✅ Static Folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ API Routes
app.use("/api", authRoutes);
app.use("/api", userHistory);
app.use("/team", teamDetailsRoutes);
app.use("/api/plans", planRoutes);
app.use("/api", paymentRoutes);
app.use("/api/bindAccountRoutes", bindRoutes);
app.use('/api/commission', commissionRoutes); // Only this one
app.use("/api", adminRoutes);
app.use("/api", announcementRoutes);


// ✅ Cron Jobs (auto-run tasks)
require("./cron/planCron");

// Daily upline commissions are distributed inside the plan daily profit cron.


// ✅ Root Test Route
app.get("/", (req, res) => {
	console.log("🌐 Server connected successfully");
	res.send("Hello from SparkX Backend!");
});

// ✅ Test Claim Reward Route
app.get("/api/test-claim", (req, res) => {
	res.json({ message: "Claim reward route is working!" });
});

startServer();
