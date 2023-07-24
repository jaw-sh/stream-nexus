// Ensure this matches the Rust object in feed/mod.rs
window.SNEED_GET_MESSAGE_DUMMY = () => {
    return {
        id: crypto.randomUUID(),
        platform: "IDK",
        username: "DUMMY_USER",
        message: "",
        sent_at: Date.now(), // System timestamp for display ordering.
        received_at: Date.now(), // Local timestamp for management.
        avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
        is_premium: false,
        amount: 0,
        currency: "ZWL",
        is_verified: false,
        is_sub: false,
        is_mod: false,
        is_owner: false,
        is_staff: false,
    };
};

window.SNEED_ADD_MESSAGES = (new_message) => {
    let messages = JSON.parse(window.localStorage['SNEED_CHAT_MESSAGES']);
    if (Array.isArray(messages) === false) {
        messages = [];
    }

    console.log("Received " + new_message.length + " messages.");

    // Join new messages.
    messages = messages.concat(new_message);
    console.log("Now has " + messages.length + " messages.");

    // Go through messages and remove messages older than Rust-set timestamp
    const timestamp = parseInt(window.localStorage['SNEED_MESSAGES_READ_AT'], 10);
    messages = messages.filter((message) => message.received_at > timestamp);

    console.log("Filtered to " + messages.length + " messages.");

    window.localStorage['SNEED_MESSAGES_LAST_SET'] = Math.max(...messages.map(m => m.sent_at));
    window.localStorage['SNEED_CHAT_MESSAGES'] = JSON.stringify(messages);
};

window.SNEED_CHAT_BIND = () => {
    const targetNode = window.SNEED_GET_CHAT_CONTAINER();
    if (targetNode === null) {
        console.log("Could not find chat container, retrying in 1 second...");
        setTimeout(window.SNEED_CHAT_BIND, 1000);
        return false;
    }
    if (document.querySelector(".sneed-chat-container") !== null) {
        console.log("Chat container already bound, aborting.");
        return false;
    }

    targetNode.classList.add("sneed-chat-container");

    const config = {
        childList: true,
        attributes: false,
        subtree: false
    };
    const callback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                const messages = window.SNEED_OBSERVE_MUTATIONS(mutation);
                if (messages.length > 0) {
                    window.SNEED_ADD_MESSAGES(messages);
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    window.SNEED_SCRAPE_EXISTING_MESSAGES();
    return true;
};

window.SNEED_OBSERVE_MUTATIONS = (mutation) => {
    return window.SNEED_RECEIVE_MESSAGE_NODES(mutation.addedNodes);
};

(function () {
    window.localStorage['SNEED_CHAT_MESSAGES'] = "[]";
    window.localStorage['SNEED_MESSAGES_READ_AT'] = Date.now();
    window.localStorage['SNEED_MESSAGES_LAST_SET'] = Date.now();
    window.SNEED_CHAT_BIND();
})(); // IIFE for first time binding.

// YT thinks it's funny to delete the chat container randomly.
setInterval(function () {
    if (document.querySelector(".sneed-chat-container") === null) {
        // You _WILL_ sneed and you _WILL_ be happy.
        console.log("Rebinding chat container...")
        window.SNEED_CHAT_BIND();
    }
}, 1000);
