let selectedHandoffId = null;

let currentHandoff = null;


// ========================================
// ELEMENTS
// ========================================

const handoffList =
    document.getElementById(
        "handoffList"
    );

const refreshButton =
    document.getElementById(
        "refreshButton"
    );

const emptyConversation =
    document.getElementById(
        "emptyConversation"
    );

const conversationPanel =
    document.getElementById(
        "conversationPanel"
    );

const customerName =
    document.getElementById(
        "customerName"
    );

const conversationMeta =
    document.getElementById(
        "conversationMeta"
    );

const statusBadge =
    document.getElementById(
        "statusBadge"
    );

const handoffSummary =
    document.getElementById(
        "handoffSummary"
    );

const messagesContainer =
    document.getElementById(
        "messages"
    );

const takeButton =
    document.getElementById(
        "takeButton"
    );

const resolveButton =
    document.getElementById(
        "resolveButton"
    );

const replyInput =
    document.getElementById(
        "replyInput"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );


// ========================================
// API
// ========================================

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                headers: {
                    "Content-Type":
                        "application/json",

                    ...options.headers
                },

                ...options
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Request failed"
        );
    }


    return data;
}


// ========================================
// LOAD HANDOFFS
// ========================================

async function loadHandoffs() {

    try {

        const data =
            await api(
                "/api/handoffs"
            );


        cachedHandoffs =
            data.handoffs || [];


        renderFilteredHandoffs();

    }
    catch (error) {

        console.error(error);

        handoffList.innerHTML =
            `
            <div class="empty-state">
                Failed to load conversations.
            </div>
            `;
    }
}


// ========================================
// RENDER HANDOFF LIST
// ========================================

function renderHandoffs(
    handoffs
) {

    handoffList.innerHTML = "";

    const inboxCount =
        document.getElementById(
            "inboxCount"
        );


    if (inboxCount) {

        inboxCount.textContent =
            handoffs.length;


        inboxCount.classList.toggle(
            "hidden",
            handoffs.length === 0
        );
    }
    if (
        handoffs.length === 0
    ) {

        handoffList.innerHTML =
            `
            <div class="empty-state">
                No conversations waiting.
            </div>
            `;

        return;
    }


    for (
        const handoff
        of handoffs
    ) {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "handoff-item";


        if (
            handoff.id ===
            selectedHandoffId
        ) {

            item.classList.add(
                "active"
            );
        }


        const priority =
            handoff.priority ===
                "high"
                ? "priority-high"
                : "";


        item.innerHTML =
            `
            <div class="handoff-top">

                <span class="business-name">
                    ${escapeHtml(
                handoff.business_id
            )}
                </span>

                <span class="${priority}">
                    ${escapeHtml(
                handoff.status
            )}
                </span>

            </div>

            <div class="handoff-summary-text">
                ${escapeHtml(
                handoff.summary ||
                handoff.reason ||
                "Human assistance requested"
            )}
            </div>
            `;


        item.addEventListener(
            "click",
            () => {

                selectHandoff(
                    handoff.id
                );
            }
        );


        handoffList.appendChild(
            item
        );
    }
}


// ========================================
// SELECT HANDOFF
// ========================================

async function selectHandoff(
    handoffId
) {

    try {

        selectedHandoffId =
            handoffId;


        const data =
            await api(
                `/api/handoffs/${handoffId}`
            );


        currentHandoff =
            data.handoff;


        renderConversation(
            data.handoff,
            data.messages || []
        );


        await loadHandoffs();

    }
    catch (error) {

        console.error(error);

        alert(
            error.message
        );
    }
}


// ========================================
// RENDER CONVERSATION
// ========================================

