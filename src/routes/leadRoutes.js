const express = require("express");

const db = require("../database/database");

const router = express.Router();


// ========================================
// DATABASE HELPERS
// ========================================

function all(
    sql,
    params = []
) {

    return new Promise(
        (resolve, reject) => {

            db.all(
                sql,
                params,
                (error, rows) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(rows || []);
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
                        reject(error);
                        return;
                    }

                    resolve(row || null);
                }
            );
        }
    );
}


function run(
    sql,
    params = []
) {

    return new Promise(
        (resolve, reject) => {

            db.run(
                sql,
                params,
                function(error) {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        changes: this.changes
                    });
                }
            );
        }
    );
}


// ========================================
// PARSE LEAD
// ========================================

function parseLead(
    lead
) {

    if (!lead) {
        return null;
    }

    let metadata = {};

    if (lead.metadata) {

        try {

            metadata =
                JSON.parse(
                    lead.metadata
                );

        }
        catch (error) {

            console.warn(
                `⚠️ Invalid metadata for lead ${lead.id}`
            );
        }
    }

    return {
        ...lead,
        metadata
    };
}


// ========================================
// GET ALL LEADS
// ========================================

router.get(
    "/",
    async (req, res) => {

        try {

            const leads =
                await all(
                    `
                    SELECT
                        id,
                        business_id,
                        customer_id,
                        conversation_id,
                        source,
                        status,
                        name,
                        phone,
                        email,
                        summary,
                        metadata,
                        created_at,
                        updated_at

                    FROM leads

                    ORDER BY
                        created_at DESC,
                        id DESC
                    `
                );

            res.json({
                success: true,
                leads:
                    leads.map(
                        parseLead
                    )
            });

        }
        catch (error) {

            console.error(
                "❌ Failed loading leads:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Failed to load leads"
            });
        }
    }
);


// ========================================
// GET ONE LEAD
// ========================================

router.get(
    "/:id",
    async (req, res) => {

        try {

            const lead =
                await get(
                    `
                    SELECT *
                    FROM leads
                    WHERE id = ?
                    `,
                    [
                        req.params.id
                    ]
                );

            if (!lead) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            "Lead not found"
                    });
            }

            res.json({
                success: true,
                lead:
                    parseLead(
                        lead
                    )
            });

        }
        catch (error) {

            console.error(
                "❌ Failed loading lead:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Failed to load lead"
            });
        }
    }
);


// ========================================
// UPDATE LEAD STATUS
// ========================================

router.patch(
    "/:id/status",
    async (req, res) => {

        try {

            const {
                status
            } = req.body;


            const allowedStatuses = [
                "new",
                "contacted",
                "converted",
                "lost"
            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            "Invalid lead status"
                    });
            }


            const result =
                await run(
                    `
                    UPDATE leads

                    SET
                        status = ?,
                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = ?
                    `,
                    [
                        status,
                        req.params.id
                    ]
                );


            if (
                result.changes === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            "Lead not found"
                    });
            }


            res.json({
                success: true,
                leadId:
                    Number(
                        req.params.id
                    ),
                status
            });

        }
        catch (error) {

            console.error(
                "❌ Failed updating lead:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Failed to update lead"
            });
        }
    }
);


module.exports = router;