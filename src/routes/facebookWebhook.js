const express = require("express");

const router = express.Router();


// ========================================
// META WEBHOOK VERIFICATION
// ========================================

router.get("/", (req, res) => {

    const mode =
        req.query["hub.mode"];

    const token =
        req.query["hub.verify_token"];

    const challenge =
        req.query["hub.challenge"];


    if (
        mode === "subscribe" &&
        token === process.env.META_VERIFY_TOKEN
    ) {

        console.log(
            "✅ Facebook webhook verified"
        );

        return res
            .status(200)
            .send(challenge);
    }


    console.warn(
        "❌ Facebook webhook verification failed"
    );

    return res.sendStatus(403);

});


// ========================================
// FACEBOOK EVENTS
// ========================================

router.post("/", (req, res) => {

    const body = req.body;


    console.log(
        "📩 Facebook webhook received"
    );

    console.dir(
        body,
        {
            depth: null
        }
    );


    // Acknowledge Meta immediately.
    res.sendStatus(200);

});


module.exports = router;