function renderConversation(
    handoff,
    messages
) {

    emptyConversation
        .classList
        .add("hidden");


    conversationPanel
        .classList
        .remove("hidden");


    customerName.textContent =
        handoff.name ||
        "Facebook Customer";


    conversationMeta.textContent =
        `${handoff.platform} • ${handoff.business_id}`;


    statusBadge.textContent =
        handoff.status;


    handoffSummary.textContent =
        handoff.summary ||
        handoff.reason ||
        "Human assistance requested.";


    takeButton.disabled =
        handoff.status ===
        "taken";


    replyInput.disabled =
        handoff.status ===
        "pending";


    sendButton.disabled =
        handoff.status ===
        "pending";


    messagesContainer.innerHTML =
        "";


    for (
        const message
        of messages
    ) {

        const element =
            document.createElement(
                "div"
            );


        let cssRole =
            "user";


        if (
            message.role ===
            "assistant"
        ) {

            cssRole =
                "assistant";
        }


        if (
            message.role ===
            "human"
        ) {

            cssRole =
                "human";
        }


        element.className =
            `message message-${cssRole}`;


        const roleLabel =
            message.role === "user"
                ? "Customer"
                : message.role === "human"
                    ? "Team"
                    : "AI";


        element.innerHTML =
            `
            <div class="message-role">
                ${roleLabel}
            </div>

            <div>
                ${escapeHtml(
                message.content
            )}
            </div>

            <div class="message-time">
                ${formatDate(
                message.created_at
            )}
            </div>
            `;


        messagesContainer
            .appendChild(
                element
            );
    }


    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


// ========================================
// TAKE HANDOFF
// ========================================

async function takeHandoff() {

    if (!selectedHandoffId) {
        return;
    }


    try {

        takeButton.disabled =
            true;


        await api(
            `/api/handoffs/${selectedHandoffId}/take`,
            {
                method: "POST"
            }
        );


        await selectHandoff(
            selectedHandoffId
        );

    }
    catch (error) {

        alert(
            error.message
        );

        takeButton.disabled =
            false;
    }
}


// ========================================
// SEND HUMAN REPLY
// ========================================

async function sendReply() {

    if (!selectedHandoffId) {
        return;
    }


    const text =
        replyInput
            .value
            .trim();


    if (!text) {
        return;
    }


    try {

        sendButton.disabled =
            true;


        await api(
            `/api/handoffs/${selectedHandoffId}/reply`,
            {
                method: "POST",

                body:
                    JSON.stringify({
                        text
                    })
            }
        );


        replyInput.value =
            "";


        await selectHandoff(
            selectedHandoffId
        );

    }
    catch (error) {

        alert(
            error.message
        );

    }
    finally {

        sendButton.disabled =
            false;
    }
}


// ========================================
// RESOLVE
// ========================================

async function resolveHandoff() {

    if (!selectedHandoffId) {
        return;
    }


    const confirmed =
        window.confirm(
            "Resolve this conversation and return future messages to AI?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await api(
            `/api/handoffs/${selectedHandoffId}/resolve`,
            {
                method: "POST"
            }
        );


        selectedHandoffId =
            null;

        currentHandoff =
            null;


        conversationPanel
            .classList
            .add("hidden");


        emptyConversation
            .classList
            .remove("hidden");


        await loadHandoffs();

    }
    catch (error) {

        alert(
            error.message
        );
    }
}


// ========================================
// HELPERS
// ========================================

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value || "";


    return div.innerHTML;
}


function formatDate(value) {

    if (!value) {
        return "";
    }


    const normalized =
        value.includes("T")
            ? value
            : value.replace(
                " ",
                "T"
            ) + "Z";


    const date =
        new Date(
            normalized
        );


    return date.toLocaleString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ========================================
// EVENTS
// ========================================

refreshButton.addEventListener(
    "click",
    loadHandoffs
);


takeButton.addEventListener(
    "click",
    takeHandoff
);


sendButton.addEventListener(
    "click",
    sendReply
);


resolveButton.addEventListener(
    "click",
    resolveHandoff
);


replyInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendReply();
        }
    }
);


// ========================================
// AUTO REFRESH
// ========================================

setInterval(
    async () => {

        await loadHandoffs();


        if (
            selectedHandoffId
        ) {

            try {

                const data =
                    await api(
                        `/api/handoffs/${selectedHandoffId}`
                    );


                currentHandoff =
                    data.handoff;


                renderConversation(
                    data.handoff,
                    data.messages || []
                );

            }
            catch (error) {

                console.error(
                    error
                );
            }
        }

    },
    5000
);

let currentHandoffFilter =
    "all";

let cachedHandoffs =
    [];


const filterButtons =
    document.querySelectorAll(
        ".filter-button"
    );


filterButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                currentHandoffFilter =
                    button.dataset.filter;


                filterButtons.forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );


                button.classList.add(
                    "active"
                );


                renderFilteredHandoffs();
            }
        );
    }
);


