// ==UserScript==
// @name S.N.E.E.D. (Odysee)
// @version 1.0.0
// @description Stream Nexus userscript for Odysee chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://odysee.com/*
// @exclude https://odysee.com/$/*
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
        return document.querySelector(".livestream__comments");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .livestream__comment");
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
            const message = CREATE_MESSAGE();
            message.platform = "Odysee";
            message.sent_at = Date.parse(node.querySelector(".date_time").getAttribute("title"));

            // in strange conditions this can be null, I do not know why.
            const avatar = node.querySelector(".channel-thumbnail__custom, .freezeframe-img")?.getAttribute("src");
            if (typeof avatar === "string") {
                message.avatar = node.querySelector(".channel-thumbnail__custom, .freezeframe-img")?.getAttribute("src");
            }
            message.username = node.querySelector(".comment__author").innerText;
            message.message = node.querySelector(".livestream-comment__text").innerText;

            if (node.classList.contains("livestream__comment--hyperchat")) {
                message.is_premium = true;

                const amount = node.querySelector(".credit-amount").innerText;
                message.currency = amount.includes("$") ? "USD" : "$LBRY"; // Odysee hyperchats are either USD or $LBRY
                message.amount = parseFloat(amount.replace("$", ""));
            }

            if (node.querySelector(".icon--BadgeMod")) {
                message.is_mod = true;
            }
            if (node.querySelector(".icon--BadgeStreamer")) {
                message.is_owner = true;
            }

            messages.push(message);
        });

        return messages;
    };
})();
// <li class="livestream__comment">
//    <div class="livestream-comment__body">
//       <div class="channel-thumbnail channel-thumbnail__default--3 channel-thumbnail--xsmall"><img class="channel-thumbnail__custom" loading="lazy" src="https://thumbnails.odycdn.com/optimize/s:160:160/quality:85/plain/https://spee.ch/spaceman-png:2.png" style="visibility: visible;"></div>
//       <div class="livestream-comment__info">
//          <div class="livestream-comment__meta-information">
//             <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6430" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--6430">Schmuck</button>
//             <a class="button button--no-style" href="/$/premium">
//                <span class="button__content">
//                   <span class="comment__badge" aria-label="Premium+">
//                      <svg size="40" class="icon icon--PremiumPlus" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 30" width="40" height="40" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>
//                   </span>
//                </span>
//             </a>
//             <span class="date_time" title="July 20, 2023 08:32 PM">1 minute ago</span>
//          </div>
//          <div class="livestream-comment__text">
//             <div dir="auto" class="notranslate markdown-preview">
//                <p><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6431" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--6431">@François_Le_Châtain</button> Sounds much like the movie GARP</p>
//             </div>
//          </div>
//       </div>
//    </div>
//    <div class="livestream-comment__menu">
//       <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6432" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--6432">
//          <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
//       </button>
//    </div>
// </li>
// 
// <li class="livestream__comment livestream__comment--hyperchat">
//    <div class="livestream-comment__hyperchat-banner">
//       <span title="0.05" class="credit-amount-wrapper hyperChat">
//          <span class="credit-amount">
//             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="black" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" class="icon icon--LBC icon__lbc icon__lbc--after-text" aria-hidden="true"></svg>
//             0.05
//          </span>
//       </span>
//    </div>
//    <div class="livestream-comment__body">
//       <div class="channel-thumbnail channel-thumbnail__default--2 channel-thumbnail--xsmall"><img class="channel-thumbnail__custom" loading="lazy" src="https://thumbnails.odycdn.com/optimize/s:160:160/quality:85/plain/https://spee.ch/spaceman-png:2.png" style="visibility: visible;"></div>
//       <div class="livestream-comment__info">
//          <div class="livestream-comment__meta-information"><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--8" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--8">Chief-Kickabitch-of-the-Slapaho-Nation</button><span class="date_time" title="July 20, 2023 08:31 PM">2 minutes ago</span></div>
//          <div class="livestream-comment__text">
//             <div dir="auto" class="notranslate markdown-preview">
//                <p>Undisputed by Democrats that Trump go 75 million votes (he got more)  Total number of registered voters, 133 million.  133 - 75 = 58.  That assumes that 100% of all registered voters cast ballots which has never happened.  Only possible conclusion is that Trump won.</p>
//             </div>
//          </div>
//       </div>
//    </div>
//    <div class="livestream-comment__menu">
//       <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--9" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--9">
//          <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
//       </button>
//    </div>
// </li>