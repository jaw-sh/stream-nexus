// ==UserScript==
// @name S.N.E.E.D. (Twitch)
// @version 1.0.0
// @description Stream Nexus userscript for Twitch live chat.
// @license BSD-3-Clause
// @author y a t s <140337963+y-a-t-s@users.noreply.github.com>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://www.twitch.tv/*
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
        return document.querySelector(".chat-list--default .chat-scrollable-area__message-container");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .chat-line__message");

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
            message.platform = "Twitch";
            const user = node.querySelector(".chat-line__username > span");
            const name = node.querySelector(".chat-author__display-name");

            node.querySelectorAll("[data-a-target='chat-badge']").forEach((badge) => {
                const img = badge.querySelector("img");

                const label = img.getAttribute("alt");
                switch (label) {
                    case "Admin":
                        message.is_staff = true;
                        break;
                    case "Broadcaster":
                        message.is_owner = true;
                        break;
                    case "Moderator":
                        message.is_mod = true;
                        break;
                    case "Prime Gaming":
                        // Sub tiers necessitate this ugly hack. A better way probably exists.
                    case /Subscriber/.test(label) && label:
                        message.is_sub = true;
                        break;
                    case "Verified":
                        message.is_verified = true;
                        break;
                    default:
                        img.removeAttribute("srcset");
                        user.insertBefore(img, name);
                        break;
                }
            });

            name.replaceWith(name.innerHTML);
            message.username = user.innerHTML;

            const msg_body = node.querySelector("[data-a-target='chat-line-message-body']");
            msg_body.querySelectorAll(".mention-fragment, .text-fragment").forEach((txt) => txt.replaceWith(txt.textContent));
            msg_body.querySelectorAll("[data-test-selector='emote-button']").forEach((emote) => {
                const img = emote.querySelector(".chat-image");
                img.removeAttribute("srcset");
                emote.replaceWith(img);
            });

            message.message = msg_body.innerHTML;

            if (node.classList.contains("channel-points-reward-line__icon")) {
                message.is_premium = true;

                message.currency = node.querySelector(".channel-points-icon__image").getAttribute("alt");
                message.amount = node.querySelector(".user-notice-line div:first-child").textContent;
            }

            messages.push(message);
        });

        return messages;
    };
})();

// <div class="Layout-sc-1xcs6mc-0 bZVrjx chat-line__message-container">
//         <div class="Layout-sc-1xcs6mc-0">
//                 <div class="Layout-sc-1xcs6mc-0 cZxfJz chat-line__no-background">
//                         <div class="Layout-sc-1xcs6mc-0 dyQMib chat-line__username-container">
//                                 <span>
//                                         <div class="InjectLayout-sc-1i43xsx-0 hDgGYp">
//                                                 <button data-a-target="chat-badge">
//                                                         <img alt="71-Month Subscriber (5.5-Year Badge)" aria-label="71-Month Subscriber (5.5-Year Badge) badge" class="chat-badge" src="https://static-cdn.jtvnw.net/badges/v1/e08b3e2f-01ff-4018-a8d7-e9ec3d6d8f5b/1" srcset="https://static-cdn.jtvnw.net/badges/v1/e08b3e2f-01ff-4018-a8d7-e9ec3d6d8f5b/1 1x, https://static-cdn.jtvnw.net/badges/v1/e08b3e2f-01ff-4018-a8d7-e9ec3d6d8f5b/2 2x, https://static-cdn.jtvnw.net/badges/v1/e08b3e2f-01ff-4018-a8d7-e9ec3d6d8f5b/3 4x">
//                                                 </button>
//                                         </div>
//                                         <div class="InjectLayout-sc-1i43xsx-0 hDgGYp">
//                                                 <button data-a-target="chat-badge">
//                                                         <img alt="cheer 75K" aria-label="cheer 75K badge" class="chat-badge" src="https://static-cdn.jtvnw.net/badges/v1/2b7364ef-a997-4dc4-939f-dd876d115e89/1" srcset="https://static-cdn.jtvnw.net/badges/v1/2b7364ef-a997-4dc4-939f-dd876d115e89/1 1x, https://static-cdn.jtvnw.net/badges/v1/2b7364ef-a997-4dc4-939f-dd876d115e89/2 2x, https://static-cdn.jtvnw.net/badges/v1/2b7364ef-a997-4dc4-939f-dd876d115e89/3 4x">
//                                                 </button>
//                                         </div>
//                                 </span>
//                                 <span class="chat-line__username" role="button" tabindex="0">
//                                         <span>
//                                                 <span class="chat-author__display-name" data-a-target="chat-message-username" data-a-user="eointmaher" data-test-selector="message-username" style="color: rgb(180, 84, 255);">EoinTMaher</span>
//                                         </span>
//                                 </span>
//                         </div>
//                         <span aria-hidden="true">:</span>
//                         <span class="" data-a-target="chat-line-message-body">
//                                 <span class="text-fragment" data-a-target="chat-message-text">how offensive was his food pic ? it might be ok to just un-editor him</span>
//                         </span>
//                 </div>
//         </div>
// </div>
// <div class="Layout-sc-1xcs6mc-0 vNVsi chat-line__icons">
//         <div class="Layout-sc-1xcs6mc-0 gFnnYr chat-line__reply-icon">
//                 <div class="InjectLayout-sc-1i43xsx-0 dVOhMf">
//                         <button class="ScCoreButton-sc-ocjdkq-0 ibtYyW ScButtonIcon-sc-9yap0r-0 iqxxop InjectLayout-sc-1i43xsx-0" aria-label="Click to reply">
//                                 <div class="ButtonIconFigure-sc-1emm8lf-0 kgdotM">
//                                         <div class="ScIconLayout-sc-1q25cff-0 cMWGQu">
//                                                 <div class="ScAspectRatio-sc-18km980-1 hTTohL tw-aspect">
//                                                         <svg width="100%" height="100%" version="1.1" viewBox="0 0 20 20" x="0px" y="0px" aria-hidden="true" focusable="false" class="ScIconSVG-sc-1q25cff-1 dSicFr">
//                                                                 <path d="M8.5 5.5L7 4L2 9L7 14L8.5 12.5L6 10H10C12.2091 10 14 11.7909 14 14V16H16V14C16 10.6863 13.3137 8 10 8H6L8.5 5.5Z"></path>
//                                                         </svg>
//                                                 </div>
//                                         </div>
//                                 </div>
//                         </button>
//                 </div>
//         </div>
// </div>
