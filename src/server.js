require("dotenv").config();

const express = require("express");

const facebookWebhook =
    require("./routes/facebookWebhook");

const app = express();

const PORT =
    process.env.PORT || 3000;

app.use(express.json());


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