function renderFilteredHandoffs() {

    if (
        currentHandoffFilter ===
        "all"
    ) {

        renderHandoffs(
            cachedHandoffs
        );

        return;
    }


    const filtered =
        cachedHandoffs.filter(
            handoff =>
                handoff.status ===
                currentHandoffFilter
        );


    renderHandoffs(
        filtered
    );
}

// ========================================
// DASHBOARD NAVIGATION
// ========================================

const navItems =
    document.querySelectorAll(
        ".nav-item[data-page]"
    );

const pages =
    document.querySelectorAll(
        ".page"
    );


function showPage(
    pageName
) {

    pages.forEach(
        page => {

            page.classList.remove(
                "active"
            );
        }
    );


    navItems.forEach(
        item => {

            item.classList.remove(
                "active"
            );
        }
    );


    const page =
        document.getElementById(
            `page-${pageName}`
        );


    if (page) {

        page.classList.add(
            "active"
        );
    }


    const navItem =
        document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );


    if (navItem) {

        navItem.classList.add(
            "active"
        );
    }
}


navItems.forEach(
    item => {

        item.addEventListener(
            "click",
            () => {

                showPage(
                    item.dataset.page
                );
            }
        );
    }
);
// ========================================
// INITIAL LOAD
// ========================================

loadHandoffs();

// ========================================
// LEADS
// ========================================

let cachedLeads = [];

let currentLeadFilter = "all";


// ========================================
// LOAD LEADS
// ========================================

async function loadLeads() {

    try {

        const response =
            await fetch(
                "/api/leads"
            );

        const data =
            await response.json();


        if (!data.success) {
            throw new Error(
                "Failed loading leads"
            );
        }


        cachedLeads =
            data.leads || [];


        const leadCount =
            document.getElementById(
                "leadCount"
            );

        if (leadCount) {
            leadCount.textContent =
                cachedLeads.length;
        }


        renderFilteredLeads();

    }
    catch (error) {

        console.error(
            "Failed loading leads:",
            error
        );


        const body =
            document.getElementById(
                "leadsTableBody"
            );

        if (body) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="empty-table"
                    >
                        Failed to load leads.
                    </td>
                </tr>
            `;
        }
    }
}


// ========================================
// FILTER LEADS
// ========================================

function renderFilteredLeads() {

    let leads =
        cachedLeads;


    if (
        currentLeadFilter !==
        "all"
    ) {

        leads =
            cachedLeads.filter(
                lead =>
                    lead.status ===
                    currentLeadFilter
            );
    }


    renderLeads(
        leads
    );
}


// ========================================
// RENDER LEADS
// ========================================

function renderLeads(
    leads
) {

    const body =
        document.getElementById(
            "leadsTableBody"
        );


    if (!body) {
        return;
    }


    if (
        !leads.length
    ) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="empty-table"
                >
                    No leads found.
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML =
        leads.map(
            lead => {

                const contact =
                    lead.phone ||
                    lead.email ||
                    "—";


                const source =
                    lead.source ||
                    "Unknown";


                return `
                    <tr
                        class="lead-row"
                        data-lead-id="${lead.id}"
                    >

                        <td>
                            <strong>
                                ${escapeHtml(
                                    lead.name ||
                                    "Unknown"
                                )}
                            </strong>

                            <div class="lead-id">
                                Lead #${lead.id}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(
                                contact
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                lead.summary ||
                                "—"
                            )}
                        </td>

                        <td>
                            <span class="source-badge">
                                ${escapeHtml(
                                    source
                                )}
                            </span>
                        </td>

                        <td>

                            <select
                                class="lead-status-select"
                                data-lead-id="${lead.id}"
                            >

                                ${buildLeadStatusOptions(
                                    lead.status
                                )}

                            </select>

                        </td>

                        <td>
                            ${formatLeadDate(
                                lead.created_at
                            )}
                        </td>

                    </tr>
                `;
            }
        ).join("");


    document
        .querySelectorAll(
            ".lead-row"
        )
        .forEach(
            row => {

                row.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target.closest(
                                ".lead-status-select"
                            )
                        ) {
                            return;
                        }

                        const leadId =
                            Number(
                                row.dataset.leadId
                            );

                        showLeadDetails(
                            leadId
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll(
            ".lead-status-select"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    async event => {

                        const leadId =
                            Number(
                                event.target.dataset.leadId
                            );

                        await updateLeadStatus(
                            leadId,
                            event.target.value
                        );
                    }
                );
            }
        );
}


// ========================================
// STATUS OPTIONS
// ========================================

function buildLeadStatusOptions(
    currentStatus
) {

    const statuses = [
        "new",
        "contacted",
        "converted",
        "lost"
    ];


    return statuses.map(
        status => {

            const selected =
                status === currentStatus
                    ? "selected"
                    : "";


            const label =
                status.charAt(0)
                    .toUpperCase() +
                status.slice(1);


            return `
                <option
                    value="${status}"
                    ${selected}
                >
                    ${label}
                </option>
            `;
        }
    ).join("");
}


// ========================================
// UPDATE LEAD STATUS
// ========================================

async function updateLeadStatus(
    leadId,
    status
) {

    try {

        const response =
            await fetch(
                `/api/leads/${leadId}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status
                        })
                }
            );


        const data =
            await response.json();


        if (!data.success) {
            throw new Error(
                "Failed updating lead"
            );
        }


        const lead =
            cachedLeads.find(
                item =>
                    item.id === leadId
            );


        if (lead) {
            lead.status = status;
        }


        renderFilteredLeads();

    }
    catch (error) {

        console.error(
            "Failed updating lead:",
            error
        );

        await loadLeads();
    }
}


