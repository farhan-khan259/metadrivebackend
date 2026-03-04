
require("dotenv").config(); // ✅ Load environment variables first

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");

// ✅ Import routes
const authRoutes = require("./routes/user");
const paymentRoutes = require("./routes/payment");

const bindRoutes = require("./routes/bindAccountRoutes");
const teamDetailsRoutes = require("./routes/Teamdetails");
const planRoutes = require("./routes/plain");
const commissionRoutes = require('./routes/commissionRoutes');
const rebateCommissionRoutes = require('./routes/planExpireCommission');
const adminRoutes = require("./routes/adminRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const userHistory = require("./routes/userHistory");
const promoCodeRoutes = require("./routes/promoCode");

const ensureAdminUser = require("./utils/ensureAdminUser");



const app = express();

// ✅ CORS Setup
const allowedOrigins = [
	"http://localhost:3000",
	"https://www.metadrive01.xyz",
	"https://metadrive01.xyz",
	
];

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
	}
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization"
	);
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, OPTIONS"
	);

	if (req.method === "OPTIONS") return res.sendStatus(204);
	next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ MongoDB Connection
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB Connected"))
	.catch((err) => console.error("❌ MongoDB Connection Error:", err));


// ✅ Static Folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ API Routes
app.use("/api", authRoutes);
app.use("/api", userHistory);
app.use('/api/commissions', rebateCommissionRoutes);
app.use("/team", teamDetailsRoutes);
app.use("/api/plans", planRoutes);
app.use("/api", paymentRoutes);
app.use("/api/bindAccountRoutes", bindRoutes);
app.use('/api/commission', commissionRoutes); // Only this one
app.use("/api", adminRoutes);
app.use("/api", announcementRoutes);
app.use("/api", promoCodeRoutes);



// ✅ Test route to verify frontend connection
app.get("/api/test", (req, res) => {
	res.json({ ok: true, message: "Backend is working ✅" });
});

// ✅ Cron Jobs
cron.schedule("*/5 * * * *", () => {
	console.log("⏱️ Plan cron executed every 5 minutes");
	require("./cron/planCron");
});

cron.schedule("0 0 * * *", () => {
	console.log("⏱️ Commission cron executed daily at midnight");
	require("./utils/commissionCron");
});

console.log("✅ Cron jobs scheduled");

// ✅ Root route
app.get("/", (req, res) => res.send("Hello from metadrive Backend!"));

// ✅ Start Server
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
