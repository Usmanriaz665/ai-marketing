const axios = require("axios");

async function sendFacebookMessage(senderId, text) {

    const pageAccessToken =
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
        throw new Error(
            "FACEBOOK_PAGE_ACCESS_TOKEN is missing"
        );
    }

    const url =
        "https://graph.facebook.com/v23.0/me/messages";

    const response =
        await axios.post(
            url,
            {
                recipient: {
                    id: senderId
                },
                message: {
                    text
                }
            },
            {
                params: {
                    access_token:
                        pageAccessToken
                }
            }
        );

    console.log(
        "✅ Facebook reply sent:",
        response.data
    );

    return response.data;
}

module.exports = {
    sendFacebookMessage
};