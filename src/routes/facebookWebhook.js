const {
    resolveFacebookBusiness
} = require("../services/businessService");

const {
    sendFacebookMessage
} = require("../services/facebookMessenger");
const {
    sendFacebookMessage
} = require(
    "../services/facebookMessenger"
);
const express = require("express");

const router = express.Router();


// ========================================
// META WEBHOOK VERIFICATION
// ========================================

router.get("/", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
        mode === "subscribe" &&
        token === process.env.META_VERIFY_TOKEN
    ) {

        console.log("✅ Facebook webhook verified");

        return res
            .status(200)
            .send(challenge);
    }

    console.warn("❌ Facebook webhook verification failed");

    return res.sendStatus(403);
});


// ========================================
// FACEBOOK EVENTS
// ========================================

router.post("/", (req, res) => {

    const body = req.body;

    // Meta expects a fast acknowledgment.
    res.sendStatus(200);

    if (body.object !== "page") {
        return;
    }

    for (const entry of body.entry || []) {

        const pageId = entry.id;

        for (const event of entry.messaging || []) {

            // ----------------------------------------
            // Ignore messages sent BY the Page itself.
            // Prevents reply loops.
            // ----------------------------------------

            if (event.message?.is_echo) {

                console.log("🔁 Facebook message echo ignored");

                continue;
            }


            // ----------------------------------------
            // Incoming customer text message
            // ----------------------------------------

            if (event.message?.text) {

                const senderId =
                    event.sender?.id;

                const messageId =
                    event.message?.mid;

                const text =
                    event.message.text;


                console.log("\n=================================");
                console.log("📩 FACEBOOK CUSTOMER MESSAGE");
                console.log("=================================");

                console.log("Page ID:", pageId);
                console.log("Sender ID:", senderId);
                console.log("Message ID:", messageId);
                console.log("Text:", text);
                const business =
                    resolveFacebookBusiness(pageId);

                if (!business) {

                    console.error(
                        `❌ Cannot process message — unknown Page: ${pageId}`
                    );

                    continue;
                }


                const reply =
                    `Thanks for contacting ${business.name}! We received your message.`;


                sendFacebookMessage(
                    senderId,
                    reply
                ).catch(error => {

                    console.error(
                        "❌ Facebook reply failed:",
                        error.response?.data ||
                        error.message
                    );

                });
                console.log("=================================\n");


                // Next:
                //
                // processFacebookMessage({
                //     pageId,
                //     senderId,
                //     messageId,
                //     text
                // });

            }

        }

    }

});


module.exports = router;