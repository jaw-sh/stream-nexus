// ==UserScript==
// @name S.N.E.E.D. (Rumble)
// @version 1.0.0
// @description Stream Nexus userscript for Rumble chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://rumble.com/v*.html
// @include https://rumble.com/chat/popup/*
// @connect *
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_listValues
// @grant GM_addValueChangeListener
// @grant GM_openInTab
// @grant GM_xmlhttpRequest
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.deleteValue
// @grant GM.listValues
// @grant GM.openInTab
// @grant GM.xmlHttpRequest
// @run-at document-start
// ==/UserScript==

(function () {
    'use strict';

    //
    // Socket Logic
    //
    let CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
        }
    };

    // Connection opened
    CHAT_SOCKET.addEventListener("open", (event) => {
        console.log("[SNEED] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    CHAT_SOCKET.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 3000);
    });

    CHAT_SOCKET.addEventListener("error", (event) => {
        console.log("[SNEED] Socket has errored. Closing.", event.reason);
        alert("The SNEED chat socket could not connect. Ensure the web server is running and that Brave shields are off.");
        socket.close();
    });

    //
    // Chat Messages
    //
    let MESSAGE_QUEUE = [];

    const CREATE_MESSAGE = () => {
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

    const BIND_MUTATION_OBSERVER = () => {
        const targetNode = GET_CHAT_CONTAINER();

        if (targetNode === null) {
            return false;
        }

        if (document.querySelector(".sneed-chat-container") !== null) {
            console.log("[SNEED] Chat container already bound, aborting.");
            return false;
        }

        targetNode.classList.add("sneed-chat-container");

        const observer = new MutationObserver(MUTATION_OBSERVE);
        observer.observe(targetNode, {
            childList: true,
            attributes: false,
            subtree: false
        });

        GET_EXISTING_MESSAGES();
        return true;
    };

    const MUTATION_OBSERVE = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                const messages = HANDLE_MESSAGES(mutation.addedNodes);
                if (messages.length > 0) {
                    SEND_MESSAGES(messages);
                }
            }
        }
    };

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (CHAT_SOCKET.readyState === WebSocket.OPEN) {
            CHAT_SOCKET.send(JSON.stringify(messages));
        }
        else {
            // add to queue if not
            messages.forEach((message) => {
                MESSAGE_QUEUE.push(messages);
            });
        }
    };

    setInterval(function () {
        if (document.querySelector(".sneed-chat-container") === null) {
            console.log("[SNEED] Binding chat container.")
            BIND_MUTATION_OBSERVER();
        }
    }, 1000);


    //
    // Specific Implementations
    //

    const GET_CHAT_CONTAINER = () => {
        return document.getElementById("chat-history-list");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .chat-history--row");

        if (nodes.length > 0) {
            const messages = HANDLE_MESSAGES(nodes);
            if (messages.length > 0) {
                SEND_MESSAGES(messages);
            }
        }
    };

    const HANDLE_MESSAGES = (nodes) => {
        const messages = [];

        nodes.forEach((node) => {
            let message = CREATE_MESSAGE();
            message.platform = "Rumble";

            const avatarEl = node.querySelector("img.chat-history--user-avatar");
            const picEl = node.querySelector(".chat--profile-pic");
            if (avatarEl !== null && avatarEl.src !== "") {
                console.log("Avatar", avatarEl.src);
                message.avatar = avatarEl.src;
            }
            else if (picEl !== null && picEl.style.backgroundImage !== "") {
                message.avatar = picEl.style.backgroundImage.replace('url("', "").replace('")', "");
                console.log("Profile Pic", picEl.style.backgroundImage);
            }


            if (node.classList.contains("chat-history--rant")) {
                message.username = node.querySelector(".chat-history--rant-username").innerText;
                message.message = node.querySelector(".chat-history--rant-text").innerHTML;
                message.is_premium = true;
                message.amount = parseFloat(node.querySelector(".chat-history--rant-price").innerText.replace("$", ""));
                message.currency = "USD"; // Rumble rants are always USD.
                console.log("Superchat", message);
            }
            else {
                message.username = node.querySelector(".chat-history--username").innerText;
                message.message = node.querySelector(".chat-history--message").innerHTML;
            }

            node.querySelectorAll(".chat-history--user-badge").forEach((badge) => {
                if (badge.src.includes("moderator")) {
                    message.is_mod = true;
                }
                else if (badge.src.includes("locals") || badge.src.includes("whale")) {
                    message.is_sub = true;
                }
                else if (badge.src.includes("admin")) {
                    // misnomer: this is the streamer.
                    message.is_owner = true;
                }
                // Rumble staff badge unknown.
            });

            console.log(message);
            messages.push(message);
        });

        return messages;
    };
})();

