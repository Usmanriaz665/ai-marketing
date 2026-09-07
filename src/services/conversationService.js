const db =
    require("../database/database");


function run(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.run(
                sql,
                params,
                function(error) {

                    if (error) {
                        return reject(error);
                    }

                    resolve({
                        id: this.lastID,
                        changes: this.changes
                    });
                }
            );
        }
    );
}


function get(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.get(
                sql,
                params,
                (error, row) => {

                    if (error) {
                        return reject(error);
                    }

                    resolve(row);
                }
            );
        }
    );
}


function all(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.all(
                sql,
                params,
                (error, rows) => {

                    if (error) {
                        return reject(error);
                    }

                    resolve(rows);
                }
            );
        }
    );
}


// ========================================
// CUSTOMER
// ========================================

async function getOrCreateCustomer(
    businessId,
    platform,
    platformCustomerId
) {

    let customer =
        await get(
            `
            SELECT *
            FROM customers
            WHERE business_id = ?
              AND platform = ?
              AND platform_customer_id = ?
            `,
            [
                businessId,
                platform,
                platformCustomerId
            ]
        );


    if (customer) {
        return customer;
    }


    const result =
        await run(
            `
            INSERT INTO customers (
                business_id,
                platform,
                platform_customer_id
            )
            VALUES (?, ?, ?)
            `,
            [
                businessId,
                platform,
                platformCustomerId
            ]
        );


    customer =
        await get(
            `
            SELECT *
            FROM customers
            WHERE id = ?
            `,
            [result.id]
        );


    console.log(
        "👤 Marketing customer created:",
        customer.id
    );


    return customer;
}


// ========================================
// CONVERSATION
// ========================================

async function getOrCreateConversation(
    businessId,
    platform,
    platformCustomerId
) {

    const customer =
        await getOrCreateCustomer(
            businessId,
            platform,
            platformCustomerId
        );


    let conversation =
        await get(
            `
            SELECT *
            FROM conversations
            WHERE business_id = ?
              AND customer_id = ?
              AND platform = ?
              AND status = 'active'
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                businessId,
                customer.id,
                platform
            ]
        );


    if (conversation) {

        return {
            customer,
            conversation
        };
    }


    const result =
        await run(
            `
            INSERT INTO conversations (
                business_id,
                customer_id,
                platform
            )
            VALUES (?, ?, ?)
            `,
            [
                businessId,
                customer.id,
                platform
            ]
        );


    conversation =
        await get(
            `
            SELECT *
            FROM conversations
            WHERE id = ?
            `,
            [result.id]
        );


    console.log(
        "💬 Conversation created:",
        conversation.id
    );


    return {
        customer,
        conversation
    };
}


// ========================================
// SAVE MESSAGE
// ========================================

async function addMessage(
    businessId,
    platform,
    platformCustomerId,
    role,
    content,
    platformMessageId = null
) {

    const {
        conversation
    } =
        await getOrCreateConversation(
            businessId,
            platform,
            platformCustomerId
        );


    await run(
        `
        INSERT INTO messages (
            conversation_id,
            role,
            content,
            platform_message_id
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            conversation.id,
            role,
            content,
            platformMessageId
        ]
    );


    await run(
        `
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [conversation.id]
    );


    return conversation;
}


// ========================================
// GET HISTORY
// ========================================

async function getConversation(
    businessId,
    platform,
    platformCustomerId,
    limit = 20
) {

    const {
        conversation
    } =
        await getOrCreateConversation(
            businessId,
            platform,
            platformCustomerId
        );


    const rows =
        await all(
            `
            SELECT role, content
            FROM (
                SELECT
                    id,
                    role,
                    content
                FROM messages
                WHERE conversation_id = ?
                ORDER BY id DESC
                LIMIT ?
            )
            ORDER BY id ASC
            `,
            [
                conversation.id,
                limit
            ]
        );


    return rows.map(
        row => ({
            role: row.role,
            content: row.content
        })
    );
}


module.exports = {
    getOrCreateCustomer,
    getOrCreateConversation,
    getConversation,
    addMessage
};