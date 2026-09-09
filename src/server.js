require("dotenv").config();
console.log(
    "OPENAI_API_KEY:",
    process.env.OPENAI_API_KEY ? "LOADED" : "MISSING"
);
const path =
    require("path");
const express = require("express");

const facebookWebhook =
    require("./routes/facebookWebhook");

const app = express();
const handoffRoutes =
    require("./routes/handoffRoutes");
const leadRoutes =
    require("./routes/leadRoutes");

const PORT =
    process.env.PORT || 3000;

app.use(express.json());
app.use(
    "/dashboard",
    express.static(
        path.join(
            __dirname,
            "../public/dashboard"
        )
    )
);
app.use(
    "/api/handoffs",
    handoffRoutes
);
app.use(
    "/api/leads",
    leadRoutes
);
// Health check
app.get("/", (req, res) => {

    res.json({
        service: "AI Marketing",
        status: "running"
    });

});


// Facebook Messenger webhook
app.use(
    "/webhook/facebook",
    facebookWebhook
);


app.listen(PORT, () => {

    console.log(
        `🚀 AI Marketing server running on port ${PORT}`
    );

});