// <li class="chat-history--row" data-message-user-id="u64 goes here" data-message-id="u64 goes here">
// <img class="chat-history--user-avatar" src="https://sp.rmbl.ws/many/sub/dir/xxx.jpeg">
// <div class="chat-history--message-wrapper">
//   <div class="chat-history--username">
//     <a target="_blank" href="/user/username" style="color: #e1637f">UserName</a>
//   </div>
//   <div class="chat-history--badges-wrapper">
//     <img class="chat-history--user-badge" src="/i/badges/moderator_48.png" alt="Moderator" title="Moderator"></img>
//     <a href="/account/publisher-packages"><img class="chat-history--user-badge" src="/i/badges/premium_48.png" alt="Rumble Premium User" title="Rumble Premium User"></a>
//     <img class="chat-history--user-badge" src="/i/badges/locals_48.png" alt="Sub" title="Sub">
//     <img class="chat-history--user-badge" src="/i/badges/whale_yellow_48.png" alt="Supporter+" title="Supporter+">
//     <img class="chat-history--user-badge" src="/i/badges/admin_48.png" alt="Admin" title="Admin">
//   </div>
//   <div class="chat-history--message">USER CHAT MESSAGE</div>
// </div>
// </li>

// <li class="chat-history--row chat-history--rant" data-message-user-id="x" data-message-id="x">
// <div class="chat-history--rant" data-level="2">
//   <div class="chat-history--rant-head">
//     <div class="chat--profile-pic" style="margin-right: 1rem; background-image: url(&quot;https://sp.rmbl.ws/xxx&quot;);" data-large=""></div>
//       <div style="display: flex; flex-wrap: wrap; align-items: flex-end">
//         <a class="chat-history--rant-username" target="_blank" href="/user/xxx">xxx</a>
//         <div class="chat-history--badges-wrapper"><img class="chat-history--user-badge" src="/i/badges/whale_yellow_48.png" alt="Supporter+" title="Supporter+"></div>
//         <div class="chat-history--rant-price" style="width: 100%;">$2</div>
//       </div>
//     </div>
//     <div class="chat-history--rant-text">xxx</div>
//   </div>
// </div>
// </li>


// <li class="chat-history--row chat-history--rant" data-message-user-id="88707682" data-message-id="1182290124941408978"><div class="chat-history--rant" data-level="2">
// <div class="chat-history--rant-head">
// <div class="chat--profile-pic" style="margin-right: 1rem; background-image: url(&quot;https://sp.rmbl.ws/z0/I/j/z/s/Ijzsf.asF-1gtbaa-rpmd6x.jpeg&quot;);" data-large=""></div>
// <div style="display: flex; flex-wrap: wrap; align-items: flex-end">
// <a class="chat-history--rant-username" target="_blank" href="/user/madattheinternet">madattheinternet</a>
// <div class="chat-history--badges-wrapper"><img class="chat-history--user-badge" src="/i/badges/admin_48.png" alt="Admin" title="Admin"><a href="/account/publisher-packages"><img class="chat-history--user-badge" src="/i/badges/premium_48.png" alt="Rumble Premium User" title="Rumble Premium User"></a><img class="chat-history--user-badge" src="/i/badges/whale_gray_48.png" alt="Supporter" title="Supporter"></div>
// <div class="chat-history--rant-price" style="width: 100%;">$2</div>
// </div>
// </div>
// <div class="chat-history--rant-text">Testing superchats.</div>
// </div></li>