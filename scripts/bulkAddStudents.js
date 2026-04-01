const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../server/models/User');
const StudentProfile = require('../server/models/StudentProfile');

const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/placement_portal';
const REPO_ROOT = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.resolve(REPO_ROOT, '.env') });

function printUsage() {
	console.log('Usage: npm run bulk:add-students -- --file="students.csv" --password="CommonPass123"');
	console.log('Also supported: --file students.csv --password CommonPass123');
	console.log('CSV format: name,email (header row is optional)');
}

function parseArgs(argv) {
	const args = {};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (!arg.startsWith('--')) continue;

		const cleaned = arg.slice(2);
		const equalsIndex = cleaned.indexOf('=');

		if (equalsIndex !== -1) {
			const key = cleaned.slice(0, equalsIndex);
			const value = cleaned.slice(equalsIndex + 1).trim();
			args[key] = value;
			continue;
		}

		const nextToken = argv[i + 1];
		if (nextToken && !nextToken.startsWith('--')) {
			args[cleaned] = nextToken.trim();
			i += 1;
		} else {
			args[cleaned] = '';
		}
	}

	if (!args.file && process.env.npm_config_file) {
		args.file = process.env.npm_config_file;
	}

	if (!args.password && process.env.npm_config_password) {
		args.password = process.env.npm_config_password;
	}

	return args;
}

function resolveCsvPath(csvFile) {
	if (path.isAbsolute(csvFile)) {
		return fs.existsSync(csvFile) ? csvFile : null;
	}

	const cwdPath = path.resolve(process.cwd(), csvFile);
	if (fs.existsSync(cwdPath)) return cwdPath;

	const rootPath = path.resolve(REPO_ROOT, csvFile);
	if (fs.existsSync(rootPath)) return rootPath;

	return null;
}

function parseCsv(content) {
	const rows = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (rows.length === 0) return [];

	const firstCells = rows[0].split(',').map((cell) => cell.trim().toLowerCase());
	const hasHeader = firstCells[0] === 'name' && firstCells[1] === 'email';
	const dataRows = hasHeader ? rows.slice(1) : rows;

	return dataRows
		.map((line, index) => {
			const separator = line.indexOf(',');
			if (separator === -1) {
				return { error: `Invalid row at line ${hasHeader ? index + 2 : index + 1}: ${line}` };
			}

			const rawName = line.slice(0, separator).trim();
			const rawEmail = line.slice(separator + 1).trim().toLowerCase();

			if (!rawName || !rawEmail) {
				return { error: `Missing name/email at line ${hasHeader ? index + 2 : index + 1}` };
			}

			return { name: rawName, email: rawEmail };
		});
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	const csvFile = args.file;
	const password = args.password;

	if (!csvFile || !password) {
		printUsage();
		process.exitCode = 1;
		return;
	}

	if (password.length < 6) {
		console.error('Password must be at least 6 characters.');
		process.exitCode = 1;
		return;
	}

	const resolvedCsvPath = resolveCsvPath(csvFile);
	if (!resolvedCsvPath) {
		console.error(`CSV file not found for input: ${csvFile}`);
		console.error(`Tried from cwd: ${path.resolve(process.cwd(), csvFile)}`);
		console.error(`Tried from repo root: ${path.resolve(REPO_ROOT, csvFile)}`);
		process.exitCode = 1;
		return;
	}

	const csvContent = fs.readFileSync(resolvedCsvPath, 'utf8');
	const parsedRows = parseCsv(csvContent);

	const rowErrors = parsedRows.filter((row) => row.error);
	if (rowErrors.length > 0) {
		for (const rowError of rowErrors) {
			console.error(rowError.error);
		}
		process.exitCode = 1;
		return;
	}

	const rows = parsedRows;
	if (rows.length === 0) {
		console.log('No students found in CSV.');
		return;
	}

	const dedupedByEmail = [];
	const seenEmails = new Set();
	let duplicateInCsvCount = 0;

	for (const row of rows) {
		if (seenEmails.has(row.email)) {
			duplicateInCsvCount += 1;
			continue;
		}
		seenEmails.add(row.email);
		dedupedByEmail.push(row);
	}

	const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGO_URI;
	await mongoose.connect(mongoUri);
	console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

	try {
		const incomingEmails = dedupedByEmail.map((row) => row.email);
		const existingUsers = await User.find(
			{ email: { $in: incomingEmails } },
			{ email: 1 }
		).lean();

		const existingEmailSet = new Set(existingUsers.map((user) => user.email));
		const toCreate = dedupedByEmail.filter((row) => !existingEmailSet.has(row.email));

		if (toCreate.length === 0) {
			console.log('No new students to create.');
			console.log(`Skipped existing users: ${existingUsers.length}`);
			console.log(`Skipped duplicate rows in CSV: ${duplicateInCsvCount}`);
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 12);
		const usersPayload = toCreate.map((row) => ({
			name: row.name,
			email: row.email,
			password: hashedPassword,
			role: 'student',
			isVerified: true,
		}));

		const createdUsers = await User.insertMany(usersPayload, { ordered: false });

		const profilesPayload = createdUsers.map((user) => ({
			user: user._id,
			skills: [],
			profileCompletion: 0,
		}));

		await StudentProfile.insertMany(profilesPayload, { ordered: false });

		const verifiedUsers = await User.countDocuments({
			email: { $in: toCreate.map((row) => row.email) },
			role: 'student',
		});

		console.log(`Created students: ${createdUsers.length}`);
		console.log(`Verified in users collection: ${verifiedUsers}`);
		console.log(`Skipped existing users: ${existingUsers.length}`);
		console.log(`Skipped duplicate rows in CSV: ${duplicateInCsvCount}`);
	} finally {
		await mongoose.disconnect();
	}
}

run().catch(async (error) => {
	console.error('Bulk import failed:', error.message);
	try {
		await mongoose.disconnect();
	} catch (disconnectError) {
		console.error('Disconnect failed:', disconnectError.message);
	}
	process.exitCode = 1;
});
