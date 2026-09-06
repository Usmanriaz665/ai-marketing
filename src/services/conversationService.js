const conversations = new Map();

const MAX_MESSAGES = 20;


function conversationKey(businessId, platform, customerId) {

    return `${businessId}:${platform}:${customerId}`;
}


function getConversation(
    businessId,
    platform,
    customerId
) {

    const key =
        conversationKey(
            businessId,
            platform,
            customerId
        );

    return conversations.get(key) || [];
}


function addMessage(
    businessId,
    platform,
    customerId,
    role,
    content
) {

    const key =
        conversationKey(
            businessId,
            platform,
            customerId
        );

    const history =
        conversations.get(key) || [];

    history.push({
        role,
        content
    });

    // Prevent unlimited memory growth
    if (history.length > MAX_MESSAGES) {
        history.splice(
            0,
            history.length - MAX_MESSAGES
        );
    }

    conversations.set(
        key,
        history
    );
}


module.exports = {
    getConversation,
    addMessage
};