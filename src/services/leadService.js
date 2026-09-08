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


// ========================================
// SAVE LEAD
// ========================================

async function saveLead({
    businessId,
    platform,
    platformCustomerId,
    name = null,
    phone = null,
    email = null,
    summary = null,
    metadata = {}
}) {

    // Find customer
    const customer =
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


    if (!customer) {

        return {
            success: false,
            error: "customer_not_found"
        };
    }


    // Find active conversation
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


    const result =
        await run(
            `
            INSERT INTO leads (
                business_id,
                customer_id,
                conversation_id,
                source,
                status,
                name,
                phone,
                email,
                summary,
                metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                businessId,
                customer.id,
                conversation?.id || null,
                platform,
                "new",
                name,
                phone,
                email,
                summary,
                JSON.stringify(metadata || {})
            ]
        );


    console.log(
        "🎯 Lead saved:",
        result.id
    );


    return {
        success: true,
        leadId: result.id
    };
}


module.exports = {
    saveLead
};