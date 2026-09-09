const db =
    require("../database/database");


// ========================================
// SQLITE HELPERS
// ========================================

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
            [
                result.id
            ]
        );


    console.log(
        "👤 Marketing customer created:",
        customer.id
    );


    return customer;
}


// ========================================
// GET EXISTING OPEN CONVERSATION
// ========================================

async function getOpenConversation(
    businessId,
    customerId,
    platform
) {

    return await get(
        `
        SELECT *
        FROM conversations

        WHERE business_id = ?
          AND customer_id = ?
          AND platform = ?
          AND status IN (
              'active',
              'handoff'
          )

        ORDER BY
            CASE
                WHEN status = 'handoff'
                THEN 0
                ELSE 1
            END,

            id DESC

        LIMIT 1
        `,
        [
            businessId,
            customerId,
            platform
        ]
    );
}


// ========================================
// GET OR CREATE CONVERSATION
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
        await getOpenConversation(
            businessId,
            customer.id,
            platform
        );


    // ========================================
    // EXISTING ACTIVE/HANDOFF CONVERSATION
    // ========================================

    if (conversation) {

        return {
            customer,
            conversation
        };
    }


    // ========================================
    // CREATE NEW ACTIVE CONVERSATION
    // ========================================

    const result =
        await run(
            `
            INSERT INTO conversations (
                business_id,
                customer_id,
                platform,
                status
            )

            VALUES (?, ?, ?, 'active')
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
            [
                result.id
            ]
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
// MESSAGE EXISTS
// ========================================

async function messageExists(
    platformMessageId
) {

    if (!platformMessageId) {
        return false;
    }


    const row =
        await get(
            `
            SELECT id
            FROM messages

            WHERE platform_message_id = ?

            LIMIT 1
            `,
            [
                platformMessageId
            ]
        );


    return !!row;
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

    // ========================================
    // DUPLICATE PLATFORM MESSAGE PROTECTION
    // ========================================

    if (
        platformMessageId &&
        await messageExists(
            platformMessageId
        )
    ) {

        console.log(
            `🔁 Duplicate platform message ignored: ${platformMessageId}`
        );


        return {
            duplicate: true
        };
    }


    // ========================================
    // GET OPEN CONVERSATION
    //
    // IMPORTANT:
    // This may return either:
    //
    // active
    // OR
    // handoff
    //
    // This prevents handoff conversations
    // from being split into new conversations.
    // ========================================

    const {
        customer,
        conversation
    } =
        await getOrCreateConversation(
            businessId,
            platform,
            platformCustomerId
        );

    // ========================================
    // INSERT MESSAGE
    // ========================================

    const result =
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


    // ========================================
    // UPDATE CONVERSATION TIMESTAMP
    // ========================================

    await run(
        `
        UPDATE conversations

        SET updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            conversation.id
        ]
    );


    return {
        success: true,

        duplicate: false,

        messageId:
            result.id,

        customerId:
            customer.id,

        conversationId:
            conversation.id,

        conversationStatus:
            conversation.status
    };
}


// ========================================
// GET AI CONVERSATION HISTORY
// ========================================

async function getConversation(
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


    // ========================================
    // AI SHOULD ONLY USE ACTIVE CONVERSATION
    //
    // Handoff conversations belong to the
    // human agent and should not be processed
    // by the AI.
    // ========================================

    const conversation =
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


    if (!conversation) {
        return [];
    }


    const messages =
        await all(
            `
            SELECT
                role,
                content

            FROM messages

            WHERE conversation_id = ?

            ORDER BY id ASC
            `,
            [
                conversation.id
            ]
        );


    // ========================================
    // CONVERT INTERNAL ROLES FOR OPENAI
    // ========================================

    return messages
        .filter(
            message =>
                message.role === "user" ||
                message.role === "assistant"
        )
        .map(
            message => ({
                role:
                    message.role,

                content:
                    message.content
            })
        );
}


// ========================================
// COMPLETE ACTIVE CONVERSATION
// ========================================

async function completeConversation(
    businessId,
    platform,
    platformCustomerId
) {

    const customer =
        await get(
            `
            SELECT *
            FROM customers

            WHERE business_id = ?
              AND platform = ?
              AND platform_customer_id = ?

            LIMIT 1
            `,
            [
                businessId,
                platform,
                platformCustomerId
            ]
        );


    if (!customer) {

        return {
            success: false,
            reason:
                "customer_not_found"
        };
    }


    const conversation =
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


    if (!conversation) {

        return {
            success: false,
            reason:
                "active_conversation_not_found"
        };
    }


    await run(
        `
        UPDATE conversations

        SET
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            conversation.id
        ]
    );


    return {
        success: true,
        conversationId:
            conversation.id
    };
}


// ========================================
// EXPORTS
// ========================================

module.exports = {
    getOrCreateCustomer,
    getOrCreateConversation,
    getConversation,
    addMessage,
    messageExists,
    completeConversation
};