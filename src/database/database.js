const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const databasePath =
    process.env.DATABASE_PATH ||
    path.join(__dirname, "../../marketing.db");

console.log(
    "🗄 Marketing database:",
    databasePath
);

const db =
    new sqlite3.Database(
        databasePath,
        error => {

            if (error) {
                console.error(
                    "❌ Marketing database connection failed:",
                    error
                );
                return;
            }

            console.log(
                "✅ Connected to marketing database"
            );
        }
    );


db.serialize(() => {

    // ========================================
    // BUSINESSES
    // ========================================

    db.run(`
        CREATE TABLE IF NOT EXISTS businesses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            industry TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);


    // ========================================
    // CUSTOMERS
    // ========================================

    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            business_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            platform_customer_id TEXT NOT NULL,

            name TEXT,
            phone TEXT,
            email TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(
                business_id,
                platform,
                platform_customer_id
            )
        )
    `);


    // ========================================
    // CONVERSATIONS
    // ========================================

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            business_id TEXT NOT NULL,
            customer_id INTEGER NOT NULL,
            platform TEXT NOT NULL,

            status TEXT DEFAULT 'active',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY(customer_id)
                REFERENCES customers(id)
        )
    `);


    // ========================================
    // MESSAGES
    // ========================================

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            conversation_id INTEGER NOT NULL,

            role TEXT NOT NULL,
            content TEXT NOT NULL,

            platform_message_id TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY(conversation_id)
                REFERENCES conversations(id)
        )
    `);


    // ========================================
    // LEADS
    // ========================================

    db.run(`
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            business_id TEXT NOT NULL,
            customer_id INTEGER,
            conversation_id INTEGER,

            source TEXT,
            status TEXT DEFAULT 'new',

            name TEXT,
            phone TEXT,
            email TEXT,

            summary TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);


    console.log(
        "✅ Marketing database tables ready"
    );

});


module.exports = db;