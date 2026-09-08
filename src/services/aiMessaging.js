const OpenAI = require("openai");

const {
    saveLeadTool
} = require("../tools/leadTools");

const {
    requestHumanHandoffTool
} = require("../tools/handoffTools");

const {
    getConversation,
    addMessage,
    completeConversation
} = require("./conversationService");

const {
    executeBusinessTool
} = require("./toolService");

const {
    hasActiveHandoff
} = require("./handoffService");


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ========================================
// GENERATE AI REPLY
// ========================================

async function generateAIReply({
    business,
    platform,
    customerId,
    text,
    messageId = null
}) {

    // ========================================
    // BUSINESS AI CONFIGURATION
    // ========================================

    const aiConfig =
        business.ai || {};


    const leadConfig =
        aiConfig.leadCapture || {};


    const handoffConfig =
        aiConfig.humanHandoff || {};


    const leadCaptureEnabled =
        leadConfig.enabled === true;


    const humanHandoffEnabled =
        handoffConfig.enabled === true;


    const requiredLeadFields =
        Array.isArray(
            leadConfig.requiredFields
        )
            ? leadConfig.requiredFields
            : [];


    const metadataFields =
        Array.isArray(
            leadConfig.metadataFields
        )
            ? leadConfig.metadataFields
            : [];


    const askOneAtATime =
        leadConfig.askOneAtATime === true;


    // ========================================
    // SAVE CUSTOMER MESSAGE
    // ========================================

    const messageResult =
        await addMessage(
            business.id,
            platform,
            customerId,
            "user",
            text,
            messageId
        );


    // ========================================
    // DUPLICATE PROTECTION
    // ========================================

    if (
        messageResult?.duplicate
    ) {

        console.log(
            `🔁 Skipping AI reply for duplicate message: ${messageId}`
        );

        return null;
    }


    // ========================================
    // CHECK EXISTING HUMAN HANDOFF
    // ========================================

    if (
        humanHandoffEnabled
    ) {

        const activeHandoff =
            await hasActiveHandoff({
                businessId:
                    business.id,

                platform,

                platformCustomerId:
                    customerId
            });


        if (
            activeHandoff
        ) {

            console.log(
                "🙋 Active human handoff. AI reply skipped."
            );

            return null;
        }
    }


    // ========================================
    // LOAD CONVERSATION HISTORY
    // ========================================

    const history =
        await getConversation(
            business.id,
            platform,
            customerId
        );


    console.log(
        "🧠 Conversation history:",
        JSON.stringify(
            history,
            null,
            2
        )
    );


    // ========================================
    // SYSTEM PROMPT
    // ========================================

    const systemPrompt = `
You are an AI customer service and sales assistant
for ${business.name}.

Business information:
${business.profile?.description || ""}

Industry:
${business.profile?.industry || "general"}

BUSINESS AI STYLE:

Tone:
${aiConfig.tone || "friendly, professional and conversational"}

Preferred reply length:
${aiConfig.replyLength || "short"}


GENERAL RESPONSIBILITIES:

- Respond naturally to customers.
- Understand what the customer wants.
- Ask relevant follow-up questions when information is missing.
- Help convert genuine inquiries into customers.
- Keep replies concise because this is instant messaging.
- Respond in the language used by the customer.
- Never invent prices, services, availability, policies, or business information.
- Do not mention OpenAI.
- Do not mention internal tools, functions, databases, metadata, IDs, or implementation details.


BUSINESS INFORMATION:

When the customer asks about a service, price, repair, product,
or other business-specific information, use the available
business tools when appropriate.

When a business tool returns found=true:

- Use the exact information returned by the tool.
- Never change, estimate, round, or invent a price.
- If duration is provided, tell the customer the duration when relevant.
- If warranty is provided, tell the customer the warranty when relevant.
- If free=true, clearly tell the customer the service is free.

When a business tool returns found=false:

- Never guess the missing information.
- Explain naturally that the information is currently unavailable.
- Offer assistance from a team member when appropriate.


DEVICE AND ITEM MATCHING:

Customers may use abbreviations or incomplete device,
product, or item names.

Use business tools to resolve them when possible.

If a tool returns reason="ambiguous_device":

- Do not choose a device yourself.
- Ask a short follow-up question.
- If candidates are returned, use them to help the customer clarify.

Never invent a device or product match.


CONVERSATION CONTEXT:

Use information the customer already provided in the
current conversation.

Do not repeatedly ask for information that is already known.

Pay particular attention to recent messages when resolving
references such as:

- "it"
- "this"
- "that"
- "yes"
- "do it"
- "come today"
- "I want it"

If recent context clearly identifies what the customer means,
continue using that context.

If the meaning is genuinely ambiguous, ask a short
clarifying question.


LEAD CAPTURE:

Lead capture enabled:
${leadCaptureEnabled}

Required customer fields:
${
    requiredLeadFields.length
        ? requiredLeadFields.join(", ")
        : "None"
}

Ask one field at a time:
${askOneAtATime ? "Yes" : "No"}

Business lead instructions:
${
    leadConfig.instructions ||
    "Follow the business configuration when capturing leads."
}

Useful lead metadata:
${
    metadataFields.length
        ? metadataFields.join(", ")
        : "None"
}

If lead capture is enabled:

- Recognize genuine buying, booking, visiting, or service intent naturally.
- Examples include wanting to proceed, buy, book, visit,
  receive a service, or be contacted.
- Collect only the required customer fields configured above.
- Never invent customer information.
- Do not ask for information already provided in the current conversation.

${
    askOneAtATime
        ? `
IMPORTANT LEAD COLLECTION RULE:

Ask for only ONE missing customer field per message.

Never ask for multiple missing customer fields in the same message.

Collect the required fields naturally in the order listed above.
`
        : `
You may request multiple missing lead fields when appropriate.
`
}

Once all required customer information has been collected,
call save_lead.

When calling save_lead:

- Include a concise factual summary of what the customer wants.
- Preserve useful known information in metadata.
- Prefer the configured metadata fields listed above.
- Never invent metadata values.
- Only include information learned from the conversation
  or returned by business tools.

After save_lead succeeds:

- Confirm naturally that the customer's information was received.
- Do not mention the database, lead ID, function, tool,
  metadata, or internal systems.

If lead capture is disabled:

- Do not attempt to save a lead.
- Continue helping the customer normally.


HUMAN HANDOFF:

Human handoff enabled:
${humanHandoffEnabled}

Business handoff instructions:
${
    handoffConfig.instructions ||
    "Use human handoff when genuine human assistance is required."
}

If human handoff is enabled, request human assistance when:

- The customer explicitly asks to speak with a person,
  employee, representative, manager, or human.

- The customer has a serious complaint requiring staff attention.

- The customer requests information or an action that cannot
  be reliably handled using the available business tools.

- Continuing the conversation would require guessing important
  business information.

Do not request human handoff unnecessarily when you can
confidently help the customer yourself.

When human assistance is genuinely required:

- Call request_human_handoff.
- Give the tool a concise factual reason.
- Give the tool a concise factual summary of the conversation.
- Use high priority only when the situation genuinely requires
  more urgent staff attention.

After request_human_handoff succeeds:

- Tell the customer naturally that a team member will assist them.
- Do not mention queues, handoff IDs, databases, tools,
  functions, or internal systems.


MESSAGING STYLE:

Facebook Messenger does not support Markdown formatting.

Never use:

- Markdown
- asterisks for bold
- headings
- tables
- formatting syntax

Write clean plain-text messages.

Keep replies short, friendly, professional,
natural, and conversational.
`;


    // ========================================
    // AVAILABLE TOOLS
    // ========================================

    const tools = [];


    // ========================================
    // BUSINESS-SPECIFIC SERVICE TOOL
    // ========================================

    if (
        business.capabilities?.includes(
            "lookup_service_info"
        )
    ) {

        tools.push({
            type: "function",

            function: {

                name:
                    "lookup_service_info",

                description:
                    "Look up business-specific service information such as service details, repair information, pricing, duration, or warranty when available.",

                parameters: {

                    type: "object",

                    properties: {

                        service: {
                            type: "string",

                            description:
                                "The service requested by the customer, for example screen repair or battery replacement."
                        },

                        device: {
                            type: "string",

                            description:
                                "The device, product, or item involved, for example iPhone 13."
                        }
                    },

                    required: []
                }
            }
        });
    }


    // ========================================
    // GENERIC LEAD TOOL
    // ========================================

    if (
        leadCaptureEnabled
    ) {

        tools.push({
            type: "function",

            function: {

                name:
                    "save_lead",

                description:
                    `Save a qualified lead after the customer shows clear intent to proceed and the required customer information has been collected. Required fields: ${
                        requiredLeadFields.length
                            ? requiredLeadFields.join(", ")
                            : "none"
                    }.`,

                parameters: {

                    type: "object",

                    properties: {

                        name: {
                            type: "string",

                            description:
                                "Customer name if provided."
                        },

                        phone: {
                            type: "string",

                            description:
                                "Customer phone number if provided."
                        },

                        email: {
                            type: "string",

                            description:
                                "Customer email address if provided."
                        },

                        summary: {
                            type: "string",

                            description:
                                "Short factual summary of what the customer wants."
                        },

                        metadata: {
                            type: "object",

                            description:
                                `Relevant business-specific information about the lead. Preferred fields: ${
                                    metadataFields.length
                                        ? metadataFields.join(", ")
                                        : "none"
                                }.`,

                            additionalProperties:
                                true
                        }
                    },

                    required: [
                        "summary"
                    ]
                }
            }
        });
    }


    // ========================================
    // GENERIC HUMAN HANDOFF TOOL
    // ========================================

    if (
        humanHandoffEnabled
    ) {

        tools.push({
            type: "function",

            function: {

                name:
                    "request_human_handoff",

                description:
                    "Request assistance from a human team member when the customer explicitly requests a person or when the conversation genuinely requires human attention.",

                parameters: {

                    type: "object",

                    properties: {

                        reason: {
                            type: "string",

                            description:
                                "Short factual reason why human assistance is required."
                        },

                        summary: {
                            type: "string",

                            description:
                                "Concise factual summary of the customer's request and relevant conversation context."
                        },

                        priority: {
                            type: "string",

                            enum: [
                                "normal",
                                "high"
                            ],

                            description:
                                "Priority of the human assistance request."
                        }
                    },

                    required: [
                        "reason",
                        "summary"
                    ]
                }
            }
        });
    }


    // ========================================
    // BUILD AI MESSAGE HISTORY
    // ========================================

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },

        ...history
    ];


    // ========================================
    // MULTI-ROUND AI TOOL LOOP
    // ========================================

    const MAX_TOOL_ROUNDS = 5;


    let assistantMessage =
        null;


    let shouldCompleteConversation =
        false;


    for (
        let round = 1;
        round <= MAX_TOOL_ROUNDS;
        round++
    ) {

        console.log(
            `🤖 AI round ${round}`
        );


        // ========================================
        // CALL OPENAI
        // ========================================

        const response =
            await openai.chat.completions.create({

                model:
                    process.env.OPENAI_MESSAGING_MODEL ||
                    "gpt-5.6-terra",

                reasoning_effort:
                    "none",

                messages,

                tools,

                tool_choice:
                    "auto"
            });


        assistantMessage =
            response.choices[0].message;


        // ========================================
        // CHECK FOR TOOL CALLS
        // ========================================

        const hasToolCalls =
            Array.isArray(
                assistantMessage.tool_calls
            ) &&
            assistantMessage.tool_calls.length > 0;


        // ========================================
        // NO TOOL CALLS = FINAL RESPONSE
        // ========================================

        if (
            !hasToolCalls
        ) {

            console.log(
                "✅ AI returned final response"
            );

            break;
        }


        console.log(
            `🔧 AI requested ${assistantMessage.tool_calls.length} tool call(s)`
        );


        // Assistant tool-call message must be
        // added before the tool results.
        messages.push(
            assistantMessage
        );


        // ========================================
        // EXECUTE TOOL CALLS
        // ========================================

        for (
            const toolCall
            of assistantMessage.tool_calls
        ) {

            if (
                toolCall.type !==
                "function"
            ) {

                continue;
            }


            const toolName =
                toolCall.function.name;


            // ========================================
            // PARSE ARGUMENTS
            // ========================================

            let args = {};


            try {

                args =
                    JSON.parse(
                        toolCall.function.arguments ||
                        "{}"
                    );

            }
            catch (error) {

                console.error(
                    "❌ Invalid tool arguments:",
                    toolCall.function.arguments
                );

                args = {};
            }


            console.log(
                "🔧 Executing tool:",
                toolName,
                args
            );


            let result;


            // ========================================
            // SAVE LEAD
            // ========================================

            if (
                toolName ===
                "save_lead"
            ) {

                console.log(
                    "🎯 Executing lead capture:",
                    args
                );


                // ========================================
                // VALIDATE REQUIRED LEAD FIELDS
                // ========================================

                const missingFields =
                    requiredLeadFields.filter(
                        field => {

                            const value =
                                args[field];


                            return (
                                value === undefined ||
                                value === null ||
                                String(value).trim() === ""
                            );
                        }
                    );


                if (
                    missingFields.length > 0
                ) {

                    console.warn(
                        "⚠️ Lead missing required fields:",
                        missingFields
                    );


                    result = {
                        success: false,

                        reason:
                            "missing_required_fields",

                        missingFields
                    };

                }
                else {

                    result =
                        await saveLeadTool({
                            business,
                            platform,
                            customerId,
                            args
                        });


                    if (
                        result?.success ===
                        true
                    ) {

                        shouldCompleteConversation =
                            true;


                        console.log(
                            "🎯 Lead saved successfully. Conversation will be completed after the final AI reply."
                        );
                    }
                }

            }


            // ========================================
            // HUMAN HANDOFF
            // ========================================

            else if (
                toolName ===
                "request_human_handoff"
            ) {

                console.log(
                    "🙋 Executing human handoff:",
                    args
                );


                result =
                    await requestHumanHandoffTool({
                        business,
                        platform,
                        customerId,
                        args
                    });

            }


            // ========================================
            // BUSINESS-SPECIFIC TOOL
            // ========================================

            else {

                result =
                    await executeBusinessTool({
                        businessId:
                            business.id,

                        toolName,

                        arguments:
                            args
                    });

            }


            console.log(
                "🔧 Tool result:",
                result
            );


            // ========================================
            // RETURN TOOL RESULT TO AI
            // ========================================

            messages.push({
                role: "tool",

                tool_call_id:
                    toolCall.id,

                content:
                    JSON.stringify(
                        result
                    )
            });
        }


        // ========================================
        // MAX TOOL ROUND PROTECTION
        // ========================================

        if (
            round ===
            MAX_TOOL_ROUNDS
        ) {

            console.error(
                "❌ Maximum AI tool rounds reached"
            );


            assistantMessage = {
                role: "assistant",

                content:
                    "A team member can assist you with that request."
            };
        }
    }


    // ========================================
    // FINAL TEXT RESPONSE
    // ========================================

    const reply =
        assistantMessage
            ?.content
            ?.trim();


    if (
        !reply
    ) {

        console.error(
            "❌ AI returned no final text response"
        );


        return (
            "A team member can assist you with that request."
        );
    }


    // ========================================
    // SAVE FINAL AI MESSAGE
    // ========================================

    await addMessage(
        business.id,
        platform,
        customerId,
        "assistant",
        reply
    );


    // ========================================
    // COMPLETE CONVERSATION AFTER LEAD
    // ========================================

    if (
        shouldCompleteConversation
    ) {

        const completionResult =
            await completeConversation(
                business.id,
                platform,
                customerId
            );


        if (
            completionResult?.success
        ) {

            console.log(
                `🏁 Conversation ${completionResult.conversationId} completed after lead capture`
            );

        }
        else {

            console.warn(
                "⚠️ Conversation could not be completed:",
                completionResult
            );
        }
    }


    return reply;
}


// ========================================
// EXPORT
// ========================================

module.exports = {
    generateAIReply
};