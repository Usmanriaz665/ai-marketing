const db = require("../database/database");


// ========================================
// PROMISE HELPERS
// ========================================

function run(
    sql,
    params = []
) {

    return new Promise(
        (resolve, reject) => {

            db.run(
                sql,
                params,
                function (error) {

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


function get(
    sql,
    params = []
) {

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


// ========================================
// CREATE HUMAN HANDOFF
// ========================================

async function createHandoff({
    businessId,
    platform,
    platformCustomerId,
    reason = null,
    summary = null,
    priority = "normal"
}) {

    // ========================================
    // FIND CUSTOMER
    // ========================================

    const customer =
        await get(
            `
            SELECT id
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
            reason: "customer_not_found"
        };
    }


    // ========================================
    // FIND ACTIVE CONVERSATION
    // ========================================

    const conversation =
        await get(
            `
            SELECT id
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
            reason: "conversation_not_found"
        };
    }


    // ========================================
    // PREVENT DUPLICATE HANDOFFS
    // ========================================

    const existing =
        await get(
            `
            SELECT id
            FROM handoffs
            WHERE conversation_id = ?
              AND status IN ('pending', 'taken')
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                conversation.id
            ]
        );


    if (existing) {

        return {
            success: true,
            handoffId: existing.id,
            alreadyExists: true
        };
    }


    // ========================================
    // CREATE HANDOFF
    // ========================================

    const result =
        await run(
            `
            INSERT INTO handoffs (
                business_id,
                customer_id,
                conversation_id,
                platform,
                reason,
                summary,
                priority,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `,
            [
                businessId,
                customer.id,
                conversation.id,
                platform,
                reason,
                summary,
                priority
            ]
        );


    // ========================================
    // PUT CONVERSATION INTO HANDOFF MODE
    // ========================================

    await run(
        `
        UPDATE conversations
        SET
            status = 'handoff',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
            conversation.id
        ]
    );


    console.log(
        `🙋 Human handoff created: ${result.id}`
    );


    return {
        success: true,
        handoffId: result.id,
        conversationId: conversation.id
    };
}


// ========================================
// CHECK ACTIVE HANDOFF
// ========================================

async function hasActiveHandoff({
    businessId,
    platform,
    platformCustomerId
}) {

    const row =
        await get(
            `
            SELECT h.id
            FROM handoffs h

            JOIN customers c
                ON c.id = h.customer_id

            WHERE h.business_id = ?
              AND h.platform = ?
              AND c.platform_customer_id = ?
              AND h.status IN ('pending', 'taken')

            ORDER BY h.id DESC
            LIMIT 1
            `,
            [
                businessId,
                platform,
                platformCustomerId
            ]
        );


    return !!row;
}


module.exports = {
    createHandoff,
    hasActiveHandoff
};