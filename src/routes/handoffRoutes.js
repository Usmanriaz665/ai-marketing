const express = require("express");

const router = express.Router();

const db = require("../database/database");

const {
    sendFacebookMessage
} = require("../services/facebookMessenger");


// ========================================
// SQLITE HELPERS
// ========================================

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(
            sql,
            params,
            (error, rows) => {

                if (error) {
                    reject(error);
                    return;
                }

                resolve(rows);
            }
        );
    });
}


function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(
            sql,
            params,
            (error, row) => {

                if (error) {
                    reject(error);
                    return;
                }

                resolve(row);
            }
        );
    });
}


function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(
            sql,
            params,
            function (error) {

                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        );
    });
}


// ========================================
// GET ALL ACTIVE HANDOFFS
// ========================================

router.get(
    "/",
    async (req, res) => {

        try {

            const handoffs =
                await all(
                    `
                    SELECT
                        h.id,
                        h.business_id,
                        h.customer_id,
                        h.conversation_id,
                        h.platform,
                        h.reason,
                        h.summary,
                        h.priority,
                        h.status,
                        h.created_at,
                        h.updated_at,

                        c.platform_customer_id,
                        c.name,
                        c.phone,
                        c.email

                    FROM handoffs h

                    JOIN customers c
                        ON c.id = h.customer_id

                    WHERE h.status IN (
                        'pending',
                        'taken'
                    )

                    ORDER BY
                        CASE
                            WHEN h.priority = 'high'
                            THEN 0
                            ELSE 1
                        END,
                        h.created_at ASC
                    `
                );


            return res.json({
                success: true,
                handoffs
            });

        }
        catch (error) {

            console.error(
                "❌ Failed loading handoffs:",
                error
            );


            return res.status(500).json({
                success: false,
                error:
                    "Failed to load handoffs"
            });
        }
    }
);


// ========================================
// GET SINGLE HANDOFF
// ========================================

router.get(
    "/:id",
    async (req, res) => {

        try {

            const handoff =
                await get(
                    `
                    SELECT
                        h.*,

                        c.platform_customer_id,
                        c.name,
                        c.phone,
                        c.email

                    FROM handoffs h

                    JOIN customers c
                        ON c.id = h.customer_id

                    WHERE h.id = ?
                    `,
                    [
                        req.params.id
                    ]
                );


            if (!handoff) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Handoff not found"
                });
            }


            const messages =
                await all(
                    `
                    SELECT
                        id,
                        role,
                        content,
                        platform_message_id,
                        created_at

                    FROM messages

                    WHERE conversation_id = ?

                    ORDER BY id ASC
                    `,
                    [
                        handoff.conversation_id
                    ]
                );


            return res.json({
                success: true,
                handoff,
                messages
            });

        }
        catch (error) {

            console.error(
                "❌ Failed loading handoff:",
                error
            );


            return res.status(500).json({
                success: false,
                error:
                    "Failed to load handoff"
            });
        }
    }
);


// ========================================
// TAKE HANDOFF
// ========================================

router.post(
    "/:id/take",
    async (req, res) => {

        try {

            const handoff =
                await get(
                    `
                    SELECT *
                    FROM handoffs
                    WHERE id = ?
                    `,
                    [
                        req.params.id
                    ]
                );


            if (!handoff) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Handoff not found"
                });
            }


            if (
                handoff.status ===
                "resolved"
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Handoff is already resolved"
                });
            }


            await run(
                `
                UPDATE handoffs

                SET
                    status = 'taken',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    req.params.id
                ]
            );


            console.log(
                `🙋 Handoff ${req.params.id} taken`
            );


            return res.json({
                success: true,
                handoffId:
                    Number(req.params.id),
                status:
                    "taken"
            });

        }
        catch (error) {

            console.error(
                "❌ Failed taking handoff:",
                error
            );


            return res.status(500).json({
                success: false,
                error:
                    "Failed to take handoff"
            });
        }
    }
);


// ========================================
// HUMAN REPLY
// ========================================

router.post(
    "/:id/reply",
    async (req, res) => {

        try {

            const text =
                String(
                    req.body?.text || ""
                ).trim();


            if (!text) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Reply text is required"
                });
            }


            const handoff =
                await get(
                    `
                    SELECT
                        h.*,
                        c.platform_customer_id

                    FROM handoffs h

                    JOIN customers c
                        ON c.id = h.customer_id

                    WHERE h.id = ?
                    `,
                    [
                        req.params.id
                    ]
                );


            if (!handoff) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Handoff not found"
                });
            }


            if (
                handoff.status ===
                "resolved"
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Handoff is already resolved"
                });
            }


            // ========================================
            // SEND PLATFORM MESSAGE
            // ========================================

            if (
                handoff.platform ===
                "facebook"
            ) {

                await sendFacebookMessage(
                    handoff.platform_customer_id,
                    text
                );

            }
            else {

                return res.status(400).json({
                    success: false,
                    error:
                        `Unsupported platform: ${handoff.platform}`
                });
            }


            // ========================================
            // SAVE HUMAN MESSAGE
            // ========================================

            await run(
                `
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content
                )

                VALUES (?, ?, ?)
                `,
                [
                    handoff.conversation_id,
                    "human",
                    text
                ]
            );


            // ========================================
            // AUTO-MARK AS TAKEN
            // ========================================

            await run(
                `
                UPDATE handoffs

                SET
                    status = 'taken',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    req.params.id
                ]
            );


            console.log(
                `💬 Human replied on handoff ${req.params.id}`
            );


            return res.json({
                success: true,
                handoffId:
                    Number(req.params.id),
                message:
                    text
            });

        }
        catch (error) {

            console.error(
                "❌ Failed sending human reply:",
                error
            );


            return res.status(500).json({
                success: false,
                error:
                    "Failed to send human reply"
            });
        }
    }
);


// ========================================
// RESOLVE HANDOFF
// ========================================

router.post(
    "/:id/resolve",
    async (req, res) => {

        try {

            const handoff =
                await get(
                    `
                    SELECT *
                    FROM handoffs
                    WHERE id = ?
                    `,
                    [
                        req.params.id
                    ]
                );


            if (!handoff) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Handoff not found"
                });
            }


            await run(
                `
                UPDATE handoffs

                SET
                    status = 'resolved',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    req.params.id
                ]
            );


            await run(
                `
                UPDATE conversations

                SET
                    status = 'completed',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    handoff.conversation_id
                ]
            );


            console.log(
                `✅ Handoff ${req.params.id} resolved`
            );


            return res.json({
                success: true,
                handoffId:
                    Number(req.params.id),
                status:
                    "resolved"
            });

        }
        catch (error) {

            console.error(
                "❌ Failed resolving handoff:",
                error
            );


            return res.status(500).json({
                success: false,
                error:
                    "Failed to resolve handoff"
            });
        }
    }
);


module.exports = router;