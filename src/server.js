require("dotenv").config();
console.log(
    "OPENAI_API_KEY:",
    process.env.OPENAI_API_KEY ? "LOADED" : "MISSING"
);

const express = require("express");

const facebookWebhook =
    require("./routes/facebookWebhook");

const app = express();
const handoffRoutes =
    require("./routes/handoffRoutes");

const PORT =
    process.env.PORT || 3000;

app.use(express.json());

app.use(
    "/api/handoffs",
    handoffRoutes
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