// ========================================
// LEAD DETAILS
// ========================================

function showLeadDetails(
    leadId
) {

    const lead =
        cachedLeads.find(
            item =>
                item.id === leadId
        );


    if (!lead) {
        return;
    }


    const panel =
        document.getElementById(
            "leadDetails"
        );


    const name =
        document.getElementById(
            "leadDetailsName"
        );


    const summary =
        document.getElementById(
            "leadDetailsSummary"
        );


    const content =
        document.getElementById(
            "leadDetailsContent"
        );


    if (
        !panel ||
        !name ||
        !summary ||
        !content
    ) {
        return;
    }


    name.textContent =
        lead.name ||
        `Lead #${lead.id}`;


    summary.textContent =
        lead.summary ||
        "";


    const metadata =
        lead.metadata || {};


    content.innerHTML = `

        ${leadDetailItem(
            "Phone",
            lead.phone
        )}

        ${leadDetailItem(
            "Email",
            lead.email
        )}

        ${leadDetailItem(
            "Source",
            lead.source
        )}

        ${leadDetailItem(
            "Status",
            lead.status
        )}

        ${leadDetailItem(
            "Device",
            metadata.device
        )}

        ${leadDetailItem(
            "Service",
            metadata.service
        )}

        ${leadDetailItem(
            "Quoted Price",
            metadata.quoted_price
        )}

        ${leadDetailItem(
            "Duration",
            metadata.duration
        )}

        ${leadDetailItem(
            "Warranty",
            metadata.warranty
        )}

        ${leadDetailItem(
            "Intent",
            metadata.intent
        )}

    `;


    panel.classList.remove(
        "hidden"
    );
}


function leadDetailItem(
    label,
    value
) {

    return `
        <div class="lead-detail-item">

            <span>
                ${escapeHtml(label)}
            </span>

            <strong>
                ${escapeHtml(
                    value || "—"
                )}
            </strong>

        </div>
    `;
}


// ========================================
// CLOSE DETAILS
// ========================================

const closeLeadDetails =
    document.getElementById(
        "closeLeadDetails"
    );


if (
    closeLeadDetails
) {

    closeLeadDetails.addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "leadDetails"
                )
                ?.classList.add(
                    "hidden"
                );
        }
    );
}


// ========================================
// LEAD FILTER BUTTONS
// ========================================

document
    .querySelectorAll(
        ".lead-filter-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    currentLeadFilter =
                        button.dataset.leadFilter;


                    document
                        .querySelectorAll(
                            ".lead-filter-button"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    renderFilteredLeads();
                }
            );
        }
    );


// ========================================
// HELPERS
// ========================================

function formatLeadDate(
    date
) {

    if (!date) {
        return "—";
    }


    const parsed =
        new Date(
            date.replace(
                " ",
                "T"
            ) + "Z"
        );


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return date;
    }


    return parsed.toLocaleString();
}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// ========================================
// INITIAL LEAD LOAD
// ========================================

loadLeads();