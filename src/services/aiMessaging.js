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
    text
}) {

    addMessage(
        business.id,
        platform,
        customerId,
        "user",
        text
    );


    const history =
        getConversation(
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
- Be concise because this is instant messaging.
- Never invent prices, products, services, availability, policies, or business information.
- If information is unavailable, say that you need more information or that a team member can assist.
- Respond in the language used by the customer.
- Do not mention that you are using OpenAI.
`;


    const response =
        await openai.chat.completions.create({
            model: "gpt-5.6-mini",
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


    addMessage(
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