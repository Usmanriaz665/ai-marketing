const OpenAI = require("openai");

const {
    getConversation,
    addMessage
} = require("./conversationService");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateAIReply({
    business,
    platform,
    customerId,
    text,
    messageId = null
}) {

    await addMessage(
        business.id,
        platform,
        customerId,
        "user",
        text,
        messageId
    );


    const history =
        await getConversation(
            business.id,
            platform,
            customerId
        );


    const systemPrompt = `
You are an AI customer service and sales assistant
for ${business.name}.

Business information:
${business.profile.description}

Industry:
${business.profile.industry}

Your responsibilities:

- Respond naturally to customers.
- Understand what the customer wants.
- Ask relevant follow-up questions when information is missing.
- Help convert genuine inquiries into customers.
- Keep responses concise and appropriate for instant messaging.
- Never invent prices, services, availability, policies or other business information.
- If required information is unavailable, explain that a team member can assist.
- Respond in the language used by the customer.
- Do not mention OpenAI.
`;


    const response =
        await openai.chat.completions.create({

            model:
                process.env.OPENAI_MESSAGING_MODEL ||
                "gpt-5.6-terra",

            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...history
            ]
        });


    const reply =
        response.choices[0]
            .message
            .content
            .trim();


    await addMessage(
        business.id,
        platform,
        customerId,
        "assistant",
        reply
    );


    return reply;
}
module.exports = {
    generateAIReply
};